import { addYears, parseISO, isAfter, format } from "date-fns";
import { prisma } from "../../prisma";
import type { TenantRequest } from "../../middleware/tenant";

export interface RenewalInfo {
  id: number;
  name: string;
  hireDate: string;
  hireDateFormatted: string;
  renewalDate: string;
  renewalDateFormatted: string;
  daysUntil: number;
  status: string;
}

function getNextRenewalDate(hireDate: Date): Date {
  let renewal = addYears(hireDate, 1);
  const now = new Date();
  while (!isAfter(renewal, now)) {
    renewal = addYears(renewal, 1);
  }
  return renewal;
}

function getDaysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export class RenewalsService {
  async getAll(req: TenantRequest): Promise<RenewalInfo[]> {
    const employees = await prisma.employee.findMany({
      where: req.tenantId ? { tenantId: req.tenantId } : {},
      orderBy: { hireDate: "asc" },
    });

    return employees.map((emp) => {
      const renewalDate = getNextRenewalDate(emp.hireDate);
      const daysUntil = getDaysUntil(renewalDate);
      return {
        id: emp.id,
        name: emp.name,
        hireDate: emp.hireDate.toISOString(),
        hireDateFormatted: emp.hireDate.toLocaleDateString("ar-SA"),
        renewalDate: renewalDate.toISOString().split("T")[0],
        renewalDateFormatted: renewalDate.toLocaleDateString("ar-SA"),
        daysUntil,
        status: daysUntil <= 30 ? "عاجل" : daysUntil <= 90 ? "قريب" : "بعيد",
      };
    });
  }

  async getUpcoming(reminderDays: number, req: TenantRequest) {
    const employees = await prisma.employee.findMany({
      where: req.tenantId ? { tenantId: req.tenantId } : {},
    });

    return employees
      .map((emp) => {
        const renewalDate = getNextRenewalDate(emp.hireDate);
        const daysUntil = getDaysUntil(renewalDate);
        return {
          name: emp.name,
          hireDate: emp.hireDate.toISOString().split("T")[0],
          renewalDate: renewalDate.toISOString().split("T")[0],
          daysUntil,
        };
      })
      .filter((r) => r.daysUntil <= reminderDays);
  }

  async getMonthlyBreakdown(req: TenantRequest) {
    const monthNames = [
      "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
      "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
    ];

    const employees = await prisma.employee.findMany({
      where: req.tenantId ? { tenantId: req.tenantId } : {},
    });

    const renewalsByMonth: Record<string, typeof employees> = {};
    for (const m of monthNames) renewalsByMonth[m] = [];

    for (const emp of employees) {
      const renewalDate = getNextRenewalDate(emp.hireDate);
      const monthIndex = renewalDate.getMonth();
      renewalsByMonth[monthNames[monthIndex]].push(emp);
    }

    const year = new Date().getFullYear();
    let total = 0;
    const months = monthNames.map((name) => {
      total += renewalsByMonth[name].length;
      return {
        name,
        count: renewalsByMonth[name].length,
        renewals: renewalsByMonth[name].map((emp) => ({
          name: emp.name,
          hireDate: emp.hireDate.toISOString().split("T")[0],
          renewalDate: getNextRenewalDate(emp.hireDate).toISOString().split("T")[0],
          daysUntil: getDaysUntil(getNextRenewalDate(emp.hireDate)),
        })),
      };
    });

    return { year, months, total };
  }
}

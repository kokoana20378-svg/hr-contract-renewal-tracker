import { prisma } from "../prisma";
import { RenewalsService } from "../modules/renewals/renewals.service";
import { sendEmail } from "../email/email.service";

const renewalsService = new RenewalsService();

export async function runMonthlyReport() {
  console.log("Running monthly renewal report...");

  const monthNames = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ];

  const tenants = await prisma.tenant.findMany();

  for (const tenant of tenants) {
    try {
      const reminderEmail = await getSetting("reminder_email", "", tenant.id);
      if (!reminderEmail) continue;

      const data = await renewalsService.getMonthlyBreakdown({
        tenantId: tenant.id,
      } as any);

      let html = `<div dir="rtl" style="font-family:Arial,sans-serif;padding:20px;">`;
      html += `<h1 style="color:#1e40af;">تقرير تجديد عقود الموظفين - ${data.year}</h1>`;
      html += `<p style="color:#666;">التاريخ: ${new Date().toLocaleDateString("ar-SA")}</p>`;
      html += `<hr style="margin:20px 0;" />`;

      for (const month of data.months) {
        html += `<div style="margin-bottom:20px;">`;
        html += `<h2 style="color:#ea580c;border-bottom:2px solid #ea580c;padding-bottom:5px;">
          ${month.name} (${month.count} تجديد)
        </h2>`;

        if (month.count === 0) {
          html += `<p style="color:#999;">لا توجد تجديدات هذا الشهر</p>`;
        } else {
          html += `<table style="width:100%;border-collapse:collapse;margin-top:10px;">`;
          html += `<tr style="background:#f3f4f6;">
            <th style="padding:8px;border:1px solid #ddd;">الموظف</th>
            <th style="padding:8px;border:1px solid #ddd;">تاريخ التعيين</th>
            <th style="padding:8px;border:1px solid #ddd;">تاريخ التجديد</th>
            <th style="padding:8px;border:1px solid #ddd;">الأيام المتبقية</th>
          </tr>`;
          for (const r of month.renewals) {
            const color =
              r.daysUntil <= 30
                ? "#dc2626"
                : r.daysUntil <= 90
                  ? "#d97706"
                  : "#16a34a";
            html += `<tr>
              <td style="padding:8px;border:1px solid #ddd;">${r.name}</td>
              <td style="padding:8px;border:1px solid #ddd;">${r.hireDate}</td>
              <td style="padding:8px;border:1px solid #ddd;">${r.renewalDate}</td>
              <td style="padding:8px;border:1px solid #ddd;color:${color};font-weight:bold;">${r.daysUntil} يوم</td>
            </tr>`;
          }
          html += `</table>`;
        }
        html += `</div>`;
      }

      html += `<hr style="margin:20px 0;" />`;
      html += `<p><strong>إجمالي التجديدات: ${data.total} موظف</strong></p>`;
      html += `</div>`;

      await sendEmail(
        reminderEmail,
        `التقرير الشهري: تجديد عقود الموظفين - ${data.year}`,
        html,
      );
    } catch (error) {
      console.error(
        `Error in monthly report for tenant ${tenant.id}:`,
        error,
      );
    }
  }
}

async function getSetting(
  key: string,
  defaultValue: string,
  tenantId?: string,
): Promise<string> {
  const where: Record<string, unknown> = { key };
  if (tenantId) where.tenantId = tenantId;

  const row = await prisma.setting.findFirst({ where });
  return row?.value ?? defaultValue;
}

import { prisma } from "../prisma";
import { RenewalsService } from "../modules/renewals/renewals.service";
import { sendEmail, buildRenewalTableHtml } from "../email/email.service";

const renewalsService = new RenewalsService();

export async function runDailyReminder() {
  console.log("Running daily renewal check...");

  const tenants = await prisma.tenant.findMany();

  for (const tenant of tenants) {
    try {
      const reminderDays = await getSetting("reminder_days", "30", tenant.id);
      const reminderEmail = await getSetting("reminder_email", "", tenant.id);

      if (!reminderEmail) continue;

      const upcoming = await renewalsService.getUpcoming(
        parseInt(reminderDays, 10),
        { tenantId: tenant.id } as any,
      );

      if (upcoming.length > 0) {
        const html = buildRenewalTableHtml(upcoming);
        await sendEmail(
          reminderEmail,
          `تذكير: ${upcoming.length} موظف يقترب تجديد عقدهم`,
          html,
        );
      }
    } catch (error) {
      console.error(`Error in daily reminder for tenant ${tenant.id}:`, error);
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

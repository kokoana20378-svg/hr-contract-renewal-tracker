import nodemailer from "nodemailer";
import { config } from "../config";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!config.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return transporter;
}

export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    console.warn("SMTP not configured, skipping email");
    return false;
  }
  try {
    await t.sendMail({ from: config.smtp.from, to, subject, html: htmlBody });
    console.log(`Email sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error("Email send failed:", error);
    return false;
  }
}

export function buildRenewalTableHtml(
  renewals: { name: string; renewalDate: string; daysUntil: number }[],
): string {
  const rows = renewals
    .map(
      (r) =>
        `<tr>
          <td style="padding:8px;border:1px solid #ddd;">${r.name}</td>
          <td style="padding:8px;border:1px solid #ddd;">${r.renewalDate}</td>
          <td style="padding:8px;border:1px solid #ddd;color:${r.daysUntil <= 30 ? "#dc2626" : "#d97706"};font-weight:bold;">
            ${r.daysUntil} يوم
          </td>
        </tr>`,
    )
    .join("");

  return `
    <div dir="rtl" style="font-family:Arial,sans-serif;padding:20px;">
      <h2 style="color:#ea580c;">تذكير بتجديد عقود الموظفين</h2>
      <table style="border-collapse:collapse;width:100%;margin-top:10px;">
        <tr style="background:#f3f4f6;">
          <th style="padding:8px;border:1px solid #ddd;">الموظف</th>
          <th style="padding:8px;border:1px solid #ddd;">تاريخ التجديد</th>
          <th style="padding:8px;border:1px solid #ddd;">الأيام المتبقية</th>
        </tr>
        ${rows}
      </table>
    </div>`;
}

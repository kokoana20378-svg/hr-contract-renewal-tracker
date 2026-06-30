import express from "express";
import cors from "cors";
import helmet from "helmet";
import cron from "node-cron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { config } from "./config";
import { connectDatabase, disconnectDatabase } from "./prisma";
import { connectRedis, disconnectRedis } from "./redis";
import { tenantMiddleware } from "./middleware/tenant";
import { apiLimiter } from "./middleware/rateLimiter";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { runDailyReminder } from "./cron/dailyReminder";
import { runMonthlyReport } from "./cron/monthlyReport";

import healthRoutes from "./health";
import employeeRoutes from "./modules/employees/employees.controller";
import settingsRoutes from "./modules/settings/settings.controller";
import renewalsRoutes from "./modules/renewals/renewals.controller";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.cors.origin }));
app.use(express.json({ limit: "50mb" }));

// Tenant middleware
app.use(tenantMiddleware);

// Rate limiting
app.use("/api/", apiLimiter);

// Health check (no rate limit)
app.use("/api", healthRoutes);

// API Routes
app.use("/api/employees", employeeRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/renewals", renewalsRoutes);

// Send monthly report endpoint
app.post("/api/send-monthly-report", async (_req, res, next) => {
  try {
    const { sendEmail } = await import("./email/email.service");
    const { prisma } = await import("./prisma");
    const { RenewalsService } = await import("./modules/renewals/renewals.service");

    const renewalsService = new RenewalsService();
    const reminderEmail = "";
    const settings = await prisma.setting.findFirst({
      where: { key: "reminder_email" },
    });

    if (!settings?.value) {
      res.status(400).json({ error: "يرجى تحديد إيميل التذكير في الإعدادات" });
      return;
    }

    const data = await renewalsService.getMonthlyBreakdown({} as any);

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
          const color = r.daysUntil <= 30 ? "#dc2626" : r.daysUntil <= 90 ? "#d97706" : "#16a34a";
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

    await sendEmail(settings.value, `التقرير الشهري: تجديد عقود الموظفين - ${data.year}`, html);
    res.json({ success: true, message: `تم إرسال التقرير لـ ${settings.value}` });
  } catch (error) {
    next(error);
  }
});

// Serve frontend in production
if (!config.isDev) {
  const distPath = path.join(__dirname, "..", "..", "frontend", "dist");
  const distIndex = path.join(distPath, "index.html");

  if (fs.existsSync(distIndex)) {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(distIndex);
    });
  }
}

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  await disconnectDatabase();
  await disconnectRedis();
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start server
async function start() {
  await connectDatabase();
  await connectRedis();

  // Schedule cron jobs
  cron.schedule("0 9 * * *", () => {
    runDailyReminder().catch(console.error);
  });

  cron.schedule("0 9 1 * *", () => {
    runMonthlyReport().catch(console.error);
  });

  app.listen(config.port, "0.0.0.0", () => {
    console.log(`\n🚀 HR Contract Tracker API`);
    console.log(`📡 Port: ${config.port}`);
    console.log(`🌍 Environment: ${config.nodeEnv}`);
    console.log(`📦 Database: PostgreSQL`);
    console.log(`⚡ Redis: ${config.redis.enabled ? "enabled" : "disabled"}`);
    console.log(`🏢 Multi-Tenant: ${config.tenant.enabled ? "enabled" : "disabled"}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

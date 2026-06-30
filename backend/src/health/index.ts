import { Router } from "express";
import { prisma } from "../prisma";
import { redis } from "../redis";

const router = Router();

router.get("/health", async (_req, res) => {
  const checks: Record<string, string> = {};

  checks.server = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  if (redis) {
    try {
      await redis.ping();
      checks.redis = "ok";
    } catch {
      checks.redis = "error";
    }
  } else {
    checks.redis = "disabled";
  }

  const allOk = Object.values(checks).every((v) => v === "ok" || v === "disabled");
  res.status(allOk ? 200 : 503).json({
    status: allOk ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
  });
});

export default router;

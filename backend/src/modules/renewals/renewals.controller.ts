import { Router } from "express";
import type { Response, NextFunction } from "express";
import type { TenantRequest } from "../../middleware/tenant";
import { RenewalsService } from "./renewals.service";

const router = Router();
const service = new RenewalsService();

router.get("/", async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    const renewals = await service.getAll(req);
    res.json(renewals);
  } catch (err) {
    next(err);
  }
});

router.get("/upcoming", async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    const reminderDays = parseInt((req.query.days as string) || "30", 10);
    const renewals = await service.getUpcoming(reminderDays, req);
    res.json(renewals);
  } catch (err) {
    next(err);
  }
});

router.get("/monthly", async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    const data = await service.getMonthlyBreakdown(req);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;

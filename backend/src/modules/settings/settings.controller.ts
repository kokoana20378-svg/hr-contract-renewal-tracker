import { Router } from "express";
import type { Response, NextFunction } from "express";
import type { TenantRequest } from "../../middleware/tenant";
import { SettingsService } from "./settings.service";
import { AppError } from "../../middleware/errorHandler";

const router = Router();
const service = new SettingsService();

router.get("/", async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await service.getAll(req);
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

router.put("/", async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) throw new AppError(400, "key and value are required");
    await service.set(key, String(value), req);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;

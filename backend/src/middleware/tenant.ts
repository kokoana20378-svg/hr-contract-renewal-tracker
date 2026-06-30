import type { Request, Response, NextFunction } from "express";
import { config } from "../config";

export interface TenantRequest extends Request {
  tenantId?: string;
  userId?: string;
}

export function tenantMiddleware(
  req: TenantRequest,
  _res: Response,
  next: NextFunction,
) {
  if (config.tenant.enabled) {
    req.tenantId =
      (req.headers["x-tenant-id"] as string) ||
      (req.headers["x-tenant-slug"] as string);
  }
  next();
}

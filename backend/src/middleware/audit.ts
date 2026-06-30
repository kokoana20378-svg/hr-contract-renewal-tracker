import type { Response, NextFunction } from "express";
import type { TenantRequest } from "./tenant";
import { prisma } from "../prisma";

export function auditLog(action: string, entity: string) {
  return async (req: TenantRequest, _res: Response, next: NextFunction) => {
    const originalSend = _res.json.bind(_res);
    _res.json = function (body: unknown) {
      prisma.auditLog.create({
        data: {
          action,
          entity,
          entityId: req.params?.id || req.body?.id?.toString(),
          userId: req.userId,
          tenantId: req.tenantId,
          metadata: { method: req.method, path: req.path },
          ip: req.ip,
        },
      }).catch(() => {});
      return originalSend(body);
    };
    next();
  };
}

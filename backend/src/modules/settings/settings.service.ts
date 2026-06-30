import { prisma } from "../../prisma";
import type { TenantRequest } from "../../middleware/tenant";

export class SettingsService {
  async getAll(req: TenantRequest) {
    const where: Record<string, unknown> = {};
    if (req.tenantId) where.tenantId = req.tenantId;

    const rows = await prisma.setting.findMany({ where });
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return settings;
  }

  async set(key: string, value: string, req: TenantRequest) {
    return prisma.setting.upsert({
      where: { key },
      create: { key, value, tenantId: req.tenantId },
      update: { value },
    });
  }

  async get(key: string, defaultValue = ""): Promise<string> {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value ?? defaultValue;
  }
}

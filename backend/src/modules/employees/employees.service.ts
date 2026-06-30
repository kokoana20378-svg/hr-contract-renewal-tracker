import { prisma } from "../../prisma";
import type { TenantRequest } from "../../middleware/tenant";

interface CreateEmployeeInput {
  name: string;
  hireDate: string;
}

interface BulkCreateInput {
  employees: { name: string; hireDate: string }[];
}

export class EmployeesService {
  async findAll(req: TenantRequest) {
    return prisma.employee.findMany({
      where: req.tenantId ? { tenantId: req.tenantId } : {},
      orderBy: { hireDate: "asc" },
      select: { id: true, name: true, hireDate: true },
    });
  }

  async findOne(id: number, req: TenantRequest) {
    const where: Record<string, unknown> = { id };
    if (req.tenantId) where.tenantId = req.tenantId;
    return prisma.employee.findFirst({ where });
  }

  async create(input: CreateEmployeeInput, req: TenantRequest) {
    return prisma.employee.create({
      data: {
        name: input.name,
        hireDate: new Date(input.hireDate),
        tenantId: req.tenantId,
      },
      select: { id: true, name: true, hireDate: true },
    });
  }

  async update(id: number, input: CreateEmployeeInput, req: TenantRequest) {
    const where: Record<string, unknown> = { id };
    if (req.tenantId) where.tenantId = req.tenantId;

    const existing = await prisma.employee.findFirst({ where });
    if (!existing) return null;

    return prisma.employee.update({
      where: { id },
      data: { name: input.name, hireDate: new Date(input.hireDate) },
      select: { id: true, name: true, hireDate: true },
    });
  }

  async delete(id: number, req: TenantRequest) {
    const where: Record<string, unknown> = { id };
    if (req.tenantId) where.tenantId = req.tenantId;

    const existing = await prisma.employee.findFirst({ where });
    if (!existing) return false;

    await prisma.employee.delete({ where: { id } });
    return true;
  }

  async bulkCreate(input: BulkCreateInput, req: TenantRequest) {
    const deleteWhere: Record<string, unknown> = {};
    if (req.tenantId) deleteWhere.tenantId = req.tenantId;

    await prisma.$transaction(async (tx) => {
      await tx.employee.deleteMany({ where: deleteWhere });
      for (const emp of input.employees) {
        if (emp.name && emp.hireDate) {
          await tx.employee.create({
            data: {
              name: emp.name,
              hireDate: new Date(emp.hireDate),
              tenantId: req.tenantId,
            },
          });
        }
      }
    });

    return { count: input.employees.length };
  }
}

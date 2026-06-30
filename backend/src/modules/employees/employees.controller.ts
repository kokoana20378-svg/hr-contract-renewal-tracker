import { Router } from "express";
import type { Response, NextFunction } from "express";
import type { TenantRequest } from "../../middleware/tenant";
import { EmployeesService } from "./employees.service";
import { AppError } from "../../middleware/errorHandler";

const router = Router();
const service = new EmployeesService();

router.get("/", async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    const employees = await service.findAll(req);
    res.json(employees);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const employee = await service.findOne(id, req);
    if (!employee) throw new AppError(404, "Employee not found");
    res.json(employee);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    const { name, hireDate } = req.body;
    if (!name || !hireDate) throw new AppError(400, "name and hireDate are required");
    const employee = await service.create({ name, hireDate }, req);
    res.status(201).json(employee);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, hireDate } = req.body;
    if (!name || !hireDate) throw new AppError(400, "name and hireDate are required");
    const employee = await service.update(id, { name, hireDate }, req);
    if (!employee) throw new AppError(404, "Employee not found");
    res.json(employee);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await service.delete(id, req);
    if (!deleted) throw new AppError(404, "Employee not found");
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/bulk", async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    const { employees } = req.body;
    if (!Array.isArray(employees)) throw new AppError(400, "employees array is required");
    const result = await service.bulkCreate({ employees }, req);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;

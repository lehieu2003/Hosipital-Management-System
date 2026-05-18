import type { Response } from 'express';

import { opdService } from '../../domain/services/opd.service.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { HTTP_STATUS } from '../../shared/constants/http-status.js';
import { AppError } from '../../shared/errors/app-error.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import {
  assignDepartmentDoctorSchema,
  createDepartmentSchema,
  departmentIdParamsSchema,
} from '../validators/opd.validator.js';

const serializeDepartment = (department: Awaited<ReturnType<typeof opdService.createDepartment>>) => ({
  id: department.id,
  name: department.name,
  assignmentCount: department.assignmentCount,
  assignedDoctor: department.assignedDoctor,
  createdAt: department.createdAt.toISOString(),
  updatedAt: department.updatedAt.toISOString(),
});

export const createDepartmentController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const principal = req.auth;
    const payload = createDepartmentSchema.parse(req.body);

    if (!principal) {
      throw new AppError('Bearer token is required', HTTP_STATUS.unauthorized, 'MISSING_BEARER_TOKEN');
    }

    const department = await opdService.createDepartment(payload, principal);

    return res.status(HTTP_STATUS.created).json({
      success: true,
      data: serializeDepartment(department),
    });
  },
);

export const listDepartmentsController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const principal = req.auth;

    if (!principal) {
      throw new AppError('Bearer token is required', HTTP_STATUS.unauthorized, 'MISSING_BEARER_TOKEN');
    }

    const departments = await opdService.listDepartments(principal);

    return res.status(HTTP_STATUS.ok).json({
      success: true,
      data: departments.map(serializeDepartment),
    });
  },
);

export const assignDepartmentDoctorController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const principal = req.auth;
    const params = departmentIdParamsSchema.parse(req.params);
    const payload = assignDepartmentDoctorSchema.parse(req.body);

    if (!principal) {
      throw new AppError('Bearer token is required', HTTP_STATUS.unauthorized, 'MISSING_BEARER_TOKEN');
    }

    const department = await opdService.assignDoctorToDepartment(
      params.departmentId,
      payload,
      principal,
    );

    return res.status(HTTP_STATUS.ok).json({
      success: true,
      data: serializeDepartment(department),
    });
  },
);

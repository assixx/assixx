import { NextFunction, Response } from 'express';

import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { errorResponse, successResponse } from '../../../utils/apiResponse.js';
import { logger } from '../../../utils/logger.js';
import rootLog from '../logs/logs.service.js';
import { departmentService } from './departments.service.js';

const DEFAULT_ERROR_MESSAGE = 'Error occurred';
const INTERNAL_SERVER_ERROR = 'Internal server error';

interface Department {
  id: number;
  name: string;
  description?: string;
  department_lead_id?: number;
  parent_id?: number;
  is_active: number; // TINYINT(1) from DB
  [key: string]: unknown;
}

/**
 * Convert boolean to TINYINT(1) for database
 * @param value - Optional boolean value
 * @returns 1 for true, 0 for false, 1 for undefined (default active)
 */
function booleanToTinyInt(value: boolean | undefined): 0 | 1 {
  if (value === undefined) return 1;
  return value ? 1 : 0;
}

/**
 * Determine error code based on error object
 */
function getErrorCode(errorObj: { code?: number; message?: string }): string {
  if (errorObj.code === 400 && errorObj.message?.includes('required') === true) {
    return 'VALIDATION_ERROR';
  }
  return `DEPT_${errorObj.code ?? 500}`;
}

/** Department create/update body type */
interface DepartmentBody {
  name: string;
  description?: string | undefined;
  departmentLeadId?: number | undefined;
  areaId?: number | undefined;
  isActive?: boolean | undefined;
}

/** Build department data from request body */
function buildDepartmentData(body: DepartmentBody): DepartmentBody {
  const data: DepartmentBody = { name: body.name };
  if (body.description !== undefined) data.description = body.description;
  if (body.departmentLeadId !== undefined) data.departmentLeadId = body.departmentLeadId;
  if (body.areaId !== undefined) data.areaId = body.areaId;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  return data;
}

/** Department update body (all optional) */
interface DepartmentUpdateBody {
  name?: string | undefined;
  description?: string | undefined;
  departmentLeadId?: number | undefined;
  areaId?: number | undefined;
  isActive?: boolean | undefined;
}

/** Build department update data from request body */
function buildUpdateData(body: DepartmentUpdateBody): DepartmentUpdateBody {
  const data: DepartmentUpdateBody = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.departmentLeadId !== undefined) data.departmentLeadId = body.departmentLeadId;
  if (body.areaId !== undefined) data.areaId = body.areaId;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  return data;
}

/** Parse and validate department ID from request params */
function parseDepartmentId(idParam: string | undefined, res: Response): number | null {
  if (idParam === undefined) {
    res.status(400).json(errorResponse('DEPT_400', 'Department ID is required'));
    return null;
  }
  const id = Number.parseInt(idParam);
  if (Number.isNaN(id)) {
    res.status(400).json(errorResponse('DEPT_400', 'Invalid department ID'));
    return null;
  }
  return id;
}

/** Log department action */
async function logDepartmentAction(
  req: AuthenticatedRequest,
  action: 'create' | 'update' | 'delete',
  entityId: number,
  details: string,
  newValues: Record<string, unknown>,
): Promise<void> {
  await rootLog.create({
    tenant_id: req.user.tenant_id,
    user_id: req.user.id,
    action,
    entity_type: 'department',
    entity_id: entityId,
    details,
    new_values: newValues,
    ip_address: req.ip ?? req.socket.remoteAddress,
    user_agent: req.get('user-agent'),
    was_role_switched: false,
  });
}

/** Handle department service errors */
function handleDepartmentError(res: Response, error: unknown): void {
  logger.error('Department error:', error);
  const errorObj = error as { code?: number; message?: string; details?: unknown };
  if (errorObj.code !== undefined) {
    const errorCode = getErrorCode(errorObj);
    res
      .status(errorObj.code)
      .json(
        errorResponse(
          errorCode,
          errorObj.message ?? DEFAULT_ERROR_MESSAGE,
          errorObj.details as { field: string; message: string }[] | undefined,
        ),
      );
  } else {
    res.status(500).json(errorResponse('DEPT_500', INTERNAL_SERVER_ERROR));
  }
}

/**
 *
 */
class DepartmentController {
  /**
   * Get all departments
   * @param req - The request object
   * @param res - The response object
   * @param _next - The _next parameter
   */
  async getDepartments(
    req: AuthenticatedRequest,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      const includeExtended = req.query['includeExtended'] !== 'false';

      const departments = await departmentService.getDepartments(
        req.user.tenant_id,
        includeExtended,
      );

      res.json(successResponse(departments));
    } catch (error: unknown) {
      logger.error('Error in getDepartments:', error);
      const errorObj = error as {
        code?: number;
        message?: string;
        details?: unknown;
      };
      if (errorObj.code !== undefined) {
        res
          .status(errorObj.code)
          .json(
            errorResponse(
              `DEPT_${errorObj.code}`,
              errorObj.message ?? DEFAULT_ERROR_MESSAGE,
              errorObj.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res.status(500).json(errorResponse('DEPT_500', INTERNAL_SERVER_ERROR));
      }
    }
  }

  /**
   * Get department by ID
   * @param req - The request object
   * @param res - The response object
   * @param _next - The _next parameter
   */
  async getDepartmentById(
    req: AuthenticatedRequest,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      const idParam = req.params['id'];
      if (idParam === undefined) {
        res.status(400).json(errorResponse('DEPT_400', 'Department ID is required'));
        return;
      }

      const departmentId = Number.parseInt(idParam);

      if (Number.isNaN(departmentId)) {
        res.status(400).json(errorResponse('DEPT_400', 'Invalid department ID'));
        return;
      }

      const department = await departmentService.getDepartmentById(
        departmentId,
        req.user.tenant_id,
      );

      res.json(successResponse(department));
    } catch (error: unknown) {
      logger.error('Error in getDepartmentById:', error);
      const errorObj = error as {
        code?: number;
        message?: string;
        details?: unknown;
      };
      if (errorObj.code !== undefined) {
        res
          .status(errorObj.code)
          .json(
            errorResponse(
              `DEPT_${errorObj.code}`,
              errorObj.message ?? DEFAULT_ERROR_MESSAGE,
              errorObj.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res.status(500).json(errorResponse('DEPT_500', INTERNAL_SERVER_ERROR));
      }
    }
  }

  /** Create a new department */
  async createDepartment(
    req: AuthenticatedRequest,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'root') {
        res
          .status(403)
          .json(errorResponse('FORBIDDEN', 'Access denied. Admin or root role required.'));
        return;
      }

      const body = req.body as DepartmentBody;
      const departmentData = buildDepartmentData(body);
      const department = await departmentService.createDepartment(
        departmentData,
        req.user.tenant_id,
      );

      await logDepartmentAction(
        req,
        'create',
        (department as unknown as Department).id,
        `Erstellt: ${body.name}`,
        {
          name: body.name,
          description: body.description,
          department_lead_id: body.departmentLeadId,
          is_active: booleanToTinyInt(body.isActive),
          created_by: req.user.email,
        },
      );

      res.status(201).json(successResponse(department, 'Department created successfully'));
    } catch (error: unknown) {
      handleDepartmentError(res, error);
    }
  }

  /**
   * Update a department
   * @param req - The request object
   * @param res - The response object
   * @param _next - The _next parameter
   */
  private async logDepartmentUpdate(
    req: AuthenticatedRequest,
    departmentId: number,
    body: DepartmentUpdateBody,
    oldDepartment: unknown,
  ): Promise<void> {
    const oldDept = oldDepartment as Department | null;
    await rootLog.create({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'update',
      entity_type: 'department',
      entity_id: departmentId,
      details: `Aktualisiert: ${body.name ?? 'Unbekannt'}`,
      old_values: {
        name: oldDept?.name,
        description: oldDept?.description,
        department_lead_id: oldDept?.department_lead_id,
        is_active: oldDept?.is_active,
      },
      new_values: {
        name: body.name,
        description: body.description,
        department_lead_id: body.departmentLeadId,
        is_active:
          body.isActive !== undefined ?
            body.isActive ?
              1
            : 0
          : undefined,
        updated_by: req.user.email,
      },
      ip_address: req.ip ?? req.socket.remoteAddress,
      user_agent: req.get('user-agent'),
      was_role_switched: false,
    });
  }

  async updateDepartment(
    req: AuthenticatedRequest,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'root') {
        res
          .status(403)
          .json(errorResponse('FORBIDDEN', 'Access denied. Admin or root role required.'));
        return;
      }

      const departmentId = parseDepartmentId(req.params['id'], res);
      if (departmentId === null) return;

      const body = req.body as DepartmentUpdateBody;
      const oldDepartment = await departmentService.getDepartmentById(
        departmentId,
        req.user.tenant_id,
      );
      const updateData = buildUpdateData(body);
      const department = await departmentService.updateDepartment(
        departmentId,
        updateData,
        req.user.tenant_id,
      );

      await this.logDepartmentUpdate(req, departmentId, body, oldDepartment);
      res.json(successResponse(department, 'Department updated successfully'));
    } catch (error: unknown) {
      handleDepartmentError(res, error);
    }
  }

  /** Delete a department */
  async deleteDepartment(
    req: AuthenticatedRequest,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'root') {
        res
          .status(403)
          .json(errorResponse('FORBIDDEN', 'Access denied. Admin or root role required.'));
        return;
      }

      const departmentId = parseDepartmentId(req.params['id'], res);
      if (departmentId === null) return;

      const force = req.query['force'] === 'true';
      const deletedDept = await departmentService.getDepartmentById(
        departmentId,
        req.user.tenant_id,
      );
      await departmentService.deleteDepartment(departmentId, req.user.tenant_id, force);

      const dept = deletedDept as unknown as Department | null;
      await logDepartmentAction(req, 'delete', departmentId, `Gelöscht: ${String(dept?.name)}`, {
        name: dept?.name,
        description: dept?.description,
        department_lead_id: dept?.department_lead_id,
        is_active: dept?.is_active,
        deleted_by: req.user.email,
      });

      res.json(
        successResponse(
          { message: 'Department deleted successfully' },
          'Department deleted successfully',
        ),
      );
    } catch (error: unknown) {
      handleDepartmentError(res, error);
    }
  }

  /**
   * Get department members
   * @param req - The request object
   * @param res - The response object
   * @param _next - The _next parameter
   */
  async getDepartmentMembers(
    req: AuthenticatedRequest,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      const idParam = req.params['id'];
      if (idParam === undefined) {
        res.status(400).json(errorResponse('DEPT_400', 'Department ID is required'));
        return;
      }

      const departmentId = Number.parseInt(idParam);

      if (Number.isNaN(departmentId)) {
        res.status(400).json(errorResponse('DEPT_400', 'Invalid department ID'));
        return;
      }

      const members = await departmentService.getDepartmentMembers(
        departmentId,
        req.user.tenant_id,
      );

      res.json(successResponse(members));
    } catch (error: unknown) {
      logger.error('Error in getDepartmentMembers:', error);
      const errorObj = error as {
        code?: number;
        message?: string;
        details?: unknown;
      };
      if (errorObj.code !== undefined) {
        res
          .status(errorObj.code)
          .json(
            errorResponse(
              `DEPT_${errorObj.code}`,
              errorObj.message ?? DEFAULT_ERROR_MESSAGE,
              errorObj.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res.status(500).json(errorResponse('DEPT_500', INTERNAL_SERVER_ERROR));
      }
    }
  }

  /**
   * Get department statistics
   * @param req - The request object
   * @param res - The response object
   * @param _next - The _next parameter
   */
  async getDepartmentStats(
    req: AuthenticatedRequest,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      const stats = await departmentService.getDepartmentStats(req.user.tenant_id);

      res.json(successResponse(stats));
    } catch (error: unknown) {
      logger.error('Error in getDepartmentStats:', error);
      const errorObj = error as {
        code?: number;
        message?: string;
        details?: unknown;
      };
      if (errorObj.code !== undefined) {
        res
          .status(errorObj.code)
          .json(
            errorResponse(
              `DEPT_${errorObj.code}`,
              errorObj.message ?? DEFAULT_ERROR_MESSAGE,
              errorObj.details as { field: string; message: string }[] | undefined,
            ),
          );
      } else {
        res.status(500).json(errorResponse('DEPT_500', INTERNAL_SERVER_ERROR));
      }
    }
  }
}

// Export controller instance
export const departmentController = new DepartmentController();

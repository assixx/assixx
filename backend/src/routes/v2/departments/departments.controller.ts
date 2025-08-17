import { Response, NextFunction } from "express";

import RootLog from "../../../models/rootLog";
import type { AuthenticatedRequest } from "../../../types/request.types.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { logger } from "../../../utils/logger.js";

import { departmentService } from "./departments.service.js";

interface Department {
  id: number;
  name: string;
  description?: string;
  manager_id?: number;
  parent_id?: number;
  status: string;
  visibility: string;
  [key: string]: unknown;
}

/**
 *
 */
export class DepartmentController {
  /**
   * Get all departments
   * @param req
   * @param res
   * @param _next
   */
  async getDepartments(
    req: AuthenticatedRequest,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      const includeExtended = req.query.includeExtended !== "false";

      const departments = await departmentService.getDepartments(
        req.user.tenant_id,
        includeExtended,
      );

      res.json(successResponse(departments));
    } catch (error: unknown) {
      logger.error("Error in getDepartments:", error);
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
              errorObj.message ?? "Error occurred",
              errorObj.details as
                | { field: string; message: string }[]
                | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(errorResponse("DEPT_500", "Internal server error"));
      }
    }
  }

  /**
   * Get department by ID
   * @param req
   * @param res
   * @param _next
   */
  async getDepartmentById(
    req: AuthenticatedRequest,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      const departmentId = Number.parseInt(req.params.id);

      if (isNaN(departmentId)) {
        res
          .status(400)
          .json(errorResponse("DEPT_400", "Invalid department ID"));
        return;
      }

      const department = await departmentService.getDepartmentById(
        departmentId,
        req.user.tenant_id,
      );

      res.json(successResponse(department));
    } catch (error: unknown) {
      logger.error("Error in getDepartmentById:", error);
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
              errorObj.message ?? "Error occurred",
              errorObj.details as
                | { field: string; message: string }[]
                | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(errorResponse("DEPT_500", "Internal server error"));
      }
    }
  }

  /**
   * Create a new department
   * @param req
   * @param res
   * @param _next
   */
  async createDepartment(
    req: AuthenticatedRequest,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      // Admin/Root only check
      if (req.user.role !== "admin" && req.user.role !== "root") {
        res
          .status(403)
          .json(
            errorResponse(
              "FORBIDDEN",
              "Access denied. Admin or root role required.",
            ),
          );
        return;
      }

      const body = req.body as {
        name: string;
        description?: string;
        managerId?: number;
        parentId?: number;
        areaId?: number;
        status?: string;
        visibility?: string;
      };

      const department = await departmentService.createDepartment(
        {
          name: body.name,
          description: body.description,
          managerId: body.managerId,
          parentId: body.parentId,
          areaId: body.areaId,
          status: body.status,
          visibility: body.visibility,
        },
        req.user.tenant_id,
      );

      // Log department creation
      await RootLog.create({
        tenant_id: req.user.tenant_id,
        user_id: req.user.id,
        action: "create",
        entity_type: "department",
        entity_id: (department as unknown as Department).id,
        details: `Erstellt: ${body.name}`,
        new_values: {
          name: body.name,
          description: body.description,
          manager_id: body.managerId,
          parent_id: body.parentId,
          status: body.status,
          visibility: body.visibility,
          created_by: req.user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get("user-agent"),
        was_role_switched: false,
      });

      res
        .status(201)
        .json(successResponse(department, "Department created successfully"));
    } catch (error: unknown) {
      logger.error("Error in createDepartment:", error);
      const errorObj = error as {
        code?: number;
        message?: string;
        details?: unknown;
      };
      if (errorObj.code !== undefined) {
        const errorCode =
          errorObj.code === 400 &&
          errorObj.message?.includes("required") === true
            ? "VALIDATION_ERROR"
            : `DEPT_${errorObj.code}`;
        res
          .status(errorObj.code)
          .json(
            errorResponse(
              errorCode,
              errorObj.message ?? "Error occurred",
              errorObj.details as
                | { field: string; message: string }[]
                | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(errorResponse("DEPT_500", "Internal server error"));
      }
    }
  }

  /**
   * Update a department
   * @param req
   * @param res
   * @param _next
   */
  async updateDepartment(
    req: AuthenticatedRequest,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      // Admin/Root only check
      if (req.user.role !== "admin" && req.user.role !== "root") {
        res
          .status(403)
          .json(
            errorResponse(
              "FORBIDDEN",
              "Access denied. Admin or root role required.",
            ),
          );
        return;
      }

      const departmentId = Number.parseInt(req.params.id);

      if (isNaN(departmentId)) {
        res
          .status(400)
          .json(errorResponse("DEPT_400", "Invalid department ID"));
        return;
      }

      const body = req.body as {
        name?: string;
        description?: string;
        managerId?: number;
        parentId?: number;
        areaId?: number;
        status?: string;
        visibility?: string;
      };

      // Get old department data for logging
      const oldDepartment = await departmentService.getDepartmentById(
        departmentId,
        req.user.tenant_id,
      );

      const department = await departmentService.updateDepartment(
        departmentId,
        {
          name: body.name,
          description: body.description,
          managerId: body.managerId,
          parentId: body.parentId,
          areaId: body.areaId,
          status: body.status,
          visibility: body.visibility,
        },
        req.user.tenant_id,
      );

      // Log department update
      await RootLog.create({
        tenant_id: req.user.tenant_id,
        user_id: req.user.id,
        action: "update",
        entity_type: "department",
        entity_id: departmentId,
        details: `Aktualisiert: ${body.name}`,
        old_values: {
          name: (oldDepartment as unknown as Department | null)?.name,
          description: (oldDepartment as unknown as Department | null)
            ?.description,
          manager_id: (oldDepartment as unknown as Department | null)
            ?.manager_id,
          parent_id: (oldDepartment as unknown as Department | null)?.parent_id,
          status: (oldDepartment as unknown as Department | null)?.status,
          visibility: (oldDepartment as unknown as Department | null)
            ?.visibility,
        },
        new_values: {
          name: body.name,
          description: body.description,
          manager_id: body.managerId,
          parent_id: body.parentId,
          status: body.status,
          visibility: body.visibility,
          updated_by: req.user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get("user-agent"),
        was_role_switched: false,
      });

      res.json(successResponse(department, "Department updated successfully"));
    } catch (error: unknown) {
      logger.error("Error in updateDepartment:", error);
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
              errorObj.message ?? "Error occurred",
              errorObj.details as
                | { field: string; message: string }[]
                | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(errorResponse("DEPT_500", "Internal server error"));
      }
    }
  }

  /**
   * Delete a department
   * @param req
   * @param res
   * @param _next
   */
  async deleteDepartment(
    req: AuthenticatedRequest,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      // Admin/Root only check
      if (req.user.role !== "admin" && req.user.role !== "root") {
        res
          .status(403)
          .json(
            errorResponse(
              "FORBIDDEN",
              "Access denied. Admin or root role required.",
            ),
          );
        return;
      }

      const departmentId = Number.parseInt(req.params.id);

      if (isNaN(departmentId)) {
        res
          .status(400)
          .json(errorResponse("DEPT_400", "Invalid department ID"));
        return;
      }

      // Get department data before deletion for logging
      const deletedDepartment = await departmentService.getDepartmentById(
        departmentId,
        req.user.tenant_id,
      );

      await departmentService.deleteDepartment(
        departmentId,
        req.user.tenant_id,
      );

      // Log department deletion
      await RootLog.create({
        tenant_id: req.user.tenant_id,
        user_id: req.user.id,
        action: "delete",
        entity_type: "department",
        entity_id: departmentId,
        details: `Gelöscht: ${String((deletedDepartment as unknown as Department | null)?.name)}`,
        old_values: {
          name: (deletedDepartment as unknown as Department | null)?.name,
          description: (deletedDepartment as unknown as Department | null)
            ?.description,
          manager_id: (deletedDepartment as unknown as Department | null)
            ?.manager_id,
          status: (deletedDepartment as unknown as Department | null)?.status,
          visibility: (deletedDepartment as unknown as Department | null)
            ?.visibility,
          deleted_by: req.user.email,
        },
        ip_address: req.ip ?? req.socket.remoteAddress,
        user_agent: req.get("user-agent"),
        was_role_switched: false,
      });

      res.json(
        successResponse(
          { message: "Department deleted successfully" },
          "Department deleted successfully",
        ),
      );
    } catch (error: unknown) {
      logger.error("Error in deleteDepartment:", error);
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
              errorObj.message ?? "Error occurred",
              errorObj.details as
                | { field: string; message: string }[]
                | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(errorResponse("DEPT_500", "Internal server error"));
      }
    }
  }

  /**
   * Get department members
   * @param req
   * @param res
   * @param _next
   */
  async getDepartmentMembers(
    req: AuthenticatedRequest,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      const departmentId = Number.parseInt(req.params.id);

      if (isNaN(departmentId)) {
        res
          .status(400)
          .json(errorResponse("DEPT_400", "Invalid department ID"));
        return;
      }

      const members = await departmentService.getDepartmentMembers(
        departmentId,
        req.user.tenant_id,
      );

      res.json(successResponse(members));
    } catch (error: unknown) {
      logger.error("Error in getDepartmentMembers:", error);
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
              errorObj.message ?? "Error occurred",
              errorObj.details as
                | { field: string; message: string }[]
                | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(errorResponse("DEPT_500", "Internal server error"));
      }
    }
  }

  /**
   * Get department statistics
   * @param req
   * @param res
   * @param _next
   */
  async getDepartmentStats(
    req: AuthenticatedRequest,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      const stats = await departmentService.getDepartmentStats(
        req.user.tenant_id,
      );

      res.json(successResponse(stats));
    } catch (error: unknown) {
      logger.error("Error in getDepartmentStats:", error);
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
              errorObj.message ?? "Error occurred",
              errorObj.details as
                | { field: string; message: string }[]
                | undefined,
            ),
          );
      } else {
        res
          .status(500)
          .json(errorResponse("DEPT_500", "Internal server error"));
      }
    }
  }
}

// Export controller instance
export const departmentController = new DepartmentController();

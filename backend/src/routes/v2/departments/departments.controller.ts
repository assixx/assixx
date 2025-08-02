import { Response, NextFunction } from "express";

import { AuthenticatedRequest } from "../../../types/request.types.js";
import { successResponse, errorResponse } from "../../../utils/apiResponse.js";
import { logger } from "../../../utils/logger.js";

import { departmentService } from "./departments.service.js";

export class DepartmentController {
  /**
   * Get all departments
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
    } catch (error) {
      logger.error("Error in getDepartments:", error);
      const errorObj = error as {
        code?: number;
        message?: string;
        details?: unknown;
      };
      if (errorObj.code) {
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
   */
  async getDepartmentById(
    req: AuthenticatedRequest,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      const departmentId = parseInt(req.params.id);

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
    } catch (error) {
      logger.error("Error in getDepartmentById:", error);
      const errorObj = error as {
        code?: number;
        message?: string;
        details?: unknown;
      };
      if (errorObj.code) {
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
        status?: string;
        visibility?: string;
      };

      const department = await departmentService.createDepartment(
        {
          name: body.name,
          description: body.description,
          managerId: body.managerId,
          parentId: body.parentId,
          status: body.status,
          visibility: body.visibility,
        },
        req.user.tenant_id,
      );

      res
        .status(201)
        .json(successResponse(department, "Department created successfully"));
    } catch (error) {
      logger.error("Error in createDepartment:", error);
      const errorObj = error as {
        code?: number;
        message?: string;
        details?: unknown;
      };
      if (errorObj.code) {
        const errorCode =
          errorObj.code === 400 && errorObj.message?.includes("required")
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

      const departmentId = parseInt(req.params.id);

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
        status?: string;
        visibility?: string;
      };

      const department = await departmentService.updateDepartment(
        departmentId,
        {
          name: body.name,
          description: body.description,
          managerId: body.managerId,
          parentId: body.parentId,
          status: body.status,
          visibility: body.visibility,
        },
        req.user.tenant_id,
      );

      res.json(successResponse(department, "Department updated successfully"));
    } catch (error) {
      logger.error("Error in updateDepartment:", error);
      const errorObj = error as {
        code?: number;
        message?: string;
        details?: unknown;
      };
      if (errorObj.code) {
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

      const departmentId = parseInt(req.params.id);

      if (isNaN(departmentId)) {
        res
          .status(400)
          .json(errorResponse("DEPT_400", "Invalid department ID"));
        return;
      }

      await departmentService.deleteDepartment(
        departmentId,
        req.user.tenant_id,
      );

      res.json(
        successResponse(
          { message: "Department deleted successfully" },
          "Department deleted successfully",
        ),
      );
    } catch (error) {
      logger.error("Error in deleteDepartment:", error);
      const errorObj = error as {
        code?: number;
        message?: string;
        details?: unknown;
      };
      if (errorObj.code) {
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
   */
  async getDepartmentMembers(
    req: AuthenticatedRequest,
    res: Response,
    _next: NextFunction,
  ): Promise<void> {
    try {
      const departmentId = parseInt(req.params.id);

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
    } catch (error) {
      logger.error("Error in getDepartmentMembers:", error);
      const errorObj = error as {
        code?: number;
        message?: string;
        details?: unknown;
      };
      if (errorObj.code) {
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
    } catch (error) {
      logger.error("Error in getDepartmentStats:", error);
      const errorObj = error as {
        code?: number;
        message?: string;
        details?: unknown;
      };
      if (errorObj.code) {
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

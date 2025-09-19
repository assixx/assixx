/**
 * Employee Controller
 * Handles employee-related operations
 * NOTE: This controller was previously named UserController but renamed for consistency
 */
import { Request, Response } from 'express';
import { Pool } from 'mysql2/promise';

import type { UserCreateData } from '../models/user';
import employeeService from '../services/employee.service';

// Constants
const TENANT_DB_NOT_AVAILABLE = 'Tenant database not available';
const UNKNOWN_ERROR = 'Unknown error';

// Extended Request interface with tenant database
interface TenantRequest extends Request {
  tenantDb?: Pool;
  tenantId?: number | null;
  user?: {
    id: number;
    tenantId: number;
    role: string;
    [key: string]: unknown;
  };
}

// Interface for create/update request bodies
interface EmployeeCreateRequest extends TenantRequest {
  body: {
    tenant_id: number;
    username: string;
    email: string;
    password?: string;
    password_hash?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    role?: 'admin' | 'user' | 'manager';
    department_id?: number | null;
    team_id?: number | null;
    hire_date?: Date | string;
    salary?: number;
    position?: string;
    location?: string;
    employee_id?: string;
    is_active?: boolean;
    avatar_url?: string;
    profile_picture?: string;
    language?: string;
    timezone?: string;
  };
}

interface EmployeeUpdateRequest extends TenantRequest {
  body: {
    username?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    role?: 'admin' | 'user' | 'manager';
    department_id?: number | null;
    team_id?: number | null;
    hire_date?: Date | string;
    salary?: number;
    position?: string;
    location?: string;
    employee_id?: string;
    is_active?: boolean;
    avatar_url?: string;
    profile_picture?: string;
    is_archived?: boolean;
    archived?: boolean;
  };
  params: {
    id: string;
  };
}

interface EmployeeGetRequest extends TenantRequest {
  params: {
    id: string;
  };
}

interface EmployeeQueryRequest extends TenantRequest {
  query: {
    search?: string;
    role?: 'admin' | 'user' | 'manager';
    department_id?: string;
    team_id?: string;
    is_active?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortDir?: 'ASC' | 'DESC';
  };
}

/**
 * Helper function to validate tenant context
 */
function validateTenantContext(
  req: EmployeeQueryRequest,
  res: Response,
): { isValid: boolean; tenantId?: number } {
  if (req.tenantDb === undefined) {
    res.status(400).json({ error: TENANT_DB_NOT_AVAILABLE });
    return { isValid: false };
  }

  const tenantId = req.tenantId ?? req.user?.tenantId;
  if (tenantId === undefined || tenantId === 0) {
    res.status(400).json({ error: 'Tenant ID not found' });
    return { isValid: false };
  }

  return { isValid: true, tenantId };
}

/**
 * Helper function to parse optional number from query string
 */
function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  return Number.parseInt(value);
}

/**
 * Helper function to parse optional boolean from query string
 */
function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  return value === 'true';
}

/**
 * Helper function to build filters from query parameters
 */
function buildEmployeeFilters(
  query: EmployeeQueryRequest['query'],
  tenantId: number,
): {
  tenant_id: number;
  search: string | undefined;
  role: string | undefined;
  department_id: number | undefined;
  team_id: number | undefined;
  is_active: boolean | undefined;
  page: number | undefined;
  limit: number | undefined;
  sortBy: string | undefined;
  sortDir: 'ASC' | 'DESC' | undefined;
} {
  return {
    tenant_id: tenantId,
    search: query.search,
    role: query.role,
    department_id: parseOptionalNumber(query.department_id),
    team_id: parseOptionalNumber(query.team_id),
    is_active: parseOptionalBoolean(query.is_active),
    page: parseOptionalNumber(query.page),
    limit: parseOptionalNumber(query.limit),
    sortBy: query.sortBy,
    sortDir: query.sortDir,
  };
}

/**
 *
 */
class EmployeeController {
  /**
   * Holt alle Employee Einträge
   * GET /api/employee
   * @param req - The request object
   * @param res - The response object
   */
  async getAll(req: EmployeeQueryRequest, res: Response): Promise<void> {
    try {
      const validation = validateTenantContext(req, res);
      if (!validation.isValid || validation.tenantId === undefined || req.tenantDb === undefined) {
        return;
      }

      const filters = buildEmployeeFilters(req.query, validation.tenantId);
      const result = await employeeService.getAll(req.tenantDb, filters);
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in EmployeeController.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }

  /**
   * Holt einen Employee Eintrag per ID
   * GET /api/employee/:id
   * @param req - The request object
   * @param res - The response object
   */
  async getById(req: EmployeeGetRequest, res: Response): Promise<void> {
    try {
      if (req.tenantDb === undefined) {
        res.status(400).json({ error: TENANT_DB_NOT_AVAILABLE });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      // Get tenant ID from request
      const tenantId = req.tenantId ?? req.user?.tenantId;
      if (tenantId === undefined || tenantId === 0) {
        res.status(400).json({ error: 'Tenant ID not found' });
        return;
      }

      const result = await employeeService.getById(req.tenantDb, id, tenantId);
      if (result === null) {
        res.status(404).json({ error: 'Nicht gefunden' });
        return;
      }
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in EmployeeController.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }

  /**
   * Erstellt einen neuen Employee Eintrag
   * POST /api/employee
   * @param req - The request object
   * @param res - The response object
   */
  async create(req: EmployeeCreateRequest, res: Response): Promise<void> {
    try {
      if (req.tenantDb === undefined) {
        res.status(400).json({ error: TENANT_DB_NOT_AVAILABLE });
        return;
      }

      // Get tenant ID from request
      const tenantId = req.tenantId ?? req.user?.tenantId;
      if (tenantId === undefined || tenantId === 0) {
        res.status(400).json({ error: 'Tenant ID not found' });
        return;
      }

      const employeeData: UserCreateData = {
        username: req.body.username,
        email: req.body.email,
        password: req.body.password ?? req.body.password_hash ?? '',
        first_name: req.body.first_name ?? '',
        last_name: req.body.last_name ?? '',
        role: req.body.role ?? 'user',
        tenant_id: tenantId,
        department_id: req.body.department_id ?? undefined,
        profile_picture: req.body.profile_picture ?? undefined,
        position: req.body.position,
        phone: req.body.phone,
        employee_id: req.body.employee_id,
        status: req.body.is_active === false ? 'inactive' : 'active',
      };
      const result = await employeeService.create(req.tenantDb, employeeData);
      res.status(201).json(result);
    } catch (error: unknown) {
      console.error('Error in EmployeeController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }

  /**
   * Aktualisiert einen Employee Eintrag
   * PUT /api/employee/:id
   * @param req - The request object
   * @param res - The response object
   */
  async update(req: EmployeeUpdateRequest, res: Response): Promise<void> {
    try {
      if (req.tenantDb === undefined) {
        res.status(400).json({ error: TENANT_DB_NOT_AVAILABLE });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const updateData: Partial<UserCreateData> = {
        username: req.body.username,
        email: req.body.email,
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        role: req.body.role,
        department_id: req.body.department_id ?? undefined,
        profile_picture: req.body.profile_picture ?? req.body.avatar_url ?? undefined,
        position: req.body.position,
        phone: req.body.phone,
        status:
          req.body.is_active === false ? 'inactive'
          : req.body.is_active === true ? 'active'
          : undefined,
        is_archived: req.body.is_archived ?? req.body.archived,
      };
      // Remove undefined values - create new object without undefined values
      const cleanedUpdateData = Object.fromEntries(
        Object.entries(updateData as Record<string, unknown>).filter(([, v]) => v !== undefined),
      ) as Partial<UserCreateData>;

      // Get tenant ID from request
      const tenantId = req.tenantId ?? req.user?.tenantId;
      if (tenantId === undefined || tenantId === 0) {
        res.status(400).json({ error: 'Tenant ID not found' });
        return;
      }

      const result = await employeeService.update(req.tenantDb, id, tenantId, cleanedUpdateData);
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in EmployeeController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }

  /**
   * Löscht einen Employee Eintrag
   * DELETE /api/employee/:id
   * @param req - The request object
   * @param res - The response object
   */
  async delete(req: EmployeeGetRequest, res: Response): Promise<void> {
    try {
      if (req.tenantDb === undefined) {
        res.status(400).json({ error: TENANT_DB_NOT_AVAILABLE });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      await employeeService.delete(req.tenantDb, id);
      res.status(204).send();
    } catch (error: unknown) {
      console.error('Error in EmployeeController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Löschen',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }
}

// Export singleton instance
const employeeController = new EmployeeController();
export default employeeController;

// Named export for the class
export { EmployeeController };

// CommonJS compatibility

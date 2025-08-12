/**
 * Shift Service
 * Handles shift planning business logic
 *
 * NOTE: This service wrapper only exposes generic CRUD methods,
 * but the Shift model has many more specific methods like getShiftTemplates,
 * createShiftTemplate, getShiftPlans, createShiftPlan, etc.
 * This should be refactored to expose the full shift planning functionality.
 */

import { Pool } from "mysql2/promise";

import {
  getShiftTemplates,
  createShiftTemplate,
  getShiftPlans,
  createShiftPlan,
  getShiftsByPlan,
  createShift,
  assignEmployeeToShift,
  // getEmployeeAvailability, // Unused
  // setEmployeeAvailability, // Unused
  // getShiftExchangeRequests, // Unused
  // createShiftExchangeRequest, // Unused
  // canAccessShiftPlan, // Unused
  getEmployeeShifts,
} from "../models/shift";

// Interfaces - these would typically match the Shift model interfaces
interface ShiftEntry {
  id: number;
  tenant_id: number;
  shift_plan_id: number;
  template_id?: number | null;
  date: Date;
  start_time: string;
  end_time: string;
  position?: string | null;
  required_employees: number;
  assigned_employees?: number;
  created_at: Date;
  updated_at: Date;
}

interface ShiftFilters {
  department_id?: number;
  team_id?: number;
  start_date?: string | Date;
  end_date?: string | Date;
  status?: "draft" | "published" | "archived";
  plan_id?: number;
  template_id?: number;
}

interface ShiftCreateData {
  tenant_id: number;
  shift_plan_id: number;
  template_id?: number | null;
  date: Date | string;
  start_time: string;
  end_time: string;
  position?: string | null;
  required_employees?: number;
}

interface ShiftUpdateData {
  template_id?: number | null;
  start_time?: string;
  end_time?: string;
  position?: string | null;
  required_employees?: number;
}

// Additional interfaces for actual Shift functionality
interface ShiftTemplate {
  id: number;
  tenant_id: number;
  name: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  duration_hours: number;
  break_minutes: number;
  color: string;
  is_active: boolean | number;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

interface ShiftPlan {
  id: number;
  tenant_id: number;
  name: string;
  description?: string | null;
  start_date: Date;
  end_date: Date;
  department_id?: number | null;
  team_id?: number | null;
  status: "draft" | "published" | "archived";
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

class ShiftService {
  /**
   * Holt alle Shift Einträge für einen Tenant
   * NOTE: This generic method doesn't match the actual Shift model functionality
   */
  getAll(_tenantDb: Pool, _filters: ShiftFilters = {}): ShiftEntry[] {
    try {
      // The actual Shift model doesn't have a generic getAll method
      console.warn(
        "ShiftService.getAll: This method should use specific Shift model methods",
      );
      throw new Error(
        "Method needs refactoring - use getShiftPlans or getShiftTemplates instead",
      );
    } catch (error: unknown) {
      console.error("Error in ShiftService.getAll:", error);
      throw error;
    }
  }

  /**
   * Holt einen Shift Eintrag per ID
   * NOTE: This should use specific methods depending on what's being retrieved
   */
  getById(_tenantDb: Pool, _id: number): ShiftEntry | null {
    try {
      console.warn(
        "ShiftService.getById: This method should use specific Shift model methods",
      );
      throw new Error(
        "Method needs refactoring - use specific getter methods instead",
      );
    } catch (error: unknown) {
      console.error("Error in ShiftService.getById:", error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Shift Eintrag
   * NOTE: This should use createShift, createShiftPlan, or createShiftTemplate
   */
  create(_tenantDb: Pool, _data: ShiftCreateData): ShiftEntry {
    try {
      console.warn(
        "ShiftService.create: This method should use specific Shift model methods",
      );
      throw new Error(
        "Method needs refactoring - use createShift, createShiftPlan, or createShiftTemplate instead",
      );
    } catch (error: unknown) {
      console.error("Error in ShiftService.create:", error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Shift Eintrag
   * NOTE: The Shift model doesn't have generic update methods
   */
  update(
    _tenantDb: Pool,
    _id: number,
    _data: ShiftUpdateData,
  ): ShiftEntry | null {
    try {
      console.warn(
        "ShiftService.update: This method should use specific Shift model methods",
      );
      throw new Error(
        "Method needs refactoring - Shift model does not have generic update methods",
      );
    } catch (error: unknown) {
      console.error("Error in ShiftService.update:", error);
      throw error;
    }
  }

  /**
   * Löscht einen Shift Eintrag
   * NOTE: The Shift model doesn't have generic delete methods
   */
  delete(_tenantDb: Pool, _id: number): boolean {
    try {
      console.warn(
        "ShiftService.delete: This method should use specific Shift model methods",
      );
      throw new Error(
        "Method needs refactoring - Shift model does not have generic delete methods",
      );
    } catch (error: unknown) {
      console.error("Error in ShiftService.delete:", error);
      throw error;
    }
  }

  // Additional methods that expose the actual Shift functionality
  // These should be added in a refactoring step:

  /**
   * Get all shift templates for a tenant
   */
  async getShiftTemplates(tenantId: number): Promise<ShiftTemplate[]> {
    try {
      return await getShiftTemplates(tenantId);
    } catch (error: unknown) {
      console.error("Error in ShiftService.getShiftTemplates:", error);
      throw error;
    }
  }

  /**
   * Create a new shift template
   */
  async createShiftTemplate(templateData: {
    tenant_id: number;
    name: string;
    description?: string | null;
    start_time: string;
    end_time: string;
    break_minutes?: number;
    color?: string;
    created_by: number;
  }): Promise<ShiftTemplate> {
    try {
      // Calculate duration_hours from start_time and end_time
      const start = new Date(`2000-01-01 ${templateData.start_time}`);
      const end = new Date(`2000-01-01 ${templateData.end_time}`);
      let duration_hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

      // Handle overnight shifts
      if (duration_hours < 0) {
        duration_hours += 24;
      }

      return await createShiftTemplate({
        ...templateData,
        duration_hours,
      });
    } catch (error: unknown) {
      console.error("Error in ShiftService.createShiftTemplate:", error);
      throw error;
    }
  }

  /**
   * Get all shift plans for a tenant with optional filters
   */
  async getShiftPlans(
    tenantId: number,
    userId: number,
    options?: ShiftFilters,
  ): Promise<{
    plans: ShiftPlan[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    try {
      return await getShiftPlans(tenantId, userId, options);
    } catch (error: unknown) {
      console.error("Error in ShiftService.getShiftPlans:", error);
      throw error;
    }
  }

  /**
   * Create a new shift plan
   */
  async createShiftPlan(planData: {
    tenant_id: number;
    name: string;
    description?: string | null;
    start_date: Date | string;
    end_date: Date | string;
    department_id?: number | null;
    team_id?: number | null;
    created_by: number;
  }): Promise<ShiftPlan> {
    try {
      return await createShiftPlan(planData);
    } catch (error: unknown) {
      console.error("Error in ShiftService.createShiftPlan:", error);
      throw error;
    }
  }

  /**
   * Get shifts for a specific plan
   */
  async getShiftsByPlan(
    planId: number,
    tenantId: number,
    userId: number,
  ): Promise<ShiftEntry[]> {
    try {
      const shifts = await getShiftsByPlan(planId, tenantId, userId);
      // Map DbShift to ShiftEntry
      return shifts.map((shift) => ({
        id: shift.id,
        tenant_id: shift.tenant_id,
        shift_plan_id: shift.plan_id, // Map plan_id to shift_plan_id
        template_id: shift.template_id,
        date: shift.date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        position: null as string | null,
        required_employees: shift.required_employees,
        assigned_employees: shift.assigned_employees as number[],
        created_at: shift.created_at,
        updated_at: shift.updated_at,
      }));
    } catch (error: unknown) {
      console.error("Error in ShiftService.getShiftsByPlan:", error);
      throw error;
    }
  }

  /**
   * Create a shift
   */
  async createShift(
    shiftData: ShiftCreateData & { created_by: number },
  ): Promise<ShiftEntry> {
    try {
      // Map ShiftCreateData to ShiftData expected by model
      const modelData = {
        tenant_id: shiftData.tenant_id,
        plan_id: shiftData.shift_plan_id, // Map shift_plan_id to plan_id
        template_id: shiftData.template_id,
        date: shiftData.date,
        start_time: shiftData.start_time,
        end_time: shiftData.end_time,
        required_employees: shiftData.required_employees,
        created_by: shiftData.created_by,
      };
      const shift = await createShift(modelData);
      // Map DbShift back to ShiftEntry
      return {
        id: shift.id,
        tenant_id: shift.tenant_id,
        shift_plan_id: shift.plan_id, // Map plan_id back to shift_plan_id
        template_id: shift.template_id,
        date: shift.date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        position: shiftData.position ?? null,
        required_employees: shift.required_employees,
        assigned_employees: 0,
        created_at: shift.created_at,
        updated_at: shift.updated_at,
      };
    } catch (error: unknown) {
      console.error("Error in ShiftService.createShift:", error);
      throw error;
    }
  }

  /**
   * Assign employee to a shift
   */
  async assignEmployeeToShift(assignmentData: {
    shift_id: number;
    employee_id: number;
    tenant_id: number;
    assigned_by: number;
  }): Promise<{
    id: number;
    shift_id: number;
    employee_id: number;
    assigned_at: Date;
  }> {
    try {
      // Map employee_id to user_id for model
      const modelData = {
        shift_id: assignmentData.shift_id,
        user_id: assignmentData.employee_id, // Map employee_id to user_id
        tenant_id: assignmentData.tenant_id,
        assigned_by: assignmentData.assigned_by,
      };
      const assignment = await assignEmployeeToShift(modelData);
      // Map result back with employee_id
      return {
        id: assignment.id,
        shift_id: assignment.shift_id,
        employee_id: assignment.user_id, // Map user_id back to employee_id
        assigned_at: assignment.assigned_at,
      };
    } catch (error: unknown) {
      console.error("Error in ShiftService.assignEmployeeToShift:", error);
      throw error;
    }
  }

  /**
   * Get employee shifts for a date range
   */
  async getEmployeeShifts(
    tenantId: number,
    userId: number,
    startDate: string | Date,
    endDate: string | Date,
  ): Promise<
    {
      id: number;
      date: Date;
      start_time: string;
      end_time: string;
      position?: string | null;
      template_name?: string | null;
      plan_name?: string | null;
    }[]
  > {
    try {
      return await getEmployeeShifts(tenantId, userId, startDate, endDate);
    } catch (error: unknown) {
      console.error("Error in ShiftService.getEmployeeShifts:", error);
      throw error;
    }
  }
}

// Export singleton instance
const shiftService = new ShiftService();
export default shiftService;

// Named export for the class
export { ShiftService };

// CommonJS compatibility

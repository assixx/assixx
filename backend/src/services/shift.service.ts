/**
 * Shift Service
 * Handles shift planning business logic
 *
 * NOTE: This service wrapper only exposes generic CRUD methods,
 * but the Shift model has many more specific methods like getShiftTemplates,
 * createShiftTemplate, getShiftPlans, createShiftPlan, etc.
 * This should be refactored to expose the full shift planning functionality.
 */

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
} from '../models/shift';
import { Pool } from 'mysql2/promise';

// Interfaces - these would typically match the Shift model interfaces
interface ShiftEntry {
  id: number;
  tenant_id: number;
  // Add other shift-specific fields as needed
  [key: string]: any;
}

interface ShiftFilters {
  department_id?: number;
  team_id?: number;
  start_date?: string | Date;
  end_date?: string | Date;
  status?: string;
  [key: string]: any;
}

interface ShiftCreateData {
  tenant_id: number;
  // Add other required fields for shift entries
  [key: string]: any;
}

interface ShiftUpdateData {
  // Add updateable fields for shift entries
  [key: string]: any;
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
  break_duration_minutes: number;
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
  status: 'draft' | 'published' | 'archived';
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

class ShiftService {
  /**
   * Holt alle Shift Einträge für einen Tenant
   * NOTE: This generic method doesn't match the actual Shift model functionality
   */
  async getAll(
    _tenantDb: Pool,
    _filters: ShiftFilters = {}
  ): Promise<ShiftEntry[]> {
    try {
      // The actual Shift model doesn't have a generic getAll method
      console.warn(
        'ShiftService.getAll: This method should use specific Shift model methods'
      );
      throw new Error(
        'Method needs refactoring - use getShiftPlans or getShiftTemplates instead'
      );
    } catch (error) {
      console.error('Error in ShiftService.getAll:', error);
      throw error;
    }
  }

  /**
   * Holt einen Shift Eintrag per ID
   * NOTE: This should use specific methods depending on what's being retrieved
   */
  async getById(_tenantDb: Pool, _id: number): Promise<ShiftEntry | null> {
    try {
      console.warn(
        'ShiftService.getById: This method should use specific Shift model methods'
      );
      throw new Error(
        'Method needs refactoring - use specific getter methods instead'
      );
    } catch (error) {
      console.error('Error in ShiftService.getById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Shift Eintrag
   * NOTE: This should use createShift, createShiftPlan, or createShiftTemplate
   */
  async create(_tenantDb: Pool, _data: ShiftCreateData): Promise<ShiftEntry> {
    try {
      console.warn(
        'ShiftService.create: This method should use specific Shift model methods'
      );
      throw new Error(
        'Method needs refactoring - use createShift, createShiftPlan, or createShiftTemplate instead'
      );
    } catch (error) {
      console.error('Error in ShiftService.create:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Shift Eintrag
   * NOTE: The Shift model doesn't have generic update methods
   */
  async update(
    _tenantDb: Pool,
    _id: number,
    _data: ShiftUpdateData
  ): Promise<ShiftEntry | null> {
    try {
      console.warn(
        'ShiftService.update: This method should use specific Shift model methods'
      );
      throw new Error(
        'Method needs refactoring - Shift model does not have generic update methods'
      );
    } catch (error) {
      console.error('Error in ShiftService.update:', error);
      throw error;
    }
  }

  /**
   * Löscht einen Shift Eintrag
   * NOTE: The Shift model doesn't have generic delete methods
   */
  async delete(_tenantDb: Pool, _id: number): Promise<boolean> {
    try {
      console.warn(
        'ShiftService.delete: This method should use specific Shift model methods'
      );
      throw new Error(
        'Method needs refactoring - Shift model does not have generic delete methods'
      );
    } catch (error) {
      console.error('Error in ShiftService.delete:', error);
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
    } catch (error) {
      console.error('Error in ShiftService.getShiftTemplates:', error);
      throw error;
    }
  }

  /**
   * Create a new shift template
   */
  async createShiftTemplate(templateData: any): Promise<ShiftTemplate> {
    try {
      return await createShiftTemplate(templateData);
    } catch (error) {
      console.error('Error in ShiftService.createShiftTemplate:', error);
      throw error;
    }
  }

  /**
   * Get all shift plans for a tenant with optional filters
   */
  async getShiftPlans(
    tenantId: number,
    userId: number,
    options?: any
  ): Promise<any> {
    try {
      return await getShiftPlans(tenantId, userId, options);
    } catch (error) {
      console.error('Error in ShiftService.getShiftPlans:', error);
      throw error;
    }
  }

  /**
   * Create a new shift plan
   */
  async createShiftPlan(planData: any): Promise<ShiftPlan> {
    try {
      return await createShiftPlan(planData);
    } catch (error) {
      console.error('Error in ShiftService.createShiftPlan:', error);
      throw error;
    }
  }

  /**
   * Get shifts for a specific plan
   */
  async getShiftsByPlan(
    planId: number,
    tenantId: number,
    userId: number
  ): Promise<any[]> {
    try {
      return await getShiftsByPlan(planId, tenantId, userId);
    } catch (error) {
      console.error('Error in ShiftService.getShiftsByPlan:', error);
      throw error;
    }
  }

  /**
   * Create a shift
   */
  async createShift(shiftData: any): Promise<any> {
    try {
      return await createShift(shiftData);
    } catch (error) {
      console.error('Error in ShiftService.createShift:', error);
      throw error;
    }
  }

  /**
   * Assign employee to a shift
   */
  async assignEmployeeToShift(assignmentData: any): Promise<any> {
    try {
      return await assignEmployeeToShift(assignmentData);
    } catch (error) {
      console.error('Error in ShiftService.assignEmployeeToShift:', error);
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
    endDate: string | Date
  ): Promise<any[]> {
    try {
      return await getEmployeeShifts(tenantId, userId, startDate, endDate);
    } catch (error) {
      console.error('Error in ShiftService.getEmployeeShifts:', error);
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

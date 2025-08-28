/**
 * Shifts API v2 Service Layer
 * Business logic for shift planning and management
 */
import { RowDataPacket } from 'mysql2';

import rootLog from '../../../models/rootLog';
import shiftModel from '../../../models/shift';
import { ServiceError } from '../../../utils/ServiceError';
import { execute, query } from '../../../utils/db';
import { apiToDb, dbToApi } from '../../../utils/fieldMapping';
import { logger } from '../../../utils/logger';

interface ShiftFilters {
  date?: string;
  startDate?: string;
  endDate?: string;
  userId?: number;
  areaId?: number;
  departmentId?: number;
  machineId?: number;
  teamId?: number;
  status?: string;
  type?: string;
  templateId?: number;
  planId?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface ShiftCreateData {
  planId?: number;
  userId: number;
  templateId?: number;
  date: string;
  startTime: string;
  endTime: string;
  title?: string;
  requiredEmployees?: number;
  breakMinutes?: number;
  status?: string;
  type?: string;
  notes?: string;
  areaId?: number;
  departmentId: number;
  teamId?: number;
  machineId?: number;
}

interface ShiftUpdateData {
  planId?: number;
  userId?: number;
  templateId?: number;
  date?: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  requiredEmployees?: number;
  actualStart?: string;
  actualEnd?: string;
  breakMinutes?: number;
  status?: string;
  type?: string;
  notes?: string;
  areaId?: number;
  departmentId?: number;
  teamId?: number;
  machineId?: number;
}

interface TemplateCreateData {
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  color?: string;
  isNightShift?: boolean;
  isActive?: boolean;
}

interface TemplateUpdateData {
  name?: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  color?: string;
  isNightShift?: boolean;
  isActive?: boolean;
}

interface SwapRequestCreateData {
  shiftId: number;
  requestedWithUserId?: number;
  reason?: string;
}

interface OverTimeData {
  userId: number;
  startDate: string;
  endDate: string;
}

interface ShiftApiResponse {
  id: number;
  userId: number;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  type?: string;
  status?: string;
  departmentId?: number;
  departmentName?: string;
  userName?: string;
  notes?: string;
}

// Interface for database shift data
interface DbShiftData extends RowDataPacket {
  id: number;
  tenant_id: number;
  plan_id?: number;
  user_id: number;
  template_id?: number;
  date: string;
  start_time: string;
  end_time: string;
  title?: string;
  required_employees?: number;
  actual_start?: string;
  actual_end?: string;
  break_minutes?: number;
  status?: string;
  type?: string;
  notes?: string;
  department_id: number;
  team_id?: number;
  created_by?: number;
  created_at?: Date;
  updated_at?: Date;
  // Joined fields
  template_name?: string;
  template_color?: string;
  user_name?: string;
  first_name?: string;
  last_name?: string;
  department_name?: string;
  team_name?: string;
}

// Helper function to convert DB shift to API format
/**
 * Convert database shift to API format
 * @param dbShift - Database shift data
 * @returns Shift in API response format
 */
function dbShiftToApi(dbShift: DbShiftData): ShiftApiResponse {
  const apiShift = dbToApi(dbShift) as unknown as ShiftApiResponse;

  // Extract time from datetime fields
  if (dbShift.start_time) {
    try {
      const startTime = new Date(dbShift.start_time);
      if (!Number.isNaN(startTime.getTime())) {
        // Get hours and minutes in local timezone
        const hours = startTime.getHours().toString().padStart(2, '0');
        const minutes = startTime.getMinutes().toString().padStart(2, '0');
        apiShift.startTime = `${hours}:${minutes}`;
      }
    } catch (error: unknown) {
      logger.error('Error parsing start_time:', error);
    }
  }

  if (dbShift.end_time) {
    try {
      const endTime = new Date(dbShift.end_time);
      if (!Number.isNaN(endTime.getTime())) {
        // Get hours and minutes in local timezone
        const hours = endTime.getHours().toString().padStart(2, '0');
        const minutes = endTime.getMinutes().toString().padStart(2, '0');
        apiShift.endTime = `${hours}:${minutes}`;
      }
    } catch (error: unknown) {
      logger.error('Error parsing end_time:', error);
    }
  }

  // Format date
  if (dbShift.date) {
    try {
      const date = new Date(dbShift.date);
      if (!Number.isNaN(date.getTime())) {
        apiShift.date = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      }
    } catch (error: unknown) {
      logger.error('Error parsing date:', error);
    }
  }

  return apiShift;
}

/**
 *
 */
export class ShiftsService {
  // ============= SHIFTS CRUD =============

  /**
   * List shifts for a tenant with filters
   * @param tenantId - Parameter description
   * @param filters - Parameter description
   * @returns Promise resolving to array of shifts
   */
  async listShifts(tenantId: number, filters: ShiftFilters): Promise<ShiftApiResponse[]> {
    try {
      const convertedFilters = apiToDb(filters as unknown as Record<string, unknown>);
      const dbFilters = {
        ...convertedFilters,
        tenant_id: tenantId,
      };

      const shifts = await shiftModel.findAll(dbFilters);
      return shifts.map((s) => dbShiftToApi(s));
    } catch (error: unknown) {
      logger.error('Error listing shifts:', error);
      throw new ServiceError('LIST_SHIFTS_ERROR', 'Failed to list shifts');
    }
  }

  /**
   * Get shift by ID
   * @param id - Parameter description
   * @param tenantId - Parameter description
   * @returns Promise resolving to shift or throws error
   */
  async getShiftById(id: number, tenantId: number): Promise<ShiftApiResponse> {
    try {
      const shiftData = await shiftModel.findById(id, tenantId);
      if (!shiftData) {
        throw new ServiceError('SHIFT_NOT_FOUND', 'Shift not found');
      }
      return dbShiftToApi(shiftData);
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error('Error getting shift:', error);
      throw new ServiceError('GET_SHIFT_ERROR', 'Failed to get shift');
    }
  }

  /**
   * Method implementation
   * @returns Promise resolving to result
   * @param data - Parameter description
   * @param tenantId - Parameter description
   * @param userId - Parameter description
   * @param ipAddress - Parameter description
   * @param userAgent - Parameter description
   */
  async createShift(
    data: ShiftCreateData,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ShiftApiResponse> {
    try {
      const convertedData = apiToDb(data as unknown as Record<string, unknown>);
      const dbData = {
        ...convertedData,
        tenant_id: tenantId,
        created_by: userId,
      };

      const shiftId = await shiftModel.create(dbData as Partial<DbShiftData>);

      // Log the creation
      await rootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: 'create',
        entity_type: 'shift',
        entity_id: shiftId,
        new_values: data as unknown as Record<string, unknown>,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return await this.getShiftById(shiftId, tenantId);
    } catch (error: unknown) {
      logger.error('Error creating shift:', error);
      throw new ServiceError('CREATE_SHIFT_ERROR', 'Failed to create shift');
    }
  }

  /**
   * Method implementation
   * @returns Promise resolving to result
   * @param id - Parameter description
   * @param data - Parameter description
   * @param tenantId - Parameter description
   * @param userId - Parameter description
   * @param ipAddress - Parameter description
   * @param userAgent - Parameter description
   */
  async updateShift(
    id: number,
    data: ShiftUpdateData,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ShiftApiResponse> {
    try {
      // Check if shift exists
      const oldShift = await this.getShiftById(id, tenantId);

      const dbData = apiToDb(data as unknown as Record<string, unknown>);
      await shiftModel.update(id, dbData as Partial<DbShiftData>, tenantId);

      // Log the update
      await rootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: 'update',
        entity_type: 'shift',
        entity_id: id,
        old_values: oldShift as unknown as Record<string, unknown>,
        new_values: data as unknown as Record<string, unknown>,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return await this.getShiftById(id, tenantId);
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error('Error updating shift:', error);
      throw new ServiceError('UPDATE_SHIFT_ERROR', 'Failed to update shift');
    }
  }

  /**
   * Method implementation
   * @returns Promise resolving to result
   * @param id - Parameter description
   * @param tenantId - Parameter description
   * @param userId - Parameter description
   * @param ipAddress - Parameter description
   * @param userAgent - Parameter description
   */
  async deleteShift(
    id: number,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    try {
      const shift = await this.getShiftById(id, tenantId);

      await shiftModel.delete(id, tenantId);

      // Log the deletion
      await rootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: 'delete',
        entity_type: 'shift',
        entity_id: id,
        old_values: shift as unknown as Record<string, unknown>,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return { message: 'Shift deleted successfully' };
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error('Error deleting shift:', error);
      throw new ServiceError('DELETE_SHIFT_ERROR', 'Failed to delete shift');
    }
  }

  // ============= TEMPLATES =============

  /**
   * Method implementation
   * @returns Promise resolving to result
   * @param tenantId - Parameter description
   */
  async listTemplates(tenantId: number): Promise<unknown[]> {
    try {
      const templates = await shiftModel.getTemplates(tenantId);
      return templates.map((template) => dbToApi(template));
    } catch (error: unknown) {
      logger.error('Error listing templates:', error);
      throw new ServiceError('LIST_TEMPLATES_ERROR', 'Failed to list templates');
    }
  }

  /**
   * Get shift by ID
   * @param id - Parameter description
   * @param tenantId - Parameter description
   * @returns Promise resolving to shift or throws error
   */
  async getTemplateById(id: number, tenantId: number): Promise<unknown> {
    try {
      const template = await shiftModel.getTemplateById(id, tenantId);
      if (!template) {
        throw new ServiceError('TEMPLATE_NOT_FOUND', 'Template not found');
      }
      return dbToApi(template);
    } catch (error: unknown) {
      logger.error('Error getting template:', error);
      throw new ServiceError('GET_TEMPLATE_ERROR', 'Failed to get template');
    }
  }

  /**
   * Method implementation
   * @returns Promise resolving to result
   * @param data - Parameter description
   * @param tenantId - Parameter description
   * @param userId - Parameter description
   * @param ipAddress - Parameter description
   * @param userAgent - Parameter description
   */
  async createTemplate(
    data: TemplateCreateData,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<unknown> {
    try {
      const convertedData = apiToDb(data as unknown as Record<string, unknown>);
      const dbData = {
        ...convertedData,
        tenant_id: tenantId,
        // shift_templates table doesn't have created_by column
      };

      const templateId = await shiftModel.createTemplate(
        dbData as {
          tenant_id: number;
          name: string;
          start_time: string;
          end_time: string;
          break_minutes?: number;
          color?: string;
          is_night_shift?: boolean;
          is_active?: boolean;
        },
      );

      // Log the creation
      await rootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: 'create',
        entity_type: 'shift_template',
        entity_id: templateId,
        new_values: data as unknown as Record<string, unknown>,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return await this.getTemplateById(templateId, tenantId);
    } catch (error: unknown) {
      logger.error('Error creating template:', error);
      throw new ServiceError('CREATE_TEMPLATE_ERROR', 'Failed to create template');
    }
  }

  /**
   * Method implementation
   * @returns Promise resolving to result
   * @param id - Parameter description
   * @param data - Parameter description
   * @param tenantId - Parameter description
   * @param userId - Parameter description
   * @param ipAddress - Parameter description
   * @param userAgent - Parameter description
   */
  async updateTemplate(
    id: number,
    data: TemplateUpdateData,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<unknown> {
    try {
      const oldTemplate = await this.getTemplateById(id, tenantId);

      const dbData = apiToDb(data as unknown as Record<string, unknown>);
      await shiftModel.updateTemplate(
        id,
        dbData as Partial<{
          name?: string;
          start_time?: string;
          end_time?: string;
          break_minutes?: number;
          color?: string;
          is_night_shift?: boolean;
          is_active?: boolean;
        }>,
        tenantId,
      );

      // Log the update
      await rootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: 'update',
        entity_type: 'shift_template',
        entity_id: id,
        old_values: oldTemplate as Record<string, unknown>,
        new_values: data as unknown as Record<string, unknown>,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return await this.getTemplateById(id, tenantId);
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error('Error updating template:', error);
      throw new ServiceError('UPDATE_TEMPLATE_ERROR', 'Failed to update template');
    }
  }

  /**
   * Method implementation
   * @returns Promise resolving to result
   * @param id - Parameter description
   * @param tenantId - Parameter description
   * @param userId - Parameter description
   * @param ipAddress - Parameter description
   * @param userAgent - Parameter description
   */
  async deleteTemplate(
    id: number,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    try {
      const template = await this.getTemplateById(id, tenantId);

      await shiftModel.deleteTemplate(id, tenantId);

      // Log the deletion
      await rootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: 'delete',
        entity_type: 'shift_template',
        entity_id: id,
        old_values: template as Record<string, unknown>,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return { message: 'Template deleted successfully' };
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error('Error deleting template:', error);
      throw new ServiceError('DELETE_TEMPLATE_ERROR', 'Failed to delete template');
    }
  }

  // ============= SWAP REQUESTS =============

  /**
   * Lists swap requests for shifts
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param filters - Filter options containing userId and status
   * @returns Promise resolving to array of swap requests
   */
  async listSwapRequests(
    tenantId: number,
    filters: { userId?: number; status?: string },
  ): Promise<unknown[]> {
    try {
      const requests = await shiftModel.getSwapRequests(tenantId, filters);
      return requests.map((request) => dbToApi(request));
    } catch (error: unknown) {
      logger.error('Error listing swap requests:', error);
      throw new ServiceError('LIST_SWAP_REQUESTS_ERROR', 'Failed to list swap requests');
    }
  }

  /**
   * Creates a new swap request
   * @param data - Swap request data
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param userId - ID of the user creating the request
   * @param ipAddress - Client IP address for logging
   * @param userAgent - Client user agent for logging
   * @returns Promise resolving to created swap request
   */
  async createSwapRequest(
    data: SwapRequestCreateData,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ id: number; message: string; [key: string]: unknown }> {
    try {
      // Verify shift exists and belongs to user
      const shift = await this.getShiftById(data.shiftId, tenantId);
      if (shift.userId !== userId) {
        throw new ServiceError('FORBIDDEN', 'You can only request swaps for your own shifts');
      }

      const dbData = {
        shift_id: data.shiftId,
        requested_by: userId,
        requested_with: data.requestedWithUserId,
        reason: data.reason,
        tenant_id: tenantId,
        status: 'pending',
      };

      const requestId = await shiftModel.createSwapRequest(dbData);

      // Log the creation
      await rootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: 'create_swap_request',
        entity_type: 'shift',
        entity_id: data.shiftId,
        new_values: data as unknown as Record<string, unknown>,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      const convertedResult = dbToApi(dbData as unknown as Record<string, unknown>);
      return {
        id: requestId,
        ...convertedResult,
        message: 'Swap request created successfully',
      };
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error('Error creating swap request:', error);
      throw new ServiceError('CREATE_SWAP_REQUEST_ERROR', 'Failed to create swap request');
    }
  }

  /**
   * Updates the status of a swap request
   * @param id - ID of the swap request to update
   * @param status - New status for the swap request
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param userId - ID of the user updating the request
   * @param ipAddress - Client IP address for logging
   * @param userAgent - Client user agent for logging
   * @returns Promise resolving to status message
   */
  async updateSwapRequestStatus(
    id: number,
    status: string,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    try {
      const request = await shiftModel.getSwapRequestById(id, tenantId);
      if (!request) {
        throw new ServiceError('SWAP_REQUEST_NOT_FOUND', 'Swap request not found');
      }

      await shiftModel.updateSwapRequestStatus(id, status, userId, tenantId);

      // Log the update
      await rootLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: `${status}_swap_request`,
        entity_type: 'shift_swap_request',
        entity_id: id,
        old_values: { status: request.status },
        new_values: { status },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return { message: `Swap request ${status} successfully` };
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error('Error updating swap request:', error);
      throw new ServiceError('UPDATE_SWAP_REQUEST_ERROR', 'Failed to update swap request');
    }
  }

  // ============= OVERTIME =============

  /**
   * Method implementation
   * @returns Promise resolving to result
   * @param data - Parameter description
   * @param tenantId - Parameter description
   */
  async getOvertimeReport(data: OverTimeData, tenantId: number): Promise<unknown> {
    try {
      const overtime = await shiftModel.getOvertimeByUser(
        data.userId,
        data.startDate,
        data.endDate,
        tenantId,
      );
      return dbToApi(overtime);
    } catch (error: unknown) {
      logger.error('Error getting overtime report:', error);
      throw new ServiceError('GET_OVERTIME_ERROR', 'Failed to get overtime report');
    }
  }

  // ============= EXPORT =============

  /**
   * Method implementation
   * @returns Promise resolving to result
   * @param filters - Parameter description
   * @param tenantId - Parameter description
   * @param format - Parameter description
   */
  async exportShifts(
    filters: ShiftFilters,
    tenantId: number,
    format: 'csv' | 'excel' = 'csv',
  ): Promise<string> {
    try {
      const shifts = await this.listShifts(tenantId, {
        ...filters,
        limit: 10000,
      });

      if (format === 'csv') {
        return this.generateCSV(shifts);
      } else {
        // TODO: Implement Excel export
        throw new ServiceError('NOT_IMPLEMENTED', 'Excel export not yet implemented');
      }
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      logger.error('Error exporting shifts:', error);
      throw new ServiceError('EXPORT_ERROR', 'Failed to export shifts');
    }
  }

  /**
   * Method implementation
   * @returns Promise resolving to result
   * @param shifts - Parameter description
   */
  private generateCSV(shifts: ShiftApiResponse[]): string {
    const headers = [
      'Date',
      'Employee',
      'Start Time',
      'End Time',
      'Break (min)',
      'Total Hours',
      'Type',
      'Status',
      'Department',
      'Notes',
    ];

    const rows = shifts.map((shift) => [
      shift.date,
      shift.userName ?? shift.userId,
      shift.startTime,
      shift.endTime,
      shift.breakMinutes ?? 0,
      this.calculateHours(shift.startTime, shift.endTime, shift.breakMinutes),
      shift.type,
      shift.status,
      shift.departmentName ?? shift.departmentId,
      shift.notes ?? '',
    ]);

    return [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell)}"`).join(',')),
    ].join('\n');
  }

  /**
   * Method implementation
   * @returns Promise resolving to result
   * @param startTime - Parameter description
   * @param endTime - Parameter description
   * @param breakMinutes - Parameter description
   */
  private calculateHours(startTime: string, endTime: string, breakMinutes = 0): number {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const breakHours = breakMinutes / 60;
    return Math.round((diffHours - breakHours) * 100) / 100;
  }

  // ============= SHIFT PLAN METHODS =============

  /**
   * Create a complete shift plan with shifts and notes
   * @param data - Shift plan data containing startDate, endDate, areaId, departmentId, teamId, machineId, name, shiftNotes, and shifts array
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param userId - ID of user creating the plan
   * @returns Object containing planId, shiftIds array and success message
   */
  async createShiftPlan(
    data: {
      startDate: string;
      endDate: string;
      areaId?: number;
      departmentId: number;
      teamId?: number;
      machineId?: number;
      name?: string;
      shiftNotes?: string; // Renamed from description, using camelCase
      kontischichtPattern?: string; // Pattern type from frontend (3er, 4er-standard, etc.)
      shifts: {
        userId: number;
        date: string;
        type: string;
        startTime: string;
        endTime: string;
      }[];
      // dailyNotes removed - redundant with shift_notes
    },
    tenantId: number,
    userId: number,
  ): Promise<{ planId: number; shiftIds: number[]; message: string }> {
    try {
      // Debug logging
      console.info('[SHIFT PLAN CREATE] Starting with data:', {
        startDate: data.startDate,
        endDate: data.endDate,
        shiftsCount: data.shifts.length,
        departmentId: data.departmentId,
        teamId: data.teamId,
        machineId: data.machineId,
        areaId: data.areaId,
        tenantId,
        userId,
      });

      // Start transaction (using query, not execute, because transactions don't work with prepared statements)
      await query('START TRANSACTION');

      // 1. Create shift_plan
      const weekNumber = this.getWeekNumber(new Date(data.startDate));
      const planName =
        data.name ??
        `Wochenplan KW ${String(weekNumber)}/${String(new Date(data.startDate).getFullYear())}`;

      // Check if this is a Kontischicht plan and use appropriate date range
      let planStartDate = data.startDate;
      let planEndDate = data.endDate;

      if (
        planName.toLowerCase().includes('kontischicht') ||
        data.name?.toLowerCase().includes('kontischicht') ||
        data.kontischichtPattern
      ) {
        // For Kontischicht, use the dates provided from modal (already in data.startDate and data.endDate)
        // These come from the Kontischicht modal date inputs
        planStartDate = data.startDate;
        planEndDate = data.endDate;

        // If no endDate provided, calculate default (end of KW1 next year)
        if (!planEndDate) {
          const startDate = new Date(data.startDate);
          const nextYear = startDate.getFullYear() + 1;
          const jan1 = new Date(nextYear, 0, 1);
          const dayOfWeek = jan1.getDay() || 7;
          const daysToThursday = (4 - dayOfWeek + 7) % 7 || 7;
          const firstThursday = new Date(nextYear, 0, 1 + daysToThursday);
          const sundayKW1 = new Date(firstThursday);
          sundayKW1.setDate(firstThursday.getDate() + (7 - firstThursday.getDay()));
          planEndDate = sundayKW1.toISOString().split('T')[0];
        }

        console.info('[KONTISCHICHT] Using dates for shift_plan:', {
          startDate: planStartDate,
          endDate: planEndDate,
          planName,
        });
      }

      const [planResult] = await execute(
        `INSERT INTO shift_plans (
          tenant_id, name, shift_notes,
          department_id, team_id, machine_id, area_id,
          start_date, end_date, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
        [
          tenantId,
          planName,
          data.shiftNotes ?? '',
          data.departmentId,
          data.teamId ?? null,
          data.machineId ?? null,
          data.areaId ?? null,
          planStartDate,
          planEndDate,
          userId,
        ],
      );

      const planId = (planResult as { insertId: number }).insertId;

      // 2. Create shifts with plan_id
      const shiftIds: number[] = [];

      // Check if this is Kontischicht and generate pattern for whole year
      let shiftsToCreate = data.shifts;
      const isKontischicht =
        planName.toLowerCase().includes('kontischicht') ||
        data.name?.toLowerCase().includes('kontischicht');

      if (isKontischicht && data.shifts.length > 0) {
        console.info('[KONTISCHICHT] Generating pattern from template');

        // Detect pattern type from data
        const patternType = this.detectPatternType(data);
        console.info(`[KONTISCHICHT] Pattern type detected: ${patternType}`);

        // Use the provided endDate from modal, or calculate a default
        let effectiveEndDateStr: string;

        if (data.endDate) {
          // Use the date from modal
          effectiveEndDateStr = data.endDate;
          console.info(`[KONTISCHICHT] Using provided end date from modal: ${effectiveEndDateStr}`);
        } else {
          // Fallback: generate until end of KW1 of next year for seamless transition
          const startDate = new Date(data.startDate);

          // Function to get last Sunday of KW1 in next year
          const getEndOfFirstWeekNextYear = (fromDate: Date): Date => {
            const nextYear = fromDate.getFullYear() + 1;
            // Find first Thursday of next year (determines KW1)
            const jan1 = new Date(nextYear, 0, 1);
            const dayOfWeek = jan1.getDay() || 7; // Sunday = 7
            const daysToThursday = (4 - dayOfWeek + 7) % 7 || 7;
            const firstThursday = new Date(nextYear, 0, 1 + daysToThursday);

            // Go to Sunday of that week
            const sundayKW1 = new Date(firstThursday);
            sundayKW1.setDate(firstThursday.getDate() + (7 - firstThursday.getDay()));

            return sundayKW1;
          };

          // Calculate end date - either 17 weeks minimum or end of KW1 next year
          const seventeenWeeksLater = new Date(startDate);
          seventeenWeeksLater.setDate(startDate.getDate() + 17 * 7);

          const endOfKW1NextYear = getEndOfFirstWeekNextYear(startDate);

          // Use the later date to ensure continuous coverage
          const effectiveEndDate =
            seventeenWeeksLater > endOfKW1NextYear ? seventeenWeeksLater : endOfKW1NextYear;
          effectiveEndDateStr = effectiveEndDate.toISOString().split('T')[0];
          console.info(`[KONTISCHICHT] Calculated default end date: ${effectiveEndDateStr}`);
        }

        const startDate = new Date(data.startDate);
        const endDate = new Date(effectiveEndDateStr);
        const weeks = Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000),
        );

        console.info(
          `[KONTISCHICHT] Generating pattern from ${data.startDate} to ${effectiveEndDateStr} (${weeks} weeks)`,
        );

        // Generate shifts based on pattern type for the specified period
        shiftsToCreate = this.generateKontischichtPeriod(
          data.shifts,
          data.startDate,
          effectiveEndDateStr,
          patternType,
        );

        console.info(
          `[KONTISCHICHT] Generated ${shiftsToCreate.length} shifts for period ${data.startDate} to ${effectiveEndDateStr} from ${data.shifts.length} template shifts`,
        );
      }

      for (const shift of shiftsToCreate) {
        const [shiftResult] = await execute(
          `INSERT INTO shifts (
            tenant_id, plan_id, user_id,
            date, start_time, end_time, type,
            area_id, department_id, team_id, machine_id,
            status, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?)`,
          [
            tenantId,
            planId,
            shift.userId,
            shift.date,
            `${shift.date} ${shift.startTime}:00`,
            `${shift.date} ${shift.endTime}:00`,
            shift.type,
            data.areaId ?? null,
            data.departmentId,
            data.teamId ?? null,
            data.machineId ?? null,
            userId,
          ],
        );
        shiftIds.push((shiftResult as { insertId: number }).insertId);
      }

      // 3. REMOVED: shift_notes - using shift_plans.description instead
      // Daily notes are redundant when we have shift_plans.description
      // If we need daily notes in future, they should be DIFFERENT per day

      // Commit transaction
      await query('COMMIT');

      return {
        planId,
        shiftIds,
        message: `Schichtplan erfolgreich erstellt (${String(shiftIds.length)} Schichten)`,
      };
    } catch (error) {
      // Rollback on error
      await query('ROLLBACK');
      logger.error('Error creating shift plan:', error);

      // More detailed error for debugging
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SHIFT PLAN ERROR] Details:', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        data: {
          startDate: data.startDate,
          endDate: data.endDate,
          shiftsCount: data.shifts.length,
          tenantId,
          userId,
        },
      });

      throw new ServiceError('CREATE_PLAN_ERROR', `Failed to create shift plan: ${errorMessage}`);
    }
  }

  /**
   * Get shift plan with all shifts and notes
   * @param filters - Filter object containing areaId, departmentId, teamId, machineId, startDate, and endDate
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @returns Object containing plan details, shifts array and notes
   */
  async getShiftPlan(
    filters: {
      areaId?: number;
      departmentId?: number;
      teamId?: number;
      machineId?: number;
      startDate?: string;
      endDate?: string;
    },
    tenantId: number,
  ): Promise<{
    plan?: unknown;
    shifts: unknown[];
    notes: unknown[];
  }> {
    try {
      // Find plan
      let planQuery = `
        SELECT * FROM shift_plans
        WHERE tenant_id = ?
      `;
      const params: (string | number)[] = [tenantId];

      if (filters.departmentId !== undefined) {
        planQuery += ' AND department_id = ?';
        params.push(filters.departmentId);
      }
      if (filters.teamId !== undefined) {
        planQuery += ' AND team_id = ?';
        params.push(filters.teamId);
      }
      if (filters.machineId !== undefined) {
        planQuery += ' AND machine_id = ?';
        params.push(filters.machineId);
      }
      if (filters.areaId !== undefined) {
        planQuery += ' AND area_id = ?';
        params.push(filters.areaId);
      }
      if (
        filters.startDate !== undefined &&
        filters.startDate !== '' &&
        filters.endDate !== undefined &&
        filters.endDate !== ''
      ) {
        planQuery += ' AND start_date <= ? AND end_date >= ?';
        params.push(filters.endDate, filters.startDate);
      }

      planQuery += ' ORDER BY created_at DESC LIMIT 1';

      const [plans] = await execute(planQuery, params);
      const plan = (plans as unknown[])[0];

      if (plan === undefined || plan === null) {
        return { shifts: [], notes: [] };
      }

      // Get shifts for this plan
      const [shifts] = await execute(
        `SELECT s.*, u.first_name, u.last_name, u.username
         FROM shifts s
         LEFT JOIN users u ON s.user_id = u.id
         WHERE s.plan_id = ?
         ORDER BY s.date, s.start_time`,
        [(plan as { id: number }).id],
      );

      // REMOVED: Loading from shift_notes - using shift_plans.description instead
      // The plan.description contains the weekly notes
      // Return empty notes array for backward compatibility

      return {
        plan: dbToApi(plan as Record<string, unknown>),
        shifts: (shifts as unknown[]).map((s) => dbToApi(s as Record<string, unknown>)),
        notes: [], // Empty - notes are in plan.description now
      };
    } catch (error) {
      logger.error('Error getting shift plan:', error);
      throw new ServiceError('GET_PLAN_ERROR', 'Failed to get shift plan');
    }
  }

  /**
   * Update existing shift plan
   * @param planId - Plan ID to update
   * @param data - Update data containing optional startDate, endDate, areaId, departmentId, teamId, machineId, name, shiftNotes, and shifts array
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param userId - User ID performing the update
   * @returns Update result
   */
  async updateShiftPlan(
    planId: number,
    data: {
      startDate?: string;
      endDate?: string;
      areaId?: number;
      departmentId?: number;
      teamId?: number;
      machineId?: number;
      name?: string;
      shiftNotes?: string;
      shifts?: {
        date: string;
        type: string;
        userId: number;
        startTime?: string;
        endTime?: string;
      }[];
    },
    tenantId: number,
    userId: number,
  ): Promise<{
    planId: number;
    shiftIds: number[];
    message: string;
  }> {
    try {
      await query('START TRANSACTION');

      // Check if plan exists and belongs to tenant
      const [existingPlans] = await execute(
        'SELECT id, department_id FROM shift_plans WHERE id = ? AND tenant_id = ?',
        [planId, tenantId],
      );

      if ((existingPlans as unknown[]).length === 0) {
        throw new ServiceError('NOT_FOUND', 'Shift plan not found');
      }

      const existingPlan = (existingPlans as { id: number; department_id: number }[])[0];
      const currentDepartmentId = data.departmentId ?? existingPlan.department_id;

      // Update plan metadata
      const updateFields: string[] = [];
      const updateValues: unknown[] = [];

      if (data.name !== undefined) {
        updateFields.push('name = ?');
        updateValues.push(data.name);
      }
      if (data.shiftNotes !== undefined) {
        updateFields.push('shift_notes = ?');
        updateValues.push(data.shiftNotes);
      }
      if (data.startDate !== undefined) {
        updateFields.push('start_date = ?');
        updateValues.push(data.startDate);
      }
      if (data.endDate !== undefined) {
        updateFields.push('end_date = ?');
        updateValues.push(data.endDate);
      }
      if (data.departmentId !== undefined) {
        updateFields.push('department_id = ?');
        updateValues.push(data.departmentId);
      }
      if (data.teamId !== undefined) {
        updateFields.push('team_id = ?');
        updateValues.push(data.teamId);
      }
      if (data.machineId !== undefined) {
        updateFields.push('machine_id = ?');
        updateValues.push(data.machineId);
      }
      if (data.areaId !== undefined) {
        updateFields.push('area_id = ?');
        updateValues.push(data.areaId);
      }

      // Always update updated_at
      updateFields.push('updated_at = NOW()');
      updateValues.push(planId, tenantId);

      if (updateFields.length > 0) {
        await execute(
          `UPDATE shift_plans SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`,
          updateValues,
        );
      }

      // If shifts are provided, update them
      const shiftIds: number[] = [];
      if (data.shifts !== undefined && data.shifts.length > 0) {
        // Delete existing shifts for this plan
        await execute('DELETE FROM shifts WHERE plan_id = ? AND tenant_id = ?', [planId, tenantId]);

        // Insert new shifts
        for (const shift of data.shifts) {
          const [result] = await execute(
            `INSERT INTO shifts (
              tenant_id, plan_id, user_id, date, type,
              start_time, end_time, department_id, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              tenantId,
              planId,
              shift.userId,
              shift.date,
              shift.type,
              shift.startTime ?? '06:00:00',
              shift.endTime ?? '14:00:00',
              currentDepartmentId,
              userId,
            ],
          );

          const insertResult = result as { insertId: number };
          shiftIds.push(insertResult.insertId);
        }
      }

      await query('COMMIT');

      return {
        planId,
        shiftIds,
        message: `Schichtplan erfolgreich aktualisiert${
          shiftIds.length > 0 ? ` (${String(shiftIds.length)} Schichten)` : ''
        }`,
      };
    } catch (error) {
      await query('ROLLBACK');

      if (error instanceof ServiceError) {
        throw error;
      }

      throw new ServiceError(
        'UPDATE_FAILED',
        error instanceof Error ? error.message : 'Failed to update shift plan',
      );
    }
  }

  /**
   * Helper to get week number
   * @param date - Parameter description
   * @returns ISO week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() !== 0 ? d.getUTCDay() : 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  // ============= FAVORITES =============

  /**
   * List user's shift planning favorites
   */
  async listFavorites(tenantId: number, userId: number): Promise<unknown[]> {
    const [rows] = await query<RowDataPacket[]>(
      `SELECT
        id,
        name,
        area_id as areaId,
        area_name as areaName,
        department_id as departmentId,
        department_name as departmentName,
        machine_id as machineId,
        machine_name as machineName,
        team_id as teamId,
        team_name as teamName,
        created_at as createdAt
      FROM shift_favorites
      WHERE tenant_id = ? AND user_id = ?
      ORDER BY created_at DESC`,
      [tenantId, userId],
    );
    return rows;
  }

  /**
   * Create new shift planning favorite
   */
  async createFavorite(
    tenantId: number,
    userId: number,
    data: {
      name: string;
      areaId: number;
      areaName: string;
      departmentId: number;
      departmentName: string;
      machineId: number;
      machineName: string;
      teamId: number;
      teamName: string;
    },
  ): Promise<unknown> {
    // Check if a favorite with the same name already exists for this user
    const [existing] = await query<RowDataPacket[]>(
      'SELECT id FROM shift_favorites WHERE tenant_id = ? AND user_id = ? AND name = ?',
      [tenantId, userId, data.name],
    );

    if (existing.length > 0) {
      throw new ServiceError('DUPLICATE', 'Ein Favorit mit diesem Namen existiert bereits');
    }

    // Insert new favorite
    const [result] = await execute(
      `INSERT INTO shift_favorites (
        tenant_id,
        user_id,
        name,
        area_id,
        area_name,
        department_id,
        department_name,
        machine_id,
        machine_name,
        team_id,
        team_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        userId,
        data.name,
        data.areaId,
        data.areaName,
        data.departmentId,
        data.departmentName,
        data.machineId,
        data.machineName,
        data.teamId,
        data.teamName,
      ],
    );

    const insertId = 'insertId' in result ? result.insertId : 0;

    return {
      id: insertId,
      ...data,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Delete shift planning favorite
   */
  async deleteFavorite(favoriteId: number, tenantId: number, userId: number): Promise<void> {
    // Delete the favorite (will fail if not exists or no permission)
    const [result] = await execute(
      'DELETE FROM shift_favorites WHERE id = ? AND tenant_id = ? AND user_id = ?',
      [favoriteId, tenantId, userId],
    );

    const affectedRows = 'affectedRows' in result ? result.affectedRows : 0;

    if (affectedRows === 0) {
      throw new ServiceError('NOT_FOUND', 'Favorit nicht gefunden oder keine Berechtigung');
    }
  }

  /**
   * Delete shift plan and associated shifts
   */
  /**
   * Detect the pattern type from shift data
   */
  private detectPatternType(data: {
    name?: string;
    patternType?: string;
    kontischichtPattern?: string;
    shifts: unknown[];
  }): 'auto' | '3er' | '4er-standard' | '4er-lang' | 'custom' {
    // Check if pattern type is explicitly provided
    if (data.kontischichtPattern) {
      console.info(`[KONTISCHICHT] Pattern provided from frontend: ${data.kontischichtPattern}`);
      return data.kontischichtPattern as 'auto' | '3er' | '4er-standard' | '4er-lang' | 'custom';
    }

    if (data.patternType) {
      return data.patternType as 'auto' | '3er' | '4er-standard' | '4er-lang' | 'custom';
    }

    // Check name for pattern hints
    if (data.name) {
      const nameLower = data.name.toLowerCase();
      if (nameLower.includes('3er')) return '3er';
      if (nameLower.includes('4er')) return '4er-standard';
    }

    // Auto-detect from employee count
    const uniqueEmployees = new Set(
      data.shifts.map((s) => {
        const shift = s as { userId?: number };
        return shift.userId;
      }),
    ).size;

    if (uniqueEmployees === 3) return '3er';
    if (uniqueEmployees === 4) return '4er-standard';

    return 'auto';
  }

  /**
   * Generate Kontischicht for a specific period based on pattern type
   */
  private generateKontischichtPeriod(
    templateShifts: {
      userId: number;
      date: string;
      startTime: string;
      endTime: string;
      type: string;
    }[],
    startDate: string,
    endDate: string,
    patternType: string,
  ): {
    userId: number;
    date: string;
    startTime: string;
    endTime: string;
    type: string;
  }[] {
    // For 4er-standard, use special logic
    if (patternType === '4er-standard') {
      return this.generate4erStandardPeriod(templateShifts, startDate, endDate);
    }

    // For other patterns, generate for the year and filter
    const year = new Date(startDate).getFullYear();
    const allShifts = this.generateKontischichtYear(templateShifts, year, patternType);

    // Filter to only the requested period
    const start = new Date(startDate);
    const end = new Date(endDate);
    return allShifts.filter((shift) => {
      const shiftDate = new Date(shift.date);
      return shiftDate >= start && shiftDate <= end;
    });
  }

  /**
   * Generate 4er Standard pattern for specific period
   */
  private generate4erStandardPeriod(
    templateShifts: {
      userId: number;
      date: string;
      startTime: string;
      endTime: string;
      type: string;
    }[],
    startDateStr: string,
    endDateStr: string,
  ): {
    userId: number;
    date: string;
    startTime: string;
    endTime: string;
    type: string;
  }[] {
    const yearShifts: typeof templateShifts = [];
    const employees = [...new Set(templateShifts.map((s) => s.userId))].slice(0, 4);

    if (employees.length !== 4) {
      console.warn('[4ER STANDARD PERIOD] Need exactly 4 employees, falling back');
      return templateShifts;
    }

    // 4er Standard Kontischicht: 2-2-2 Rotation
    const cyclePattern = [
      // Day 0-1: A=Früh, B=Spät, C=Nacht, D=Frei
      { shifts: { F: [0], S: [1], N: [2] } },
      { shifts: { F: [0], S: [1], N: [2] } },
      // Day 2-3: A=Spät, B=Nacht, C=Frei, D=Früh
      { shifts: { F: [3], S: [0], N: [1] } },
      { shifts: { F: [3], S: [0], N: [1] } },
      // Day 4-5: A=Nacht, B=Frei, C=Früh, D=Spät
      { shifts: { F: [2], S: [3], N: [0] } },
      { shifts: { F: [2], S: [3], N: [0] } },
      // Day 6-7: A=Frei, B=Früh, C=Spät, D=Nacht
      { shifts: { F: [1], S: [2], N: [3] } },
      { shifts: { F: [1], S: [2], N: [3] } },
    ];

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const patternStart = new Date(2025, 0, 1); // Pattern reference start

    // Process each day in the period
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      // Calculate which day in the 8-day cycle we're on
      const daysSincePatternStart = Math.floor(
        (date.getTime() - patternStart.getTime()) / (1000 * 60 * 60 * 24),
      );
      const cycleDay = daysSincePatternStart % 8; // 8-day cycle

      // Use Map instead of direct array access to avoid injection warning
      const patternMap = new Map(cyclePattern.entries());
      const pattern = patternMap.get(cycleDay);
      if (!pattern) continue;

      // Generate shifts for this day
      Object.entries(pattern.shifts).forEach(([shiftType, employeeIndices]) => {
        employeeIndices.forEach((empIdx) => {
          yearShifts.push({
            // eslint-disable-next-line security/detect-object-injection -- empIdx is from controlled array
            userId: employees[empIdx],
            date: date.toISOString().split('T')[0],
            startTime:
              shiftType === 'F' ? '06:00'
              : shiftType === 'S' ? '14:00'
              : '22:00',
            endTime:
              shiftType === 'F' ? '14:00'
              : shiftType === 'S' ? '22:00'
              : '06:00',
            type:
              shiftType === 'F' ? 'early'
              : shiftType === 'S' ? 'late'
              : 'night',
          });
        });
      });
    }

    return yearShifts;
  }

  /**
   * Generate Kontischicht year based on pattern type
   */
  private generateKontischichtYear(
    templateShifts: {
      userId: number;
      date: string;
      startTime: string;
      endTime: string;
      type: string;
    }[],
    year: number,
    patternType: string,
  ): {
    userId: number;
    date: string;
    startTime: string;
    endTime: string;
    type: string;
  }[] {
    switch (patternType) {
      case '3er':
        return this.generate3erRotation(templateShifts, year);
      case '4er-standard':
        return this.generate4erStandardRotation(templateShifts, year);
      case '4er-lang':
        return this.generate4erLangRotation(templateShifts, year);
      case 'custom':
      case 'auto':
      default:
        // Use existing 2-week pattern repetition
        return this.generateYearPatternFromTwoWeeks(templateShifts, year);
    }
  }

  /**
   * Generate 3er rotation pattern (3 employees, 9-day cycle)
   */
  private generate3erRotation(
    templateShifts: {
      userId: number;
      date: string;
      startTime: string;
      endTime: string;
      type: string;
    }[],
    year: number,
  ): {
    userId: number;
    date: string;
    startTime: string;
    endTime: string;
    type: string;
  }[] {
    const yearShifts: typeof templateShifts = [];
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);

    // 3er rotation pattern: 3 days early, 3 days late, 3 days night, 3 days free
    const rotationPattern = [
      { days: 3, shift: 'F' }, // Früh
      { days: 3, shift: 'S' }, // Spät
      { days: 3, shift: 'N' }, // Nacht
      { days: 3, shift: null }, // Frei
    ];

    // Get unique employees
    const employees = [...new Set(templateShifts.map((s) => s.userId))].slice(0, 3);
    if (employees.length !== 3) {
      console.warn('[3ER ROTATION] Need exactly 3 employees, falling back to standard');
      return this.generateYearPatternFromTwoWeeks(templateShifts, year);
    }

    let currentDate = new Date(yearStart);
    let patternIndex = 0;
    let employeeOffset = 0;

    while (currentDate <= yearEnd) {
      for (let i = 0; i < 3; i++) {
        const employeeIndex = (i + employeeOffset) % 3;
        const patternPhase = (patternIndex + i) % 4;
        // eslint-disable-next-line security/detect-object-injection -- patternPhase is bounded by modulo 4
        const shiftType = rotationPattern[patternPhase].shift;

        if (shiftType) {
          yearShifts.push({
            // eslint-disable-next-line security/detect-object-injection -- employeeIndex is bounded by modulo 3
            userId: employees[employeeIndex],
            date: currentDate.toISOString().split('T')[0],
            startTime:
              shiftType === 'F' ? '06:00'
              : shiftType === 'S' ? '14:00'
              : '22:00',
            endTime:
              shiftType === 'F' ? '14:00'
              : shiftType === 'S' ? '22:00'
              : '06:00',
            type: shiftType,
          });
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);

      // After each day, check if we completed a phase
      const daysSinceStart = Math.floor(
        (currentDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSinceStart % 3 === 0) {
        patternIndex = (patternIndex + 1) % 4;
      }

      // After 12 days (full cycle), shift employee positions
      if (daysSinceStart % 12 === 0) {
        employeeOffset = (employeeOffset + 1) % 3;
      }
    }

    return yearShifts;
  }

  /**
   * Generate 4er standard rotation (4 employees, 2-2-2 pattern)
   */
  private generate4erStandardRotation(
    templateShifts: {
      userId: number;
      date: string;
      startTime: string;
      endTime: string;
      type: string;
    }[],
    year: number,
  ): {
    userId: number;
    date: string;
    startTime: string;
    endTime: string;
    type: string;
  }[] {
    const yearShifts: typeof templateShifts = [];

    // Analyze the template to understand the pattern
    const employees = [...new Set(templateShifts.map((s) => s.userId))].slice(0, 4);
    if (employees.length !== 4) {
      console.warn('[4ER STANDARD] Need exactly 4 employees, falling back');
      return this.generateYearPatternFromTwoWeeks(templateShifts, year);
    }

    // 4er Standard Kontischicht: 2-2-2 Rotation
    // Each employee works 2 days per shift type, then 2 days free
    // Complete cycle: 8 days (2F-2S-2N-2Free)
    // A: FF SS NN -- | B: SS NN -- FF | C: NN -- FF SS | D: -- FF SS NN
    const cyclePattern = new Map<
      number,
      { day: number; shifts: { F: number[]; S: number[]; N: number[] } }
    >([
      // Day 0-1: A=Früh, B=Spät, C=Nacht, D=Frei
      [0, { day: 0, shifts: { F: [0], S: [1], N: [2] } }], // Day 1
      [1, { day: 1, shifts: { F: [0], S: [1], N: [2] } }], // Day 2
      // Day 2-3: A=Spät, B=Nacht, C=Frei, D=Früh
      [2, { day: 2, shifts: { F: [3], S: [0], N: [1] } }], // Day 3
      [3, { day: 3, shifts: { F: [3], S: [0], N: [1] } }], // Day 4
      // Day 4-5: A=Nacht, B=Frei, C=Früh, D=Spät
      [4, { day: 4, shifts: { F: [2], S: [3], N: [0] } }], // Day 5
      [5, { day: 5, shifts: { F: [2], S: [3], N: [0] } }], // Day 6
      // Day 6-7: A=Frei, B=Früh, C=Spät, D=Nacht
      [6, { day: 6, shifts: { F: [1], S: [2], N: [3] } }], // Day 7
      [7, { day: 7, shifts: { F: [1], S: [2], N: [3] } }], // Day 8 (wraps to day 0)
    ]);

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    // Process each day of the year
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      // Calculate which day in the 8-day cycle we're on
      const daysSinceStart = Math.floor(
        (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const cycleDay = daysSinceStart % 8; // 8-day cycle

      // Get pattern for this cycle day from Map
      const pattern = cyclePattern.get(cycleDay);
      if (!pattern) continue; // Skip if no pattern defined

      // Generate shifts for this day
      Object.entries(pattern.shifts).forEach(([shiftType, employeeIndices]) => {
        employeeIndices.forEach((empIdx) => {
          yearShifts.push({
            // eslint-disable-next-line security/detect-object-injection -- empIdx is from controlled array
            userId: employees[empIdx],
            date: date.toISOString().split('T')[0],
            startTime:
              shiftType === 'F' ? '06:00'
              : shiftType === 'S' ? '14:00'
              : '22:00',
            endTime:
              shiftType === 'F' ? '14:00'
              : shiftType === 'S' ? '22:00'
              : '06:00',
            type:
              shiftType === 'F' ? 'early'
              : shiftType === 'S' ? 'late'
              : 'night',
          });
        });
      });
    }

    return yearShifts;
  }

  /**
   * Generate 4er long rotation (4 employees, 4-4-4 pattern)
   */
  private generate4erLangRotation(
    templateShifts: {
      userId: number;
      date: string;
      startTime: string;
      endTime: string;
      type: string;
    }[],
    year: number,
  ): {
    userId: number;
    date: string;
    startTime: string;
    endTime: string;
    type: string;
  }[] {
    const yearShifts: typeof templateShifts = [];
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);

    // 4er long pattern: 4 days each shift type
    const rotationPattern = [
      { days: 4, shift: 'F' },
      { days: 4, shift: 'S' },
      { days: 4, shift: 'N' },
      { days: 4, shift: null }, // Free
    ];

    const employees = [...new Set(templateShifts.map((s) => s.userId))].slice(0, 4);
    if (employees.length !== 4) {
      return this.generateYearPatternFromTwoWeeks(templateShifts, year);
    }

    let currentDate = new Date(yearStart);
    let dayCount = 0;

    while (currentDate <= yearEnd) {
      const cycleDay = dayCount % 16; // 16-day cycle
      const phaseIndex = Math.floor(cycleDay / 4);

      for (let i = 0; i < 4; i++) {
        const employeePhase = (phaseIndex + i) % 4;
        // eslint-disable-next-line security/detect-object-injection -- employeePhase is bounded by modulo 4
        const shiftType = rotationPattern[employeePhase].shift;

        if (shiftType) {
          yearShifts.push({
            // eslint-disable-next-line security/detect-object-injection -- i is bounded by for loop (0-3)
            userId: employees[i],
            date: currentDate.toISOString().split('T')[0],
            startTime:
              shiftType === 'F' ? '06:00'
              : shiftType === 'S' ? '14:00'
              : '22:00',
            endTime:
              shiftType === 'F' ? '14:00'
              : shiftType === 'S' ? '22:00'
              : '06:00',
            type: shiftType,
          });
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
      dayCount++;
    }

    return yearShifts;
  }

  /**
   * Generate year-long shift pattern from 2-week Kontischicht template
   * @param twoWeekShifts - Array of shifts for 2 weeks (template)
   * @param year - Target year to generate shifts for
   * @returns Array of shifts for the entire year
   */
  private generateYearPatternFromTwoWeeks(
    twoWeekShifts: {
      userId: number;
      date: string;
      startTime: string;
      endTime: string;
      type: string;
    }[],
    year: number,
  ): {
    userId: number;
    date: string;
    startTime: string;
    endTime: string;
    type: string;
  }[] {
    const yearShifts: {
      userId: number;
      date: string;
      startTime: string;
      endTime: string;
      type: string;
    }[] = [];

    // Sort template shifts by date to understand the pattern
    const sortedTemplate = [...twoWeekShifts].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    if (sortedTemplate.length === 0) {
      return yearShifts;
    }

    // Get the first Monday of the template
    const firstTemplateDate = new Date(sortedTemplate[0].date);
    const firstTemplateWeekday = firstTemplateDate.getDay() || 7; // Sunday = 0 -> 7
    const templateStartMonday = new Date(firstTemplateDate);
    templateStartMonday.setDate(firstTemplateDate.getDate() - (firstTemplateWeekday - 1));

    // Group template shifts by week (Week A and Week B)
    const weekAShifts: typeof twoWeekShifts = [];
    const weekBShifts: typeof twoWeekShifts = [];

    for (const shift of sortedTemplate) {
      const shiftDate = new Date(shift.date);
      const weekNumber = this.getWeekNumber(shiftDate);
      const firstWeekNumber = this.getWeekNumber(firstTemplateDate);

      if (weekNumber === firstWeekNumber) {
        weekAShifts.push(shift);
      } else {
        weekBShifts.push(shift);
      }
    }

    console.info('[KONTISCHICHT] Pattern analysis:', {
      weekACount: weekAShifts.length,
      weekBCount: weekBShifts.length,
      year,
    });

    // Generate shifts for entire year
    const yearStart = new Date(year, 0, 1);
    // Find first Monday of the year
    const firstMonday = new Date(yearStart);
    const yearStartWeekday = yearStart.getDay() || 7;
    if (yearStartWeekday !== 1) {
      firstMonday.setDate(yearStart.getDate() + (8 - yearStartWeekday));
    }

    // Iterate through all weeks of the year
    for (let weekOffset = 0; weekOffset < 52; weekOffset++) {
      const currentWeekMonday = new Date(firstMonday);
      currentWeekMonday.setDate(firstMonday.getDate() + weekOffset * 7);

      // Determine which pattern to use (A or B) - alternating
      const useWeekA = weekOffset % 2 === 0;
      const templateWeek = useWeekA ? weekAShifts : weekBShifts;

      // Generate shifts for this week based on pattern
      for (const templateShift of templateWeek) {
        const templateDate = new Date(templateShift.date);
        const templateWeekday = templateDate.getDay() || 7;

        // Calculate the actual date for this shift in the current week
        const shiftDate = new Date(currentWeekMonday);
        shiftDate.setDate(currentWeekMonday.getDate() + (templateWeekday - 1));

        // Only add shifts that are actually in the target year
        if (shiftDate.getFullYear() === year) {
          yearShifts.push({
            userId: templateShift.userId,
            date: shiftDate.toISOString().split('T')[0],
            startTime: templateShift.startTime,
            endTime: templateShift.endTime,
            type: templateShift.type,
          });
        }
      }
    }

    console.info(`[KONTISCHICHT] Generated ${yearShifts.length} shifts for year ${year}`);
    return yearShifts;
  }

  async deleteShiftPlan(planId: number, tenantId: number): Promise<void> {
    // First check if the plan exists and belongs to this tenant
    const [plans] = await execute(
      'SELECT id, department_id, team_id FROM shift_plans WHERE id = ? AND tenant_id = ?',
      [planId, tenantId],
    );

    if (!Array.isArray(plans) || plans.length === 0) {
      throw new ServiceError('NOT_FOUND', 'Shift plan not found');
    }

    // Delete all shifts associated with this plan
    await execute('DELETE FROM shifts WHERE plan_id = ? AND tenant_id = ?', [planId, tenantId]);

    // Delete the shift plan itself
    const [result] = await execute('DELETE FROM shift_plans WHERE id = ? AND tenant_id = ?', [
      planId,
      tenantId,
    ]);

    const affectedRows = 'affectedRows' in result ? result.affectedRows : 0;

    if (affectedRows === 0) {
      throw new ServiceError('NOT_FOUND', 'Failed to delete shift plan');
    }

    console.info(
      `[SHIFTS] Deleted shift plan ${planId} and associated shifts for tenant ${tenantId}`,
    );
  }
}

// Export singleton instance
export const shiftsService = new ShiftsService();

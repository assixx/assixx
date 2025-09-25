/**
 * Shifts API v2 Service Layer
 * Core business logic for shift operations
 */
import { RowDataPacket } from 'mysql2';

import rootLog from '../../../models/rootLog';
import shiftModel from '../../../models/shift';
import { ServiceError } from '../../../utils/ServiceError';
import { execute } from '../../../utils/db';
import { apiToDb, dbToApi } from '../../../utils/fieldMapping';
import { logger } from '../../../utils/logger';
import { shiftPlansService } from './shift-plans.service';

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

// Helper functions for date/time parsing
/**
 * Parse a datetime field and return formatted time string (HH:mm)
 * @param dateTimeValue - DateTime value to parse
 * @param fieldName - Field name for error logging
 * @returns Formatted time string or undefined
 */
function parseTimeFromDateTime(
  dateTimeValue: string | Date | undefined,
  fieldName: string,
): string | undefined {
  if (!dateTimeValue) {
    return undefined;
  }

  try {
    const dateTime = new Date(dateTimeValue);
    if (Number.isNaN(dateTime.getTime())) {
      return undefined;
    }

    const hours = dateTime.getHours().toString().padStart(2, '0');
    const minutes = dateTime.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (error: unknown) {
    logger.error(`Error parsing ${fieldName}:`, error);
    return undefined;
  }
}

/**
 * Parse a date field and return formatted date string (YYYY-MM-DD)
 * @param dateValue - Date value to parse
 * @returns Formatted date string or undefined
 */
function parseDateToString(dateValue: string | Date | undefined): string | undefined {
  if (!dateValue) {
    return undefined;
  }

  try {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    return date.toISOString().split('T')[0];
  } catch (error: unknown) {
    logger.error('Error parsing date:', error);
    return undefined;
  }
}

// Helper function to convert DB shift to API format
/**
 * Convert database shift to API format
 * @param dbShift - Database shift data
 * @returns Shift in API response format
 */
function dbShiftToApi(dbShift: DbShiftData): ShiftApiResponse {
  const apiShift = dbToApi(dbShift) as unknown as ShiftApiResponse;

  // Extract and format times
  const startTime = parseTimeFromDateTime(dbShift.start_time, 'start_time');
  if (startTime) {
    apiShift.startTime = startTime;
  }

  const endTime = parseTimeFromDateTime(dbShift.end_time, 'end_time');
  if (endTime) {
    apiShift.endTime = endTime;
  }

  // Format date
  const formattedDate = parseDateToString(dbShift.date);
  if (formattedDate) {
    apiShift.date = formattedDate;
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

  // ============= SHIFT PLAN METHODS (DELEGATED) =============

  /**
   * Create a complete shift plan with shifts and notes
   * Delegates to shiftPlansService
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
      shiftNotes?: string;
      kontischichtPattern?: string;
      shifts: {
        userId: number;
        date: string;
        type: string;
        startTime: string;
        endTime: string;
      }[];
    },
    tenantId: number,
    userId: number,
  ): Promise<{ planId: number; shiftIds: number[]; message: string }> {
    return await shiftPlansService.createShiftPlan(data, tenantId, userId);
  }

  /**
   * Get shift plan with all shifts and notes
   * Delegates to shiftPlansService
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
    return await shiftPlansService.getShiftPlan(filters, tenantId);
  }

  /**
   * Update existing shift plan
   * Delegates to shiftPlansService
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
    return await shiftPlansService.updateShiftPlan(planId, data, tenantId, userId);
  }

  /**
   * Delete shift plan and associated shifts
   * Delegates to shiftPlansService
   */
  async deleteShiftPlan(planId: number, tenantId: number): Promise<void> {
    await shiftPlansService.deleteShiftPlan(planId, tenantId);
  }

  // ============= FAVORITES (DELEGATED) =============

  /**
   * List user's shift planning favorites
   * Delegates to shiftPlansService
   */
  async listFavorites(tenantId: number, userId: number): Promise<unknown[]> {
    return await shiftPlansService.listFavorites(tenantId, userId);
  }

  /**
   * Create new shift planning favorite
   * Delegates to shiftPlansService
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
    return await shiftPlansService.createFavorite(tenantId, userId, data);
  }

  /**
   * Delete shift planning favorite
   * Delegates to shiftPlansService
   */
  async deleteFavorite(favoriteId: number, tenantId: number, userId: number): Promise<void> {
    await shiftPlansService.deleteFavorite(favoriteId, tenantId, userId);
  }

  /**
   * Get user's shifts for calendar display
   * Only returns shifts with F/S/N types for the specific user
   */
  async getUserCalendarShifts(
    userId: number,
    tenantId: number,
    startDate: string,
    endDate: string,
  ): Promise<{ date: string; type: string }[]> {
    try {
      // Query BOTH tables as specified in shifts-in-calendar.md plan
      const sqlQuery = `
        SELECT DISTINCT date, type FROM (
          -- From shifts table (primary source)
          SELECT
            DATE(date) as date,
            CAST(type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as type
          FROM shifts
          WHERE user_id = ?
            AND tenant_id = ?
            AND date BETWEEN ? AND ?
            AND type IN ('F', 'S', 'N', 'early', 'late', 'night')

          UNION

          -- From shift_rotation_history table (secondary source)
          SELECT
            DATE(shift_date) as date,
            CAST(shift_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as type
          FROM shift_rotation_history
          WHERE user_id = ?
            AND tenant_id = ?
            AND shift_date BETWEEN ? AND ?
        ) AS combined_shifts
        ORDER BY date ASC
      `;

      const [rows] = await execute<RowDataPacket[]>(sqlQuery, [
        // Parameters for shifts table
        userId,
        tenantId,
        startDate,
        endDate,
        // Parameters for shift_rotation_history table
        userId,
        tenantId,
        startDate,
        endDate,
      ]);

      // Convert early/late/night to F/S/N for consistency
      return rows.map((row) => {
        const shiftRow = row as unknown as { date: string; type: string };
        return {
          date: shiftRow.date,
          type:
            shiftRow.type === 'early' ? 'F'
            : shiftRow.type === 'late' ? 'S'
            : shiftRow.type === 'night' ? 'N'
            : shiftRow.type,
        };
      });
    } catch (error: unknown) {
      logger.error('Error fetching user calendar shifts:', error);
      throw new ServiceError('SERVER_ERROR', 'Failed to fetch user shifts');
    }
  }
}

// Export singleton instance
export const shiftsService = new ShiftsService();

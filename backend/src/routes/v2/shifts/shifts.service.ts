/**
 * Shifts API v2 Service Layer
 * Business logic for shift planning and management
 */

import { RowDataPacket } from "mysql2";

import AdminLog from "../../../models/adminLog";
import Shift from "../../../models/shift";
import { dbToApi, apiToDb } from "../../../utils/fieldMapping";
import { logger } from "../../../utils/logger";
import { ServiceError } from "../../../utils/ServiceError";

interface ShiftFilters {
  date?: string;
  startDate?: string;
  endDate?: string;
  userId?: number;
  departmentId?: number;
  teamId?: number;
  status?: string;
  type?: string;
  templateId?: number;
  planId?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
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
  departmentId: number;
  teamId?: number;
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
  departmentId?: number;
  teamId?: number;
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
function dbShiftToApi(dbShift: DbShiftData): ShiftApiResponse {
  const apiShift = dbToApi<ShiftApiResponse>(dbShift);

  // Extract time from datetime fields
  if (dbShift.start_time) {
    try {
      const startTime = new Date(dbShift.start_time);
      if (!isNaN(startTime.getTime())) {
        // Get hours and minutes in local timezone
        const hours = startTime.getHours().toString().padStart(2, "0");
        const minutes = startTime.getMinutes().toString().padStart(2, "0");
        apiShift.startTime = `${hours}:${minutes}`;
      }
    } catch (e) {
      logger.error("Error parsing start_time:", e);
    }
  }

  if (dbShift.end_time) {
    try {
      const endTime = new Date(dbShift.end_time);
      if (!isNaN(endTime.getTime())) {
        // Get hours and minutes in local timezone
        const hours = endTime.getHours().toString().padStart(2, "0");
        const minutes = endTime.getMinutes().toString().padStart(2, "0");
        apiShift.endTime = `${hours}:${minutes}`;
      }
    } catch (e) {
      logger.error("Error parsing end_time:", e);
    }
  }

  // Format date
  if (dbShift.date) {
    try {
      const date = new Date(dbShift.date);
      if (!isNaN(date.getTime())) {
        apiShift.date = date.toISOString().split("T")[0]; // YYYY-MM-DD format
      }
    } catch (e) {
      logger.error("Error parsing date:", e);
    }
  }

  return apiShift;
}

export class ShiftsService {
  // ============= SHIFTS CRUD =============

  async listShifts(tenantId: number, filters: ShiftFilters) {
    try {
      const convertedFilters = apiToDb<Record<string, unknown>>(
        filters as unknown as Record<string, unknown>,
      );
      const dbFilters = {
        ...convertedFilters,
        tenant_id: tenantId,
      };

      const shifts = await Shift.findAll(dbFilters);
      return shifts.map((shift) => dbShiftToApi(shift));
    } catch (error) {
      logger.error("Error listing shifts:", error);
      throw new ServiceError("LIST_SHIFTS_ERROR", "Failed to list shifts");
    }
  }

  async getShiftById(id: number, tenantId: number) {
    try {
      const shift = await Shift.findById(id, tenantId);
      if (!shift) {
        throw new ServiceError("SHIFT_NOT_FOUND", "Shift not found");
      }
      return dbShiftToApi(shift);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      logger.error("Error getting shift:", error);
      throw new ServiceError("GET_SHIFT_ERROR", "Failed to get shift");
    }
  }

  async createShift(
    data: ShiftCreateData,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      const convertedData = apiToDb<Record<string, unknown>>(
        data as unknown as Record<string, unknown>,
      );
      const dbData = {
        ...convertedData,
        tenant_id: tenantId,
        created_by: userId,
      };

      const shiftId = await Shift.create(dbData as Partial<DbShiftData>);

      // Log the creation
      await AdminLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: "create",
        entity_type: "shift",
        entity_id: shiftId,
        new_values: data as unknown as Record<string, unknown>,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return this.getShiftById(shiftId, tenantId);
    } catch (error) {
      logger.error("Error creating shift:", error);
      throw new ServiceError("CREATE_SHIFT_ERROR", "Failed to create shift");
    }
  }

  async updateShift(
    id: number,
    data: ShiftUpdateData,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      // Check if shift exists
      const oldShift = await this.getShiftById(id, tenantId);

      const dbData = apiToDb(data as unknown as Record<string, unknown>);
      await Shift.update(id, dbData as Partial<DbShiftData>, tenantId);

      // Log the update
      await AdminLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: "update",
        entity_type: "shift",
        entity_id: id,
        old_values: oldShift as unknown as Record<string, unknown>,
        new_values: data as unknown as Record<string, unknown>,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return this.getShiftById(id, tenantId);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      logger.error("Error updating shift:", error);
      throw new ServiceError("UPDATE_SHIFT_ERROR", "Failed to update shift");
    }
  }

  async deleteShift(
    id: number,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      const shift = await this.getShiftById(id, tenantId);

      await Shift.delete(id, tenantId);

      // Log the deletion
      await AdminLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: "delete",
        entity_type: "shift",
        entity_id: id,
        old_values: shift as unknown as Record<string, unknown>,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return { message: "Shift deleted successfully" };
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      logger.error("Error deleting shift:", error);
      throw new ServiceError("DELETE_SHIFT_ERROR", "Failed to delete shift");
    }
  }

  // ============= TEMPLATES =============

  async listTemplates(tenantId: number) {
    try {
      const templates = await Shift.getTemplates(tenantId);
      return templates.map((template) => dbToApi(template));
    } catch (error) {
      logger.error("Error listing templates:", error);
      throw new ServiceError(
        "LIST_TEMPLATES_ERROR",
        "Failed to list templates",
      );
    }
  }

  async getTemplateById(id: number, tenantId: number) {
    try {
      const template = await Shift.getTemplateById(id, tenantId);
      if (!template) {
        throw new ServiceError("TEMPLATE_NOT_FOUND", "Template not found");
      }
      return dbToApi(template);
    } catch (error) {
      logger.error("Error getting template:", error);
      throw new ServiceError("GET_TEMPLATE_ERROR", "Failed to get template");
    }
  }

  async createTemplate(
    data: TemplateCreateData,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      const convertedData = apiToDb<Record<string, unknown>>(
        data as unknown as Record<string, unknown>,
      );
      const dbData = {
        ...convertedData,
        tenant_id: tenantId,
        // shift_templates table doesn't have created_by column
      };

      const templateId = await Shift.createTemplate(
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
      await AdminLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: "create",
        entity_type: "shift_template",
        entity_id: templateId,
        new_values: data as unknown as Record<string, unknown>,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return this.getTemplateById(templateId, tenantId);
    } catch (error) {
      logger.error("Error creating template:", error);
      throw new ServiceError(
        "CREATE_TEMPLATE_ERROR",
        "Failed to create template",
      );
    }
  }

  async updateTemplate(
    id: number,
    data: TemplateUpdateData,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      const oldTemplate = await this.getTemplateById(id, tenantId);

      const dbData = apiToDb(data as unknown as Record<string, unknown>);
      await Shift.updateTemplate(
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
      await AdminLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: "update",
        entity_type: "shift_template",
        entity_id: id,
        old_values: oldTemplate as Record<string, unknown>,
        new_values: data as unknown as Record<string, unknown>,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return this.getTemplateById(id, tenantId);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      logger.error("Error updating template:", error);
      throw new ServiceError(
        "UPDATE_TEMPLATE_ERROR",
        "Failed to update template",
      );
    }
  }

  async deleteTemplate(
    id: number,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      const template = await this.getTemplateById(id, tenantId);

      await Shift.deleteTemplate(id, tenantId);

      // Log the deletion
      await AdminLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: "delete",
        entity_type: "shift_template",
        entity_id: id,
        old_values: template as Record<string, unknown>,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return { message: "Template deleted successfully" };
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      logger.error("Error deleting template:", error);
      throw new ServiceError(
        "DELETE_TEMPLATE_ERROR",
        "Failed to delete template",
      );
    }
  }

  // ============= SWAP REQUESTS =============

  async listSwapRequests(
    tenantId: number,
    filters: { userId?: number; status?: string },
  ) {
    try {
      const requests = await Shift.getSwapRequests(tenantId, filters);
      return requests.map((request) => dbToApi(request));
    } catch (error) {
      logger.error("Error listing swap requests:", error);
      throw new ServiceError(
        "LIST_SWAP_REQUESTS_ERROR",
        "Failed to list swap requests",
      );
    }
  }

  async createSwapRequest(
    data: SwapRequestCreateData,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      // Verify shift exists and belongs to user
      const shift = await this.getShiftById(data.shiftId, tenantId);
      if ((shift as ShiftApiResponse).userId !== userId) {
        throw new ServiceError(
          "FORBIDDEN",
          "You can only request swaps for your own shifts",
        );
      }

      const dbData = {
        shift_id: data.shiftId,
        requested_by: userId,
        requested_with: data.requestedWithUserId,
        reason: data.reason,
        tenant_id: tenantId,
        status: "pending",
      };

      const requestId = await Shift.createSwapRequest(dbData);

      // Log the creation
      await AdminLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: "create_swap_request",
        entity_type: "shift",
        entity_id: data.shiftId,
        new_values: data as unknown as Record<string, unknown>,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      const convertedResult = dbToApi<Record<string, unknown>>(
        dbData as unknown as Record<string, unknown>,
      );
      return {
        id: requestId,
        ...convertedResult,
        message: "Swap request created successfully",
      };
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      logger.error("Error creating swap request:", error);
      throw new ServiceError(
        "CREATE_SWAP_REQUEST_ERROR",
        "Failed to create swap request",
      );
    }
  }

  async updateSwapRequestStatus(
    id: number,
    status: string,
    tenantId: number,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      const request = await Shift.getSwapRequestById(id, tenantId);
      if (!request) {
        throw new ServiceError(
          "SWAP_REQUEST_NOT_FOUND",
          "Swap request not found",
        );
      }

      await Shift.updateSwapRequestStatus(id, status, userId, tenantId);

      // Log the update
      await AdminLog.create({
        tenant_id: tenantId,
        user_id: userId,
        action: `${status}_swap_request`,
        entity_type: "shift_swap_request",
        entity_id: id,
        old_values: { status: request.status },
        new_values: { status },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      return { message: `Swap request ${status} successfully` };
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      logger.error("Error updating swap request:", error);
      throw new ServiceError(
        "UPDATE_SWAP_REQUEST_ERROR",
        "Failed to update swap request",
      );
    }
  }

  // ============= OVERTIME =============

  async getOvertimeReport(data: OverTimeData, tenantId: number) {
    try {
      const overtime = await Shift.getOvertimeByUser(
        data.userId,
        data.startDate,
        data.endDate,
        tenantId,
      );
      return dbToApi(overtime);
    } catch (error) {
      logger.error("Error getting overtime report:", error);
      throw new ServiceError(
        "GET_OVERTIME_ERROR",
        "Failed to get overtime report",
      );
    }
  }

  // ============= EXPORT =============

  async exportShifts(
    filters: ShiftFilters,
    tenantId: number,
    format: "csv" | "excel" = "csv",
  ) {
    try {
      const shifts = await this.listShifts(tenantId, {
        ...filters,
        limit: 10000,
      });

      if (format === "csv") {
        return this.generateCSV(shifts as ShiftApiResponse[]);
      } else {
        // TODO: Implement Excel export
        throw new ServiceError(
          "NOT_IMPLEMENTED",
          "Excel export not yet implemented",
        );
      }
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      logger.error("Error exporting shifts:", error);
      throw new ServiceError("EXPORT_ERROR", "Failed to export shifts");
    }
  }

  private generateCSV(shifts: ShiftApiResponse[]): string {
    const headers = [
      "Date",
      "Employee",
      "Start Time",
      "End Time",
      "Break (min)",
      "Total Hours",
      "Type",
      "Status",
      "Department",
      "Notes",
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
      shift.notes ?? "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    return csvContent;
  }

  private calculateHours(
    startTime: string,
    endTime: string,
    breakMinutes = 0,
  ): number {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const breakHours = breakMinutes / 60;
    return Math.round((diffHours - breakHours) * 100) / 100;
  }
}

// Export singleton instance
export const shiftsService = new ShiftsService();

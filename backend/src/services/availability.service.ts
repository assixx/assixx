/**
 * Employee Availability Service
 * Handles employee availability management (vacation, sick leave, etc.)
 */

import {
  EmployeeAvailability,
  DatabaseEmployeeAvailability,
} from "../types/models";
import { execute, RowDataPacket, ResultSetHeader } from "../utils/db";
import { snakeToCamel, camelToSnake } from "../utils/typeHelpers";

interface AvailabilityFilter {
  tenant_id: number;
  employeeId?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}

class AvailabilityService {
  /**
   * Get all availability records for a tenant
   */
  async getAll(filter: AvailabilityFilter): Promise<EmployeeAvailability[]> {
    try {
      let query = `
        SELECT 
          ea.*,
          u.username as employee_name,
          u.first_name,
          u.last_name,
          creator.username as created_by_name
        FROM employee_availability ea
        LEFT JOIN users u ON ea.employee_id = u.id
        LEFT JOIN users creator ON ea.created_by = creator.id
        WHERE ea.tenant_id = ?
      `;
      const params: unknown[] = [filter.tenant_id];

      if (filter.employeeId) {
        query += " AND ea.employee_id = ?";
        params.push(filter.employeeId);
      }

      if (filter.status) {
        query += " AND ea.status = ?";
        params.push(filter.status);
      }

      if (filter.startDate && filter.endDate) {
        query +=
          " AND ((ea.start_date BETWEEN ? AND ?) OR (ea.end_date BETWEEN ? AND ?) OR (ea.start_date <= ? AND ea.end_date >= ?))";
        params.push(
          filter.startDate,
          filter.endDate,
          filter.startDate,
          filter.endDate,
          filter.startDate,
          filter.endDate
        );
      }

      query += " ORDER BY ea.start_date DESC";

      const [rows] = await execute<RowDataPacket[]>(query, params);
      return rows.map((row) => snakeToCamel(row) as EmployeeAvailability);
    } catch (error) {
      console.error("Error in AvailabilityService.getAll:", error);
      throw error;
    }
  }

  /**
   * Get current availability status for all employees
   */
  async getCurrentStatus(tenantId: number): Promise<RowDataPacket[]> {
    try {
      const query = `
        SELECT 
          u.id as employee_id,
          u.username,
          u.first_name,
          u.last_name,
          u.email,
          u.department_id,
          COALESCE(cea.current_status, 'available') as availability_status,
          cea.current_reason as reason,
          cea.available_from
        FROM users u
        LEFT JOIN current_employee_availability cea ON u.id = cea.employee_id
        WHERE u.tenant_id = ? AND u.role = 'employee' AND u.is_active = 1
        ORDER BY u.first_name, u.last_name
      `;

      const [rows] = await execute<RowDataPacket[]>(query, [tenantId]);
      return rows.map((row) => snakeToCamel(row));
    } catch (error) {
      console.error("Error in AvailabilityService.getCurrentStatus:", error);
      throw error;
    }
  }

  /**
   * Get availability record by ID
   */
  async getById(
    id: number,
    tenantId: number
  ): Promise<EmployeeAvailability | null> {
    try {
      const query = `
        SELECT * FROM employee_availability 
        WHERE id = ? AND tenant_id = ?
      `;
      const [rows] = await execute<RowDataPacket[]>(query, [id, tenantId]);

      if (rows.length === 0) {
        return null;
      }

      return snakeToCamel(rows[0]) as EmployeeAvailability;
    } catch (error) {
      console.error("Error in AvailabilityService.getById:", error);
      throw error;
    }
  }

  /**
   * Create new availability record
   */
  async create(data: Partial<EmployeeAvailability>): Promise<number> {
    try {
      const dbData = camelToSnake(data) as DatabaseEmployeeAvailability;

      const query = `
        INSERT INTO employee_availability 
        (employee_id, tenant_id, status, start_date, end_date, reason, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await execute<ResultSetHeader>(query, [
        dbData.employee_id,
        dbData.tenant_id,
        dbData.status || "unavailable",
        dbData.start_date,
        dbData.end_date,
        dbData.reason ?? null,
        dbData.notes ?? null,
        dbData.created_by ?? null,
      ]);

      // Update user's availability status
      await this.updateUserAvailabilityStatus();

      return result.insertId;
    } catch (error) {
      console.error("Error in AvailabilityService.create:", error);
      throw error;
    }
  }

  /**
   * Update availability record
   */
  async update(
    id: number,
    tenantId: number,
    data: Partial<EmployeeAvailability>
  ): Promise<boolean> {
    try {
      const dbData = camelToSnake(data) as DatabaseEmployeeAvailability;

      const fields = [];
      const values = [];

      if (dbData.status !== undefined) {
        fields.push("status = ?");
        values.push(dbData.status);
      }
      if (dbData.start_date !== undefined) {
        fields.push("start_date = ?");
        values.push(dbData.start_date);
      }
      if (dbData.end_date !== undefined) {
        fields.push("end_date = ?");
        values.push(dbData.end_date);
      }
      if (dbData.reason !== undefined) {
        fields.push("reason = ?");
        values.push(dbData.reason);
      }
      if (dbData.notes !== undefined) {
        fields.push("notes = ?");
        values.push(dbData.notes);
      }

      if (fields.length === 0) {
        return false;
      }

      values.push(id, tenantId);

      const query = `
        UPDATE employee_availability 
        SET ${fields.join(", ")}
        WHERE id = ? AND tenant_id = ?
      `;

      const [result] = await execute<ResultSetHeader>(query, values);

      if (result.affectedRows > 0) {
        // Update user's availability status
        await this.updateUserAvailabilityStatus();
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error in AvailabilityService.update:", error);
      throw error;
    }
  }

  /**
   * Delete availability record
   */
  async delete(id: number, tenantId: number): Promise<boolean> {
    try {
      const query = `
        DELETE FROM employee_availability 
        WHERE id = ? AND tenant_id = ?
      `;
      const [result] = await execute<ResultSetHeader>(query, [id, tenantId]);

      if (result.affectedRows > 0) {
        // Update user's availability status
        await this.updateUserAvailabilityStatus();
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error in AvailabilityService.delete:", error);
      throw error;
    }
  }

  /**
   * Update all users' availability status based on current date
   */
  private async updateUserAvailabilityStatus(): Promise<void> {
    try {
      await execute<ResultSetHeader>("CALL UpdateUserAvailabilityStatus()");
    } catch (error) {
      console.error("Error updating user availability status:", error);
      // Don't throw, just log - this is a background update
    }
  }

  /**
   * Get availability summary for a date range
   */
  async getAvailabilitySummary(
    tenantId: number,
    startDate: string,
    endDate: string
  ): Promise<RowDataPacket[]> {
    try {
      const query = `
        SELECT 
          ea.status,
          COUNT(DISTINCT ea.employee_id) as employee_count,
          GROUP_CONCAT(DISTINCT CONCAT(u.first_name, ' ', u.last_name) SEPARATOR ', ') as employees
        FROM employee_availability ea
        JOIN users u ON ea.employee_id = u.id
        WHERE ea.tenant_id = ?
          AND ((ea.start_date BETWEEN ? AND ?) OR (ea.end_date BETWEEN ? AND ?) 
               OR (ea.start_date <= ? AND ea.end_date >= ?))
        GROUP BY ea.status
      `;

      const [rows] = await execute<RowDataPacket[]>(query, [
        tenantId,
        startDate,
        endDate,
        startDate,
        endDate,
        startDate,
        endDate,
      ]);

      return rows.map((row) => snakeToCamel(row));
    } catch (error) {
      console.error(
        "Error in AvailabilityService.getAvailabilitySummary:",
        error
      );
      throw error;
    }
  }
}

// Export singleton instance
const availabilityService = new AvailabilityService();
export default availabilityService;

// Named export for the class
export { AvailabilityService };

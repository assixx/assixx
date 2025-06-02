/**
 * Shift Model
 * Handles database operations for shift planning system
 */

import pool from "../database";
import User from "./user";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";

// Helper function to handle both real pool and mock database
async function executeQuery<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: any[],
): Promise<[T, any]> {
  const result = await (pool as any).query(sql, params);
  if (Array.isArray(result) && result.length === 2) {
    return result as [T, any];
  }
  return [result as T, null];
}

/**
 * Format datetime strings for MySQL (remove 'Z' and convert to local format)
 */
export function formatDateForMysql(
  dateString: string | Date | null,
): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Format date only for MySQL
 */
export function formatDateOnlyForMysql(
  dateString: string | Date | null,
): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toISOString().slice(0, 10);
}

// Database interfaces
interface DbShiftTemplate extends RowDataPacket {
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

interface DbShiftPlan extends RowDataPacket {
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
  // Extended fields from joins
  created_by_name?: string;
  department_name?: string | null;
  team_name?: string | null;
}

interface DbShift extends RowDataPacket {
  id: number;
  tenant_id: number;
  plan_id: number;
  template_id?: number | null;
  date: Date;
  start_time: string;
  end_time: string;
  required_employees: number;
  created_by: number;
  created_at: Date;
  updated_at: Date;
  // Extended fields from joins
  template_name?: string | null;
  template_color?: string | null;
  assignments?: string | null;
  assignedEmployees?: Array<{ name: string; status: string }>;
  assignment_status?: string;
  assigned_at?: Date;
  plan_name?: string;
}

interface DbShiftAssignment extends RowDataPacket {
  id: number;
  tenant_id: number;
  shift_id: number;
  user_id: number;
  status: "A" | "R";
  assigned_by: number;
  assigned_at: Date;
  // Extended fields from joins
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface DbEmployeeAvailability extends RowDataPacket {
  id: number;
  tenant_id: number;
  user_id: number;
  date: Date;
  availability_type: "available" | "unavailable" | "partial";
  start_time?: string | null;
  end_time?: string | null;
  notes?: string | null;
  created_at: Date;
  updated_at: Date;
}

interface DbShiftExchangeRequest extends RowDataPacket {
  id: number;
  tenant_id: number;
  shift_id: number;
  requester_id: number;
  target_user_id?: number | null;
  exchange_type: "swap" | "giveaway";
  target_shift_id?: number | null;
  message?: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: Date;
  updated_at: Date;
  // Extended fields from joins
  date?: Date;
  start_time?: string;
  end_time?: string;
  shift_template_name?: string | null;
  requester_first_name?: string;
  requester_last_name?: string;
  target_first_name?: string | null;
  target_last_name?: string | null;
}

interface ShiftPlanFilters {
  department_id?: number;
  team_id?: number;
  start_date?: string | Date;
  end_date?: string | Date;
  status?: "draft" | "published" | "archived";
  page?: number;
  limit?: number;
}

interface ShiftExchangeFilters {
  status?: "pending" | "approved" | "rejected" | "cancelled";
  limit?: number;
}

interface ShiftTemplateData {
  tenant_id: number;
  name: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  duration_hours: number;
  break_duration_minutes?: number;
  color?: string;
  created_by: number;
}

interface ShiftPlanData {
  tenant_id: number;
  name: string;
  description?: string | null;
  start_date: string | Date;
  end_date: string | Date;
  department_id?: number | null;
  team_id?: number | null;
  created_by: number;
}

interface ShiftData {
  tenant_id: number;
  plan_id: number;
  template_id?: number | null;
  date: string | Date;
  start_time: string;
  end_time: string;
  required_employees?: number;
  created_by: number;
}

interface ShiftAssignmentData {
  tenant_id: number;
  shift_id: number;
  user_id: number;
  assigned_by: number;
}

interface EmployeeAvailabilityData {
  tenant_id: number;
  user_id: number;
  date: string | Date;
  availability_type: "available" | "unavailable" | "partial";
  start_time?: string | null;
  end_time?: string | null;
  notes?: string | null;
}

interface ShiftExchangeRequestData {
  tenant_id: number;
  shift_id: number;
  requester_id: number;
  target_user_id?: number | null;
  exchange_type: "swap" | "giveaway";
  target_shift_id?: number | null;
  message?: string | null;
}

interface CountResult extends RowDataPacket {
  total: number;
}

/**
 * Get all shift templates for a tenant
 */
export async function getShiftTemplates(
  tenantId: number,
): Promise<DbShiftTemplate[]> {
  try {
    const query = `
      SELECT * FROM shift_templates
      WHERE tenant_id = ? AND is_active = TRUE
      ORDER BY name ASC
    `;

    const [templates] = await executeQuery<DbShiftTemplate[]>(query, [
      tenantId,
    ]);
    return templates;
  } catch (error) {
    console.error("Error in getShiftTemplates:", error);
    throw error;
  }
}

/**
 * Create a new shift template
 */
export async function createShiftTemplate(
  templateData: ShiftTemplateData,
): Promise<DbShiftTemplate> {
  try {
    const {
      tenant_id,
      name,
      description,
      start_time,
      end_time,
      duration_hours,
      break_duration_minutes,
      color,
      created_by,
    } = templateData;

    // Validate required fields
    if (
      !tenant_id ||
      !name ||
      !start_time ||
      !end_time ||
      !duration_hours ||
      !created_by
    ) {
      throw new Error("Missing required fields");
    }

    const query = `
      INSERT INTO shift_templates 
      (tenant_id, name, description, start_time, end_time, duration_hours, 
       break_duration_minutes, color, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await executeQuery<ResultSetHeader>(query, [
      tenant_id,
      name,
      description || null,
      start_time,
      end_time,
      duration_hours,
      break_duration_minutes || 0,
      color || "#3498db",
      created_by,
    ]);

    // Get the created template
    const [created] = await executeQuery<DbShiftTemplate[]>(
      "SELECT * FROM shift_templates WHERE id = ?",
      [result.insertId],
    );

    return created[0];
  } catch (error) {
    console.error("Error in createShiftTemplate:", error);
    throw error;
  }
}

/**
 * Get all shift plans for a tenant with optional filters
 */
export async function getShiftPlans(
  tenantId: number,
  userId: number,
  options: ShiftPlanFilters = {},
): Promise<{
  plans: DbShiftPlan[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}> {
  try {
    const {
      department_id,
      team_id,
      start_date,
      end_date,
      status = "draft",
      page = 1,
      limit = 50,
    } = options;

    // Get user info for access control
    const { role, departmentId, teamId } =
      await User.getUserDepartmentAndTeam(userId);

    let query = `
      SELECT sp.*, u.username as created_by_name,
             d.name as department_name, t.name as team_name
      FROM shift_plans sp
      LEFT JOIN users u ON sp.created_by = u.id
      LEFT JOIN departments d ON sp.department_id = d.id
      LEFT JOIN teams t ON sp.team_id = t.id
      WHERE sp.tenant_id = ?
    `;

    const queryParams: any[] = [tenantId];

    // Apply access control for non-admin users
    if (role !== "admin" && role !== "root") {
      if (role === "manager") {
        query += " AND sp.department_id = ?";
        queryParams.push(departmentId);
      } else if (role === "team_lead") {
        query += " AND sp.team_id = ?";
        queryParams.push(teamId);
      } else {
        // Regular employees can only see published plans for their department/team
        query +=
          ' AND sp.status = "published" AND (sp.department_id = ? OR sp.team_id = ?)';
        queryParams.push(departmentId || 0, teamId || 0);
      }
    }

    // Apply filters
    if (department_id) {
      query += " AND sp.department_id = ?";
      queryParams.push(department_id);
    }

    if (team_id) {
      query += " AND sp.team_id = ?";
      queryParams.push(team_id);
    }

    if (start_date) {
      query += " AND sp.end_date >= ?";
      queryParams.push(start_date);
    }

    if (end_date) {
      query += " AND sp.start_date <= ?";
      queryParams.push(end_date);
    }

    if (status) {
      query += " AND sp.status = ?";
      queryParams.push(status);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query += " ORDER BY sp.start_date DESC LIMIT ? OFFSET ?";
    queryParams.push(parseInt(limit.toString(), 10), offset);

    const [plans] = await executeQuery<DbShiftPlan[]>(query, queryParams);

    // Count total for pagination
    let countQuery = `
      SELECT COUNT(*) as total FROM shift_plans sp
      WHERE sp.tenant_id = ?
    `;
    const countParams: any[] = [tenantId];

    // Apply same access control for count
    if (role !== "admin" && role !== "root") {
      if (role === "manager") {
        countQuery += " AND sp.department_id = ?";
        countParams.push(departmentId);
      } else if (role === "team_lead") {
        countQuery += " AND sp.team_id = ?";
        countParams.push(teamId);
      } else {
        countQuery +=
          ' AND sp.status = "published" AND (sp.department_id = ? OR sp.team_id = ?)';
        countParams.push(departmentId || 0, teamId || 0);
      }
    }

    // Apply same filters for count
    if (department_id) {
      countQuery += " AND sp.department_id = ?";
      countParams.push(department_id);
    }

    if (team_id) {
      countQuery += " AND sp.team_id = ?";
      countParams.push(team_id);
    }

    if (start_date) {
      countQuery += " AND sp.end_date >= ?";
      countParams.push(start_date);
    }

    if (end_date) {
      countQuery += " AND sp.start_date <= ?";
      countParams.push(end_date);
    }

    if (status) {
      countQuery += " AND sp.status = ?";
      countParams.push(status);
    }

    const [countResult] = await executeQuery<CountResult[]>(
      countQuery,
      countParams,
    );
    const total = countResult[0].total;

    return {
      plans,
      pagination: {
        total,
        page: parseInt(page.toString(), 10),
        limit: parseInt(limit.toString(), 10),
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("Error in getShiftPlans:", error);
    throw error;
  }
}

/**
 * Create a new shift plan
 */
export async function createShiftPlan(
  planData: ShiftPlanData,
): Promise<DbShiftPlan> {
  try {
    const {
      tenant_id,
      name,
      description,
      start_date,
      end_date,
      department_id,
      team_id,
      created_by,
    } = planData;

    // Validate required fields
    if (!tenant_id || !name || !start_date || !end_date || !created_by) {
      throw new Error("Missing required fields");
    }

    // Validate date range
    if (new Date(start_date) > new Date(end_date)) {
      throw new Error("Start date must be before end date");
    }

    const query = `
      INSERT INTO shift_plans 
      (tenant_id, name, description, start_date, end_date, department_id, team_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await executeQuery<ResultSetHeader>(query, [
      tenant_id,
      name,
      description || null,
      formatDateOnlyForMysql(start_date),
      formatDateOnlyForMysql(end_date),
      department_id || null,
      team_id || null,
      created_by,
    ]);

    // Get the created plan
    const [created] = await executeQuery<DbShiftPlan[]>(
      "SELECT * FROM shift_plans WHERE id = ?",
      [result.insertId],
    );

    return created[0];
  } catch (error) {
    console.error("Error in createShiftPlan:", error);
    throw error;
  }
}

/**
 * Get shifts for a specific plan
 */
export async function getShiftsByPlan(
  planId: number,
  tenantId: number,
  userId: number,
): Promise<DbShift[]> {
  try {
    // Check if user can access this plan
    const planAccess = await canAccessShiftPlan(planId, userId);
    if (!planAccess) {
      throw new Error("Access denied to this shift plan");
    }

    const query = `
      SELECT s.*, st.name as template_name, st.color as template_color,
             GROUP_CONCAT(
               CONCAT(u.first_name, ' ', u.last_name, ':', sa.status)
               SEPARATOR '; '
             ) as assignments
      FROM shifts s
      LEFT JOIN shift_templates st ON s.template_id = st.id
      LEFT JOIN shift_assignments sa ON s.id = sa.shift_id
      LEFT JOIN users u ON sa.user_id = u.id
      WHERE s.plan_id = ? AND s.tenant_id = ?
      GROUP BY s.id
      ORDER BY s.date ASC, s.start_time ASC
    `;

    const [shifts] = await executeQuery<DbShift[]>(query, [planId, tenantId]);

    // Parse assignments string into array
    shifts.forEach((shift) => {
      if (shift.assignments) {
        shift.assignedEmployees = shift.assignments
          .split("; ")
          .map((assignment) => {
            const [name, status] = assignment.split(":");
            return { name, status };
          });
      } else {
        shift.assignedEmployees = [];
      }
      delete shift.assignments;
    });

    return shifts;
  } catch (error) {
    console.error("Error in getShiftsByPlan:", error);
    throw error;
  }
}

/**
 * Create a shift
 */
export async function createShift(shiftData: ShiftData): Promise<DbShift> {
  try {
    const {
      tenant_id,
      plan_id,
      template_id,
      date,
      start_time,
      end_time,
      required_employees,
      created_by,
    } = shiftData;

    // Validate required fields
    if (
      !tenant_id ||
      !plan_id ||
      !date ||
      !start_time ||
      !end_time ||
      !created_by
    ) {
      throw new Error("Missing required fields");
    }

    const query = `
      INSERT INTO shifts 
      (tenant_id, plan_id, template_id, date, start_time, end_time, 
       required_employees, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await executeQuery<ResultSetHeader>(query, [
      tenant_id,
      plan_id,
      template_id || null,
      formatDateOnlyForMysql(date),
      start_time,
      end_time,
      required_employees || 1,
      created_by,
    ]);

    // Get the created shift
    const [created] = await executeQuery<DbShift[]>(
      "SELECT * FROM shifts WHERE id = ?",
      [result.insertId],
    );

    return created[0];
  } catch (error) {
    console.error("Error in createShift:", error);
    throw error;
  }
}

/**
 * Assign employee to a shift
 */
export async function assignEmployeeToShift(
  assignmentData: ShiftAssignmentData,
): Promise<DbShiftAssignment> {
  try {
    const { tenant_id, shift_id, user_id, assigned_by } = assignmentData;

    // Validate required fields
    if (!tenant_id || !shift_id || !user_id || !assigned_by) {
      throw new Error("Missing required fields");
    }

    // Check if already assigned to this specific shift
    const [existing] = await executeQuery<RowDataPacket[]>(
      "SELECT * FROM shift_assignments WHERE shift_id = ? AND user_id = ?",
      [shift_id, user_id],
    );

    if (existing.length > 0) {
      throw new Error("Employee already assigned to this shift");
    }

    // Check if employee is already assigned to another shift on the same day
    const [shiftInfo] = await executeQuery<DbShift[]>(
      "SELECT date FROM shifts WHERE id = ?",
      [shift_id],
    );

    if (shiftInfo.length > 0) {
      const shiftDate = shiftInfo[0].date;

      const [dayAssignments] = await executeQuery<RowDataPacket[]>(
        `
        SELECT sa.*, s.start_time, s.end_time 
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        WHERE sa.user_id = ? AND s.date = ? AND s.tenant_id = ?
      `,
        [user_id, shiftDate, tenant_id],
      );

      if (dayAssignments.length > 0) {
        throw new Error(
          "Employee is already assigned to another shift on this day",
        );
      }
    }

    const query = `
      INSERT INTO shift_assignments 
      (tenant_id, shift_id, user_id, assigned_by)
      VALUES (?, ?, ?, ?)
    `;

    const [result] = await executeQuery<ResultSetHeader>(query, [
      tenant_id,
      shift_id,
      user_id,
      assigned_by,
    ]);

    // Get the created assignment with user details
    const [created] = await executeQuery<DbShiftAssignment[]>(
      `
      SELECT sa.*, u.first_name, u.last_name, u.username
      FROM shift_assignments sa
      JOIN users u ON sa.user_id = u.id
      WHERE sa.id = ?
    `,
      [result.insertId],
    );

    return created[0];
  } catch (error) {
    console.error("Error in assignEmployeeToShift:", error);
    throw error;
  }
}

/**
 * Get employee availability for a date range
 */
export async function getEmployeeAvailability(
  tenantId: number,
  userId: number,
  startDate: string | Date,
  endDate: string | Date,
): Promise<DbEmployeeAvailability[]> {
  try {
    const query = `
      SELECT * FROM employee_availability
      WHERE tenant_id = ? AND user_id = ? 
      AND date >= ? AND date <= ?
      ORDER BY date ASC
    `;

    const [availability] = await executeQuery<DbEmployeeAvailability[]>(query, [
      tenantId,
      userId,
      formatDateOnlyForMysql(startDate),
      formatDateOnlyForMysql(endDate),
    ]);

    return availability;
  } catch (error) {
    console.error("Error in getEmployeeAvailability:", error);
    throw error;
  }
}

/**
 * Set employee availability
 */
export async function setEmployeeAvailability(
  availabilityData: EmployeeAvailabilityData,
): Promise<DbEmployeeAvailability> {
  try {
    const {
      tenant_id,
      user_id,
      date,
      availability_type,
      start_time,
      end_time,
      notes,
    } = availabilityData;

    // Validate required fields
    if (!tenant_id || !user_id || !date || !availability_type) {
      throw new Error("Missing required fields");
    }

    // Check if availability already exists for this date
    const [existing] = await executeQuery<DbEmployeeAvailability[]>(
      "SELECT * FROM employee_availability WHERE tenant_id = ? AND user_id = ? AND date = ?",
      [tenant_id, user_id, formatDateOnlyForMysql(date)],
    );

    if (existing.length > 0) {
      // Update existing
      const query = `
        UPDATE employee_availability 
        SET availability_type = ?, start_time = ?, end_time = ?, notes = ?, updated_at = NOW()
        WHERE id = ?
      `;

      await executeQuery(query, [
        availability_type,
        start_time || null,
        end_time || null,
        notes || null,
        existing[0].id,
      ]);

      return {
        ...existing[0],
        availability_type,
        start_time,
        end_time,
        notes,
      } as DbEmployeeAvailability;
    } else {
      // Create new
      const query = `
        INSERT INTO employee_availability 
        (tenant_id, user_id, date, availability_type, start_time, end_time, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await executeQuery<ResultSetHeader>(query, [
        tenant_id,
        user_id,
        formatDateOnlyForMysql(date),
        availability_type,
        start_time || null,
        end_time || null,
        notes || null,
      ]);

      const [created] = await executeQuery<DbEmployeeAvailability[]>(
        "SELECT * FROM employee_availability WHERE id = ?",
        [result.insertId],
      );

      return created[0];
    }
  } catch (error) {
    console.error("Error in setEmployeeAvailability:", error);
    throw error;
  }
}

/**
 * Get shift exchange requests
 */
export async function getShiftExchangeRequests(
  tenantId: number,
  userId: number,
  options: ShiftExchangeFilters = {},
): Promise<DbShiftExchangeRequest[]> {
  try {
    const { status = "pending", limit = 50 } = options;

    const query = `
      SELECT ser.*, 
             s.date, s.start_time, s.end_time,
             st.name as shift_template_name,
             u1.first_name as requester_first_name, u1.last_name as requester_last_name,
             u2.first_name as target_first_name, u2.last_name as target_last_name
      FROM shift_exchange_requests ser
      JOIN shifts s ON ser.shift_id = s.id
      LEFT JOIN shift_templates st ON s.template_id = st.id
      JOIN users u1 ON ser.requester_id = u1.id
      LEFT JOIN users u2 ON ser.target_user_id = u2.id
      WHERE ser.tenant_id = ? AND (ser.requester_id = ? OR ser.target_user_id = ?)
      AND ser.status = ?
      ORDER BY ser.created_at DESC
      LIMIT ?
    `;

    const [requests] = await executeQuery<DbShiftExchangeRequest[]>(query, [
      tenantId,
      userId,
      userId,
      status,
      limit,
    ]);
    return requests;
  } catch (error) {
    console.error("Error in getShiftExchangeRequests:", error);
    throw error;
  }
}

/**
 * Create shift exchange request
 */
export async function createShiftExchangeRequest(
  requestData: ShiftExchangeRequestData,
): Promise<DbShiftExchangeRequest> {
  try {
    const {
      tenant_id,
      shift_id,
      requester_id,
      target_user_id,
      exchange_type,
      target_shift_id,
      message,
    } = requestData;

    // Validate required fields
    if (!tenant_id || !shift_id || !requester_id || !exchange_type) {
      throw new Error("Missing required fields");
    }

    const query = `
      INSERT INTO shift_exchange_requests 
      (tenant_id, shift_id, requester_id, target_user_id, exchange_type, target_shift_id, message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await executeQuery<ResultSetHeader>(query, [
      tenant_id,
      shift_id,
      requester_id,
      target_user_id || null,
      exchange_type,
      target_shift_id || null,
      message || null,
    ]);

    // Get the created request
    const [created] = await executeQuery<DbShiftExchangeRequest[]>(
      "SELECT * FROM shift_exchange_requests WHERE id = ?",
      [result.insertId],
    );

    return created[0];
  } catch (error) {
    console.error("Error in createShiftExchangeRequest:", error);
    throw error;
  }
}

/**
 * Check if user can access a shift plan
 */
export async function canAccessShiftPlan(
  planId: number,
  userId: number,
): Promise<boolean> {
  try {
    // Get user info and plan info
    const { role, departmentId, teamId } =
      await User.getUserDepartmentAndTeam(userId);

    const [plans] = await executeQuery<DbShiftPlan[]>(
      "SELECT * FROM shift_plans WHERE id = ?",
      [planId],
    );

    if (plans.length === 0) {
      return false;
    }

    const plan = plans[0];

    // Admins can access all plans
    if (role === "admin" || role === "root") {
      return true;
    }

    // Managers can access department plans
    if (role === "manager" && plan.department_id === departmentId) {
      return true;
    }

    // Team leads can access team plans
    if (role === "team_lead" && plan.team_id === teamId) {
      return true;
    }

    // Employees can access published plans for their department/team
    if (
      plan.status === "published" &&
      (plan.department_id === departmentId || plan.team_id === teamId)
    ) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error in canAccessShiftPlan:", error);
    throw error;
  }
}

/**
 * Get employee shifts for a date range
 */
export async function getEmployeeShifts(
  tenantId: number,
  userId: number,
  startDate: string | Date,
  endDate: string | Date,
): Promise<DbShift[]> {
  try {
    const query = `
      SELECT s.*, st.name as template_name, st.color as template_color,
             sa.status as assignment_status, sa.assigned_at,
             sp.name as plan_name
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      JOIN shift_plans sp ON s.plan_id = sp.id
      LEFT JOIN shift_templates st ON s.template_id = st.id
      WHERE sa.tenant_id = ? AND sa.user_id = ?
      AND s.date >= ? AND s.date <= ?
      ORDER BY s.date ASC, s.start_time ASC
    `;

    const [shifts] = await executeQuery<DbShift[]>(query, [
      tenantId,
      userId,
      formatDateOnlyForMysql(startDate),
      formatDateOnlyForMysql(endDate),
    ]);

    return shifts;
  } catch (error) {
    console.error("Error in getEmployeeShifts:", error);
    throw error;
  }
}

// Get shifts for date range
async function getShiftsForDateRange(
  tenantId: number,
  startDate: string,
  endDate: string,
): Promise<any[]> {
  try {
    const query = `
      SELECT 
        s.*,
        u.username as assigned_user_name,
        u.first_name,
        u.last_name,
        d.name as department_name,
        t.name as team_name
      FROM shifts s
      LEFT JOIN shift_assignments sa ON s.id = sa.shift_id AND sa.status = 'confirmed'
      LEFT JOIN users u ON sa.user_id = u.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN teams t ON s.team_id = t.id
      WHERE s.tenant_id = ? 
        AND s.date BETWEEN ? AND ?
        AND s.deleted_at IS NULL
      ORDER BY s.date, s.start_time
    `;

    const [rows] = await executeQuery<any[]>(query, [
      tenantId,
      startDate,
      endDate,
    ]);
    return rows;
  } catch (error) {
    console.error("Error in getShiftsForDateRange:", error);
    throw error;
  }
}

// Get week notes
async function getWeekNotes(
  tenantId: number,
  weekStart: string,
  weekEnd: string,
): Promise<Record<string, string>> {
  try {
    const query = `
      SELECT 
        date,
        notes
      FROM shift_notes
      WHERE tenant_id = ? 
        AND date BETWEEN ? AND ?
      ORDER BY date
    `;

    const [rows] = await executeQuery<any[]>(query, [
      tenantId,
      weekStart,
      weekEnd,
    ]);

    // Convert to object keyed by date
    const notesByDate: Record<string, string> = {};
    rows.forEach((row: any) => {
      notesByDate[row.date] = row.notes;
    });

    return notesByDate;
  } catch (error) {
    console.error("Error in getWeekNotes:", error);
    // Return empty object if table doesn't exist yet
    return {};
  }
}

// Export interfaces
export type { ShiftPlanFilters, ShiftExchangeFilters };

// Default export with all functions
export default {
  getShiftTemplates,
  createShiftTemplate,
  getShiftPlans,
  createShiftPlan,
  getShiftsByPlan,
  createShift,
  assignEmployeeToShift,
  getEmployeeAvailability,
  setEmployeeAvailability,
  getShiftExchangeRequests,
  createShiftExchangeRequest,
  canAccessShiftPlan,
  getEmployeeShifts,
  getShiftsForDateRange,
  getWeekNotes,
  formatDateForMysql,
  formatDateOnlyForMysql,
};

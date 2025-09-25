/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Shift Core Operations
 * Core shift management operations (v1 API)
 */
import { ResultSetHeader, RowDataPacket, query as executeQuery } from '../utils/db';
import {
  type CountResult,
  type DbEmployeeAvailability,
  type DbShift,
  type DbShiftAssignment,
  type DbShiftExchangeRequest,
  type DbShiftPlan,
  type DbShiftTemplate,
  ERROR_MESSAGES,
  type EmployeeAvailabilityData,
  SQL_FRAGMENTS,
  type ShiftAssignmentData,
  type ShiftData,
  type ShiftExchangeFilters,
  type ShiftExchangeRequestData,
  type ShiftNoteRow,
  type ShiftPlanData,
  type ShiftPlanFilters,
  type ShiftQueryResult,
  type ShiftTemplateData,
  formatDateOnlyForMysql,
} from './shift-types';
import User from './user';

/**
 * Get all shift templates for a tenant
 */
export async function getShiftTemplates(tenantId: number): Promise<DbShiftTemplate[]> {
  try {
    const query = `
      SELECT * FROM shift_templates
      WHERE tenant_id = ? AND is_active = TRUE
      ORDER BY name ASC
    `;

    const [templates] = await executeQuery<DbShiftTemplate[]>(query, [tenantId]);
    return templates;
  } catch (error: unknown) {
    console.error('Error in getShiftTemplates:', error);
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
      break_minutes,
      color,
      created_by,
    } = templateData;

    // Validate required fields
    if (!tenant_id || !name || !start_time || !end_time || !duration_hours || !created_by) {
      throw new Error(ERROR_MESSAGES.MISSING_REQUIRED_FIELDS);
    }

    const query = `
      INSERT INTO shift_templates
      (tenant_id, name, description, start_time, end_time, duration_hours,
       break_minutes, color, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await executeQuery<ResultSetHeader>(query, [
      tenant_id,
      name,
      description ?? null,
      start_time,
      end_time,
      duration_hours,
      break_minutes ?? 0,
      color ?? '#3498db',
      created_by,
    ]);

    // Get the created template
    const [created] = await executeQuery<DbShiftTemplate[]>(
      'SELECT * FROM shift_templates WHERE id = ?',
      [result.insertId],
    );

    return created[0];
  } catch (error: unknown) {
    console.error('Error in createShiftTemplate:', error);
    throw error;
  }
}

/**
 * Apply access control filters to shift plan queries
 */
function applyShiftPlanAccessControl(
  query: string,
  params: unknown[],
  role: string | null,
  departmentId: number | null,
  teamId: number | null,
): { query: string; params: unknown[] } {
  let updatedQuery = query;
  const updatedParams = [...params];

  if (role !== 'admin' && role !== 'root') {
    if (role === 'manager') {
      updatedQuery += SQL_FRAGMENTS.DEPARTMENT_FILTER;
      updatedParams.push(departmentId);
    } else if (role === 'team_lead') {
      updatedQuery += SQL_FRAGMENTS.TEAM_FILTER;
      updatedParams.push(teamId);
    } else {
      // Regular employees can only see published plans for their department/team
      updatedQuery += ' AND sp.status = "published" AND (sp.department_id = ? OR sp.team_id = ?)';
      updatedParams.push(departmentId ?? 0, teamId ?? 0);
    }
  }

  return { query: updatedQuery, params: updatedParams };
}

/**
 * Apply filters to shift plan queries
 */
function applyShiftPlanFilters(
  query: string,
  params: unknown[],
  options: ShiftPlanFilters,
): { query: string; params: unknown[] } {
  let updatedQuery = query;
  const updatedParams = [...params];

  if (options.department_id != null && options.department_id !== 0) {
    updatedQuery += SQL_FRAGMENTS.DEPARTMENT_FILTER;
    updatedParams.push(options.department_id);
  }

  if (options.team_id != null && options.team_id !== 0) {
    updatedQuery += SQL_FRAGMENTS.TEAM_FILTER;
    updatedParams.push(options.team_id);
  }

  if (options.start_date != null && options.start_date !== '') {
    updatedQuery += ' AND sp.end_date >= ?';
    updatedParams.push(options.start_date);
  }

  if (options.end_date != null && options.end_date !== '') {
    updatedQuery += ' AND sp.start_date <= ?';
    updatedParams.push(options.end_date);
  }

  updatedQuery += ' AND sp.status = ?';
  updatedParams.push(options.status ?? 'draft');

  return { query: updatedQuery, params: updatedParams };
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
    const { page = 1, limit = 50 } = options;

    // Get user info for access control
    const { role, departmentId, teamId } = await User.getUserDepartmentAndTeam(userId);

    // Build main query
    const baseQuery = `
      SELECT sp.*, u.username as created_by_name,
             d.name as department_name, t.name as team_name
      FROM shift_plans sp
      LEFT JOIN users u ON sp.created_by = u.id
      LEFT JOIN departments d ON sp.department_id = d.id
      LEFT JOIN teams t ON sp.team_id = t.id
      WHERE sp.tenant_id = ?
    `;

    // Build count query
    const countQuery = `
      SELECT COUNT(*) as total FROM shift_plans sp
      WHERE sp.tenant_id = ?
    `;

    // Apply access control and filters to main query
    const { query: accessControlledQuery, params: accessControlledParams } =
      applyShiftPlanAccessControl(baseQuery, [tenantId], role, departmentId, teamId);

    const { query: filteredQuery, params: filteredParams } = applyShiftPlanFilters(
      accessControlledQuery,
      accessControlledParams,
      options,
    );

    // Add pagination
    const offset = (page - 1) * limit;
    const paginatedQuery = filteredQuery + ' ORDER BY sp.start_date DESC LIMIT ? OFFSET ?';
    const paginatedParams = [...filteredParams, Number.parseInt(limit.toString(), 10), offset];

    // Execute main query
    const [plans] = await executeQuery<DbShiftPlan[]>(paginatedQuery, paginatedParams);

    // Apply same access control and filters to count query
    const { query: countAccessQuery, params: countAccessParams } = applyShiftPlanAccessControl(
      countQuery,
      [tenantId],
      role,
      departmentId,
      teamId,
    );

    const { query: finalCountQuery, params: finalCountParams } = applyShiftPlanFilters(
      countAccessQuery,
      countAccessParams,
      options,
    );

    // Execute count query
    const [countResult] = await executeQuery<CountResult[]>(finalCountQuery, finalCountParams);
    const total = countResult[0].total;

    return {
      plans,
      pagination: {
        total,
        page: Number.parseInt(page.toString(), 10),
        limit: Number.parseInt(limit.toString(), 10),
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error: unknown) {
    console.error('Error in getShiftPlans:', error);
    throw error;
  }
}

/**
 * Create a new shift plan
 */
export async function createShiftPlan(planData: ShiftPlanData): Promise<DbShiftPlan> {
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
    if (tenant_id === 0 || name === '' || created_by === 0) {
      throw new Error(ERROR_MESSAGES.MISSING_REQUIRED_FIELDS);
    }

    // Validate date range
    if (new Date(start_date) > new Date(end_date)) {
      throw new Error('Start date must be before end date');
    }

    const query = `
      INSERT INTO shift_plans
      (tenant_id, name, description, start_date, end_date, department_id, team_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await executeQuery<ResultSetHeader>(query, [
      tenant_id,
      name,
      description ?? null,
      formatDateOnlyForMysql(start_date),
      formatDateOnlyForMysql(end_date),
      department_id ?? null,
      team_id ?? null,
      created_by,
    ]);

    // Get the created plan
    const [created] = await executeQuery<DbShiftPlan[]>('SELECT * FROM shift_plans WHERE id = ?', [
      result.insertId,
    ]);

    return created[0];
  } catch (error: unknown) {
    console.error('Error in createShiftPlan:', error);
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
      throw new Error('Access denied to this shift plan');
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
      if (shift.assignments != null && shift.assignments !== '') {
        shift.assignedEmployees = shift.assignments.split('; ').map((assignment) => {
          const [name, status] = assignment.split(':');
          return { name, status };
        });
      } else {
        shift.assignedEmployees = [];
      }
      delete shift.assignments;
    });

    return shifts;
  } catch (error: unknown) {
    console.error('Error in getShiftsByPlan:', error);
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
      tenant_id === 0 ||
      plan_id === 0 ||
      start_time === '' ||
      end_time === '' ||
      created_by === 0
    ) {
      throw new Error(ERROR_MESSAGES.MISSING_REQUIRED_FIELDS);
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
      template_id ?? null,
      formatDateOnlyForMysql(date),
      start_time,
      end_time,
      required_employees ?? 1,
      created_by,
    ]);

    // Get the created shift
    const [created] = await executeQuery<DbShift[]>('SELECT * FROM shifts WHERE id = ?', [
      result.insertId,
    ]);

    return created[0];
  } catch (error: unknown) {
    console.error('Error in createShift:', error);
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
      throw new Error(ERROR_MESSAGES.MISSING_REQUIRED_FIELDS);
    }

    // Check if already assigned to this specific shift
    const [existing] = await executeQuery<RowDataPacket[]>(
      'SELECT * FROM shift_assignments WHERE shift_id = ? AND user_id = ?',
      [shift_id, user_id],
    );

    if (existing.length > 0) {
      throw new Error('Employee already assigned to this shift');
    }

    // Check if employee is already assigned to another shift on the same day
    const [shiftInfo] = await executeQuery<DbShift[]>('SELECT date FROM shifts WHERE id = ?', [
      shift_id,
    ]);

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
        throw new Error('Employee is already assigned to another shift on this day');
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
  } catch (error: unknown) {
    console.error('Error in assignEmployeeToShift:', error);
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
  } catch (error: unknown) {
    console.error('Error in getEmployeeAvailability:', error);
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
    const { tenant_id, user_id, date, availability_type, start_time, end_time, notes } =
      availabilityData;

    // Validate required fields
    if (tenant_id === 0 || user_id === 0) {
      throw new Error(ERROR_MESSAGES.MISSING_REQUIRED_FIELDS);
    }

    // Check if availability already exists for this date
    const [existing] = await executeQuery<DbEmployeeAvailability[]>(
      'SELECT * FROM employee_availability WHERE tenant_id = ? AND user_id = ? AND date = ?',
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
        start_time ?? null,
        end_time ?? null,
        notes ?? null,
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
        start_time ?? null,
        end_time ?? null,
        notes ?? null,
      ]);

      const [created] = await executeQuery<DbEmployeeAvailability[]>(
        'SELECT * FROM employee_availability WHERE id = ?',
        [result.insertId],
      );

      return created[0];
    }
  } catch (error: unknown) {
    console.error('Error in setEmployeeAvailability:', error);
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
    const { status = 'pending', limit = 50 } = options;

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
  } catch (error: unknown) {
    console.error('Error in getShiftExchangeRequests:', error);
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
    if (!tenant_id || !shift_id || !requester_id) {
      throw new Error(ERROR_MESSAGES.MISSING_REQUIRED_FIELDS);
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
      target_user_id ?? null,
      exchange_type,
      target_shift_id ?? null,
      message ?? null,
    ]);

    // Get the created request
    const [created] = await executeQuery<DbShiftExchangeRequest[]>(
      'SELECT * FROM shift_exchange_requests WHERE id = ?',
      [result.insertId],
    );

    return created[0];
  } catch (error: unknown) {
    console.error('Error in createShiftExchangeRequest:', error);
    throw error;
  }
}

/**
 * Check if user can access a shift plan
 */
export async function canAccessShiftPlan(planId: number, userId: number): Promise<boolean> {
  try {
    // Get user info and plan info
    const { role, departmentId, teamId } = await User.getUserDepartmentAndTeam(userId);

    const [plans] = await executeQuery<DbShiftPlan[]>('SELECT * FROM shift_plans WHERE id = ?', [
      planId,
    ]);

    if (plans.length === 0) {
      return false;
    }

    const plan = plans[0];

    // Admins can access all plans
    if (role === 'admin' || role === 'root') {
      return true;
    }

    // Managers can access department plans
    if (role === 'manager' && plan.department_id === departmentId) {
      return true;
    }

    // Team leads can access team plans
    if (role === 'team_lead' && plan.team_id === teamId) {
      return true;
    }

    // Employees can access published plans for their department/team
    return (
      plan.status === 'published' &&
      (plan.department_id === departmentId || plan.team_id === teamId)
    );
  } catch (error: unknown) {
    console.error('Error in canAccessShiftPlan:', error);
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
  } catch (error: unknown) {
    console.error('Error in getEmployeeShifts:', error);
    throw error;
  }
}

/**
 * Get shifts for date range
 */
export async function getShiftsForDateRange(
  tenantId: number,
  startDate: string,
  endDate: string,
): Promise<ShiftQueryResult[]> {
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

    const [rows] = await executeQuery<ShiftQueryResult[]>(query, [tenantId, startDate, endDate]);
    return rows;
  } catch (error: unknown) {
    console.error('Error in getShiftsForDateRange:', error);
    throw error;
  }
}

/**
 * Get week notes
 */
export async function getWeekNotes(
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

    const [rows] = await executeQuery<ShiftNoteRow[]>(query, [tenantId, weekStart, weekEnd]);

    // Convert to object keyed by date
    const notesByDate: Record<string, string> = {};
    rows.forEach((row) => {
      notesByDate[row.date] = row.notes;
    });

    return notesByDate;
  } catch (error: unknown) {
    console.error('Error in getWeekNotes:', error);
    // Return empty object if table doesn't exist yet
    return {};
  }
}

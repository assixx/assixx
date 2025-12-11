/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Shift Core Operations
 * Core shift management operations (v1 API)
 */
import { RowDataPacket, query as executeQuery } from '../../../utils/db.js';
import User from '../users/model/index.js';
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
} from './shift-types.js';

/** Validates that all numbers are valid (not 0 and not NaN) */
function hasInvalidNumber(...nums: number[]): boolean {
  return nums.some((n: number) => n === 0 || Number.isNaN(n));
}

/**
 * Get all shift templates for a tenant
 */
export async function getShiftTemplates(tenantId: number): Promise<DbShiftTemplate[]> {
  try {
    const query = `
      SELECT * FROM shift_templates
      WHERE tenant_id = $1 AND is_active = TRUE
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
    if (
      hasInvalidNumber(tenant_id, duration_hours, created_by) ||
      name === '' ||
      start_time === '' ||
      end_time === ''
    ) {
      throw new Error(ERROR_MESSAGES.MISSING_REQUIRED_FIELDS);
    }

    const query = `
      INSERT INTO shift_templates
      (tenant_id, name, description, start_time, end_time, duration_hours,
       break_minutes, color, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;

    // PostgreSQL RETURNING returns rows array, not ResultSetHeader
    const [rows] = await executeQuery<{ id: number }[]>(query, [
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
    if (rows.length === 0 || rows[0] === undefined) {
      throw new Error('Failed to create template: No ID returned from database');
    }
    const insertedId = rows[0].id;

    // Get the created template
    const [created] = await executeQuery<DbShiftTemplate[]>(
      'SELECT * FROM shift_templates WHERE id = $1',
      [insertedId],
    );

    const template = created[0];
    if (template === undefined) {
      throw new Error('Failed to retrieve created template');
    }

    return template;
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
      const paramIndex = updatedParams.length + 1;
      updatedQuery += SQL_FRAGMENTS.departmentFilter(paramIndex);
      updatedParams.push(departmentId);
    } else if (role === 'team_lead') {
      const paramIndex = updatedParams.length + 1;
      updatedQuery += SQL_FRAGMENTS.teamFilter(paramIndex);
      updatedParams.push(teamId);
    } else {
      // Regular employees can only see published plans for their department/team
      // PostgreSQL: Dynamic $N parameter numbering, single quotes for string literals
      const deptParamIndex = updatedParams.length + 1;
      const teamParamIndex = updatedParams.length + 2;
      updatedQuery += ` AND sp.status = 'published' AND (sp.department_id = $${deptParamIndex} OR sp.team_id = $${teamParamIndex})`;
      updatedParams.push(departmentId ?? 0, teamId ?? 0);
    }
  }

  return { query: updatedQuery, params: updatedParams };
}

/**
 * Apply filters to shift plan queries
 * PostgreSQL: Dynamic $N parameter numbering
 */
function applyShiftPlanFilters(
  query: string,
  params: unknown[],
  options: ShiftPlanFilters,
): { query: string; params: unknown[] } {
  let updatedQuery = query;
  const updatedParams = [...params];

  if (options.department_id != null && options.department_id !== 0) {
    const paramIndex = updatedParams.length + 1;
    updatedQuery += SQL_FRAGMENTS.departmentFilter(paramIndex);
    updatedParams.push(options.department_id);
  }

  if (options.team_id != null && options.team_id !== 0) {
    const paramIndex = updatedParams.length + 1;
    updatedQuery += SQL_FRAGMENTS.teamFilter(paramIndex);
    updatedParams.push(options.team_id);
  }

  if (options.start_date != null && options.start_date !== '') {
    const paramIndex = updatedParams.length + 1;
    updatedQuery += ` AND sp.end_date >= $${paramIndex}`;
    updatedParams.push(options.start_date);
  }

  if (options.end_date != null && options.end_date !== '') {
    const paramIndex = updatedParams.length + 1;
    updatedQuery += ` AND sp.start_date <= $${paramIndex}`;
    updatedParams.push(options.end_date);
  }

  const statusParamIndex = updatedParams.length + 1;
  updatedQuery += ` AND sp.status = $${statusParamIndex}`;
  updatedParams.push(options.status ?? 'draft');

  return { query: updatedQuery, params: updatedParams };
}

/** Execute count query and return total */
async function executeCountQuery(
  tenantId: number,
  role: string | null,
  departmentId: number | null,
  teamId: number | null,
  options: ShiftPlanFilters,
): Promise<number> {
  const baseCountQuery = 'SELECT COUNT(*) as total FROM shift_plans sp WHERE sp.tenant_id = $1';
  const { query: countAccessQuery, params: countAccessParams } = applyShiftPlanAccessControl(
    baseCountQuery,
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
  const [countResult] = await executeQuery<CountResult[]>(finalCountQuery, finalCountParams);
  const countRow = countResult[0];
  if (countRow === undefined) throw new Error('Failed to retrieve count result');
  return countRow.total;
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
      WHERE sp.tenant_id = $1
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
    const paginatedQuery = filteredQuery + ' ORDER BY sp.start_date DESC LIMIT $1 OFFSET $2';
    const paginatedParams = [...filteredParams, Number.parseInt(limit.toString(), 10), offset];

    // Execute main query
    const [plans] = await executeQuery<DbShiftPlan[]>(paginatedQuery, paginatedParams);

    // Execute count query using helper
    const total = await executeCountQuery(tenantId, role, departmentId, teamId, options);

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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    // PostgreSQL RETURNING returns rows array, not ResultSetHeader
    const [rows] = await executeQuery<{ id: number }[]>(query, [
      tenant_id,
      name,
      description ?? null,
      formatDateOnlyForMysql(start_date),
      formatDateOnlyForMysql(end_date),
      department_id ?? null,
      team_id ?? null,
      created_by,
    ]);
    if (rows.length === 0 || rows[0] === undefined) {
      throw new Error('Failed to create plan: No ID returned from database');
    }
    const insertedId = rows[0].id;

    // Get the created plan
    const [created] = await executeQuery<DbShiftPlan[]>('SELECT * FROM shift_plans WHERE id = $1', [
      insertedId,
    ]);

    const plan = created[0];
    if (plan === undefined) {
      throw new Error('Failed to retrieve created plan');
    }

    return plan;
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

    // PostgreSQL: Use MAX() for non-aggregated columns from LEFT JOIN to satisfy GROUP BY requirements
    const query = `
      SELECT s.*, MAX(st.name) as template_name, MAX(st.color) as template_color,
             STRING_AGG(
               CONCAT(u.first_name, ' ', u.last_name, ':', sa.status),
               '; '
             ) as assignments
      FROM shifts s
      LEFT JOIN shift_templates st ON s.template_id = st.id
      LEFT JOIN shift_assignments sa ON s.id = sa.shift_id
      LEFT JOIN users u ON sa.user_id = u.id
      WHERE s.plan_id = $1 AND s.tenant_id = $2
      GROUP BY s.id
      ORDER BY s.date ASC, s.start_time ASC
    `;

    const [shifts] = await executeQuery<DbShift[]>(query, [planId, tenantId]);

    // Parse assignments string into array
    shifts.forEach((shift: DbShift) => {
      if (shift.assignments != null && shift.assignments !== '') {
        shift.assignedEmployees = shift.assignments.split('; ').map((assignment: string) => {
          const [name, status] = assignment.split(':');
          return { name: name ?? '', status: status ?? '' };
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    // PostgreSQL RETURNING returns rows array, not ResultSetHeader
    const [rows] = await executeQuery<{ id: number }[]>(query, [
      tenant_id,
      plan_id,
      template_id ?? null,
      formatDateOnlyForMysql(date),
      start_time,
      end_time,
      required_employees ?? 1,
      created_by,
    ]);
    if (rows.length === 0 || rows[0] === undefined) {
      throw new Error('Failed to create shift: No ID returned from database');
    }
    const insertedId = rows[0].id;

    // Get the created shift
    const [created] = await executeQuery<DbShift[]>('SELECT * FROM shifts WHERE id = $1', [
      insertedId,
    ]);

    const shift = created[0];
    if (shift === undefined) {
      throw new Error('Failed to retrieve created shift');
    }

    return shift;
  } catch (error: unknown) {
    console.error('Error in createShift:', error);
    throw error;
  }
}

/** Check if employee is already assigned on the same day */
async function checkSameDayConflict(
  shiftId: number,
  userId: number,
  tenantId: number,
): Promise<void> {
  const [shiftInfo] = await executeQuery<DbShift[]>('SELECT date FROM shifts WHERE id = $1', [
    shiftId,
  ]);
  if (shiftInfo.length === 0) return;
  const shiftData = shiftInfo[0];
  if (shiftData === undefined) throw new Error('Failed to retrieve shift information');
  const [dayAssignments] = await executeQuery<RowDataPacket[]>(
    `SELECT sa.* FROM shift_assignments sa JOIN shifts s ON sa.shift_id = s.id
     WHERE sa.user_id = $1 AND s.date = $2 AND s.tenant_id = $3`,
    [userId, shiftData.date, tenantId],
  );
  if (dayAssignments.length > 0) {
    throw new Error('Employee is already assigned to another shift on this day');
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
    if (hasInvalidNumber(tenant_id, shift_id, user_id, assigned_by)) {
      throw new Error(ERROR_MESSAGES.MISSING_REQUIRED_FIELDS);
    }

    // Check if already assigned to this specific shift
    const [existing] = await executeQuery<RowDataPacket[]>(
      'SELECT * FROM shift_assignments WHERE shift_id = $1 AND user_id = $2',
      [shift_id, user_id],
    );
    if (existing.length > 0) throw new Error('Employee already assigned to this shift');

    // Check same-day conflict
    await checkSameDayConflict(shift_id, user_id, tenant_id);

    const query = `
      INSERT INTO shift_assignments
      (tenant_id, shift_id, user_id, assigned_by)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;

    // PostgreSQL RETURNING returns rows array, not ResultSetHeader
    const [rows] = await executeQuery<{ id: number }[]>(query, [
      tenant_id,
      shift_id,
      user_id,
      assigned_by,
    ]);
    if (rows.length === 0 || rows[0] === undefined) {
      throw new Error('Failed to create assignment: No ID returned from database');
    }
    const insertedId = rows[0].id;

    // Get the created assignment with user details
    const [created] = await executeQuery<DbShiftAssignment[]>(
      `
      SELECT sa.*, u.first_name, u.last_name, u.username
      FROM shift_assignments sa
      JOIN users u ON sa.user_id = u.id
      WHERE sa.id = $1
    `,
      [insertedId],
    );

    const assignment = created[0];
    if (assignment === undefined) {
      throw new Error('Failed to retrieve created assignment');
    }

    return assignment;
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
      WHERE tenant_id = $1 AND user_id = $2
      AND date >= $3 AND date <= $4
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

/** Update existing availability record */
async function updateAvailabilityRecord(
  existingRecord: DbEmployeeAvailability,
  data: EmployeeAvailabilityData,
): Promise<DbEmployeeAvailability> {
  await executeQuery(
    `UPDATE employee_availability SET availability_type = $1, start_time = $2, end_time = $3, notes = $4, updated_at = NOW() WHERE id = $5`,
    [
      data.availability_type,
      data.start_time ?? null,
      data.end_time ?? null,
      data.notes ?? null,
      existingRecord.id,
    ],
  );
  return {
    ...existingRecord,
    availability_type: data.availability_type,
    start_time: data.start_time,
    end_time: data.end_time,
    notes: data.notes,
  } as DbEmployeeAvailability;
}

/** Create new availability record */
async function createAvailabilityRecord(
  data: EmployeeAvailabilityData,
): Promise<DbEmployeeAvailability> {
  // PostgreSQL RETURNING returns rows array, not ResultSetHeader
  const [rows] = await executeQuery<{ id: number }[]>(
    `INSERT INTO employee_availability (tenant_id, user_id, date, availability_type, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      data.tenant_id,
      data.user_id,
      formatDateOnlyForMysql(data.date),
      data.availability_type,
      data.start_time ?? null,
      data.end_time ?? null,
      data.notes ?? null,
    ],
  );
  if (rows.length === 0 || rows[0] === undefined) {
    throw new Error('Failed to create availability record: No ID returned from database');
  }
  const insertedId = rows[0].id;
  const [created] = await executeQuery<DbEmployeeAvailability[]>(
    'SELECT * FROM employee_availability WHERE id = $1',
    [insertedId],
  );
  const availability = created[0];
  if (availability === undefined) throw new Error('Failed to retrieve created availability record');
  return availability;
}

/**
 * Set employee availability
 */
export async function setEmployeeAvailability(
  availabilityData: EmployeeAvailabilityData,
): Promise<DbEmployeeAvailability> {
  try {
    const { tenant_id, user_id, date } = availabilityData;

    // Validate required fields
    if (tenant_id === 0 || user_id === 0) {
      throw new Error(ERROR_MESSAGES.MISSING_REQUIRED_FIELDS);
    }

    // Check if availability already exists for this date
    const [existing] = await executeQuery<DbEmployeeAvailability[]>(
      'SELECT * FROM employee_availability WHERE tenant_id = $1 AND user_id = $2 AND date = $3',
      [tenant_id, user_id, formatDateOnlyForMysql(date)],
    );

    if (existing.length > 0) {
      const existingRecord = existing[0];
      if (existingRecord === undefined) throw new Error('Failed to retrieve existing availability');
      return await updateAvailabilityRecord(existingRecord, availabilityData);
    }
    return await createAvailabilityRecord(availabilityData);
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
      WHERE ser.tenant_id = $1 AND (ser.requester_id = $2 OR ser.target_user_id = $3)
      AND ser.status = $4
      ORDER BY ser.created_at DESC
      LIMIT $5
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
    if (hasInvalidNumber(tenant_id, shift_id, requester_id)) {
      throw new Error(ERROR_MESSAGES.MISSING_REQUIRED_FIELDS);
    }

    const query = `
      INSERT INTO shift_exchange_requests
      (tenant_id, shift_id, requester_id, target_user_id, exchange_type, target_shift_id, message)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;

    // PostgreSQL RETURNING returns rows array, not ResultSetHeader
    const [rows] = await executeQuery<{ id: number }[]>(query, [
      tenant_id,
      shift_id,
      requester_id,
      target_user_id ?? null,
      exchange_type,
      target_shift_id ?? null,
      message ?? null,
    ]);
    if (rows.length === 0 || rows[0] === undefined) {
      throw new Error('Failed to create exchange request: No ID returned from database');
    }
    const insertedId = rows[0].id;

    // Get the created request
    const [created] = await executeQuery<DbShiftExchangeRequest[]>(
      'SELECT * FROM shift_exchange_requests WHERE id = $1',
      [insertedId],
    );

    const request = created[0];
    if (request === undefined) {
      throw new Error('Failed to retrieve created exchange request');
    }

    return request;
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

    const [plans] = await executeQuery<DbShiftPlan[]>('SELECT * FROM shift_plans WHERE id = $1', [
      planId,
    ]);

    if (plans.length === 0) {
      return false;
    }

    const plan = plans[0];
    if (plan === undefined) {
      return false;
    }

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
      WHERE sa.tenant_id = $1 AND sa.user_id = $2
      AND s.date >= $3 AND s.date <= $4
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
      WHERE s.tenant_id = $1
        AND s.date BETWEEN $2 AND $3
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
      WHERE tenant_id = $1
        AND date BETWEEN $2 AND $3
      ORDER BY date
    `;

    const [rows] = await executeQuery<ShiftNoteRow[]>(query, [tenantId, weekStart, weekEnd]);

    // Convert to object keyed by date
    const notesByDate: Record<string, string> = {};
    rows.forEach((row: ShiftNoteRow) => {
      notesByDate[row.date] = row.notes;
    });

    return notesByDate;
  } catch (error: unknown) {
    console.error('Error in getWeekNotes:', error);
    // Return empty object if table doesn't exist yet
    return {};
  }
}

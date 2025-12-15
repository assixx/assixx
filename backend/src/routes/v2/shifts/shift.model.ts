/**
 * Shift V2 API Operations
 * V2 API shift management operations
 */
import { RowDataPacket, query as executeQuery } from '../../../utils/db.js';
import {
  type V2ShiftData,
  type V2ShiftFilters,
  type V2SwapRequestData,
  type V2SwapRequestFilters,
  type V2SwapRequestResult,
  formatDateForMysql,
  formatDateOnlyForMysql,
} from './shift-types.js';

// Query result types for type safety
interface DateResult extends RowDataPacket {
  date: string | Date;
}

interface CountResult extends RowDataPacket {
  count: number;
}

interface IdResult extends RowDataPacket {
  id: number;
}

interface OvertimeSummaryResult extends RowDataPacket {
  totalShifts: number;
  totalHours: number | null;
  overtimeHours: number | null;
  breakHours: number | null;
}

// ============= SECURITY: SQL INJECTION PREVENTION =============

/**
 * Allowed columns for ORDER BY to prevent SQL injection
 */
const ALLOWED_SORT_COLUMNS = new Set([
  'date',
  'start_time',
  'end_time',
  'created_at',
  'updated_at',
  'status',
]);

/**
 * Validate sort column to prevent SQL injection
 */
function validateSortColumn(sortBy: string): string {
  if (ALLOWED_SORT_COLUMNS.has(sortBy)) {
    return sortBy;
  }
  console.warn(`[Shifts] Invalid sortBy column rejected: ${sortBy}`);
  return 'date'; // Safe default
}

/**
 * Validate sort direction to prevent SQL injection
 */
function validateSortDirection(sortDir: string): 'ASC' | 'DESC' {
  const upper = sortDir.toUpperCase();
  if (upper === 'ASC' || upper === 'DESC') {
    return upper;
  }
  return 'DESC'; // Safe default
}

// ============= V2 API HELPER FUNCTIONS =============

/**
 * Add date filter to conditions
 * PostgreSQL: Dynamic $N parameter numbering
 */
function addDateFilter(
  filters: V2ShiftFilters,
  conditions: string[],
  params: (string | number | null)[],
): void {
  const specificDate = filters.date;
  const startDate = filters.start_date;
  const endDate = filters.end_date;

  if (specificDate != null && specificDate !== '') {
    const paramIndex = params.length + 1;
    conditions.push(`s.date = $${paramIndex}`);
    params.push(formatDateOnlyForMysql(specificDate));
    return;
  }

  if (startDate != null && startDate !== '' && endDate != null && endDate !== '') {
    const startParamIndex = params.length + 1;
    const endParamIndex = params.length + 2;
    conditions.push(`s.date BETWEEN $${startParamIndex} AND $${endParamIndex}`);
    params.push(formatDateOnlyForMysql(startDate));
    params.push(formatDateOnlyForMysql(endDate));
  }
}

/**
 * Add filter condition if value is valid
 * PostgreSQL: Dynamic $N parameter numbering
 */
function addFilterCondition(
  field: string,
  value: string | number | null | undefined,
  conditions: string[],
  params: (string | number | null)[],
  emptyValue: string | number,
): void {
  if (value != null && value !== emptyValue) {
    const paramIndex = params.length + 1;
    conditions.push(`${field} = $${paramIndex}`);
    params.push(value);
  }
}

/**
 * Build shift query filters
 */
function buildShiftQueryFilters(filters: V2ShiftFilters): {
  conditions: string[];
  params: (string | number | null)[];
} {
  const conditions: string[] = [];
  const params: (string | number | null)[] = [];

  // Date filters
  addDateFilter(filters, conditions, params);

  // ID-based filters (empty value is 0)
  addFilterCondition('s.user_id', filters.user_id, conditions, params, 0);
  addFilterCondition('s.department_id', filters.department_id, conditions, params, 0);
  addFilterCondition('s.team_id', filters.team_id, conditions, params, 0);
  addFilterCondition('s.template_id', filters.template_id, conditions, params, 0);
  addFilterCondition('s.plan_id', filters.plan_id, conditions, params, 0);

  // String filters (empty value is '')
  addFilterCondition('s.status', filters.status, conditions, params, '');
  addFilterCondition('s.type', filters.type, conditions, params, '');

  return { conditions, params };
}

/**
 * Get field value from shift data safely
 */
function getShiftFieldValue(field: string, data: Partial<V2ShiftData>): unknown {
  switch (field) {
    case 'user_id':
      return data.user_id;
    case 'plan_id':
      return data.plan_id;
    case 'template_id':
      return data.template_id;
    case 'date':
      return data.date;
    case 'start_time':
      return data.start_time;
    case 'end_time':
      return data.end_time;
    case 'actual_start':
      return data.actual_start;
    case 'actual_end':
      return data.actual_end;
    case 'department_id':
      return data.department_id;
    case 'team_id':
      return data.team_id;
    case 'title':
      return data.title;
    case 'required_employees':
      return data.required_employees;
    case 'break_minutes':
      return data.break_minutes;
    case 'status':
      return data.status;
    case 'type':
      return data.type;
    case 'notes':
      return data.notes;
    default:
      return null;
  }
}

/**
 * Convert field value to time string
 */
function convertToTimeString(fieldValue: unknown): string {
  if (typeof fieldValue === 'string') {
    return fieldValue;
  }
  if (typeof fieldValue === 'number') {
    return fieldValue.toString();
  }
  return '';
}

/**
 * Helper function to process time fields
 */
function processTimeField(fieldValue: unknown, dateToUse: string | Date | undefined): string {
  if (dateToUse === undefined || dateToUse === '') {
    return fieldValue as string;
  }

  const timeValue = convertToTimeString(fieldValue);
  if (timeValue === '') {
    return fieldValue as string;
  }

  const dateString = typeof dateToUse === 'string' ? dateToUse : dateToUse.toISOString();
  const result = formatDateForMysql(`${dateString} ${timeValue}`);
  return result ?? (fieldValue as string);
}

/**
 * Process field value for database update
 */
function processShiftFieldValue(
  field: string,
  fieldValue: unknown,
  data: Partial<V2ShiftData>,
  currentDate?: string,
): string | number | Date | null {
  if (field === 'date' && fieldValue != null) {
    return formatDateOnlyForMysql(fieldValue as string | Date);
  }

  const isTimeField = field === 'start_time' || field === 'end_time';
  if (isTimeField && fieldValue != null && fieldValue !== '') {
    const dateToUse = data.date ?? currentDate;
    return processTimeField(fieldValue, dateToUse) as string | number | Date | null;
  }

  const isActualTimeField = field === 'actual_start' || field === 'actual_end';
  if (isActualTimeField && fieldValue != null && fieldValue !== '') {
    return formatDateForMysql(fieldValue as string | Date);
  }

  return fieldValue as string | number | Date | null;
}

/**
 * Get current date for shift if needed
 */
async function getCurrentShiftDate(
  id: number,
  tenantId: number,
  data: Partial<V2ShiftData>,
): Promise<string | undefined> {
  if (
    ((data.start_time != null && data.start_time !== '') ||
      (data.end_time != null && data.end_time !== '')) &&
    (data.date == null || data.date === '')
  ) {
    const [currentShift] = await executeQuery<DateResult[]>(
      'SELECT date FROM shifts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    if (currentShift.length > 0) {
      const row = currentShift[0];
      if (row === undefined) {
        return undefined;
      }
      const formattedDate = formatDateOnlyForMysql(row.date);
      return formattedDate ?? undefined;
    }
  }
  return undefined;
}

// ============= V2 API METHODS =============

/**
 * Find all shifts with filters
 */
export async function findAll(filters: V2ShiftFilters): Promise<V2ShiftData[]> {
  try {
    const baseQuery = `
      SELECT s.*,
        st.name as template_name,
        st.color as template_color,
        u.username as user_name,
        u.first_name,
        u.last_name,
        d.name as department_name,
        t.name as team_name
      FROM shifts s
      LEFT JOIN shift_templates st ON s.template_id = st.id
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN teams t ON s.team_id = t.id
      WHERE s.tenant_id = $1`;

    const queryParams: (string | number | null)[] = [filters.tenant_id];

    // Build and apply filters
    const { conditions, params } = buildShiftQueryFilters(filters);
    let query = baseQuery;

    for (const condition of conditions) {
      query += ` AND ${condition}`;
    }
    queryParams.push(...params);

    // Sorting - SECURITY: Validate to prevent SQL injection
    const safeSortBy = validateSortColumn(filters.sort_by ?? 'date');
    const safeSortOrder = validateSortDirection(filters.sort_order ?? 'DESC');
    query += ` ORDER BY s.${safeSortBy} ${safeSortOrder}`;

    // Pagination - PostgreSQL dynamic $N
    if (filters.limit != null && filters.limit !== 0) {
      const limitParamIndex = queryParams.length + 1;
      query += ` LIMIT $${limitParamIndex}`;
      queryParams.push(filters.limit);
      if (filters.offset != null && filters.offset !== 0) {
        const offsetParamIndex = queryParams.length + 1;
        query += ` OFFSET $${offsetParamIndex}`;
        queryParams.push(filters.offset);
      }
    }

    const [shifts] = await executeQuery<V2ShiftData[]>(query, queryParams);
    return shifts;
  } catch (error: unknown) {
    console.error('Error in findAll:', error);
    throw error;
  }
}

/**
 * Find shift by ID
 */
export async function findById(id: number, tenantId: number): Promise<V2ShiftData | null> {
  try {
    const query = `
      SELECT s.*,
        st.name as template_name,
        st.color as template_color,
        u.username as user_name,
        u.first_name,
        u.last_name,
        d.name as department_name,
        t.name as team_name
      FROM shifts s
      LEFT JOIN shift_templates st ON s.template_id = st.id
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN teams t ON s.team_id = t.id
      WHERE s.id = $1 AND s.tenant_id = $2
    `;

    const [shifts] = await executeQuery<V2ShiftData[]>(query, [id, tenantId]);
    if (shifts.length === 0) {
      return null;
    }
    const shift = shifts[0];
    if (shift === undefined) {
      return null;
    }
    return shift;
  } catch (error: unknown) {
    console.error('Error in findById:', error);
    throw error;
  }
}

/**
 * Format shift date/time values for database insertion
 */
function formatShiftDateTimes(data: Partial<V2ShiftData>): {
  date: string | null;
  startTime: string | null;
  endTime: string | null;
} {
  const dateVal = data.date;
  const hasDate = dateVal != null && dateVal !== '';
  if (!hasDate) return { date: null, startTime: null, endTime: null };

  const startVal = data.start_time;
  const endVal = data.end_time;
  return {
    date: formatDateOnlyForMysql(dateVal),
    startTime:
      startVal != null && startVal !== '' ? formatDateForMysql(`${dateVal} ${startVal}`) : null,
    endTime: endVal != null && endVal !== '' ? formatDateForMysql(`${dateVal} ${endVal}`) : null,
  };
}

/**
 * Create shift (v2 version)
 * Uses UPSERT (INSERT ... ON CONFLICT) to handle duplicate assignments gracefully
 * Unique constraint: (user_id, date, start_time)
 */
export async function create(data: Partial<V2ShiftData>): Promise<number> {
  try {
    const { date, startTime, endTime } = formatShiftDateTimes(data);
    const query = `
      INSERT INTO shifts
      (tenant_id, user_id, plan_id, template_id, date, start_time, end_time,
       department_id, team_id, title, required_employees, break_minutes,
       status, type, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (user_id, date, start_time)
      DO UPDATE SET
        plan_id = COALESCE(EXCLUDED.plan_id, shifts.plan_id),
        template_id = COALESCE(EXCLUDED.template_id, shifts.template_id),
        end_time = COALESCE(EXCLUDED.end_time, shifts.end_time),
        department_id = EXCLUDED.department_id,
        team_id = COALESCE(EXCLUDED.team_id, shifts.team_id),
        title = COALESCE(EXCLUDED.title, shifts.title),
        required_employees = COALESCE(EXCLUDED.required_employees, shifts.required_employees),
        break_minutes = COALESCE(EXCLUDED.break_minutes, shifts.break_minutes),
        status = COALESCE(EXCLUDED.status, shifts.status),
        type = COALESCE(EXCLUDED.type, shifts.type),
        notes = COALESCE(EXCLUDED.notes, shifts.notes),
        updated_at = NOW()
      RETURNING id
    `;

    const [rows] = await executeQuery<{ id: number }[]>(query, [
      data.tenant_id,
      data.user_id,
      data.plan_id ?? null,
      data.template_id ?? null,
      date,
      startTime,
      endTime,
      data.department_id,
      data.team_id ?? null,
      data.title ?? null,
      data.required_employees ?? 1,
      data.break_minutes ?? 0,
      data.status ?? 'planned',
      data.type ?? 'regular',
      data.notes ?? null,
      data.created_by,
    ]);
    if (rows.length === 0 || rows[0] === undefined) {
      throw new Error('Failed to create shift: No ID returned from database');
    }

    return rows[0].id;
  } catch (error: unknown) {
    console.error('Error in create:', error);
    throw error;
  }
}

/**
 * Update shift
 */
export async function update(
  id: number,
  data: Partial<V2ShiftData>,
  tenantId: number,
): Promise<void> {
  try {
    const currentDate = await getCurrentShiftDate(id, tenantId, data);
    const updateFields: string[] = [];
    const values: (string | number | null | Date)[] = [];

    const allowedFields = [
      'user_id',
      'plan_id',
      'template_id',
      'date',
      'start_time',
      'end_time',
      'actual_start',
      'actual_end',
      'department_id',
      'team_id',
      'title',
      'required_employees',
      'break_minutes',
      'status',
      'type',
      'notes',
    ];

    for (const field of allowedFields) {
      const fieldValue = getShiftFieldValue(field, data);
      if (fieldValue !== undefined) {
        const paramIndex = values.length + 1;
        updateFields.push(`${field} = $${paramIndex}`);
        values.push(processShiftFieldValue(field, fieldValue, data, currentDate));
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    // PostgreSQL: Dynamic parameter numbering for WHERE clause
    const idParamIndex = values.length + 1;
    const tenantIdParamIndex = values.length + 2;
    const query = `
      UPDATE shifts
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${idParamIndex} AND tenant_id = $${tenantIdParamIndex}
    `;

    values.push(id, tenantId);
    await executeQuery(query, values);
  } catch (error: unknown) {
    console.error('Error in update:', error);
    throw error;
  }
}

/**
 * Delete shift
 */
export async function deleteShift(id: number, tenantId: number): Promise<void> {
  try {
    // Check if shift has assignments
    const [assignments] = await executeQuery<CountResult[]>(
      'SELECT COUNT(*) as count FROM shift_assignments WHERE shift_id = $1',
      [id],
    );

    const assignment = assignments[0];
    if (assignment === undefined) {
      throw new Error('Failed to check assignments');
    }
    if (assignment.count > 0) {
      // Delete assignments first (with tenant isolation)
      await executeQuery('DELETE FROM shift_assignments WHERE shift_id = $1 AND tenant_id = $2', [
        id,
        tenantId,
      ]);
    }

    // Delete the shift
    await executeQuery('DELETE FROM shifts WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  } catch (error: unknown) {
    console.error('Error in deleteShift:', error);
    throw error;
  }
}

/**
 * Get swap requests
 */
export async function getSwapRequests(
  tenantId: number,
  filters: V2SwapRequestFilters = {},
): Promise<V2SwapRequestResult[]> {
  try {
    let query = `
      SELECT ssr.*,
        s.date as shift_date,
        s.start_time as shift_start_time,
        s.end_time as shift_end_time,
        s.user_id as original_user_id,
        u1.username as requested_by_username,
        u1.first_name as requested_by_first_name,
        u1.last_name as requested_by_last_name,
        u2.username as requested_with_username,
        u2.first_name as requested_with_first_name,
        u2.last_name as requested_with_last_name
      FROM shift_swap_requests ssr
      JOIN shift_assignments sa ON ssr.assignment_id = sa.id
      JOIN shifts s ON sa.shift_id = s.id
      JOIN users u1 ON ssr.requested_by = u1.id
      LEFT JOIN users u2 ON ssr.requested_with = u2.id
      WHERE ssr.tenant_id = $1
    `;

    const queryParams: (string | number)[] = [tenantId];

    if (filters.userId != null && filters.userId !== 0) {
      const userParamIndex1 = queryParams.length + 1;
      const userParamIndex2 = queryParams.length + 2;
      query += ` AND (ssr.requested_by = $${userParamIndex1} OR ssr.requested_with = $${userParamIndex2})`;
      queryParams.push(filters.userId, filters.userId);
    }

    if (filters.status != null && filters.status !== '') {
      const statusParamIndex = queryParams.length + 1;
      query += ` AND ssr.status = $${statusParamIndex}`;
      queryParams.push(filters.status);
    }

    query += ' ORDER BY ssr.created_at DESC';

    const [requests] = await executeQuery<V2SwapRequestResult[]>(query, queryParams);
    return requests;
  } catch (error: unknown) {
    console.error('Error in getSwapRequests:', error);
    throw error;
  }
}

/**
 * Create swap request
 */
export async function createSwapRequest(data: V2SwapRequestData): Promise<number> {
  try {
    // First, we need to find the assignment_id for this shift and user
    const [assignments] = await executeQuery<IdResult[]>(
      'SELECT id FROM shift_assignments WHERE shift_id = $1 AND user_id = $2 AND tenant_id = $3',
      [data.shift_id, data.requested_by, data.tenant_id],
    );

    if (assignments.length === 0) {
      throw new Error('No assignment found for this shift and user');
    }

    const assignment = assignments[0];
    if (assignment === undefined) {
      throw new Error('Assignment not found in result set');
    }
    const assignmentId = assignment.id;

    const query = `
      INSERT INTO shift_swap_requests
      (tenant_id, assignment_id, requested_by, requested_with, reason, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    // PostgreSQL RETURNING returns rows array, not ResultSetHeader
    const [rows] = await executeQuery<{ id: number }[]>(query, [
      data.tenant_id,
      assignmentId,
      data.requested_by,
      data.requested_with ?? null,
      data.reason ?? null,
      data.status,
    ]);
    if (rows.length === 0 || rows[0] === undefined) {
      throw new Error('Failed to create swap request: No ID returned from database');
    }

    return rows[0].id;
  } catch (error: unknown) {
    console.error('Error in createSwapRequest:', error);
    throw error;
  }
}

/**
 * Get swap request by ID
 */
export async function getSwapRequestById(
  id: number,
  tenantId: number,
): Promise<V2SwapRequestResult | null> {
  try {
    const query = `
      SELECT * FROM shift_swap_requests
      WHERE id = $1 AND tenant_id = $2
    `;

    const [requests] = await executeQuery<V2SwapRequestResult[]>(query, [id, tenantId]);
    if (requests.length === 0) {
      return null;
    }
    const request = requests[0];
    if (request === undefined) {
      return null;
    }
    return request;
  } catch (error: unknown) {
    console.error('Error in getSwapRequestById:', error);
    throw error;
  }
}

/**
 * Update swap request status
 */
export async function updateSwapRequestStatus(
  id: number,
  status: string,
  approvedBy: number,
  tenantId: number,
): Promise<void> {
  try {
    const query = `
      UPDATE shift_swap_requests
      SET status = $1, approved_by = $2, updated_at = NOW()
      WHERE id = $3 AND tenant_id = $4
    `;

    await executeQuery(query, [status, approvedBy, id, tenantId]);

    // If approved, swap the shifts
    if (status === 'approved') {
      const [request] = await executeQuery<V2SwapRequestResult[]>(
        'SELECT * FROM shift_swap_requests WHERE id = $1 AND tenant_id = $2',
        [id, tenantId],
      );

      if (request.length === 0) {
        throw new Error('Swap request not found after approval');
      }
      const swapRequest = request[0];
      if (swapRequest === undefined) {
        throw new Error('Swap request is undefined');
      }
      if (swapRequest.requested_with != null && swapRequest.requested_with !== 0) {
        // Update the shift assignment (with tenant isolation)
        await executeQuery('UPDATE shifts SET user_id = $1 WHERE id = $2 AND tenant_id = $3', [
          swapRequest.requested_with,
          swapRequest.shift_id,
          tenantId,
        ]);
      }
    }
  } catch (error: unknown) {
    console.error('Error in updateSwapRequestStatus:', error);
    throw error;
  }
}

/**
 * Get overtime summary for a user
 */
async function getOvertimeSummary(
  userId: number,
  startDate: string,
  endDate: string,
  tenantId: number,
): Promise<OvertimeSummaryResult[]> {
  const query = `
    SELECT
      COUNT(*) as "totalShifts",
      SUM(
        CASE
          WHEN actual_end IS NOT NULL AND actual_start IS NOT NULL THEN
            TIMESTAMPDIFF(MINUTE,
              CONCAT(date, ' ', actual_start),
              CONCAT(date, ' ', actual_end)
            ) / 60.0
          ELSE
            TIMESTAMPDIFF(MINUTE,
              CONCAT(date, ' ', start_time),
              CONCAT(date, ' ', end_time)
            ) / 60.0
        END
      ) as "totalHours",
      SUM(
        CASE
          WHEN actual_end IS NOT NULL AND actual_start IS NOT NULL THEN
            GREATEST(0,
              TIMESTAMPDIFF(MINUTE,
                CONCAT(date, ' ', end_time),
                CONCAT(date, ' ', actual_end)
              ) / 60.0
            )
          ELSE 0
        END
      ) as "overtimeHours",
      SUM(break_minutes) / 60.0 as "breakHours"
    FROM shifts
    WHERE tenant_id = $1
      AND user_id = $2
      AND date BETWEEN $3 AND $4
      AND status IN ('completed', 'in_progress')
  `;

  const [result] = await executeQuery<OvertimeSummaryResult[]>(query, [
    tenantId,
    userId,
    formatDateOnlyForMysql(startDate),
    formatDateOnlyForMysql(endDate),
  ]);
  return result;
}

/**
 * Get shift details for overtime calculation
 */
async function getOvertimeShiftDetails(
  userId: number,
  startDate: string,
  endDate: string,
  tenantId: number,
): Promise<V2ShiftData[]> {
  const query = `
    SELECT
      date,
      start_time,
      end_time,
      actual_start,
      actual_end,
      break_minutes,
      type,
      CASE
        WHEN actual_end IS NOT NULL AND actual_start IS NOT NULL THEN
          TIMESTAMPDIFF(MINUTE,
            CONCAT(date, ' ', actual_start),
            CONCAT(date, ' ', actual_end)
          ) / 60.0
        ELSE
          TIMESTAMPDIFF(MINUTE,
            CONCAT(date, ' ', start_time),
            CONCAT(date, ' ', end_time)
          ) / 60.0
      END as "workedHours",
      CASE
        WHEN actual_end IS NOT NULL AND actual_start IS NOT NULL THEN
          GREATEST(0,
            TIMESTAMPDIFF(MINUTE,
              CONCAT(date, ' ', end_time),
              CONCAT(date, ' ', actual_end)
            ) / 60.0
          )
        ELSE 0
      END as "overtimeHours"
    FROM shifts
    WHERE tenant_id = $1
      AND user_id = $2
      AND date BETWEEN $3 AND $4
      AND status IN ('completed', 'in_progress')
    ORDER BY date DESC
  `;

  const [shifts] = await executeQuery<V2ShiftData[]>(query, [
    tenantId,
    userId,
    formatDateOnlyForMysql(startDate),
    formatDateOnlyForMysql(endDate),
  ]);
  return shifts;
}

/**
 * Get overtime by user
 */
export async function getOvertimeByUser(
  userId: number,
  startDate: string,
  endDate: string,
  tenantId: number,
): Promise<Record<string, unknown>> {
  try {
    const result = await getOvertimeSummary(userId, startDate, endDate, tenantId);
    const shifts = await getOvertimeShiftDetails(userId, startDate, endDate, tenantId);

    const summary = result[0];
    if (summary === undefined) {
      throw new Error('Failed to retrieve overtime summary');
    }
    return {
      summary: {
        totalShifts: summary.totalShifts,
        totalHours: summary.totalHours ?? 0,
        overtimeHours: summary.overtimeHours ?? 0,
        breakHours: summary.breakHours ?? 0,
        netHours: (summary.totalHours ?? 0) - (summary.breakHours ?? 0),
      },
      shifts,
    };
  } catch (error: unknown) {
    console.error('Error in getOvertimeByUser:', error);
    throw error;
  }
}

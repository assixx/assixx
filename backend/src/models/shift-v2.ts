/**
 * Shift V2 API Operations
 * V2 API shift management operations
 */
import { ResultSetHeader, RowDataPacket, query as executeQuery } from '../utils/db';
import { logger } from '../utils/logger';
import { getShiftTemplates } from './shift-core';
import {
  type DbShiftTemplate,
  type V2ShiftData,
  type V2ShiftFilters,
  type V2SwapRequestData,
  type V2SwapRequestFilters,
  type V2SwapRequestResult,
  type V2TemplateData,
  calculateDurationHours,
  formatDateForMysql,
  formatDateOnlyForMysql,
} from './shift-types';

// ============= V2 API HELPER FUNCTIONS =============

/**
 * Add date filter to conditions
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
    conditions.push('s.date = ?');
    params.push(formatDateOnlyForMysql(specificDate));
    return;
  }

  if (startDate != null && startDate !== '' && endDate != null && endDate !== '') {
    conditions.push('s.date BETWEEN ? AND ?');
    params.push(formatDateOnlyForMysql(startDate));
    params.push(formatDateOnlyForMysql(endDate));
  }
}

/**
 * Add filter condition if value is valid
 */
function addFilterCondition(
  field: string,
  value: string | number | null | undefined,
  conditions: string[],
  params: (string | number | null)[],
  emptyValue: string | number,
): void {
  if (value != null && value !== emptyValue) {
    conditions.push(`${field} = ?`);
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
    const [currentShift] = await executeQuery<RowDataPacket[]>(
      'SELECT date FROM shifts WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    if (currentShift.length > 0) {
      const formattedDate = formatDateOnlyForMysql(currentShift[0].date as string | Date);
      return formattedDate ?? undefined;
    }
  }
  return undefined;
}

/**
 * Convert value for database storage
 */
function convertValueForDatabase(value: unknown): string | number | null {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return value as string | number | null;
}

/**
 * Build update fields for template
 */
function buildTemplateUpdateFields(data: Partial<V2TemplateData>): {
  updateFields: string[];
  values: (string | number | null | Date)[];
} {
  const updateFields: string[] = [];
  const values: (string | number | null | Date)[] = [];

  const allowedFields = [
    'name',
    'description',
    'start_time',
    'end_time',
    'break_minutes',
    'color',
    'is_night_shift',
    'is_active',
  ];

  for (const field of allowedFields) {
    const value = data[field as keyof V2TemplateData];
    if (value === undefined) {
      continue;
    }

    updateFields.push(`${field} = ?`);
    values.push(convertValueForDatabase(value));
  }

  return { updateFields, values };
}

/**
 * Add duration update if times changed
 */
function addDurationUpdate(
  data: Partial<V2TemplateData>,
  updateFields: string[],
  values: (string | number | null | Date)[],
): void {
  const startTime = data.start_time;
  const endTime = data.end_time;

  const hasValidTimes = startTime != null && startTime !== '' && endTime != null && endTime !== '';

  if (!hasValidTimes) {
    return;
  }

  updateFields.push('duration_hours = ?');
  values.push(calculateDurationHours(startTime, endTime));
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
      WHERE s.tenant_id = ?`;

    const queryParams: (string | number | null)[] = [filters.tenant_id];

    // Build and apply filters
    const { conditions, params } = buildShiftQueryFilters(filters);
    let query = baseQuery;

    for (const condition of conditions) {
      query += ` AND ${condition}`;
    }
    queryParams.push(...params);

    // Sorting
    const sortBy = filters.sort_by ?? 'date';
    const sortOrder = filters.sort_order ?? 'DESC';
    query += ` ORDER BY s.${sortBy} ${sortOrder}`;

    // Pagination
    if (filters.limit != null && filters.limit !== 0) {
      query += ' LIMIT ?';
      queryParams.push(filters.limit);
      if (filters.offset != null && filters.offset !== 0) {
        query += ' OFFSET ?';
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
      WHERE s.id = ? AND s.tenant_id = ?
    `;

    const [shifts] = await executeQuery<V2ShiftData[]>(query, [id, tenantId]);
    return shifts.length > 0 ? shifts[0] : null;
  } catch (error: unknown) {
    console.error('Error in findById:', error);
    throw error;
  }
}

/**
 * Create shift (v2 version)
 */
export async function create(data: Partial<V2ShiftData>): Promise<number> {
  try {
    const query = `
      INSERT INTO shifts
      (tenant_id, user_id, plan_id, template_id, date, start_time, end_time,
       department_id, team_id, title, required_employees, break_minutes,
       status, type, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await executeQuery<ResultSetHeader>(query, [
      data.tenant_id,
      data.user_id,
      data.plan_id ?? null,
      data.template_id ?? null,
      data.date != null && data.date !== '' ? formatDateOnlyForMysql(data.date) : null,
      data.date != null && data.date !== '' && data.start_time != null && data.start_time !== '' ?
        formatDateForMysql(`${data.date} ${data.start_time}`)
      : null,
      data.date != null && data.date !== '' && data.end_time != null && data.end_time !== '' ?
        formatDateForMysql(`${data.date} ${data.end_time}`)
      : null,
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

    return result.insertId;
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
        updateFields.push(`${field} = ?`);
        values.push(processShiftFieldValue(field, fieldValue, data, currentDate));
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `
      UPDATE shifts
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = ? AND tenant_id = ?
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
    const [assignments] = await executeQuery<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM shift_assignments WHERE shift_id = ?',
      [id],
    );

    if (assignments[0].count > 0) {
      // Delete assignments first
      await executeQuery('DELETE FROM shift_assignments WHERE shift_id = ?', [id]);
    }

    // Delete the shift
    await executeQuery('DELETE FROM shifts WHERE id = ? AND tenant_id = ?', [id, tenantId]);
  } catch (error: unknown) {
    console.error('Error in deleteShift:', error);
    throw error;
  }
}

/**
 * Get templates (alias for getShiftTemplates)
 */
export async function getTemplates(tenantId: number): Promise<DbShiftTemplate[]> {
  return await getShiftTemplates(tenantId);
}

/**
 * Get template by ID
 */
export async function getTemplateById(
  id: number,
  tenantId: number,
): Promise<DbShiftTemplate | null> {
  try {
    const query = `
      SELECT * FROM shift_templates
      WHERE id = ? AND tenant_id = ?
    `;

    const [templates] = await executeQuery<DbShiftTemplate[]>(query, [id, tenantId]);
    return templates.length > 0 ? templates[0] : null;
  } catch (error: unknown) {
    console.error('Error in getTemplateById:', error);
    throw error;
  }
}

/**
 * Create template (alias)
 */
export async function createTemplate(data: V2TemplateData): Promise<number> {
  try {
    const query = `
      INSERT INTO shift_templates
      (tenant_id, name, start_time, end_time, break_minutes, color, is_night_shift, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await executeQuery<ResultSetHeader>(query, [
      data.tenant_id,
      data.name,
      data.start_time,
      data.end_time,
      data.break_minutes ?? 0,
      data.color ?? '#3498db',
      data.is_night_shift ?? false,
      data.is_active ?? true,
    ]);

    return result.insertId;
  } catch (error: unknown) {
    logger.error('Error creating shift template:', error);
    throw error;
  }
}

/**
 * Update template
 */
export async function updateTemplate(
  id: number,
  data: Partial<V2TemplateData>,
  tenantId: number,
): Promise<void> {
  try {
    const { updateFields, values } = buildTemplateUpdateFields(data);

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    // Add duration update if times changed
    addDurationUpdate(data, updateFields, values);

    const query = `
      UPDATE shift_templates
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = ? AND tenant_id = ?
    `;

    values.push(id, tenantId);
    await executeQuery(query, values);
  } catch (error: unknown) {
    console.error('Error in updateTemplate:', error);
    throw error;
  }
}

/**
 * Delete template
 */
export async function deleteTemplate(id: number, tenantId: number): Promise<void> {
  try {
    await executeQuery('DELETE FROM shift_templates WHERE id = ? AND tenant_id = ?', [
      id,
      tenantId,
    ]);
  } catch (error: unknown) {
    console.error('Error in deleteTemplate:', error);
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
      WHERE ssr.tenant_id = ?
    `;

    const queryParams: (string | number)[] = [tenantId];

    if (filters.userId != null && filters.userId !== 0) {
      query += ' AND (ssr.requested_by = ? OR ssr.requested_with = ?)';
      queryParams.push(filters.userId, filters.userId);
    }

    if (filters.status != null && filters.status !== '') {
      query += ' AND ssr.status = ?';
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
    const [assignments] = await executeQuery<RowDataPacket[]>(
      'SELECT id FROM shift_assignments WHERE shift_id = ? AND user_id = ? AND tenant_id = ?',
      [data.shift_id, data.requested_by, data.tenant_id],
    );

    if (assignments.length === 0) {
      throw new Error('No assignment found for this shift and user');
    }

    const assignmentId = assignments[0].id as number;

    const query = `
      INSERT INTO shift_swap_requests
      (tenant_id, assignment_id, requested_by, requested_with, reason, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await executeQuery<ResultSetHeader>(query, [
      data.tenant_id,
      assignmentId,
      data.requested_by,
      data.requested_with ?? null,
      data.reason ?? null,
      data.status,
    ]);

    return result.insertId;
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
      WHERE id = ? AND tenant_id = ?
    `;

    const [requests] = await executeQuery<V2SwapRequestResult[]>(query, [id, tenantId]);
    return requests.length > 0 ? requests[0] : null;
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
      SET status = ?, approved_by = ?, updated_at = NOW()
      WHERE id = ? AND tenant_id = ?
    `;

    await executeQuery(query, [status, approvedBy, id, tenantId]);

    // If approved, swap the shifts
    if (status === 'approved') {
      const [request] = await executeQuery<V2SwapRequestResult[]>(
        'SELECT * FROM shift_swap_requests WHERE id = ?',
        [id],
      );

      if (
        request.length > 0 &&
        request[0].requested_with != null &&
        request[0].requested_with !== 0
      ) {
        // Update the shift assignment
        await executeQuery('UPDATE shifts SET user_id = ? WHERE id = ?', [
          request[0].requested_with,
          request[0].shift_id,
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
): Promise<RowDataPacket[]> {
  const query = `
    SELECT
      COUNT(*) as totalShifts,
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
      ) as totalHours,
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
      ) as overtimeHours,
      SUM(break_minutes) / 60.0 as breakHours
    FROM shifts
    WHERE tenant_id = ?
      AND user_id = ?
      AND date BETWEEN ? AND ?
      AND status IN ('completed', 'in_progress')
  `;

  const [result] = await executeQuery<RowDataPacket[]>(query, [
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
      END as workedHours,
      CASE
        WHEN actual_end IS NOT NULL AND actual_start IS NOT NULL THEN
          GREATEST(0,
            TIMESTAMPDIFF(MINUTE,
              CONCAT(date, ' ', end_time),
              CONCAT(date, ' ', actual_end)
            ) / 60.0
          )
        ELSE 0
      END as overtimeHours
    FROM shifts
    WHERE tenant_id = ?
      AND user_id = ?
      AND date BETWEEN ? AND ?
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

    return {
      summary: {
        totalShifts: (result[0].totalShifts as number) || 0,
        totalHours: Number.parseFloat(String(result[0].totalHours)) || 0,
        overtimeHours: Number.parseFloat(String(result[0].overtimeHours)) || 0,
        breakHours: Number.parseFloat(String(result[0].breakHours)) || 0,
        netHours:
          (Number.parseFloat(String(result[0].totalHours)) || 0) -
          (Number.parseFloat(String(result[0].breakHours)) || 0),
      },
      shifts,
    };
  } catch (error: unknown) {
    console.error('Error in getOvertimeByUser:', error);
    throw error;
  }
}

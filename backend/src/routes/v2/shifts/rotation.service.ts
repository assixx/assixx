/**
 * Shift Rotation Service
 * Business logic for shift rotation patterns
 */
import { ServiceError } from '../../../utils/ServiceError.js';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from '../../../utils/db.js';
import { query as executeQuery, getConnection } from '../../../utils/db.js';
import { dbToApi } from '../../../utils/fieldMapping.js';
import type {
  AssignRotationRequest,
  CreateRotationPatternRequest,
  GenerateRotationRequest,
  PatternConfig,
  ShiftRotationAssignment,
  ShiftRotationHistory,
  ShiftRotationPattern,
} from './rotation.types.js';

// Query result interfaces
interface RotationPatternResult extends RowDataPacket {
  id: number;
  tenant_id: number;
  name: string;
  description?: string;
  pattern_type: 'fixed' | 'rotating';
  pattern_config: string | PatternConfig; // JSON string or parsed object
  is_active: boolean | number;
  created_by: number;
  created_at: Date;
  updated_at: Date;
  created_by_name?: string; // From LEFT JOIN users
}

interface AssignmentIdResult extends RowDataPacket {
  id: number;
}

/**
 * Get all rotation patterns for a tenant
 */
export async function getRotationPatterns(
  tenantId: number,
  activeOnly?: boolean,
): Promise<ShiftRotationPattern[]> {
  let query = `
    SELECT
      p.*,
      u.username as created_by_name
    FROM shift_rotation_patterns p
    LEFT JOIN users u ON p.created_by = u.id
    WHERE p.tenant_id = $1
  `;

  const params: (string | number | boolean)[] = [tenantId];

  if (activeOnly ?? true) {
    query += ' AND p.is_active = TRUE';
  }

  query += ' ORDER BY p.created_at DESC';

  const [rows] = await executeQuery<RotationPatternResult[]>(query, params);

  return rows.map((row: RotationPatternResult) => {
    const apiData = dbToApi(row);
    return {
      ...apiData,
      patternConfig:
        typeof row.pattern_config === 'string' ?
          (JSON.parse(row.pattern_config) as PatternConfig)
        : row.pattern_config,
    } as ShiftRotationPattern;
  });
}

/**
 * Get a single rotation pattern by ID
 */
export async function getRotationPattern(
  patternId: number,
  tenantId: number,
): Promise<ShiftRotationPattern> {
  const query = `
    SELECT
      p.*,
      u.username as created_by_name
    FROM shift_rotation_patterns p
    LEFT JOIN users u ON p.created_by = u.id
    WHERE p.id = $1 AND p.tenant_id = $2
  `;

  const [rows] = await executeQuery<RotationPatternResult[]>(query, [patternId, tenantId]);

  if (rows.length === 0) {
    throw new ServiceError('NOT_FOUND', 'Rotation pattern not found', 404);
  }

  const row = rows[0];
  if (row === undefined) {
    throw new ServiceError('NOT_FOUND', 'Rotation pattern not found', 404);
  }

  const apiRow = dbToApi(row);
  return {
    ...apiRow,
    patternConfig:
      typeof row.pattern_config === 'string' ?
        (JSON.parse(row.pattern_config) as PatternConfig)
      : row.pattern_config,
  } as ShiftRotationPattern;
}

/**
 * Create a new rotation pattern
 */
export async function createRotationPattern(
  data: CreateRotationPatternRequest,
  tenantId: number,
  userId: number,
): Promise<ShiftRotationPattern> {
  const query = `
    INSERT INTO shift_rotation_patterns (
      tenant_id, team_id, name, description, pattern_type,
      pattern_config, cycle_length_weeks, starts_at,
      ends_at, is_active, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `;

  const params = [
    tenantId,
    data.team_id ?? null,
    data.name,
    data.description ?? null,
    data.pattern_type,
    JSON.stringify(data.pattern_config),
    data.cycle_length_weeks ?? 2,
    data.starts_at,
    data.ends_at ?? null,
    data.is_active ?? true,
    userId,
  ];

  const [result] = await executeQuery<ResultSetHeader>(query, params);

  return await getRotationPattern(result.insertId, tenantId);
}

/**
 * Update a rotation pattern
 */
// eslint-disable-next-line max-lines-per-function
export async function updateRotationPattern(
  patternId: number,
  data: Partial<CreateRotationPatternRequest>,
  tenantId: number,
): Promise<ShiftRotationPattern> {
  // First check if pattern exists and belongs to tenant
  await getRotationPattern(patternId, tenantId);

  const updates: string[] = [];
  const params: (string | number | boolean | null)[] = [];

  // PostgreSQL: Dynamic $N parameter numbering
  if (data.name !== undefined) {
    const paramIndex = params.length + 1;
    updates.push(`name = $${paramIndex}`);
    params.push(data.name);
  }

  if (data.description !== undefined) {
    const paramIndex = params.length + 1;
    updates.push(`description = $${paramIndex}`);
    params.push(data.description ?? null);
  }

  if (data.team_id !== undefined) {
    const paramIndex = params.length + 1;
    updates.push(`team_id = $${paramIndex}`);
    params.push(data.team_id ?? null);
  }

  if (data.pattern_config !== undefined) {
    const paramIndex = params.length + 1;
    updates.push(`pattern_config = $${paramIndex}`);
    params.push(JSON.stringify(data.pattern_config));
  }

  if (data.cycle_length_weeks !== undefined) {
    const paramIndex = params.length + 1;
    updates.push(`cycle_length_weeks = $${paramIndex}`);
    params.push(data.cycle_length_weeks);
  }

  if (data.starts_at !== undefined) {
    const paramIndex = params.length + 1;
    updates.push(`starts_at = $${paramIndex}`);
    params.push(data.starts_at);
  }

  if (data.ends_at !== undefined) {
    const paramIndex = params.length + 1;
    updates.push(`ends_at = $${paramIndex}`);
    params.push(data.ends_at ?? null);
  }

  if (data.is_active !== undefined) {
    const paramIndex = params.length + 1;
    updates.push(`is_active = $${paramIndex}`);
    params.push(data.is_active);
  }

  if (updates.length === 0) {
    throw new ServiceError('BAD_REQUEST', 'No fields to update', 400);
  }

  // PostgreSQL: Dynamic parameter numbering for WHERE clause
  const patternIdParamIndex = params.length + 1;
  const tenantIdParamIndex = params.length + 2;
  params.push(patternId, tenantId);

  const query = `
    UPDATE shift_rotation_patterns
    SET ${updates.join(', ')}
    WHERE id = $${patternIdParamIndex} AND tenant_id = $${tenantIdParamIndex}
  `;

  await executeQuery(query, params);

  return await getRotationPattern(patternId, tenantId);
}

/**
 * Delete a rotation pattern
 */
export async function deleteRotationPattern(patternId: number, tenantId: number): Promise<void> {
  // Check if pattern exists and belongs to tenant
  await getRotationPattern(patternId, tenantId);

  // Delete pattern (cascade will handle assignments and history)
  const query = 'DELETE FROM shift_rotation_patterns WHERE id = $1 AND tenant_id = $2';
  await executeQuery(query, [patternId, tenantId]);
}

/** Update existing rotation assignment */
async function updateRotationAssignment(
  assignmentId: number,
  shiftGroup: string,
  startsAt: string,
  endsAt: string | null | undefined,
): Promise<void> {
  await executeQuery(
    `UPDATE shift_rotation_assignments SET shift_group = $1, starts_at = $2, ends_at = $3, updated_at = NOW() WHERE id = $4`,
    [shiftGroup, startsAt, endsAt ?? null, assignmentId],
  );
}

/** Create new rotation assignment */
async function createRotationAssignment(
  tenantId: number,
  patternId: number,
  userId: number,
  teamId: number | null | undefined,
  shiftGroup: string,
  startsAt: string,
  endsAt: string | null | undefined,
  assignedBy: number,
): Promise<void> {
  await executeQuery<ResultSetHeader>(
    `INSERT INTO shift_rotation_assignments (tenant_id, pattern_id, user_id, team_id, shift_group,
     rotation_order, can_override, starts_at, ends_at, is_active, assigned_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      tenantId,
      patternId,
      userId,
      teamId ?? null,
      shiftGroup,
      0,
      true,
      startsAt,
      endsAt ?? null,
      true,
      assignedBy,
    ],
  );
}

/** Assignment row type for rotation */
type AssignmentRow = RowDataPacket & {
  user_id: number;
  shift_group: 'F' | 'S' | 'N';
  id: number;
  team_id: number | null;
};

/** Get active assignments for a pattern within date range */
async function getActiveAssignmentsForPattern(
  patternId: number,
  tenantId: number,
  startDate: string,
  endDate: string,
): Promise<AssignmentRow[]> {
  const assignmentsQuery = `
    SELECT * FROM shift_rotation_assignments
    WHERE pattern_id = $1 AND tenant_id = $2
    AND is_active = TRUE
    AND starts_at <= $3
    AND (ends_at IS NULL OR ends_at >= $4)
  `;
  const [assignments] = await executeQuery<AssignmentRow[]>(assignmentsQuery, [
    patternId,
    tenantId,
    endDate,
    startDate,
  ]);
  return assignments;
}

/** Get active assignments for pattern */
async function getPatternAssignments(
  patternId: number,
  tenantId: number,
): Promise<ShiftRotationAssignment[]> {
  const [rows] = await executeQuery<RowDataPacket[]>(
    `SELECT a.*, u.username, u.first_name, u.last_name FROM shift_rotation_assignments a
     JOIN users u ON a.user_id = u.id WHERE a.pattern_id = $1 AND a.tenant_id = $2 AND a.is_active = TRUE`,
    [patternId, tenantId],
  );
  return rows.map((row: RowDataPacket) => dbToApi(row) as unknown as ShiftRotationAssignment);
}

/**
 * Assign users to a rotation pattern
 */
export async function assignUsersToPattern(
  data: AssignRotationRequest,
  tenantId: number,
  assignedBy: number,
): Promise<ShiftRotationAssignment[]> {
  await getRotationPattern(data.pattern_id, tenantId);

  for (const userId of data.user_ids) {
    const userKey = String(userId);
    const shiftGroupsMap = data.shift_groups as Record<string, 'F' | 'S' | 'N'>;

    // eslint-disable-next-line security/detect-object-injection -- userKey is from controlled array
    const shiftGroup = shiftGroupsMap[userKey];

    if (shiftGroup === undefined) {
      throw new ServiceError('BAD_REQUEST', `Shift group not specified for user ${userId}`, 400);
    }

    const [existing] = await executeQuery<AssignmentIdResult[]>(
      `SELECT id FROM shift_rotation_assignments WHERE tenant_id = $1 AND pattern_id = $2 AND user_id = $3
       AND (ends_at IS NULL OR ends_at > NOW())`,
      [tenantId, data.pattern_id, userId],
    );

    if (existing.length > 0) {
      const existingRow = existing[0];
      if (existingRow === undefined) {
        throw new ServiceError('INTERNAL_ERROR', 'Failed to retrieve existing assignment', 500);
      }
      await updateRotationAssignment(existingRow.id, shiftGroup, data.starts_at, data.ends_at);
    } else {
      await createRotationAssignment(
        tenantId,
        data.pattern_id,
        userId,
        data.team_id,
        shiftGroup,
        data.starts_at,
        data.ends_at,
        assignedBy,
      );
    }
  }

  return await getPatternAssignments(data.pattern_id, tenantId);
}

/** Generated shift data interface */
interface GeneratedShift {
  user_id: number;
  date: string;
  shift_type: 'F' | 'S' | 'N';
}

/** Save all generated shifts in a transaction */
async function saveShiftsInTransaction(
  assignments: AssignmentRow[],
  pattern: ShiftRotationPattern,
  data: GenerateRotationRequest,
  tenantId: number,
  generatedBy: number,
): Promise<void> {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    for (const assignment of assignments) {
      const shifts = generateShiftsForAssignment(
        assignment,
        pattern,
        data.start_date,
        data.end_date,
      );
      for (const shift of shifts) {
        await saveGeneratedShiftInTransaction(
          connection,
          shift,
          pattern.id ?? data.pattern_id,
          assignment.id,
          tenantId,
          assignment.team_id,
          generatedBy,
        );
      }
    }

    await connection.commit();
    console.info('[ROTATION GENERATE] Transaction committed successfully');
  } catch (error) {
    await connection.rollback();
    console.error('[GENERATE ERROR] Transaction rolled back due to error:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Generate shifts based on rotation pattern
 */
export async function generateRotationShifts(
  data: GenerateRotationRequest,
  tenantId: number,
  generatedBy: number,
): Promise<GeneratedShift[]> {
  const pattern = await getRotationPattern(data.pattern_id, tenantId);
  const assignments = await getActiveAssignmentsForPattern(
    data.pattern_id,
    tenantId,
    data.start_date,
    data.end_date,
  );

  const generatedShifts: GeneratedShift[] = [];
  for (const assignment of assignments) {
    const shifts = generateShiftsForAssignment(assignment, pattern, data.start_date, data.end_date);
    generatedShifts.push(...shifts);
  }

  // If not preview mode, save ALL shifts in a transaction
  if (data.preview !== true && generatedShifts.length > 0) {
    await saveShiftsInTransaction(assignments, pattern, data, tenantId, generatedBy);
  }

  return generatedShifts;
}

/**
 * Helper: Generate shifts for a single assignment
 */
type ShiftAssignmentRow = RowDataPacket & {
  user_id: number;
  shift_group: string;
  id: number;
  team_id: number | null;
};

/**
 * Determine shift type for F/S alternation with night shift ignored
 */
function determineAlternatingShiftType(shiftGroup: string, cycleWeek: number): 'F' | 'S' | 'N' {
  if (shiftGroup === 'F') {
    return cycleWeek === 0 ? 'F' : 'S';
  }
  if (shiftGroup === 'S') {
    return cycleWeek === 0 ? 'S' : 'F';
  }
  // Night shift workers (N) and any other unexpected values
  // WICHTIG: Bei ignoreNightShift bleiben N-Mitarbeiter IMMER in Nachtschicht!
  return shiftGroup === 'N' ? 'N' : 'F';
}

/**
 * Determine shift type for a given date and pattern
 */
function determineShiftType(
  assignment: ShiftAssignmentRow,
  pattern: ShiftRotationPattern,
  weeksSinceStart: number,
  date: Date,
): 'F' | 'S' | 'N' {
  const config: PatternConfig = pattern.patternConfig;
  const ignoreNightShift = config.ignoreNightShift ?? false;

  // Fixed night shift pattern
  if (pattern.patternType === 'fixed_n') {
    return 'N';
  }

  // Weekly rotation patterns
  const isWeeklyRotation =
    pattern.patternType === 'alternate_fs' ||
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- patternType is a runtime value that can be different strings
    (pattern.patternType === 'custom' && config.cycleWeeks === 1);

  if (!isWeeklyRotation) {
    // Custom pattern - would need more complex logic
    return assignment.shift_group as 'F' | 'S' | 'N';
  }

  // Weekly rotation with ignoreNightShift
  if (ignoreNightShift) {
    const cycleWeek = weeksSinceStart % 2; // Only 2-week cycle for F/S alternation

    // Debug logging
    const dateStr = date.toISOString().split('T')[0] ?? 'unknown';
    console.info(
      `[ROTATION DEBUG] Date: ${dateStr}, User: ${assignment.user_id}, Shift Group: ${assignment.shift_group}, Weeks Since Start: ${weeksSinceStart}, Cycle Week: ${cycleWeek}`,
    );

    return determineAlternatingShiftType(assignment.shift_group, cycleWeek);
  }

  // Original 3-shift rotation (F -> S -> N)
  const cycleWeek = weeksSinceStart % 3;
  if (cycleWeek === 0) return 'F';
  if (cycleWeek === 1) return 'S';
  return 'N';
}

function generateShiftsForAssignment(
  assignment: ShiftAssignmentRow,
  pattern: ShiftRotationPattern,
  startDate: string,
  endDate: string,
): { user_id: number; date: string; shift_type: 'F' | 'S' | 'N' }[] {
  const shifts: { user_id: number; date: string; shift_type: 'F' | 'S' | 'N' }[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const patternStart = new Date(pattern.startsAt);

  console.info(
    `[ROTATION GENERATE] Starting for user ${assignment.user_id}, pattern ${pattern.patternType}, dates ${startDate} to ${endDate}`,
  );

  // Calculate weeks since pattern start
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const config: PatternConfig = pattern.patternConfig;
  const skipWeekends = config.skipWeekends ?? true;

  console.info(
    `[ROTATION CONFIG] skipWeekends: ${skipWeekends}, ignoreNightShift: ${config.ignoreNightShift ?? false}, cycleWeeks: ${config.cycleWeeks ?? 'undefined'}`,
  );

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    // Skip weekends if configured
    if (skipWeekends && (date.getDay() === 0 || date.getDay() === 6)) continue;

    const weeksSinceStart = Math.floor((date.getTime() - patternStart.getTime()) / msPerWeek);
    const shiftType = determineShiftType(assignment, pattern, weeksSinceStart, date);

    const dateString = date.toISOString().split('T')[0];
    if (dateString === undefined) {
      throw new ServiceError('INTERNAL_ERROR', 'Failed to format date', 500);
    }

    shifts.push({
      user_id: assignment.user_id,
      date: dateString,
      shift_type: shiftType,
    });
  }

  return shifts;
}

/**
 * Helper: Save generated shift to history (with transaction support)
 */
async function saveGeneratedShiftInTransaction(
  connection: PoolConnection,
  shift: { user_id: number; date: string; shift_type: 'F' | 'S' | 'N' },
  patternId: number,
  assignmentId: number,
  tenantId: number,
  teamId: number | null,
  _generatedBy: number,
): Promise<void> {
  // Check if shift already exists
  const checkQuery = `
    SELECT id FROM shift_rotation_history
    WHERE tenant_id = $1 AND user_id = $2 AND shift_date = $3
  `;
  const [existing] = await connection.query<RowDataPacket[]>(checkQuery, [
    tenantId,
    shift.user_id,
    shift.date,
  ]);

  if (existing.length === 0) {
    // Calculate week number
    const date = new Date(shift.date);
    const yearStart = new Date(date.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(
      ((date.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7,
    );

    const insertQuery = `
      INSERT INTO shift_rotation_history (
        tenant_id, pattern_id, assignment_id, user_id, team_id,
        shift_date, shift_type, week_number, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'generated')
    `;

    await connection.query(insertQuery, [
      tenantId,
      patternId,
      assignmentId,
      shift.user_id,
      teamId,
      shift.date,
      shift.shift_type,
      weekNumber,
    ]);

    console.info(
      `[DB SAVE] Saved shift for user ${shift.user_id} on ${shift.date} (${shift.shift_type}) in transaction`,
    );
  } else {
    console.info(`[DB SKIP] Shift already exists for user ${shift.user_id} on ${shift.date}`);
  }
}

/**
 * Get rotation history
 */
export async function getRotationHistory(
  tenantId: number,
  filters: {
    patternId?: number;
    userId?: number;
    startDate?: string;
    endDate?: string;
    status?: string;
  },
): Promise<ShiftRotationHistory[]> {
  let query = `
    SELECT
      h.*,
      u.username,
      u.first_name,
      u.last_name,
      p.name as pattern_name
    FROM shift_rotation_history h
    JOIN users u ON h.user_id = u.id
    JOIN shift_rotation_patterns p ON h.pattern_id = p.id
    WHERE h.tenant_id = $1
  `;

  const params: (string | number)[] = [tenantId];

  // PostgreSQL: Dynamic $N parameter numbering
  if (filters.patternId !== undefined) {
    const paramIndex = params.length + 1;
    query += ` AND h.pattern_id = $${paramIndex}`;
    params.push(filters.patternId);
  }

  if (filters.userId !== undefined) {
    const paramIndex = params.length + 1;
    query += ` AND h.user_id = $${paramIndex}`;
    params.push(filters.userId);
  }

  if (filters.startDate !== undefined && filters.startDate !== '') {
    const paramIndex = params.length + 1;
    query += ` AND h.shift_date >= $${paramIndex}`;
    params.push(filters.startDate);
  }

  if (filters.endDate !== undefined && filters.endDate !== '') {
    const paramIndex = params.length + 1;
    query += ` AND h.shift_date <= $${paramIndex}`;
    params.push(filters.endDate);
  }

  if (filters.status !== undefined && filters.status !== '') {
    const paramIndex = params.length + 1;
    query += ` AND h.status = $${paramIndex}`;
    params.push(filters.status);
  }

  query += ' ORDER BY h.shift_date DESC, h.user_id';

  const [rows] = await executeQuery<RowDataPacket[]>(query, params);

  return rows.map((row: RowDataPacket) => dbToApi(row) as unknown as ShiftRotationHistory);
}

/**
 * Delete all rotation data for a specific team
 * CRITICAL: Must include team_id for multi-tenant isolation!
 */
export async function deleteRotationHistory(
  tenantId: number,
  teamId: number,
): Promise<{
  historyDeleted: number;
  assignmentsDeleted: number;
  patternsDeleted: number;
}> {
  // Start transaction to ensure data consistency
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // 1. Delete from shift_rotation_history (if exists)
    const historyQuery = `
      DELETE FROM shift_rotation_history
      WHERE tenant_id = $1 AND team_id = $2
    `;
    const [historyResult] = await connection.execute<ResultSetHeader>(historyQuery, [
      tenantId,
      teamId,
    ]);

    // 2. Delete from shift_rotation_assignments - CRITICAL: team_id filter!
    const assignmentsQuery = `
      DELETE FROM shift_rotation_assignments
      WHERE tenant_id = $1 AND team_id = $2
    `;
    const [assignmentsResult] = await connection.execute<ResultSetHeader>(assignmentsQuery, [
      tenantId,
      teamId,
    ]);

    // 3. Delete from shift_rotation_patterns - CRITICAL: team_id filter!
    const patternsQuery = `
      DELETE FROM shift_rotation_patterns
      WHERE tenant_id = $1 AND team_id = $2
    `;
    const [patternsResult] = await connection.execute<ResultSetHeader>(patternsQuery, [
      tenantId,
      teamId,
    ]);

    await connection.commit();

    console.info('[ROTATION DELETE] Successfully deleted rotation data:', {
      tenantId,
      teamId,
      historyDeleted: historyResult.affectedRows,
      assignmentsDeleted: assignmentsResult.affectedRows,
      patternsDeleted: patternsResult.affectedRows,
    });

    return {
      historyDeleted: historyResult.affectedRows,
      assignmentsDeleted: assignmentsResult.affectedRows,
      patternsDeleted: patternsResult.affectedRows,
    };
  } catch (error) {
    await connection.rollback();
    console.error('[ROTATION DELETE ERROR]:', error);
    throw error;
  } finally {
    connection.release();
  }
}

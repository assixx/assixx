/* eslint-disable max-lines */
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
  GenerateRotationFromConfigRequest,
  GenerateRotationRequest,
  PatternConfig,
  ShiftBlockType,
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
    query += ' AND p.is_active = 1';
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
 * Check if a rotation pattern with this name already exists
 * Returns the existing pattern ID if found, null otherwise
 */
async function findExistingPatternByName(name: string, tenantId: number): Promise<number | null> {
  const [rows] = await executeQuery<RowDataPacket[]>(
    'SELECT id FROM shift_rotation_patterns WHERE name = $1 AND tenant_id = $2 AND is_active = 1',
    [name, tenantId],
  );
  if (rows.length > 0) {
    const row = rows[0];
    return row !== undefined ? (row['id'] as number) : null;
  }
  return null;
}

/**
 * Create a new rotation pattern
 * Throws DUPLICATE_NAME error if pattern with same name exists (with existingId in metadata)
 */
export async function createRotationPattern(
  data: CreateRotationPatternRequest,
  tenantId: number,
  userId: number,
): Promise<ShiftRotationPattern> {
  // Check for existing pattern with same name
  const existingId = await findExistingPatternByName(data.name, tenantId);
  if (existingId !== null) {
    const error = new ServiceError(
      'DUPLICATE_NAME',
      `Ein Rotationsmuster mit dem Namen "${data.name}" existiert bereits.`,
      409,
    );
    // Attach existingId for frontend to use in update request
    (error as ServiceError & { existingId: number }).existingId = existingId;
    throw error;
  }

  // PostgreSQL: Use RETURNING id to get the inserted ID
  const query = `
    INSERT INTO shift_rotation_patterns (
      tenant_id, team_id, name, description, pattern_type,
      pattern_config, cycle_length_weeks, starts_at,
      ends_at, is_active, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id
  `;

  // is_active is SMALLINT in PostgreSQL: 0=inactive, 1=active
  const isActiveValue = data.isActive === false ? 0 : 1;

  // API uses camelCase, DB uses snake_case - convert here
  const params = [
    tenantId,
    data.teamId ?? null,
    data.name,
    data.description ?? null,
    data.patternType,
    JSON.stringify(data.patternConfig),
    data.cycleLengthWeeks ?? 2,
    data.startsAt,
    data.endsAt ?? null,
    isActiveValue,
    userId,
  ];

  // PostgreSQL returns rows with RETURNING, not insertId
  const [rows] = await executeQuery<RowDataPacket[]>(query, params);
  const insertedRow = rows[0];
  if (insertedRow === undefined) {
    throw new ServiceError('INTERNAL_ERROR', 'Failed to create rotation pattern', 500);
  }
  const insertedId = insertedRow['id'] as number;

  return await getRotationPattern(insertedId, tenantId);
}

/**
 * Add update field to query params
 * PostgreSQL: Dynamic $N parameter numbering
 */
function addUpdateField(
  dbColumn: string,
  value: unknown,
  updates: string[],
  params: (string | number | boolean | null)[],
): void {
  if (value === undefined) return;
  const paramIndex = params.length + 1;
  updates.push(`${dbColumn} = $${paramIndex}`);
  params.push(value as string | number | boolean | null);
}

/**
 * Build update params from request data
 * API uses camelCase, DB uses snake_case
 */
function buildUpdateParams(data: Partial<CreateRotationPatternRequest>): {
  updates: string[];
  params: (string | number | boolean | null)[];
} {
  const updates: string[] = [];
  const params: (string | number | boolean | null)[] = [];

  addUpdateField('name', data.name, updates, params);
  addUpdateField('description', data.description ?? null, updates, params);
  addUpdateField('team_id', data.teamId ?? null, updates, params);
  if (data.patternConfig !== undefined) {
    addUpdateField('pattern_config', JSON.stringify(data.patternConfig), updates, params);
  }
  addUpdateField('cycle_length_weeks', data.cycleLengthWeeks, updates, params);
  addUpdateField('starts_at', data.startsAt, updates, params);
  addUpdateField('ends_at', data.endsAt ?? null, updates, params);
  if (data.isActive !== undefined) {
    // is_active is SMALLINT: 0=inactive, 1=active
    addUpdateField('is_active', data.isActive ? 1 : 0, updates, params);
  }

  return { updates, params };
}

/**
 * Update a rotation pattern
 */
export async function updateRotationPattern(
  patternId: number,
  data: Partial<CreateRotationPatternRequest>,
  tenantId: number,
): Promise<ShiftRotationPattern> {
  // First check if pattern exists and belongs to tenant
  await getRotationPattern(patternId, tenantId);

  const { updates, params } = buildUpdateParams(data);

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
      true, // can_override is BOOLEAN
      startsAt,
      endsAt ?? null,
      1, // is_active is SMALLINT: 0=inactive, 1=active
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
    AND is_active = 1
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
     JOIN users u ON a.user_id = u.id WHERE a.pattern_id = $1 AND a.tenant_id = $2 AND a.is_active = 1`,
    [patternId, tenantId],
  );
  return rows.map((row: RowDataPacket) => dbToApi(row) as unknown as ShiftRotationAssignment);
}

/**
 * Assign users to a rotation pattern
 * API uses camelCase, converts to snake_case for DB operations
 */
export async function assignUsersToPattern(
  data: AssignRotationRequest,
  tenantId: number,
  assignedBy: number,
): Promise<ShiftRotationAssignment[]> {
  // Validate pattern exists
  await getRotationPattern(data.patternId, tenantId);

  // Process each assignment from the frontend array structure
  for (const assignment of data.assignments) {
    const { userId, group: shiftGroup } = assignment;

    const [existing] = await executeQuery<AssignmentIdResult[]>(
      `SELECT id FROM shift_rotation_assignments WHERE tenant_id = $1 AND pattern_id = $2 AND user_id = $3
       AND (ends_at IS NULL OR ends_at > NOW())`,
      [tenantId, data.patternId, userId],
    );

    if (existing.length > 0) {
      const existingRow = existing[0];
      if (existingRow === undefined) {
        throw new ServiceError('INTERNAL_ERROR', 'Failed to retrieve existing assignment', 500);
      }
      await updateRotationAssignment(existingRow.id, shiftGroup, data.startsAt, data.endsAt);
    } else {
      await createRotationAssignment(
        tenantId,
        data.patternId,
        userId,
        data.teamId,
        shiftGroup,
        data.startsAt,
        data.endsAt,
        assignedBy,
      );
    }
  }

  return await getPatternAssignments(data.patternId, tenantId);
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
      const shifts = generateShiftsForAssignment(assignment, pattern, data.startDate, data.endDate);
      for (const shift of shifts) {
        await saveGeneratedShiftInTransaction(
          connection,
          shift,
          pattern.id ?? data.patternId,
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
 * API uses camelCase, converts to snake_case for DB operations
 */
export async function generateRotationShifts(
  data: GenerateRotationRequest,
  tenantId: number,
  generatedBy: number,
): Promise<GeneratedShift[]> {
  const pattern = await getRotationPattern(data.patternId, tenantId);
  const assignments = await getActiveAssignmentsForPattern(
    data.patternId,
    tenantId,
    data.startDate,
    data.endDate,
  );

  const generatedShifts: GeneratedShift[] = [];
  for (const assignment of assignments) {
    const shifts = generateShiftsForAssignment(assignment, pattern, data.startDate, data.endDate);
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
  // Support both new (nightShiftStatic) and legacy (ignoreNightShift) field names
  const nightShiftStatic = config.nightShiftStatic ?? config.ignoreNightShift ?? false;

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

  // Weekly rotation with nightShiftStatic (N stays constant, only F ↔ S alternate)
  if (nightShiftStatic) {
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

  // Support both new (skipSaturday/skipSunday) and legacy (skipWeekends) fields
  // If new fields not set, fall back to legacy behavior
  const skipSaturday = config.skipSaturday ?? config.skipWeekends ?? false;
  const skipSunday = config.skipSunday ?? config.skipWeekends ?? false;
  const nightShiftStatic = config.nightShiftStatic ?? config.ignoreNightShift ?? false;

  console.info(
    `[ROTATION CONFIG] skipSaturday: ${skipSaturday}, skipSunday: ${skipSunday}, nightShiftStatic: ${nightShiftStatic}, cycleWeeks: ${config.cycleWeeks ?? 'undefined'}`,
  );

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

    // Skip Saturday if configured (dayOfWeek === 6)
    if (skipSaturday && dayOfWeek === 6) continue;

    // Skip Sunday if configured (dayOfWeek === 0)
    if (skipSunday && dayOfWeek === 0) continue;

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
    teamId?: number;
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

  if (filters.teamId !== undefined) {
    const paramIndex = params.length + 1;
    query += ` AND h.team_id = $${paramIndex}`;
    params.push(filters.teamId);
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

/**
 * Delete rotation history for a specific date range (week)
 * Only deletes history entries, keeps patterns and assignments intact
 * CRITICAL: Must include team_id for multi-tenant isolation!
 */
export async function deleteRotationHistoryByDateRange(
  tenantId: number,
  teamId: number,
  startDate: string,
  endDate: string,
): Promise<{ historyDeleted: number }> {
  const connection = await getConnection();

  try {
    const query = `
      DELETE FROM shift_rotation_history
      WHERE tenant_id = $1
        AND team_id = $2
        AND shift_date >= $3
        AND shift_date <= $4
    `;
    const [result] = await connection.execute<ResultSetHeader>(query, [
      tenantId,
      teamId,
      startDate,
      endDate,
    ]);

    console.info('[ROTATION DELETE BY DATE] Successfully deleted rotation history:', {
      tenantId,
      teamId,
      startDate,
      endDate,
      historyDeleted: result.affectedRows,
    });

    return { historyDeleted: result.affectedRows };
  } catch (error) {
    console.error('[ROTATION DELETE BY DATE ERROR]:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Delete a single rotation history entry by ID
 * Used when removing individual shift assignments from the UI
 */
export async function deleteRotationHistoryEntry(
  historyId: number,
  tenantId: number,
): Promise<void> {
  const connection = await getConnection();

  try {
    // Delete with tenant isolation
    const query = `
      DELETE FROM shift_rotation_history
      WHERE id = $1 AND tenant_id = $2
    `;
    const [result] = await connection.execute<ResultSetHeader>(query, [historyId, tenantId]);

    if (result.affectedRows === 0) {
      throw new ServiceError('NOT_FOUND', 'Rotation history entry not found', 404);
    }

    console.info('[ROTATION DELETE ENTRY] Successfully deleted rotation history entry:', {
      historyId,
      tenantId,
    });
  } catch (error) {
    console.error('[ROTATION DELETE ENTRY ERROR]:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// ============================================================
// NEW: Algorithm-based rotation generation
// ============================================================

/**
 * Map group (F/S/N) to shift type index in sequence
 */
function getGroupStartIndex(group: 'F' | 'S' | 'N', sequence: ShiftBlockType[]): number {
  let shiftType: ShiftBlockType;
  switch (group) {
    case 'F':
      shiftType = 'early';
      break;
    case 'S':
      shiftType = 'late';
      break;
    case 'N':
      shiftType = 'night';
      break;
  }
  const index = sequence.indexOf(shiftType);
  return index >= 0 ? index : 0;
}

/** History entry for rotation */
interface RotationHistoryEntry {
  date: string;
  shiftType: 'F' | 'S' | 'N';
  weekNumber: number;
}

/**
 * Create rotation pattern in database (internal - uses transaction connection)
 */
async function _createPatternInTransaction(
  connection: PoolConnection,
  data: GenerateRotationFromConfigRequest,
  tenantId: number,
  userId: number,
): Promise<number> {
  const { config, startDate, endDate, teamId } = data;
  const patternConfig = JSON.stringify({
    shiftBlockLength: config.shiftBlockLength,
    freeDays: config.freeDays,
    startShift: config.startShift,
    shiftSequence: config.shiftSequence,
    specialRules: config.specialRules,
  });

  const cycleWeeks = Math.ceil((config.shiftBlockLength + config.freeDays) / 7);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const patternName = `Custom-Rotation ${timestamp}`;

  const [rows] = await connection.query(
    `INSERT INTO shift_rotation_patterns
     (tenant_id, team_id, name, pattern_type, pattern_config, cycle_length_weeks, starts_at, ends_at, created_by)
     VALUES ($1, $2, $3, 'custom', $4::jsonb, $5, $6, $7, $8) RETURNING id`,
    [tenantId, teamId ?? null, patternName, patternConfig, cycleWeeks, startDate, endDate, userId],
  );
  const resultRows = rows as { id: number }[];
  return resultRows[0]?.id ?? 0;
}

/**
 * Create assignment for employee in pattern (internal - uses transaction connection)
 */
async function _createAssignmentInTransaction(
  connection: PoolConnection,
  patternId: number,
  assignment: GenerateRotationFromConfigRequest['assignments'][0],
  tenantId: number,
  teamId: number | undefined,
  startDate: string,
  endDate: string,
  userId: number,
): Promise<number> {
  const [rows] = await connection.query(
    `INSERT INTO shift_rotation_assignments
     (tenant_id, pattern_id, user_id, team_id, shift_group, starts_at, ends_at, assigned_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      tenantId,
      patternId,
      assignment.userId,
      teamId ?? null,
      assignment.startGroup,
      startDate,
      endDate,
      userId,
    ],
  );
  const resultRows = rows as { id: number }[];
  return resultRows[0]?.id ?? 0;
}

/**
 * Insert rotation history entries for an employee (internal - uses transaction connection)
 */
async function _insertHistoryInTransaction(
  connection: PoolConnection,
  entries: RotationHistoryEntry[],
  patternId: number,
  assignmentId: number,
  employeeUserId: number,
  tenantId: number,
  teamId: number | undefined,
): Promise<number> {
  for (const entry of entries) {
    await connection.query(
      `INSERT INTO shift_rotation_history
       (tenant_id, pattern_id, assignment_id, user_id, team_id, shift_date, shift_type, week_number, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'generated')
       ON CONFLICT (tenant_id, user_id, shift_date) DO UPDATE SET
       shift_type = EXCLUDED.shift_type, pattern_id = EXCLUDED.pattern_id, assignment_id = EXCLUDED.assignment_id`,
      [
        tenantId,
        patternId,
        assignmentId,
        employeeUserId,
        teamId ?? null,
        entry.date,
        entry.shiftType,
        entry.weekNumber,
      ],
    );
  }
  return entries.length;
}

/**
 * Generate rotation shifts from algorithm config + employee assignments
 */
export async function generateRotationFromConfig(
  data: GenerateRotationFromConfigRequest,
  tenantId: number,
  userId: number,
): Promise<{ success: boolean; shiftsCreated: number; patternId: number }> {
  console.info('[GENERATE-FROM-CONFIG] Starting:', { assignments: data.assignments.length });

  const { config, assignments, startDate, endDate, teamId } = data;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    // 1. Create pattern
    const patternId = await _createPatternInTransaction(connection, data, tenantId, userId);
    console.info(`[GENERATE-FROM-CONFIG] Created pattern: ${String(patternId)}`);

    // 2. Create assignments and history for each employee
    let totalShifts = 0;
    for (const assignment of assignments) {
      const assignmentId = await _createAssignmentInTransaction(
        connection,
        patternId,
        assignment,
        tenantId,
        teamId,
        startDate,
        endDate,
        userId,
      );

      const entries = generateHistoryEntries(assignment, config, start, totalDays);
      const count = await _insertHistoryInTransaction(
        connection,
        entries,
        patternId,
        assignmentId,
        assignment.userId,
        tenantId,
        teamId,
      );
      totalShifts += count;
    }

    await connection.commit();
    console.info(`[GENERATE-FROM-CONFIG] Created ${totalShifts} history entries`);
    return { success: true, shiftsCreated: totalShifts, patternId };
  } catch (error) {
    await connection.rollback();
    console.error('[GENERATE-FROM-CONFIG] Error:', error);
    throw new ServiceError('GENERATION_FAILED', 'Failed to generate rotation shifts', 500);
  } finally {
    connection.release();
  }
}

/**
 * Generate history entries for single employee
 */
function generateHistoryEntries(
  assignment: GenerateRotationFromConfigRequest['assignments'][0],
  config: GenerateRotationFromConfigRequest['config'],
  start: Date,
  totalDays: number,
): RotationHistoryEntry[] {
  const { shiftBlockLength, freeDays, shiftSequence } = config;
  const cycleLength = shiftBlockLength + freeDays;
  const entries: RotationHistoryEntry[] = [];

  const startIndex = getGroupStartIndex(assignment.startGroup, shiftSequence);
  let currentShiftIndex = startIndex;
  let dayInCycle = 0;

  for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + dayOffset);
    const dateStr = currentDate.toISOString().split('T')[0] ?? '';
    const positionInCycle = dayInCycle % cycleLength;

    if (positionInCycle < shiftBlockLength) {
      const shiftType = shiftSequence[currentShiftIndex % shiftSequence.length] ?? 'early';
      const weekNumber = getWeekNumber(currentDate);
      entries.push({
        date: dateStr,
        shiftType: mapShiftTypeToGroup(shiftType),
        weekNumber,
      });
    }

    dayInCycle++;
    if (dayInCycle >= cycleLength) {
      dayInCycle = 0;
      currentShiftIndex++;
    }
  }

  return entries;
}

/** Get ISO week number */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const utcDay = d.getUTCDay();
  const dayNum = utcDay === 0 ? 7 : utcDay;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Map shift type to group enum */
function mapShiftTypeToGroup(shiftType: ShiftBlockType): 'F' | 'S' | 'N' {
  switch (shiftType) {
    case 'early':
      return 'F';
    case 'late':
      return 'S';
    case 'night':
      return 'N';
    default:
      return 'F';
  }
}

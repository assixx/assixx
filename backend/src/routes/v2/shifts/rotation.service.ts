/**
 * Shift Rotation Service
 * Business logic for shift rotation patterns
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';

import { ServiceError } from '../../../utils/ServiceError.js';
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

interface ShiftEntry {
  userId: number;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
}

/**
 * Get all rotation patterns for a tenant
 */
export async function getRotationPatterns(
  tenantId: number,
  activeOnly = true,
): Promise<ShiftRotationPattern[]> {
  let query = `
    SELECT
      p.*,
      u.username as created_by_name
    FROM shift_rotation_patterns p
    LEFT JOIN users u ON p.created_by = u.id
    WHERE p.tenant_id = ?
  `;

  const params: (string | number | boolean)[] = [tenantId];

  if (activeOnly) {
    query += ' AND p.is_active = TRUE';
  }

  query += ' ORDER BY p.created_at DESC';

  const [rows] = await executeQuery<RowDataPacket[]>(query, params);

  return rows.map((row) => {
    const apiData = dbToApi(row);
    return {
      ...apiData,
      patternConfig:
        typeof row.pattern_config === 'string' ?
          (JSON.parse(row.pattern_config) as PatternConfig)
        : (row.pattern_config as PatternConfig),
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
    WHERE p.id = ? AND p.tenant_id = ?
  `;

  const [rows] = await executeQuery<RowDataPacket[]>(query, [patternId, tenantId]);

  if (rows.length === 0) {
    throw new ServiceError('NOT_FOUND', 'Rotation pattern not found', 404);
  }

  const row = rows[0];
  const apiRow = dbToApi(row);
  return {
    ...apiRow,
    patternConfig:
      typeof row.pattern_config === 'string' ?
        (JSON.parse(row.pattern_config) as PatternConfig)
      : (row.pattern_config as PatternConfig),
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
export async function updateRotationPattern(
  patternId: number,
  data: Partial<CreateRotationPatternRequest>,
  tenantId: number,
): Promise<ShiftRotationPattern> {
  // First check if pattern exists and belongs to tenant
  await getRotationPattern(patternId, tenantId);

  const updates: string[] = [];
  const params: (string | number | boolean | null)[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }

  if (data.description !== undefined) {
    updates.push('description = ?');
    params.push(data.description ?? null);
  }

  if (data.team_id !== undefined) {
    updates.push('team_id = ?');
    params.push(data.team_id ?? null);
  }

  if (data.pattern_config !== undefined) {
    updates.push('pattern_config = ?');
    params.push(JSON.stringify(data.pattern_config));
  }

  if (data.cycle_length_weeks !== undefined) {
    updates.push('cycle_length_weeks = ?');
    params.push(data.cycle_length_weeks);
  }

  if (data.starts_at !== undefined) {
    updates.push('starts_at = ?');
    params.push(data.starts_at);
  }

  if (data.ends_at !== undefined) {
    updates.push('ends_at = ?');
    params.push(data.ends_at ?? null);
  }

  if (data.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(data.is_active);
  }

  if (updates.length === 0) {
    throw new ServiceError('BAD_REQUEST', 'No fields to update', 400);
  }

  params.push(patternId, tenantId);

  const query = `
    UPDATE shift_rotation_patterns
    SET ${updates.join(', ')}
    WHERE id = ? AND tenant_id = ?
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
  const query = 'DELETE FROM shift_rotation_patterns WHERE id = ? AND tenant_id = ?';
  await executeQuery(query, [patternId, tenantId]);
}

/**
 * Assign users to a rotation pattern
 */
export async function assignUsersToPattern(
  data: AssignRotationRequest,
  tenantId: number,
  assignedBy: number,
): Promise<ShiftRotationAssignment[]> {
  // Verify pattern exists and belongs to tenant
  await getRotationPattern(data.pattern_id, tenantId);

  for (const userId of data.user_ids) {
    // Safe object access with validation - userId comes from controlled array
    // Convert to string key to satisfy ESLint security rule
    const userKey = String(userId);
    const shiftGroupsMap = data.shift_groups as Record<string, 'F' | 'S' | 'N'>;

    if (!Object.prototype.hasOwnProperty.call(shiftGroupsMap, userKey)) {
      throw new ServiceError('BAD_REQUEST', `Shift group not specified for user ${userId}`, 400);
    }

    // eslint-disable-next-line security/detect-object-injection -- userKey is from controlled array, validated above
    const shiftGroup = shiftGroupsMap[userKey];

    // Check if assignment already exists
    const checkQuery = `
      SELECT id FROM shift_rotation_assignments
      WHERE tenant_id = ? AND pattern_id = ? AND user_id = ?
      AND (ends_at IS NULL OR ends_at > NOW())
    `;

    const [existing] = await executeQuery<RowDataPacket[]>(checkQuery, [
      tenantId,
      data.pattern_id,
      userId,
    ]);

    if (existing.length > 0) {
      // Update existing assignment
      const updateQuery = `
        UPDATE shift_rotation_assignments
        SET shift_group = ?, starts_at = ?, ends_at = ?, updated_at = NOW()
        WHERE id = ?
      `;

      await executeQuery(updateQuery, [
        shiftGroup,
        data.starts_at,
        data.ends_at ?? null,
        existing[0].id,
      ]);
    } else {
      // Create new assignment
      const insertQuery = `
        INSERT INTO shift_rotation_assignments (
          tenant_id, pattern_id, user_id, team_id, shift_group,
          rotation_order, can_override, starts_at, ends_at,
          is_active, assigned_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await executeQuery<ResultSetHeader>(insertQuery, [
        tenantId,
        data.pattern_id,
        userId,
        data.team_id ?? null,
        shiftGroup,
        0, // rotation_order
        true, // can_override
        data.starts_at,
        data.ends_at ?? null,
        true, // is_active
        assignedBy,
      ]);
    }
  }

  // Return all assignments for this pattern
  const query = `
    SELECT a.*, u.username, u.first_name, u.last_name
    FROM shift_rotation_assignments a
    JOIN users u ON a.user_id = u.id
    WHERE a.pattern_id = ? AND a.tenant_id = ?
    AND a.is_active = TRUE
  `;

  const [rows] = await executeQuery<RowDataPacket[]>(query, [data.pattern_id, tenantId]);

  return rows.map((row) => dbToApi(row) as unknown as ShiftRotationAssignment);
}

/**
 * Generate shifts based on rotation pattern
 */
export async function generateRotationShifts(
  data: GenerateRotationRequest,
  tenantId: number,
  _generatedBy: number,
): Promise<{ user_id: number; date: string; shift_type: 'F' | 'S' | 'N' }[]> {
  // Get pattern and verify it belongs to tenant
  const pattern = await getRotationPattern(data.pattern_id, tenantId);

  // Get all active assignments for this pattern
  const assignmentsQuery = `
    SELECT * FROM shift_rotation_assignments
    WHERE pattern_id = ? AND tenant_id = ?
    AND is_active = TRUE
    AND starts_at <= ?
    AND (ends_at IS NULL OR ends_at >= ?)
  `;

  type AssignmentRow = RowDataPacket & {
    user_id: number;
    shift_group: 'F' | 'S' | 'N';
    id: number;
    team_id: number | null;
  };
  const [assignments] = await executeQuery<AssignmentRow[]>(assignmentsQuery, [
    data.pattern_id,
    tenantId,
    data.end_date,
    data.start_date,
  ]);

  const generatedShifts: { user_id: number; date: string; shift_type: 'F' | 'S' | 'N' }[] = [];

  // Generate shifts for each assignment
  for (const assignment of assignments) {
    const shifts = generateShiftsForAssignment(assignment, pattern, data.start_date, data.end_date);
    generatedShifts.push(...shifts);
  }

  // If not preview mode, save ALL shifts in a transaction
  // This ensures if ONE shift has overlap, ALL shifts are rejected
  if (!data.preview && generatedShifts.length > 0) {
    const connection = await getConnection();
    try {
      await connection.beginTransaction();

      // Save all shifts in the transaction
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
            _generatedBy,
          );
        }
      }

      // If we get here, all shifts were saved successfully
      await connection.commit();
      console.info('[ROTATION GENERATE] Transaction committed successfully');
    } catch (error) {
      // Rollback on ANY error (including overlap trigger errors)
      await connection.rollback();
      console.error('[GENERATE ERROR] Transaction rolled back due to error:', error);
      throw error; // Re-throw to propagate error to caller
    } finally {
      connection.release();
    }
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
    console.info(
      `[ROTATION DEBUG] Date: ${date.toISOString().split('T')[0]}, User: ${assignment.user_id}, Shift Group: ${assignment.shift_group}, Weeks Since Start: ${weeksSinceStart}, Cycle Week: ${cycleWeek}`,
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

    shifts.push({
      user_id: assignment.user_id,
      date: date.toISOString().split('T')[0],
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
    WHERE tenant_id = ? AND user_id = ? AND shift_date = ?
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'generated')
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
    WHERE h.tenant_id = ?
  `;

  const params: (string | number)[] = [tenantId];

  if (filters.patternId) {
    query += ' AND h.pattern_id = ?';
    params.push(filters.patternId);
  }

  if (filters.userId) {
    query += ' AND h.user_id = ?';
    params.push(filters.userId);
  }

  if (filters.startDate) {
    query += ' AND h.shift_date >= ?';
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    query += ' AND h.shift_date <= ?';
    params.push(filters.endDate);
  }

  if (filters.status) {
    query += ' AND h.status = ?';
    params.push(filters.status);
  }

  query += ' ORDER BY h.shift_date DESC, h.user_id';

  const [rows] = await executeQuery<RowDataPacket[]>(query, params);

  return rows.map((row) => dbToApi(row) as unknown as ShiftRotationHistory);
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
      WHERE tenant_id = ? AND team_id = ?
    `;
    const [historyResult] = await connection.execute<ResultSetHeader>(historyQuery, [
      tenantId,
      teamId,
    ]);

    // 2. Delete from shift_rotation_assignments - CRITICAL: team_id filter!
    const assignmentsQuery = `
      DELETE FROM shift_rotation_assignments
      WHERE tenant_id = ? AND team_id = ?
    `;
    const [assignmentsResult] = await connection.execute<ResultSetHeader>(assignmentsQuery, [
      tenantId,
      teamId,
    ]);

    // 3. Delete from shift_rotation_patterns - CRITICAL: team_id filter!
    const patternsQuery = `
      DELETE FROM shift_rotation_patterns
      WHERE tenant_id = ? AND team_id = ?
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
 * Helper: Group shifts by week number
 */
function groupShiftsByWeek(
  sortedTemplate: ShiftEntry[],
  firstWeekNumber: number,
): { weekAShifts: ShiftEntry[]; weekBShifts: ShiftEntry[] } {
  const weekAShifts: ShiftEntry[] = [];
  const weekBShifts: ShiftEntry[] = [];

  for (const shift of sortedTemplate) {
    const shiftDate = new Date(shift.date);
    const weekNumber = getISOWeekNumber(shiftDate);

    if (weekNumber === firstWeekNumber) {
      weekAShifts.push(shift);
    } else {
      weekBShifts.push(shift);
    }
  }

  return { weekAShifts, weekBShifts };
}

/**
 * Helper: Find first Monday of the year
 */
function findFirstMondayOfYear(year: number): Date {
  const yearStart = new Date(year, 0, 1);
  const firstMonday = new Date(yearStart);
  const yearStartWeekday = yearStart.getDay() || 7;

  if (yearStartWeekday !== 1) {
    firstMonday.setDate(yearStart.getDate() + (8 - yearStartWeekday));
  }

  return firstMonday;
}

/**
 * Helper: Generate shift for specific date
 */
function generateShiftForDate(
  templateShift: ShiftEntry,
  currentWeekMonday: Date,
  year: number,
): ShiftEntry | null {
  const templateDate = new Date(templateShift.date);
  const templateWeekday = templateDate.getDay() || 7;

  const shiftDate = new Date(currentWeekMonday);
  shiftDate.setDate(currentWeekMonday.getDate() + (templateWeekday - 1));

  // Only add shifts that are actually in the target year
  if (shiftDate.getFullYear() !== year) {
    return null;
  }

  return {
    userId: templateShift.userId,
    date: shiftDate.toISOString().split('T')[0],
    startTime: templateShift.startTime,
    endTime: templateShift.endTime,
    type: templateShift.type,
  };
}

/**
 * Helper: Generate shifts for a week
 */
function generateWeekShifts(
  templateWeek: ShiftEntry[],
  currentWeekMonday: Date,
  year: number,
): ShiftEntry[] {
  const weekShifts: ShiftEntry[] = [];

  for (const templateShift of templateWeek) {
    const shift = generateShiftForDate(templateShift, currentWeekMonday, year);
    if (shift !== null) {
      weekShifts.push(shift);
    }
  }

  return weekShifts;
}

/**
 * Generate Kontischicht pattern for entire year
 * Takes 2-week pattern and repeats it for all 52 weeks
 * @param basePattern - Array of shifts for 2 weeks (template)
 * @param year - Target year to generate shifts for
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @returns Array of shifts for the entire year
 */
export function generateKontischichtYear(
  basePattern: ShiftEntry[],
  year: number,
  tenantId: number,
): ShiftEntry[] {
  // Sort template shifts by date
  const sortedTemplate = [...basePattern].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  if (sortedTemplate.length === 0) {
    return [];
  }

  // Get the week numbers and group shifts
  const firstTemplateDate = new Date(sortedTemplate[0].date);
  const firstWeekNumber = getISOWeekNumber(firstTemplateDate);
  const { weekAShifts, weekBShifts } = groupShiftsByWeek(sortedTemplate, firstWeekNumber);

  console.info('[KONTISCHICHT] Pattern analysis:', {
    weekACount: weekAShifts.length,
    weekBCount: weekBShifts.length,
    year,
    tenantId,
  });

  const yearShifts: ShiftEntry[] = [];
  const firstMonday = findFirstMondayOfYear(year);

  // Generate shifts for all 52 weeks
  for (let weekOffset = 0; weekOffset < 52; weekOffset++) {
    const currentWeekMonday = new Date(firstMonday);
    currentWeekMonday.setDate(firstMonday.getDate() + weekOffset * 7);

    // Determine which pattern to use (alternating)
    const templateWeek = weekOffset % 2 === 0 ? weekAShifts : weekBShifts;

    // Generate shifts for this week
    const weekShifts = generateWeekShifts(templateWeek, currentWeekMonday, year);
    yearShifts.push(...weekShifts);
  }

  console.info(`[KONTISCHICHT] Generated ${yearShifts.length} shifts for year ${year}`);
  return yearShifts;
}

/**
 * Helper function to get ISO week number
 */
function getISOWeekNumber(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

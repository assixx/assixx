/**
 * Areas Service v2
 * Business logic for area/location management
 * NOTE: parent_id/hierarchy removed (2025-11-29) - areas are now flat (non-hierarchical)
 */
import { ServiceError } from '../../../utils/ServiceError.js';
import { ResultSetHeader, RowDataPacket, execute } from '../../../utils/db.js';
import { Area, AreaFilters, CreateAreaRequest, UpdateAreaRequest } from './types.js';

interface AreaRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  name: string;
  description?: string;
  area_lead_id?: number | null;
  type: 'building' | 'warehouse' | 'office' | 'production' | 'outdoor' | 'other';
  capacity?: number;
  address?: string;
  is_active: number; // Status: 0=inactive, 1=active, 3=archived, 4=deleted
  created_by: number;
  created_at: Date;
  updated_at: Date;
  // Virtual fields from joins
  area_lead_name?: string | null;
  employee_count?: number;
  department_count?: number;
  department_names?: string | null;
}

// Stats query result interfaces
interface AreaStatsResult extends RowDataPacket {
  total_areas: number;
  active_areas: number;
  total_capacity: number;
}

interface AreaTypeStatsResult extends RowDataPacket {
  type: string;
  count: number;
}

/**
 * Apply type filter to query
 */
function applyTypeFilter(
  query: string,
  params: (string | number | boolean)[],
  type: string | undefined,
): string {
  if (type !== undefined && type !== '') {
    const paramIndex = params.length + 1;
    params.push(type);
    return query + ` AND a.type = $${paramIndex}`;
  }
  return query;
}

/**
 * Apply search filter to query
 */
function applySearchFilter(
  query: string,
  params: (string | number | boolean)[],
  search: string | undefined,
): string {
  if (search !== undefined && search !== '') {
    const paramIndex = params.length + 1;
    params.push(`%${search}%`, `%${search}%`);
    return query + ` AND (a.name LIKE $${paramIndex} OR a.description LIKE $${paramIndex + 1})`;
  }
  return query;
}

/**
 * Build SQL query and params for area filters
 * NOTE: Returns ALL areas (active, inactive, archived) - filtering done in frontend
 */
function buildAreaQuery(
  tenantId: number,
  filters?: AreaFilters,
): { query: string; params: (string | number | boolean)[] } {
  // PostgreSQL: Use MAX() for non-aggregated columns from LEFT JOIN to satisfy GROUP BY requirements
  const baseQuery = `
    SELECT
      a.*,
      NULLIF(TRIM(CONCAT(COALESCE(MAX(area_lead.first_name), ''), ' ', COALESCE(MAX(area_lead.last_name), ''))), '') as area_lead_name,
      COUNT(DISTINCT e.id) as employee_count,
      COUNT(DISTINCT d.id) as department_count,
      STRING_AGG(DISTINCT d.name, ', ' ORDER BY d.name) as department_names
    FROM areas a
    LEFT JOIN users area_lead ON a.area_lead_id = area_lead.id
    LEFT JOIN users e ON e.tenant_id = a.tenant_id AND e.role = 'employee'
    LEFT JOIN departments d ON d.area_id = a.id AND d.tenant_id = a.tenant_id
    WHERE a.tenant_id = $1
  `;

  const params: (string | number | boolean)[] = [tenantId];

  if (!filters) {
    return { query: baseQuery + ' GROUP BY a.id ORDER BY a.name', params };
  }

  let query = baseQuery;

  // Apply each filter
  query = applyTypeFilter(query, params, filters.type);
  query = applySearchFilter(query, params, filters.search);

  return { query: query + ' GROUP BY a.id ORDER BY a.name', params };
}

/**
 * Get all areas for a tenant
 * @param tenantId - The tenant ID
 * @param filters - The filter criteria
 */
export async function getAreas(tenantId: number, filters?: AreaFilters): Promise<Area[]> {
  const { query, params } = buildAreaQuery(tenantId, filters);

  const [rows] = await execute<AreaRow[]>(query, params);

  return rows.map((row: AreaRow): Area => {
    const area: Area = {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      type: row.type,
      is_active: row.is_active, // Status: 0=inactive, 1=active, 3=archived, 4=deleted
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    // Conditionally add optional properties only when defined
    if (row.description !== undefined) area.description = row.description;
    if (row.area_lead_id !== undefined) area.area_lead_id = row.area_lead_id;
    if (row.area_lead_name !== undefined) area.area_lead_name = row.area_lead_name;
    if (row.capacity !== undefined) area.capacity = row.capacity;
    if (row.address !== undefined) area.address = row.address;
    if (row.employee_count !== undefined) area.employee_count = row.employee_count;
    if (row.department_count !== undefined) area.department_count = row.department_count;
    if (row.department_names !== undefined) area.department_names = row.department_names;

    return area;
  });
}

/**
 * Get area by ID
 * @param id - The resource ID
 * @param tenantId - The tenant ID
 */
export async function getAreaById(id: number, tenantId: number): Promise<Area | null> {
  // PostgreSQL: Use MAX() for non-aggregated columns from LEFT JOIN to satisfy GROUP BY requirements
  const query = `
    SELECT
      a.*,
      NULLIF(TRIM(CONCAT(COALESCE(MAX(area_lead.first_name), ''), ' ', COALESCE(MAX(area_lead.last_name), ''))), '') as area_lead_name,
      COUNT(DISTINCT e.id) as employee_count,
      COUNT(DISTINCT d.id) as department_count,
      STRING_AGG(DISTINCT d.name, ', ' ORDER BY d.name) as department_names
    FROM areas a
    LEFT JOIN users area_lead ON a.area_lead_id = area_lead.id
    LEFT JOIN users e ON e.tenant_id = a.tenant_id AND e.role = 'employee'
    LEFT JOIN departments d ON d.area_id = a.id AND d.tenant_id = a.tenant_id
    WHERE a.id = $1 AND a.tenant_id = $2
    GROUP BY a.id
  `;

  const [rows] = await execute<AreaRow[]>(query, [id, tenantId]);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  if (row === undefined) {
    return null;
  }

  const area: Area = {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    type: row.type,
    is_active: row.is_active, // Status: 0=inactive, 1=active, 3=archived, 4=deleted
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  // Conditionally add optional properties only when defined
  if (row.description !== undefined) area.description = row.description;
  if (row.area_lead_id !== undefined) area.area_lead_id = row.area_lead_id;
  if (row.area_lead_name !== undefined) area.area_lead_name = row.area_lead_name;
  if (row.capacity !== undefined) area.capacity = row.capacity;
  if (row.address !== undefined) area.address = row.address;
  if (row.employee_count !== undefined) area.employee_count = row.employee_count;
  if (row.department_count !== undefined) area.department_count = row.department_count;
  if (row.department_names !== undefined) area.department_names = row.department_names;

  return area;
}

/**
 * Create new area
 * @param data - The data object
 * @param tenantId - The tenant ID
 * @param userId - The user ID
 */
export async function createArea(
  data: CreateAreaRequest,
  tenantId: number,
  userId: number,
): Promise<Area> {
  // POSTGRESQL: RETURNING id required to get insertId
  const query = `
    INSERT INTO areas (
      tenant_id, name, description, area_lead_id, type, capacity,
      address, created_by, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `;

  const [result] = await execute<ResultSetHeader>(query, [
    tenantId,
    data.name,
    data.description ?? null,
    data.areaLeadId ?? null,
    data.type ?? 'other',
    data.capacity ?? null,
    data.address ?? null,
    userId,
    1, // is_active = 1 (active) - Status: 0=inactive, 1=active, 3=archived, 4=deleted
  ]);

  const newArea = await getAreaById(result.insertId, tenantId);
  if (!newArea) {
    throw new ServiceError('CREATE_FAILED', 'Failed to create area', 500);
  }

  return newArea;
}

/**
 * Add a field to the update query if value is defined
 */
function addUpdateField(
  updates: string[],
  values: (string | number | null)[],
  column: string,
  value: string | number | null | undefined,
): void {
  if (value === undefined) {
    return;
  }
  const paramIndex = values.length + 1;
  updates.push(`${column} = $${paramIndex}`);
  values.push(value);
}

/**
 * Build update query from data
 */
function buildUpdateQuery(data: UpdateAreaRequest): {
  updates: string[];
  values: (string | number | null)[];
} {
  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  // Simple field mappings - all use same pattern
  addUpdateField(updates, values, 'name', data.name);
  addUpdateField(updates, values, 'description', data.description);
  addUpdateField(updates, values, 'area_lead_id', data.areaLeadId);
  addUpdateField(updates, values, 'type', data.type);
  addUpdateField(updates, values, 'capacity', data.capacity);
  addUpdateField(updates, values, 'address', data.address);
  // Status: 0=inactive, 1=active, 3=archived, 4=deleted
  addUpdateField(updates, values, 'is_active', data.isActive);

  return { updates, values };
}

/**
 * Update area
 * @param id - The resource ID
 * @param data - The data object
 * @param tenantId - The tenant ID
 */
export async function updateArea(
  id: number,
  data: UpdateAreaRequest,
  tenantId: number,
): Promise<Area> {
  // Check if area exists
  const existing = await getAreaById(id, tenantId);
  if (!existing) {
    throw new ServiceError('NOT_FOUND', 'Area not found', 404);
  }

  // Build update query
  const { updates, values } = buildUpdateQuery(data);

  if (updates.length === 0) {
    return existing;
  }

  // Execute update
  const idIndex = values.length + 1;
  const tenantIndex = values.length + 2;
  values.push(id, tenantId);
  const query = `
    UPDATE areas
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${idIndex} AND tenant_id = $${tenantIndex}
  `;

  await execute(query, values);

  // Return updated area
  const updated = await getAreaById(id, tenantId);
  if (!updated) {
    throw new ServiceError('UPDATE_FAILED', 'Failed to update area', 500);
  }

  return updated;
}

/**
 * Check for area dependencies
 * @param id - The area ID
 * @param tenantId - The tenant ID
 * @returns Object with dependency counts
 */
async function checkAreaDependencies(
  id: number,
  tenantId: number,
): Promise<{
  departments: number;
  machines: number;
  shifts: number;
  shiftPlans: number;
  shiftFavorites: number;
  total: number;
}> {
  const [departments] = await execute<RowDataPacket[]>(
    'SELECT id FROM departments WHERE area_id = $1 AND tenant_id = $2 AND is_active = 1',
    [id, tenantId],
  );

  const [machines] = await execute<RowDataPacket[]>(
    'SELECT id FROM machines WHERE area_id = $1 AND tenant_id = $2',
    [id, tenantId],
  );

  const [shifts] = await execute<RowDataPacket[]>(
    'SELECT id FROM shifts WHERE area_id = $1 AND tenant_id = $2',
    [id, tenantId],
  );

  const [shiftPlans] = await execute<RowDataPacket[]>(
    'SELECT id FROM shift_plans WHERE area_id = $1 AND tenant_id = $2',
    [id, tenantId],
  );

  const [shiftFavorites] = await execute<RowDataPacket[]>(
    'SELECT id FROM shift_favorites WHERE area_id = $1 AND tenant_id = $2',
    [id, tenantId],
  );

  return {
    departments: departments.length,
    machines: machines.length,
    shifts: shifts.length,
    shiftPlans: shiftPlans.length,
    shiftFavorites: shiftFavorites.length,
    total:
      departments.length +
      machines.length +
      shifts.length +
      shiftPlans.length +
      shiftFavorites.length,
  };
}

/**
 * Remove area dependencies (SET NULL or DELETE)
 * @param id - The area ID
 * @param tenantId - The tenant ID
 * @param deps - Dependency counts
 */
async function removeAreaDependencies(
  id: number,
  tenantId: number,
  deps: Awaited<ReturnType<typeof checkAreaDependencies>>,
): Promise<void> {
  if (deps.departments > 0) {
    await execute('UPDATE departments SET area_id = NULL WHERE area_id = $1 AND tenant_id = $2', [
      id,
      tenantId,
    ]);
  }

  if (deps.machines > 0) {
    await execute('UPDATE machines SET area_id = NULL WHERE area_id = $1 AND tenant_id = $2', [
      id,
      tenantId,
    ]);
  }

  if (deps.shifts > 0) {
    await execute('UPDATE shifts SET area_id = NULL WHERE area_id = $1 AND tenant_id = $2', [
      id,
      tenantId,
    ]);
  }

  if (deps.shiftPlans > 0) {
    await execute('UPDATE shift_plans SET area_id = NULL WHERE area_id = $1 AND tenant_id = $2', [
      id,
      tenantId,
    ]);
  }

  if (deps.shiftFavorites > 0) {
    await execute('DELETE FROM shift_favorites WHERE area_id = $1 AND tenant_id = $2', [
      id,
      tenantId,
    ]);
  }
}

/**
 * Build dependency details object for error response
 * @param deps - Dependency counts
 * @returns Details object with all non-zero dependencies
 */
function buildDependencyDetails(
  deps: Awaited<ReturnType<typeof checkAreaDependencies>>,
): Record<string, number> {
  const details: Record<string, number> = { totalDependencies: deps.total };

  // Build details object with explicit property assignment (safe from injection)
  if (deps.departments > 0) details['departments'] = deps.departments;
  if (deps.machines > 0) details['machines'] = deps.machines;
  if (deps.shifts > 0) details['shifts'] = deps.shifts;
  if (deps.shiftPlans > 0) details['shiftPlans'] = deps.shiftPlans;
  if (deps.shiftFavorites > 0) details['shiftFavorites'] = deps.shiftFavorites;

  return details;
}

/**
 * Handle area dependencies before deletion
 * @param id - The area ID
 * @param tenantId - The tenant ID
 * @param force - If true, removes/nullifies all dependencies before deleting
 * @throws ServiceError if dependencies exist and force is false
 */
async function handleAreaDependenciesForDeletion(
  id: number,
  tenantId: number,
  force: boolean,
): Promise<void> {
  const deps = await checkAreaDependencies(id, tenantId);

  if (deps.total === 0) {
    return;
  }

  if (!force) {
    const details = buildDependencyDetails(deps);
    throw new ServiceError('BAD_REQUEST', 'Cannot delete area with dependencies', details);
  }

  await removeAreaDependencies(id, tenantId, deps);
}

/**
 * Delete an area
 * @param id - The area ID
 * @param tenantId - The tenant ID
 * @param force - If true, removes/nullifies all dependencies before deleting
 */
export async function deleteArea(
  id: number,
  tenantId: number,
  force: boolean = false,
): Promise<void> {
  // Check if area exists
  const existing = await getAreaById(id, tenantId);
  if (!existing) {
    throw new ServiceError('NOT_FOUND', 'Area not found', 404);
  }

  // Handle dependencies (throws error if dependencies exist and force is false)
  await handleAreaDependenciesForDeletion(id, tenantId, force);

  // Hard delete - wirklich löschen
  await execute('DELETE FROM areas WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
}

/**
 * Get area statistics
 * @param tenantId - The tenant ID
 */
export async function getAreaStats(tenantId: number): Promise<{
  totalAreas: number;
  byType: Record<string, number>;
  activeAreas: number;
  totalCapacity: number;
}> {
  const [stats] = await execute<AreaStatsResult[]>(
    `
    SELECT
      COUNT(*) as total_areas,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_areas,
      SUM(capacity) as total_capacity
    FROM areas
    WHERE tenant_id = $1
  `,
    [tenantId],
  );

  const [typeStats] = await execute<AreaTypeStatsResult[]>(
    `
    SELECT type, COUNT(*) as count
    FROM areas
    WHERE tenant_id = $1 AND is_active = 1
    GROUP BY type
  `,
    [tenantId],
  );

  const byType: Record<string, number> = {};
  typeStats.forEach((row: AreaTypeStatsResult) => {
    const typeKey = row.type;
    const count = row.count;
    // Safe: typeKey comes from database query results, not user input
    // eslint-disable-next-line security/detect-object-injection
    byType[typeKey] = count;
  });

  const statsRow = stats[0];
  if (statsRow === undefined) {
    return {
      totalAreas: 0,
      activeAreas: 0,
      totalCapacity: 0,
      byType,
    };
  }

  const totalAreas = statsRow.total_areas;
  const activeAreas = statsRow.active_areas;
  const totalCapacity = statsRow.total_capacity;

  return {
    totalAreas,
    activeAreas,
    totalCapacity,
    byType,
  };
}

/**
 * Assign departments to an area (bulk update)
 * Sets area_id for selected departments, clears area_id for departments
 * that were previously assigned to this area but are no longer selected
 * @param areaId - The area ID to assign departments to
 * @param departmentIds - Array of department IDs to assign
 * @param tenantId - The tenant ID for security
 */
export async function assignDepartmentsToArea(
  areaId: number,
  departmentIds: number[],
  tenantId: number,
): Promise<void> {
  // First, verify the area exists and belongs to this tenant
  const area = await getAreaById(areaId, tenantId);
  if (!area) {
    throw new ServiceError('NOT_FOUND', 'Area not found', 404);
  }

  // Step 1: Clear area_id from all departments that were previously assigned to this area
  // but are NOT in the new selection
  await execute(
    `UPDATE departments
     SET area_id = NULL
     WHERE tenant_id = $1
     AND area_id = $2`,
    [tenantId, areaId],
  );

  // Step 2: Set area_id for all selected departments (if any)
  if (departmentIds.length > 0) {
    // Build placeholders for IN clause - start after areaId and tenantId
    const placeholders = departmentIds.map((_: number, i: number) => `$${i + 3}`).join(', ');

    await execute(
      `UPDATE departments
       SET area_id = $1
       WHERE tenant_id = $2
       AND id IN (${placeholders})`,
      [areaId, tenantId, ...departmentIds],
    );
  }
}

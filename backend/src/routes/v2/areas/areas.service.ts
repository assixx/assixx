/**
 * Areas Service v2
 * Business logic for area/location management
 */
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { ServiceError } from '../../../utils/ServiceError.js';
import { execute } from '../../../utils/db.js';
import { Area, AreaFilters, CreateAreaRequest, UpdateAreaRequest } from './types.js';

interface AreaRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  name: string;
  description?: string;
  type: 'building' | 'warehouse' | 'office' | 'production' | 'outdoor' | 'other';
  capacity?: number;
  parent_id?: number;
  address?: string;
  is_active: boolean;
  created_by: number;
  created_at: Date;
  updated_at: Date;
  parent_name?: string;
  employee_count?: number;
}

/**
 * Get all areas for a tenant
 * @param tenantId
 * @param filters
 */
export async function getAreas(tenantId: number, filters?: AreaFilters): Promise<Area[]> {
  let query = `
    SELECT
      a.*,
      p.name as parent_name,
      COUNT(DISTINCT e.id) as employee_count
    FROM areas a
    LEFT JOIN areas p ON a.parent_id = p.id
    LEFT JOIN users e ON e.tenant_id = a.tenant_id AND e.role = 'employee'
    WHERE a.tenant_id = ?
  `;

  const params: (string | number | boolean)[] = [tenantId];

  if (filters?.type !== undefined && filters.type !== '') {
    query += ' AND a.type = ?';
    params.push(filters.type);
  }

  if (filters?.isActive !== undefined) {
    query += ' AND a.is_active = ?';
    params.push(filters.isActive ? 1 : 0);
  }

  if (filters?.parentId !== undefined) {
    if (filters.parentId === null) {
      query += ' AND a.parent_id IS NULL';
    } else {
      query += ' AND a.parent_id = ?';
      params.push(filters.parentId);
    }
  }

  if (filters?.search !== undefined && filters.search !== '') {
    query += ' AND (a.name LIKE ? OR a.description LIKE ?)';
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  query += ' GROUP BY a.id ORDER BY a.name';

  const [rows] = await execute<AreaRow[]>(query, params);

  return rows.map(
    (row: AreaRow): Area => ({
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description,
      type: row.type,
      capacity: row.capacity,
      parent_id: row.parent_id,
      address: row.address,
      is_active: row.is_active,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      employee_count: row.employee_count,
    }),
  );
}

/**
 * Get area by ID
 * @param id
 * @param tenantId
 */
export async function getAreaById(id: number, tenantId: number): Promise<Area | null> {
  const query = `
    SELECT
      a.*,
      p.name as parent_name,
      COUNT(DISTINCT e.id) as employee_count
    FROM areas a
    LEFT JOIN areas p ON a.parent_id = p.id
    LEFT JOIN users e ON e.tenant_id = a.tenant_id AND e.role = 'employee'
    WHERE a.id = ? AND a.tenant_id = ?
    GROUP BY a.id
  `;

  const [rows] = await execute<AreaRow[]>(query, [id, tenantId]);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    description: row.description,
    type: row.type,
    capacity: row.capacity,
    parent_id: row.parent_id,
    address: row.address,
    is_active: row.is_active,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    employee_count: row.employee_count,
  };
}

/**
 * Get area hierarchy (tree structure)
 * @param tenantId
 */
export async function getAreaHierarchy(tenantId: number): Promise<Area[]> {
  const query = `
    SELECT * FROM areas
    WHERE tenant_id = ? AND is_active = 1
    ORDER BY parent_id IS NULL DESC, name
  `;

  const [rows] = await execute<AreaRow[]>(query, [tenantId]);

  // Build tree structure
  const areasMap = new Map<number, Area & { children: Area[] }>();
  const rootAreas: Area[] = [];

  // First pass: create all areas
  rows.forEach((row: AreaRow) => {
    const area: Area & { children: Area[] } = {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description,
      type: row.type,
      capacity: row.capacity,
      parent_id: row.parent_id,
      address: row.address,
      is_active: row.is_active,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      children: [],
    };
    areasMap.set(area.id, area);
  });

  // Second pass: build hierarchy
  rows.forEach((row: AreaRow) => {
    const area = areasMap.get(row.id);
    if (!area) return; // Skip if area not found

    if (row.parent_id !== undefined && row.parent_id !== 0) {
      const parent = areasMap.get(row.parent_id);
      if (parent) {
        parent.children.push(area);
      }
    } else {
      rootAreas.push(area);
    }
  });

  return rootAreas;
}

/**
 * Create new area
 * @param data
 * @param tenantId
 * @param userId
 */
export async function createArea(
  data: CreateAreaRequest,
  tenantId: number,
  userId: number,
): Promise<Area> {
  // Validate parent area if provided
  if (data.parentId !== undefined && data.parentId !== 0) {
    const parentExists = await getAreaById(data.parentId, tenantId);
    if (!parentExists) {
      throw new ServiceError('PARENT_NOT_FOUND', 'Parent area not found', 404);
    }
  }

  const query = `
    INSERT INTO areas (
      tenant_id, name, description, type, capacity,
      parent_id, address, created_by, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const [result] = await execute<ResultSetHeader>(query, [
    tenantId,
    data.name,
    data.description ?? null,
    data.type ?? 'other',
    data.capacity ?? null,
    data.parentId ?? null,
    data.address ?? null,
    userId,
    1,
  ]);

  const newArea = await getAreaById(result.insertId, tenantId);
  if (!newArea) {
    throw new ServiceError('CREATE_FAILED', 'Failed to create area', 500);
  }

  return newArea;
}

/**
 * Update area
 * @param id
 * @param data
 * @param tenantId
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

  // Validate parent area if provided
  if (data.parentId !== undefined && data.parentId !== null) {
    if (data.parentId === id) {
      throw new ServiceError('INVALID_PARENT', 'Area cannot be its own parent', 400);
    }
    const parentExists = await getAreaById(data.parentId, tenantId);
    if (!parentExists) {
      throw new ServiceError('PARENT_NOT_FOUND', 'Parent area not found', 404);
    }
  }

  const updates: string[] = [];
  const values: (string | number | boolean | null)[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    values.push(data.description);
  }
  if (data.type !== undefined) {
    updates.push('type = ?');
    values.push(data.type);
  }
  if (data.capacity !== undefined) {
    updates.push('capacity = ?');
    values.push(data.capacity);
  }
  if (data.parentId !== undefined) {
    updates.push('parent_id = ?');
    values.push(data.parentId);
  }
  if (data.address !== undefined) {
    updates.push('address = ?');
    values.push(data.address);
  }
  if (data.isActive !== undefined) {
    updates.push('is_active = ?');
    values.push(data.isActive ? 1 : 0);
  }

  if (updates.length === 0) {
    return existing;
  }

  values.push(id, tenantId);
  const query = `
    UPDATE areas
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ?
  `;

  await execute(query, values);

  const updated = await getAreaById(id, tenantId);
  if (!updated) {
    throw new ServiceError('UPDATE_FAILED', 'Failed to update area', 500);
  }

  return updated;
}

/**
 * Delete area (hard delete)
 * @param id
 * @param tenantId
 */
export async function deleteArea(id: number, tenantId: number): Promise<void> {
  // Check if area exists
  const existing = await getAreaById(id, tenantId);
  if (!existing) {
    throw new ServiceError('NOT_FOUND', 'Area not found', 404);
  }

  // Check if area has children
  const [children] = await execute<RowDataPacket[]>(
    'SELECT id FROM areas WHERE parent_id = ? AND tenant_id = ?',
    [id, tenantId],
  );

  if (children.length > 0) {
    throw new ServiceError('HAS_CHILDREN', 'Cannot delete area with child areas', 400);
  }

  // Hard delete - wirklich löschen
  await execute('DELETE FROM areas WHERE id = ? AND tenant_id = ?', [id, tenantId]);
}

/**
 * Get area statistics
 * @param tenantId
 */
export async function getAreaStats(tenantId: number): Promise<{
  totalAreas: number;
  byType: Record<string, number>;
  activeAreas: number;
  totalCapacity: number;
}> {
  const [stats] = await execute<RowDataPacket[]>(
    `
    SELECT
      COUNT(*) as total_areas,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_areas,
      SUM(capacity) as total_capacity
    FROM areas
    WHERE tenant_id = ?
  `,
    [tenantId],
  );

  const [typeStats] = await execute<RowDataPacket[]>(
    `
    SELECT type, COUNT(*) as count
    FROM areas
    WHERE tenant_id = ? AND is_active = 1
    GROUP BY type
  `,
    [tenantId],
  );

  const byType: Record<string, number> = {};
  typeStats.forEach((row: RowDataPacket) => {
    const typeKey = row.type as string;
    const count = row.count as number;
    byType[typeKey] = count;
  });

  const totalAreas = (stats[0].total_areas as number) || 0;
  const activeAreas = (stats[0].active_areas as number) || 0;
  const totalCapacity = (stats[0].total_capacity as number) || 0;

  return {
    totalAreas,
    activeAreas,
    totalCapacity,
    byType,
  };
}

/**
 * Position Catalog — Type Definitions
 * @module organigram/position-catalog.types
 *
 * DB row types (snake_case) and API response types (camelCase).
 * ENUM matches PostgreSQL type: position_role_category.
 */

// =============================================================================
// ENUMS
// =============================================================================

export type PositionRoleCategory = 'employee' | 'admin' | 'root';

// =============================================================================
// CONSTANTS
// =============================================================================

export const ROLE_CATEGORY_LABELS: Readonly<
  Record<PositionRoleCategory, string>
> = {
  employee: 'Mitarbeiter',
  admin: 'Admin',
  root: 'Root',
};

/** System positions seeded per tenant — locked from editing/deletion */
export const SYSTEM_POSITIONS: readonly {
  name: string;
  roleCategory: PositionRoleCategory;
}[] = [
  { name: 'team_lead', roleCategory: 'employee' },
  { name: 'area_lead', roleCategory: 'admin' },
  { name: 'department_lead', roleCategory: 'admin' },
];

/** Default custom positions seeded per tenant on first access (editable, deletable) */
export const DEFAULT_POSITIONS: readonly {
  name: string;
  roleCategory: PositionRoleCategory;
}[] = [
  { name: 'Produktionsmitarbeiter', roleCategory: 'employee' },
  { name: 'Anlagenbediener', roleCategory: 'employee' },
  { name: 'Lagerarbeiter', roleCategory: 'employee' },
  { name: 'Qualitätsprüfer', roleCategory: 'employee' },
  { name: 'Schichtleiter', roleCategory: 'employee' },
  { name: 'Wartungstechniker', roleCategory: 'employee' },
  { name: 'Personalleiter', roleCategory: 'admin' },
  { name: 'Werksleiter', roleCategory: 'admin' },
  { name: 'Produktionsleiter', roleCategory: 'admin' },
  { name: 'Qualitätsleiter', roleCategory: 'admin' },
  { name: 'IT-Leiter', roleCategory: 'admin' },
  { name: 'Vertriebsleiter', roleCategory: 'admin' },
  { name: 'CEO', roleCategory: 'root' },
  { name: 'CTO', roleCategory: 'root' },
  { name: 'CFO', roleCategory: 'root' },
  { name: 'Geschäftsführer', roleCategory: 'root' },
  { name: 'IT-Administrator', roleCategory: 'root' },
  { name: 'Systemadministrator', roleCategory: 'root' },
];

// =============================================================================
// DB ROW TYPES (snake_case — 1:1 with PostgreSQL tables)
// =============================================================================

export interface PositionCatalogRow {
  id: string;
  tenant_id: number;
  name: string;
  role_category: PositionRoleCategory;
  sort_order: number;
  is_system: boolean;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface UserPositionRow {
  id: string;
  tenant_id: number;
  user_id: number;
  position_id: string;
  created_at: string;
}

/** Extended row with JOINed position details */
export interface UserPositionDetailRow extends UserPositionRow {
  position_name: string;
  role_category: PositionRoleCategory;
}

// =============================================================================
// API RESPONSE TYPES (camelCase)
// =============================================================================

export interface PositionCatalogEntry {
  id: string;
  name: string;
  roleCategory: PositionRoleCategory;
  sortOrder: number;
  isSystem: boolean;
}

export interface UserPositionEntry {
  id: string;
  userId: number;
  positionId: string;
  positionName: string;
  roleCategory: PositionRoleCategory;
}

// =============================================================================
// MAPPERS
// =============================================================================

export function mapPositionRowToApi(
  row: PositionCatalogRow,
): PositionCatalogEntry {
  return {
    id: row.id,
    name: row.name,
    roleCategory: row.role_category,
    sortOrder: row.sort_order,
    isSystem: row.is_system,
  };
}

export function mapUserPositionRowToApi(
  row: UserPositionDetailRow,
): UserPositionEntry {
  return {
    id: row.id,
    userId: row.user_id,
    positionId: row.position_id,
    positionName: row.position_name,
    roleCategory: row.role_category,
  };
}

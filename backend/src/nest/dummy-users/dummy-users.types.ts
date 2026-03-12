/**
 * Dummy Users — Type Definitions
 *
 * DB Row types (snake_case, 1:1 with users table),
 * API types (camelCase), and constants.
 */

// ============================================================================
// Constants
// ============================================================================

/** Display domain for auto-generated dummy emails */
export const DUMMY_EMAIL_DOMAIN = 'display';

/** Prefix for auto-generated employee numbers */
export const DUMMY_EMPLOYEE_PREFIX = 'DUMMY';

/** Permissions auto-assigned to every new dummy user (read-only) */
export const DUMMY_PERMISSIONS = [
  { addonCode: 'blackboard', moduleCode: 'blackboard-posts' },
  { addonCode: 'blackboard', moduleCode: 'blackboard-comments' },
  { addonCode: 'calendar', moduleCode: 'calendar-events' },
  { addonCode: 'tpm', moduleCode: 'tpm-plans' },
  { addonCode: 'tpm', moduleCode: 'tpm-cards' },
  { addonCode: 'tpm', moduleCode: 'tpm-executions' },
] as const;

// ============================================================================
// DB Row Types (snake_case — 1:1 with users table, dummy-relevant fields)
// ============================================================================

export interface DummyUserRow {
  id: number;
  uuid: string;
  tenant_id: number;
  email: string;
  display_name: string;
  employee_number: string;
  role: 'dummy';
  is_active: number;
  has_full_access: false;
  created_at: string;
  updated_at: string;
}

/** Extended row with team/dept/area JOINs */
export interface DummyUserWithTeamsRow extends DummyUserRow {
  team_ids: string | null;
  team_names: string | null;
  department_ids: string | null;
  department_names: string | null;
  area_ids: string | null;
  area_names: string | null;
}

// ============================================================================
// API Types (camelCase — response shapes)
// ============================================================================

export interface DummyUser {
  uuid: string;
  email: string;
  displayName: string;
  employeeNumber: string;
  isActive: number;
  createdAt: string;
  updatedAt: string;
  teamIds: number[];
  teamNames: string[];
  departmentIds: number[];
  departmentNames: string[];
  areaIds: number[];
  areaNames: string[];
}

export interface PaginatedDummyUsers {
  items: DummyUser[];
  total: number;
  page: number;
  pageSize: number;
}

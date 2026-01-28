// =============================================================================
// MANAGE AREAS - TYPE DEFINITIONS
// =============================================================================

/**
 * Status values for is_active field
 * 0 = inactive, 1 = active, 3 = archived, 4 = deleted
 */
export type IsActiveStatus = 0 | 1 | 3 | 4;

/**
 * Form-only status values (excludes deleted)
 */
export type FormIsActiveStatus = 0 | 1 | 3;

/**
 * Status filter options for list view
 */
export type StatusFilter = 'all' | 'active' | 'inactive' | 'archived';

/**
 * Area type values
 */
export type AreaType =
  | 'building'
  | 'warehouse'
  | 'office'
  | 'production'
  | 'outdoor'
  | 'other';

/**
 * Area entity from API (camelCase to match NestJS response)
 */
export interface Area {
  id: number;
  name: string;
  description?: string | null;
  areaLeadId?: number | null;
  areaLeadName?: string | null;
  type: AreaType;
  capacity?: number | null;
  address?: string | null;
  isActive: IsActiveStatus;
  employeeCount?: number | string;
  departmentCount?: number | string;
  departmentNames?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Admin/Root user for area lead selection
 */
export interface AdminUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'root';
}

/**
 * Department for area assignment
 */
export interface Department {
  id: number;
  name: string;
  areaId?: number | null;
}

/**
 * Payload for creating/updating an area
 */
export interface AreaPayload {
  name: string;
  description?: string | null;
  areaLeadId?: number | null;
  type: AreaType;
  capacity?: number | null;
  address?: string | null;
  isActive: FormIsActiveStatus;
  departmentIds: number[];
}

/**
 * Type option for dropdown
 */
export interface TypeOption {
  value: AreaType;
  label: string;
}

/**
 * API response for areas list
 */
export interface AreasApiResponse {
  data?: Area[];
  success?: boolean;
}

/**
 * API response for departments list
 */
export interface DepartmentsApiResponse {
  data?: Department[];
  success?: boolean;
}

/**
 * Delete area result with potential dependency info
 */
export interface DeleteAreaResult {
  success: boolean;
  error: string | null;
  hasDependencies?: boolean;
  dependencyMessage?: string;
}

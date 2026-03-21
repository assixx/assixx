// =============================================================================
// MANAGE AREAS - TYPE DEFINITIONS
// =============================================================================

import type { IsActiveStatus, FormIsActiveStatus, StatusFilter } from '@assixx/shared';

export type { IsActiveStatus, FormIsActiveStatus, StatusFilter };

/**
 * Area type values
 */
export type AreaType = 'building' | 'warehouse' | 'office' | 'production' | 'outdoor' | 'other';

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
 * Hall for area assignment
 */
export interface Hall {
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
  hallIds: number[];
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
 * API response for halls list
 */
export interface HallsApiResponse {
  data?: Hall[];
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

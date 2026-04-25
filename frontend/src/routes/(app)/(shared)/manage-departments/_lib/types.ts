// =============================================================================
// MANAGE DEPARTMENTS - TYPE DEFINITIONS
// =============================================================================

import type { IsActiveStatus, FormIsActiveStatus, StatusFilter } from '@assixx/shared';

export type { IsActiveStatus, FormIsActiveStatus, StatusFilter };

/**
 * Hall entry in a department's effective hall list.
 * 'area'   = implicitly inherited via halls.area_id === dept.area_id
 * 'direct' = explicit cross-area assignment via department_halls junction
 */
export interface DepartmentHallEntry {
  id: number;
  name: string;
  areaId: number | null;
  source: 'area' | 'direct';
}

/**
 * Department entity from API
 */
export interface Department {
  id: number;
  name: string;
  description?: string | null;
  departmentLeadId?: number | null;
  departmentLeadName?: string | null;
  departmentDeputyLeadId?: number | null;
  departmentDeputyLeadName?: string | null;
  areaId?: number | null;
  areaName?: string | null;
  parentId?: number | null;
  parentName?: string | null;
  isActive: IsActiveStatus;
  employeeCount?: number;
  employeeNames?: string;
  teamCount?: number;
  teamNames?: string;
  halls?: DepartmentHallEntry[];
  hallCount?: number;
  assetCount?: number;
  budget?: number;
  costCenter?: string;
  foundedDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  tenantId?: number;
  createdBy?: number;
}

/**
 * Area for dropdown selection
 */
export interface Area {
  id: number;
  name: string;
  type?: string;
  description?: string;
}

/**
 * Admin/Root user for department lead selection
 */
export interface AdminUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'root';
}

/**
 * Hall for multi-select assignment
 */
export interface Hall {
  id: number;
  name: string;
  areaId?: number | null;
}

/**
 * Payload for creating/updating a department
 */
export interface DepartmentPayload {
  name: string;
  description?: string | null;
  areaId?: number | null;
  departmentLeadId?: number | null;
  departmentDeputyLeadId?: number | null;
  isActive: FormIsActiveStatus;
}

/**
 * API response for departments list
 */
export interface DepartmentsApiResponse {
  data?: Department[];
  success?: boolean;
}

/**
 * API response for areas list
 */
export interface AreasApiResponse {
  data?: Area[];
  success?: boolean;
}

/**
 * Delete department result with potential dependency info
 */
export interface DeleteDepartmentResult {
  success: boolean;
  error: string | null;
  hasDependencies?: boolean;
  dependencyDetails?: DependencyDetails;
}

/**
 * Dependency details for force delete
 */
export interface DependencyDetails {
  totalDependencies?: number;
  users?: number;
  teams?: number;
  assets?: number;
  shifts?: number;
  shiftPlans?: number;
  kvpSuggestions?: number;
  documents?: number;
  calendarEvents?: number;
  surveyAssignments?: number;
  adminPermissions?: number;
}

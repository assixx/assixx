// =============================================================================
// MANAGE ADMINS - TYPE DEFINITIONS
// =============================================================================

/**
 * Area entity - Organizational unit containing departments
 */
export interface Area {
  id: number;
  name: string;
  description?: string;
  departmentCount?: number;
}

/**
 * Department entity - Part of an area, contains teams
 */
export interface Department {
  id: number;
  name: string;
  description?: string;
  areaId?: number;
  areaName?: string;
}

/**
 * isActive status values:
 * - 0 = inactive
 * - 1 = active
 * - 3 = archived
 * - 4 = deleted (soft delete)
 */
export type IsActiveStatus = 0 | 1 | 3 | 4;

/**
 * Form status values (excludes deleted)
 */
export type FormIsActiveStatus = 0 | 1 | 3;

/**
 * Admin entity with organization permissions
 */
export interface Admin {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  position?: string;
  notes?: string;
  employeeNumber?: string;
  isActive: IsActiveStatus;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  areas?: Area[];
  departments?: Department[];
  areaIds?: number[];
  departmentIds?: number[];
  hasFullAccess?: boolean | number;
}

/**
 * Badge display information
 */
export interface BadgeInfo {
  class: string;
  text: string;
  title: string;
  icon?: string;
}

/**
 * Status filter options
 */
export type StatusFilter = 'active' | 'inactive' | 'archived' | 'all';

/**
 * Admin form data for create/update
 */
export interface AdminFormData {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  position: string;
  notes: string;
  isActive: FormIsActiveStatus;
  employeeNumber: string;
  role: 'admin';
  hasFullAccess: boolean;
  areaIds: number[];
  departmentIds: number[];
  password?: string;
}

/**
 * Admin permissions response from API
 */
export interface AdminPermissions {
  areas?: Area[];
  departments?: Department[];
  hasFullAccess?: boolean;
}

/**
 * API response for admin creation/update
 */
export interface AdminApiResponse {
  adminId?: number;
  id?: number;
  data?: {
    id?: number;
  };
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data?: T;
}

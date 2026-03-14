// =============================================================================
// MANAGE ADMINS - TYPE DEFINITIONS
// =============================================================================

import type {
  IsActiveStatus,
  FormIsActiveStatus,
  StatusFilter,
  AvailabilityStatus,
} from '@assixx/shared';

export type {
  IsActiveStatus,
  FormIsActiveStatus,
  StatusFilter,
  AvailabilityStatus,
};

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
 * Admin entity with organization permissions
 */
export interface Admin {
  id: number;
  uuid: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  position?: string;
  notes?: string;
  employeeNumber?: string;
  profilePicture?: string | null;
  isActive: IsActiveStatus;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  areas?: Area[];
  departments?: Department[];
  /** Areas where admin is area_lead (implicit permission, not in admin_area_permissions) */
  leadAreas?: Area[];
  /** Departments where admin is department_lead (implicit permission) */
  leadDepartments?: Department[];
  areaIds?: number[];
  departmentIds?: number[];
  hasFullAccess?: boolean | number;

  // Availability
  availabilityStatus?: AvailabilityStatus;
  availabilityStart?: string;
  availabilityEnd?: string;
  availabilityNotes?: string;
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
  leadAreas?: Area[];
  leadDepartments?: Department[];
  hasFullAccess?: boolean;
}

/**
 * API response for admin creation/update
 */
export interface AdminApiResponse {
  adminId?: number;
  id?: number;
  uuid?: string;
  data?: {
    id?: number;
    uuid?: string;
  };
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data?: T;
}

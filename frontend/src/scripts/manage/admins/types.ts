/**
 * Admin Management - Type Definitions
 * All interfaces and types for admin management module
 */

import type { User } from '../../../types/api.types';

/**
 * Admin user with permissions and departments
 * N:M REFACTORING: Added areaIds, departmentIds arrays for multi-select support
 * NOTE: teamIds removed - Admins get teams via Area/Department inheritance
 */
export interface Admin extends User {
  tenantName?: string;
  notes?: string;
  lastLogin?: string;
  areas?: Area[];
  departments?: Department[];
  // NOTE: teams removed - Admins get teams via inheritance, not direct assignment
  // N:M REFACTORING: Array fields for multiple assignments (used in form)
  areaIds?: number[];
  departmentIds?: number[];
  // NOTE: teamIds removed - Admins get teams via inheritance
  hasFullAccess?: boolean | number; // has_full_access flag from DB - single source of truth for "Vollzugriff"
}

/**
 * Area with access permissions (Assignment System 2025-11-27)
 * Area → Department inheritance: User with Area access gets all Departments with that area_id
 */
export interface Area {
  id: number;
  name: string;
  description?: string;
  departmentCount?: number;
  canRead?: boolean;
  canWrite?: boolean;
  canDelete?: boolean;
}

/**
 * Department with access permissions
 */
export interface Department {
  id: number;
  name: string;
  description?: string;
  areaId?: number;
  areaName?: string;
  canRead?: boolean;
  canWrite?: boolean;
  canDelete?: boolean;
}

/**
 * Team within a department
 * N:M REFACTORING: Teams are sub-groups of departments
 */
export interface Team {
  id: number;
  name: string;
  description?: string;
  departmentId?: number;
  departmentName?: string;
}

/**
 * Tenant (company) information
 */
export interface Tenant {
  id: number;
  name?: string;
  company_name?: string;
  subdomain: string;
}

/**
 * Form data for admin creation/update
 * N:M REFACTORING: Added areaIds, departmentIds, hasFullAccess
 * NOTE: teamIds removed - Admins get teams via inheritance
 */
export interface AdminFormData {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password?: string;
  position: string;
  notes: string;
  role: string;
  isActive?: boolean;
  isArchived?: boolean;
  employeeNumber?: string;
  // N:M REFACTORING: Organization assignment fields
  areaIds?: number[];
  departmentIds?: number[];
  // NOTE: teamIds removed - Admins get teams via inheritance
  hasFullAccess?: boolean;
}

/**
 * Admin status filter types
 */
export type AdminStatusFilter = 'active' | 'inactive' | 'archived' | 'all';

/**
 * Window interface for global admin management functions
 */
export interface ManageAdminsWindow extends Window {
  editAdmin: ((adminId: number) => Promise<void>) | null;
  deleteAdmin: ((adminId: number) => Promise<void>) | null;
  showAddAdminModal: (() => void) | null;
  closeAdminModal: (() => void) | null;
  reloadAdminsTable: (() => Promise<void>) | null;
}

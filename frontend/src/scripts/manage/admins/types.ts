/**
 * Admin Management - Type Definitions
 * All interfaces and types for admin management module
 */

import type { MappedUser } from '../../../utils/api-mappers';

/**
 * Admin user with permissions and departments
 */
export interface Admin extends MappedUser {
  tenantName?: string;
  notes?: string;
  lastLogin?: string;
  departments?: Department[];
  hasAllAccess?: boolean;
}

/**
 * Department with access permissions
 */
export interface Department {
  id: number;
  name: string;
  description?: string;
  can_read?: boolean;
  can_write?: boolean;
  can_delete?: boolean;
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
  showPermissionsModal: ((adminId: number) => Promise<void>) | null;
  showAddAdminModal: (() => void) | null;
  closeAdminModal: (() => void) | null;
  closePermissionsModal: (() => void) | null;
  savePermissionsHandler: (() => Promise<void>) | null;
  reloadAdminsTable: (() => Promise<void>) | null;
}

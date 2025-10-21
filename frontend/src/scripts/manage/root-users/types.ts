/**
 * Root User Management - Type Definitions
 * All interfaces and types for root user management module
 */

/**
 * Root user with all properties
 */
export interface RootUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  position?: string;
  notes?: string;
  employeeId?: string;
  employeeNumber?: string;
  departmentId?: number;
  isActive: boolean | number;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

/**
 * Form data for root user creation/update
 */
export interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  emailConfirm: string;
  password: string;
  passwordConfirm: string;
  position: string;
  notes: string;
  employeeNumber: string;
  departmentId: string;
  isActive: boolean;
}

/**
 * Root user status filter types
 */
export type RootStatusFilter = 'active' | 'inactive' | 'all';

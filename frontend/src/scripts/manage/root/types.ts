/**
 * Root User Management - Type Definitions
 * All interfaces and types for root user management module
 * UPDATED: Using unified isActive status (2025-12-02)
 * Status: 0=inactive, 1=active, 3=archived, 4=deleted
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
  // N:M REFACTORING: Root users have has_full_access=1, no departmentId needed
  isActive: 0 | 1 | 3 | 4; // Status: 0=inactive, 1=active, 3=archived, 4=deleted
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

/**
 * Form data for root user creation/update
 * UPDATED: Using unified isActive status (2025-12-02)
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
  // N:M REFACTORING: Root users have has_full_access=1, no departmentId needed
  isActive: 0 | 1 | 3 | 4; // Status: 0=inactive, 1=active, 3=archived, 4=deleted
}

/**
 * Root user status filter types
 */
export type RootStatusFilter = 'active' | 'inactive' | 'archived' | 'all';

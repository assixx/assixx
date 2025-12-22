// =============================================================================
// MANAGE EMPLOYEES - TYPE DEFINITIONS
// =============================================================================

/**
 * Team interface - used for team assignment
 */
export interface Team {
  id: number;
  name: string;
  departmentId?: number;
  departmentName?: string;
}

/**
 * Employee interface - main data model
 */
export interface Employee {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  position?: string;
  phone?: string;
  employeeNumber?: string;
  dateOfBirth?: string;
  isActive: IsActiveStatus;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  teams?: Team[];
  teamIds?: number[];
  availabilityStatus?: AvailabilityStatus;
  availabilityStart?: string;
  availabilityEnd?: string;
  availabilityNotes?: string;
  role?: string;
}

/**
 * Status filter type for employee list filtering
 */
export type StatusFilter = 'active' | 'inactive' | 'archived' | 'all';

/**
 * isActive status values
 * 0 = inactive, 1 = active, 3 = archived, 4 = deleted (soft delete)
 */
export type IsActiveStatus = 0 | 1 | 3 | 4;

/**
 * Form-compatible isActive status (excludes deleted)
 */
export type FormIsActiveStatus = 0 | 1 | 3;

/**
 * Availability status options
 */
export type AvailabilityStatus =
  | 'available'
  | 'vacation'
  | 'sick'
  | 'unavailable'
  | 'training'
  | 'other';

/**
 * Badge info for display
 */
export interface BadgeInfo {
  class: string;
  text: string;
  title?: string;
}

/**
 * Employee form data structure
 */
export interface EmployeeFormData {
  firstName: string;
  lastName: string;
  email: string;
  emailConfirm: string;
  password: string;
  passwordConfirm: string;
  employeeNumber: string;
  position: string;
  phone: string;
  dateOfBirth: string;
  isActive: FormIsActiveStatus;
  teamIds: number[];
  availabilityStatus: AvailabilityStatus;
  availabilityStart: string;
  availabilityEnd: string;
  availabilityNotes: string;
}

/**
 * API request payload for creating/updating employee
 */
export interface EmployeePayload {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  position?: string;
  phone?: string;
  dateOfBirth?: string;
  employeeNumber: string;
  isActive: FormIsActiveStatus;
  role: 'employee';
  password?: string;
  availabilityStatus: AvailabilityStatus;
  availabilityStart?: string;
  availabilityEnd?: string;
  availabilityNotes?: string;
}

/**
 * Password strength result
 */
export interface PasswordStrengthResult {
  score: number;
  label: string;
  time: string;
}

/**
 * Availability option for dropdown
 */
export interface AvailabilityOption {
  value: AvailabilityStatus;
  label: string;
}

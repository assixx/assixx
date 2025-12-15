/**
 * User Type Definitions
 * Single source of truth for all user-related TypeScript types
 */
import { RowDataPacket } from '../../../../utils/db.js';

/**
 * Database representation of a user (snake_case to match DB schema)
 * N:M REFACTORING: department_id replaced with primary_department_id from user_departments table
 */
export interface DbUser extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  password: string;
  role: string;
  has_full_access: boolean; // Full tenant access without individual assignments
  // REMOVED: company and iban columns dropped (2025-11-27)
  notes?: string;
  first_name: string;
  last_name: string;
  age?: number;
  employee_id?: string;
  // N:M REFACTORING: Removed department_id - now comes from user_departments JOIN
  primary_department_id?: number | null; // From user_departments WHERE is_primary = true
  department_name?: string; // Primary department name from JOIN
  position?: string;
  phone?: string;
  landline?: string;
  employee_number?: string;
  address?: string;
  date_of_birth?: Date;
  hire_date?: Date;
  emergency_contact?: string;
  profile_picture?: string;
  is_active: number; // Status: 0=inactive, 1=active, 3=archived, 4=deleted
  tenant_id?: number;
  last_login?: Date;
  created_at?: Date;
  updated_at?: Date;
  reset_token?: string | null;
  reset_token_expires?: Date | null;
  // Additional fields from joins
  company_name?: string;
  subdomain?: string;
  availability_status?: 'available' | 'unavailable' | 'vacation' | 'sick';
  availability_start?: string | Date | null;
  availability_end?: string | Date | null;
  availability_notes?: string | null;
  team_id?: number | null;
  team_name?: string | null;
  // INHERITANCE-FIX: Full inheritance chain from Team → Department → Area
  team_department_id?: number | null;
  team_department_name?: string | null;
  team_area_id?: number | null;
  team_area_name?: string | null;
}

/**
 * Data required to create a new user
 * N:M REFACTORING: department_id removed - use UserDepartmentAssignment instead
 */
export interface UserCreateData {
  username: string;
  email: string;
  password: string;
  role: string;
  has_full_access?: boolean; // Full tenant access without individual assignments
  // REMOVED: company and iban columns dropped (2025-11-27)
  notes?: string;
  first_name: string;
  last_name: string;
  age?: number;
  employee_id?: string;
  // N:M REFACTORING: department_id removed - departments assigned via user_departments table
  position?: string;
  phone?: string;
  landline?: string;
  employee_number?: string;
  address?: string;
  date_of_birth?: Date;
  hire_date?: Date;
  emergency_contact?: string;
  profile_picture?: string;
  is_active?: number; // Status: 0=inactive, 1=active, 3=archived, 4=deleted
  tenant_id?: number;
  last_login?: Date; // Track last successful login timestamp
  availability_status?: string;
  availability_start?: string;
  availability_end?: string;
  availability_notes?: string;
}

/**
 * Department assignment data for N:M user_departments table
 */
export interface UserDepartmentAssignment {
  department_id: number;
  is_primary: boolean;
}

/**
 * Filter options for user search queries
 * N:M REFACTORING: department_id now filters via user_departments table
 */
export interface UserFilter {
  tenant_id: number; // PFLICHT für multi-tenant isolation!
  role?: string;
  is_active?: number; // Status: 0=inactive, 1=active, 3=archived, 4=deleted
  department_id?: number; // Filters users who belong to this department (via user_departments)
  status?: string;
  search?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  limit?: number;
  page?: number;
}

/**
 * Count result from database queries
 */
export interface CountResult extends RowDataPacket {
  count: number;
  total: number;
}

/**
 * Document count result for user document queries
 */
export interface DocumentCountResult extends RowDataPacket {
  document_count: number;
}

/**
 * User department and team information
 * N:M REFACTORING: department_id now from user_departments table
 */
export interface UserDepartmentTeam extends RowDataPacket {
  role: string | null;
  primary_department_id: number | null; // From user_departments WHERE is_primary = true
  team_id: number | null;
  department_name: string | null;
  team_name: string | null;
  has_full_access: boolean | null; // VISIBILITY-FIX: For blackboard admin filtering
}

/**
 * Subdomain result from tenant queries
 */
export interface SubdomainResult extends RowDataPacket {
  subdomain: string;
}

/**
 * Availability data for updating user availability
 */
export interface AvailabilityData {
  availability_status: string;
  availability_start?: string;
  availability_end?: string;
  availability_notes?: string;
}

/**
 * Result from password change operation
 */
export interface PasswordChangeResult {
  success: boolean;
  message: string;
}

/**
 * Result from profile update operation
 */
export interface ProfileUpdateResult {
  success: boolean;
  message: string;
}

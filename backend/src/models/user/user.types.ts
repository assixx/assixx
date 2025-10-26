/**
 * User Type Definitions
 * Single source of truth for all user-related TypeScript types
 */
import { RowDataPacket } from '../../utils/db';

/**
 * Database representation of a user (snake_case to match DB schema)
 */
export interface DbUser extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  password: string;
  role: string;
  company?: string;
  notes?: string;
  first_name: string;
  last_name: string;
  age?: number;
  employee_id?: string;
  iban?: string;
  department_id?: number;
  department_name?: string;
  position?: string;
  phone?: string;
  landline?: string;
  employee_number?: string;
  address?: string;
  birthday?: Date;
  hire_date?: Date;
  emergency_contact?: string;
  profile_picture?: string;
  status: string;
  is_archived: boolean;
  is_active?: boolean;
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
}

/**
 * Data required to create a new user
 */
export interface UserCreateData {
  username: string;
  email: string;
  password: string;
  role: string;
  company?: string;
  notes?: string;
  first_name: string;
  last_name: string;
  age?: number;
  employee_id?: string;
  iban?: string;
  department_id?: number;
  position?: string;
  phone?: string;
  landline?: string;
  employee_number?: string;
  address?: string;
  birthday?: Date;
  hire_date?: Date;
  emergency_contact?: string;
  profile_picture?: string;
  status?: string;
  is_archived?: boolean;
  is_active?: boolean;
  tenant_id?: number;
  availability_status?: string;
  availability_start?: string;
  availability_end?: string;
  availability_notes?: string;
}

/**
 * Filter options for user search queries
 */
export interface UserFilter {
  tenant_id: number; // PFLICHT für multi-tenant isolation!
  role?: string;
  is_archived?: boolean;
  department_id?: number;
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
 */
export interface UserDepartmentTeam extends RowDataPacket {
  role: string | null;
  department_id: number | null;
  team_id: number | null;
  department_name: string | null;
  team_name: string | null;
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

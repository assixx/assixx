/**
 * Users Module Types
 *
 * Shared interfaces and types for the users module.
 * Imported by users.service.ts, users.helpers.ts, and users.controller.ts.
 */

/**
 * User row type from database
 * NOTE: Availability fields removed - now in employee_availability table
 */
export interface UserRow {
  id: number;
  uuid: string;
  tenant_id: number;
  email: string;
  password?: string;
  role: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  is_active: number;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date | null;
  phone: string | null;
  address: string | null;
  position: string | null;
  employee_number: string | null;
  profile_picture: string | null;
  emergency_contact: string | null;
  date_of_birth: string | null;
  has_full_access: number | null;
}

/**
 * User department assignment row
 */
export interface UserDepartmentRow {
  user_id: number;
  department_id: number;
  department_name: string;
  is_primary: boolean;
}

/**
 * User team assignment row
 * INHERITANCE-FIX: Includes department and area info from team chain
 */
export interface UserTeamRow {
  user_id: number;
  team_id: number;
  team_name: string;
  // Inheritance chain: Team → Department → Area
  team_department_id: number | null;
  team_department_name: string | null;
  team_area_id: number | null;
  team_area_name: string | null;
}

/**
 * Pagination result
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
  };
}

/**
 * Tenant info for user response
 */
export interface TenantInfo {
  companyName: string;
  subdomain: string;
}

/**
 * Safe user response - API format (camelCase)
 * This is what gets returned to the frontend
 * isActive status: 0=inactive, 1=active, 3=archived, 4=deleted
 */
export interface SafeUserResponse {
  id: number;
  uuid: string;
  tenantId: number;
  email: string;
  role: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  isActive: number;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string | null;
  phone: string | null;
  address: string | null;
  position: string | null;
  employeeNumber: string | null;
  profilePicture: string | null;
  emergencyContact: string | null;
  dateOfBirth: string | null;
  availabilityStatus: string | null;
  availabilityStart: string | null;
  availabilityEnd: string | null;
  availabilityNotes: string | null;
  hasFullAccess: boolean | null;
  departmentIds?: number[];
  departmentNames?: string[];
  teamIds?: number[];
  teamNames?: string[];
  // INHERITANCE-FIX: Team → Department → Area chain (first team's chain)
  teamDepartmentId?: number | null;
  teamDepartmentName?: string | null;
  teamAreaId?: number | null;
  teamAreaName?: string | null;
  tenant?: TenantInfo;
}

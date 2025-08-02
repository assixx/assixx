/**
 * Users API v2 Type Definitions
 * Type-safe definitions for all user-related operations
 */

// Request Body Types
export interface CreateUserBody {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role?: "employee" | "admin";
  departmentId?: number;
  position?: string;
  phone?: string;
  address?: string;
  employeeNumber?: string;
}

export interface UpdateUserBody {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: "employee" | "admin";
  departmentId?: number;
  position?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
  employeeNumber?: string;
}

export interface UpdateProfileBody {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
}

export interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateAvailabilityBody {
  availabilityStatus: "available" | "vacation" | "sick" | "training" | "other";
  availabilityStart?: string | null; // ISO date
  availabilityEnd?: string | null; // ISO date
  availabilityNotes?: string | null;
}

// Query Parameter Types
export interface ListUsersQuery {
  page?: string;
  limit?: string;
  search?: string;
  role?: string;
  isActive?: string;
  isArchived?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// Database field mapping types
export interface UserDbFields {
  tenant_id: number;
  role?: string;
  is_active?: boolean;
  is_archived?: boolean;
  first_name?: string;
  last_name?: string;
  department_id?: number;
  employee_id?: string;
  created_at?: Date;
  updated_at?: Date;
  availability_status?: string;
  availability_start?: Date | null;
  availability_end?: Date | null;
  availability_notes?: string | null;
}

// User creation data for database
export interface UserCreateData {
  email: string;
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  tenant_id: number;
  role?: string;
  department_id?: number;
  position?: string;
  phone?: string;
  address?: string;
  employee_id?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

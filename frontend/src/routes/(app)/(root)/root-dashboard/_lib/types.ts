/**
 * Root Dashboard - Type Definitions
 * @module root-dashboard/_lib/types
 */

/** Dashboard statistics data */
export interface DashboardData {
  adminCount: number;
  employeeCount: number;
  totalUsers: number;
}

/** Activity log entry */
export interface ActivityLog {
  id: number;
  action: string;
  userName?: string;
  userFirstName?: string;
  userLastName?: string;
  userRole?: string;
  employeeNumber?: string;
}

/** User data from /users/me */
export interface UserData {
  employeeNumber?: string;
  employee_number?: string;
}

/** API response wrapper */
export interface ApiResponse<T> {
  data?: T;
}

/** Logs API response */
export interface LogsApiResponse {
  data?: {
    logs?: ActivityLog[];
  };
  logs?: ActivityLog[];
}

/** User role type */
export type UserRole = 'root' | 'admin' | 'employee' | 'dummy';

/** Action type */
export type ActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'view'
  | 'assign'
  | 'unassign'
  | 'role_switch_to_root'
  | 'role_switch_to_admin'
  | 'role_switch_to_employee'
  | 'role_switch_root_to_admin';

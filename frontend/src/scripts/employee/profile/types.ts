/**
 * Types and Interfaces for Employee Profile Management
 * Shared type definitions used across employee profile modules
 */

/**
 * Employee user profile data
 * API v2 returns camelCase (via dbToApi transformation)
 * Note: Employees have readonly access to most fields (only password can be changed)
 */
export interface EmployeeProfile {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string; // API v2 returns camelCase via dbToApi()
  role: 'employee';
  tenantId: number;
  isActive: boolean;
  position?: string;
  departmentName?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Password change request data
 */
export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Window extension for profile handlers
 * Allows backwards compatibility with inline script patterns
 */
export interface WindowWithEmployeeProfileHandlers extends Window {
  loadProfile?: () => Promise<void>;
  changePassword?: (data: PasswordChangeData) => Promise<void>;
  uploadProfilePicture?: (file: File) => Promise<void>;
  removeProfilePicture?: () => Promise<void>;
}

/**
 * Types and Interfaces for Admin Profile Management
 * Shared type definitions used across admin profile modules
 */

/**
 * Admin user profile data
 * API v2 returns camelCase (via dbToApi transformation)
 * Note: Admins have readonly access to most fields (only password can be changed)
 */
export interface AdminProfile {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string; // API v2 returns camelCase via dbToApi()
  role: 'admin';
  tenantId: number;
  isActive: boolean;
  position?: string;
  companyName?: string;
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
export interface WindowWithAdminProfileHandlers extends Window {
  loadProfile?: () => Promise<void>;
  changePassword?: (data: PasswordChangeData) => Promise<void>;
  uploadProfilePicture?: (file: File) => Promise<void>;
  removeProfilePicture?: () => Promise<void>;
}

/**
 * Employee Profile - Type Definitions
 * @module employee-profile/_lib/types
 */

/** Employee user profile data (API v2 camelCase) */
export interface EmployeeProfile {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  role: 'employee';
  tenantId: number;
  isActive: boolean;
  position?: string;
  departmentName?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Password strength analysis result */
export interface PasswordStrengthResult {
  score: number;
  label: string;
  color: string;
  className: string;
  crackTime: string;
  feedback: {
    warning: string;
    suggestions: string[];
  };
}

/** Password visibility toggle field */
export type PasswordField = 'current' | 'new' | 'confirm';

/** Toast notification type */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

/** Password change payload */
export interface PasswordChangePayload {
  currentPassword: string;
  newPassword: string;
}

/** Profile picture upload response */
export interface PictureUploadResponse {
  url?: string;
  profilePicture?: string;
}

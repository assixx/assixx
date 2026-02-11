/**
 * Admin Profile - Type Definitions
 * @module admin-profile/_lib/types
 */

/** Admin user profile data (API v2 camelCase) */
export interface AdminProfile {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  role: 'admin';
  tenantId: number;
  isActive: boolean;
  position?: string;
  companyName?: string;
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
  confirmPassword: string;
}

/** Profile picture upload response */
export interface PictureUploadResponse {
  url?: string;
  profilePicture?: string;
}

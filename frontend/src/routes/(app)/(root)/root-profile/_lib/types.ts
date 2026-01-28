/**
 * Root Profile - Type Definitions
 * @module root-profile/_lib/types
 */

/** User profile data */
export interface UserProfile {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  role: string;
}

/** Tenant deletion approval item */
export interface ApprovalItem {
  id: number;
  tenantName: string;
  requestedBy: string;
  requestedAt: string;
  status: string;
  coolingOffComplete: boolean;
  coolingOffEndsAt?: string;
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

/** Profile update payload */
export interface ProfileUpdatePayload {
  email: string;
  firstName: string;
  lastName: string;
}

/** Password change payload */
export interface PasswordChangePayload {
  currentPassword: string;
  newPassword: string;
}

/** API response wrapper variants */
export interface UserResponse {
  user?: UserProfile;
  data?: UserProfile;
}

export interface ApprovalsResponse {
  approvals?: ApprovalItem[];
  data?: ApprovalItem[];
}

export interface PictureUploadResponse {
  url?: string;
  profilePicture?: string;
}

/** JWT payload structure */
export interface JwtPayload {
  role: string;
  [key: string]: unknown;
}

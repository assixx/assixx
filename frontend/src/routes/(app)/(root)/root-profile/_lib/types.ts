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
  confirmPassword: string;
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

// =============================================================================
// SELF-TERMINATION (FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN §5.1)
// Backend domain shape: backend/src/nest/root/root-self-termination.service.ts
// `RootSelfTerminationRequest` (camelCase, ISO date strings over the wire).
// =============================================================================

/** Status values for the request lifecycle (matches DB enum). */
export type SelfTerminationStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';

/**
 * Self-termination request as delivered by the API.
 *
 * NOTE: Dates are ISO 8601 strings here (backend returns Date instances which
 * are serialised by JSON.stringify). Convert to Date only when needed for
 * formatting/comparison.
 */
export interface SelfTerminationRequest {
  id: string;
  tenantId: number;
  requesterId: number;
  reason: string | null;
  status: SelfTerminationStatus;
  expiresAt: string;
  approvedBy: number | null;
  approvedAt: string | null;
  rejectedBy: number | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

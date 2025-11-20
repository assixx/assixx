/**
 * Types and Interfaces for Root Profile Management
 * Shared type definitions used across root profile modules
 */

/**
 * Root user profile data
 * API v2 returns camelCase (via dbToApi transformation)
 */
export interface RootProfile {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string; // API v2 returns camelCase via dbToApi()
  role: 'root';
  tenantId: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Deletion approval request data
 */
export interface DeletionApproval {
  queue_id: number;
  company_name: string;
  subdomain: string;
  requester_name: string;
  requested_at: string;
  status?: string;
}

/**
 * Profile update request data
 */
export interface ProfileUpdateData {
  email?: string;
  firstName?: string;
  lastName?: string;
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
export interface WindowWithProfileHandlers extends Window {
  loadProfile?: () => Promise<void>;
  updateProfile?: (data: ProfileUpdateData) => Promise<void>;
  changePassword?: (data: PasswordChangeData) => Promise<void>;
  uploadProfilePicture?: (file: File) => Promise<void>;
  removeProfilePicture?: () => Promise<void>;
  loadPendingApprovals?: () => Promise<void>;
  approveDeletion?: (queueId: number) => Promise<void>;
  rejectDeletion?: (queueId: number, reason: string) => Promise<void>;
}

// =============================================================================
// MANAGE ROOT - TYPE DEFINITIONS
// =============================================================================

import type {
  IsActiveStatus,
  FormIsActiveStatus,
  StatusFilter,
} from '@assixx/shared';

export type { IsActiveStatus, FormIsActiveStatus, StatusFilter };

/**
 * Root User interface
 */
export interface RootUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  position?: string;
  notes?: string;
  employeeNumber?: string;
  isActive: IsActiveStatus;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

/**
 * Root user form data
 */
export interface RootUserFormData {
  firstName: string;
  lastName: string;
  email: string;
  emailConfirm: string;
  password: string;
  passwordConfirm: string;
  employeeNumber: string;
  position: string;
  notes: string;
  isActive: FormIsActiveStatus;
}

/**
 * Root user API payload (for create/update)
 */
export interface RootUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  notes?: string;
  employeeNumber?: string;
  isActive: FormIsActiveStatus;
  password?: string;
  username?: string;
}

/**
 * API response for root users list
 */
export interface RootUsersApiResponse {
  success?: boolean;
  data?: {
    users?: RootUser[];
  };
}

/**
 * Password strength result
 */
export interface PasswordStrengthResult {
  score: number;
  label: string;
  time: string;
}

// =============================================================================
// MANAGE ROOT - TYPE DEFINITIONS
// =============================================================================

import type {
  IsActiveStatus,
  FormIsActiveStatus,
  StatusFilter,
  AvailabilityStatus,
} from '@assixx/shared';

export type { IsActiveStatus, FormIsActiveStatus, StatusFilter, AvailabilityStatus };

/**
 * Root User interface
 */
export interface RootUser {
  id: number;
  uuid: string;
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

  // Availability
  availabilityStatus?: AvailabilityStatus;
  availabilityStart?: string;
  availabilityEnd?: string;
  availabilityNotes?: string;
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
  positionIds: string[];
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
  positionIds: string[];
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

/**
 * Pagination page item — UI representation of a page-button slot.
 *
 * Mirrors manage-admins / manage-employees / /logs so the same design-system
 * pagination markup can be reused 1:1.
 *
 * @see frontend/src/design-system/primitives/navigation/pagination.css
 */
export type PaginationPageItem =
  | { type: 'page'; value: number; active?: boolean }
  | { type: 'ellipsis' };

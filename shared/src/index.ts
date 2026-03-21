/**
 * Assixx Shared - Barrel Export
 *
 * Shared types, constants, and helpers for the Assixx monorepo.
 * Consumed by both frontend (SvelteKit) and backend (NestJS).
 */

// Types
export type {
  UserRole,
  ExtendedUserRole,
  IsActiveStatus,
  FormIsActiveStatus,
  StatusFilter,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
  ValidationError,
  PaginationMeta,
  ResponseMeta,
  BaseAuthUser,
  PaginationParams,
  AvailabilityStatus,
} from './types/index.js';

export { USER_ROLES, EXTENDED_USER_ROLES, AVAILABILITY_STATUSES } from './types/index.js';

// Constants
export {
  IS_ACTIVE,
  STATUS_LABELS,
  STATUS_BADGE_CLASSES,
  STATUS_FILTER_OPTIONS,
  FORM_STATUS_OPTIONS,
  ROLE_LABELS,
  EXTENDED_ROLE_LABELS,
  AVAILABILITY_LABELS,
  AVAILABILITY_BADGE_CLASSES,
  AVAILABILITY_ICONS,
  AVAILABILITY_OPTIONS,
} from './constants/index.js';

// Helpers
export {
  formatDate,
  formatDateTime,
  formatTime,
  formatRelativeDate,
  isToday,
  isWithinDays,
} from './helpers/index.js';

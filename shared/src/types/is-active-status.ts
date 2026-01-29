/**
 * IsActive Status Types
 *
 * Integer status convention used across the entire system:
 * 0 = inactive, 1 = active, 3 = archived, 4 = deleted (soft delete)
 */

/** All possible is_active database values */
export type IsActiveStatus = 0 | 1 | 3 | 4;

/** Form-safe subset (excludes 4=deleted, which is never set via forms) */
export type FormIsActiveStatus = 0 | 1 | 3;

/** String-based status filter for UI dropdowns/queries */
export type StatusFilter = 'active' | 'inactive' | 'archived' | 'all';

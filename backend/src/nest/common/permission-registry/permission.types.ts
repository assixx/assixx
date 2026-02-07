/**
 * Permission Registry Types
 *
 * Shared interfaces for the decentralized permission registry pattern.
 * Feature modules define their own PermissionCategoryDef and register
 * via OnModuleInit — no central God-Object.
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 * @see docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md
 */

/** Permission types that can be granted per module */
export type PermissionType = 'canRead' | 'canWrite' | 'canDelete';

/** A sub-module within a feature that has its own permission set */
export interface PermissionModuleDef {
  /** Unique code within the feature (e.g. 'blackboard-posts') */
  code: string;
  /** Human-readable label for UI display */
  label: string;
  /** FontAwesome icon class (e.g. 'fa-sticky-note') */
  icon: string;
  /** Which permission types this module supports */
  allowedPermissions: PermissionType[];
}

/** A feature category containing one or more permission modules */
export interface PermissionCategoryDef {
  /** Must match features.code in DB (e.g. 'blackboard', 'calendar') */
  code: string;
  /** Human-readable label for UI display */
  label: string;
  /** FontAwesome icon class (e.g. 'fa-clipboard') */
  icon: string;
  /** Sub-modules with their own permission sets */
  modules: PermissionModuleDef[];
}

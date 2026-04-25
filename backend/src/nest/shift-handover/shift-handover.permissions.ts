/**
 * Shift Handover — Permission Module Definitions (ADR-020).
 *
 * The two modules below are appended to the existing `shift_planning`
 * `PermissionCategoryDef` (owned by ShiftsPermissionRegistrar) at
 * OnApplicationBootstrap — see `shift-handover-permission.registrar.ts`.
 *
 * Why appended and not a standalone category?
 * - Plan §2 locks the feature as part of the `shift_planning` addon
 *   subscription (`AddonCheckService.checkTenantAccess(tid, 'shift_planning')`).
 * - `@RequirePermission` uses the addon code as its first argument, so
 *   all shift-related permissions must live under `shift_planning` for
 *   guard lookups to resolve.
 * - The registry is throw-on-duplicate; extending the existing category
 *   avoids cross-feature imports and keeps ownership decentralised.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2.7 + §Spec Deviation #2
 * @see docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md
 */
import type { PermissionModuleDef } from '../common/permission-registry/permission.types.js';

/** Addon code — matches `addons.code` and is the first arg to `@RequirePermission`. */
export const SHIFT_PLANNING_ADDON = 'shift_planning';

/** Permission module codes — second arg to `@RequirePermission`. */
export const SHIFT_HANDOVER_TEMPLATES_MODULE = 'shift-handover-templates';
export const SHIFT_HANDOVER_ENTRIES_MODULE = 'shift-handover-entries';

/**
 * Modules appended to the `shift_planning` permission category.
 *
 * `canDelete` on `shift-handover-entries` gates the attachment-delete
 * endpoint only; the entry row itself is never deleted via API (plan §2.7
 * carves out the scope split — permission exists, row-delete endpoint
 * deliberately does not).
 */
export const SHIFT_HANDOVER_PERMISSION_MODULES: readonly PermissionModuleDef[] = [
  {
    code: SHIFT_HANDOVER_TEMPLATES_MODULE,
    label: 'Übergabe-Templates',
    icon: 'fa-clipboard-list',
    allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
  },
  {
    code: SHIFT_HANDOVER_ENTRIES_MODULE,
    label: 'Übergabe-Einträge',
    icon: 'fa-clipboard-check',
    allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
  },
];

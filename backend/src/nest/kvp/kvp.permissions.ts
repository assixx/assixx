/**
 * KVP Permission Definitions
 *
 * Defines which permission modules the KVP (Continuous Improvement) feature exposes.
 * Registered via KvpPermissionRegistrar (OnModuleInit).
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const KVP_PERMISSIONS: PermissionCategoryDef = {
  code: 'kvp',
  label: 'KVP',
  icon: 'fa-lightbulb',
  modules: [
    // TODO: 'kvp-reviews' existiert bereits in DB (user_feature_permissions) — Modul hier hinzufügen sobald KVP-Bewertungen implementiert werden
    {
      code: 'kvp-suggestions',
      label: 'Vorschläge',
      icon: 'fa-lightbulb',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'kvp-comments',
      label: 'Kommentare',
      icon: 'fa-comments',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
  ],
};

/**
 * KVP Permission Definitions
 *
 * Defines which permission modules the KVP (Continuous Improvement) addon exposes.
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
    // 'kvp-reviews' existiert bereits in DB (user_addon_permissions) — Modul hier registrieren sobald KVP-Bewertungen implementiert sind
    {
      code: 'kvp-suggestions',
      label: 'Vorschläge',
      icon: 'fa-lightbulb',
      allowedPermissions: ['canRead', 'canWrite'],
    },
    {
      code: 'kvp-comments',
      label: 'Kommentare',
      icon: 'fa-comments',
      allowedPermissions: ['canRead', 'canWrite'],
    },
    {
      code: 'kvp-sharing',
      label: 'Teilen',
      icon: 'fa-share-nodes',
      allowedPermissions: ['canWrite'],
    },
  ],
};

/**
 * TPM Permission Definition (ADR-020)
 *
 * Defines the permission category and modules for the TPM feature.
 * Registered automatically via TpmPermissionRegistrar on module init.
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const TPM_PERMISSIONS: PermissionCategoryDef = {
  code: 'tpm',
  label: 'TPM / Wartung',
  icon: 'fa-tools',
  modules: [
    // TODO: 'tpm-reports' existiert bereits in DB (user_feature_permissions) — Modul hier hinzufügen sobald TPM-Reports implementiert werden
    {
      code: 'tpm-plans',
      label: 'Wartungspläne',
      icon: 'fa-clipboard-list',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'tpm-cards',
      label: 'Wartungskarten',
      icon: 'fa-th',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'tpm-executions',
      label: 'Durchführungen',
      icon: 'fa-check-circle',
      allowedPermissions: ['canRead', 'canWrite'],
    },
    {
      code: 'tpm-config',
      label: 'Konfiguration',
      icon: 'fa-cogs',
      allowedPermissions: ['canRead', 'canWrite'],
    },
    {
      code: 'tpm-locations',
      label: 'Standorte',
      icon: 'fa-map-marker-alt',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
  ],
};

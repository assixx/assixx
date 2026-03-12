/**
 * Documents Permission Definitions
 *
 * Defines which permission modules the documents addon exposes.
 * Registered via DocumentsPermissionRegistrar (OnModuleInit).
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const DOCUMENTS_PERMISSIONS: PermissionCategoryDef = {
  code: 'documents',
  label: 'Dokumente',
  icon: 'fa-folder-open',
  modules: [
    {
      code: 'documents-files',
      label: 'Dokumente',
      icon: 'fa-file-alt',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'documents-archive',
      label: 'Archiv',
      icon: 'fa-archive',
      allowedPermissions: ['canRead', 'canWrite'],
    },
  ],
};

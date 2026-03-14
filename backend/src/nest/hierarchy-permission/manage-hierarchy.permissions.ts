/**
 * Manage Hierarchy Permission Definitions
 *
 * Cross-cutting addon for organizational structure management.
 * Covers Areas, Departments, Teams, and Employees manage-pages.
 *
 * NOTE: No canDelete — Leads can Read + Write, not Create/Delete.
 * Create/Delete stays Root/Admin only (enforced by @Roles on controllers).
 *
 * Registered via ManageHierarchyPermissionRegistrar (OnModuleInit).
 * Root grants manage_hierarchy permissions to Admins manually.
 * Employees get auto-seeded at Lead-Zuweisung (Step 3.5).
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const MANAGE_HIERARCHY_PERMISSIONS: PermissionCategoryDef = {
  code: 'manage_hierarchy',
  label: 'Organisationsstruktur',
  icon: 'fa-sitemap',
  modules: [
    {
      code: 'manage-areas',
      label: 'Bereiche verwalten',
      icon: 'fa-map-marker-alt',
      allowedPermissions: ['canRead', 'canWrite'],
      allowedRoles: ['admin', 'root'], // D1=NEIN: Employees können keine Area-Leads sein
    },
    {
      code: 'manage-departments',
      label: 'Abteilungen verwalten',
      icon: 'fa-building',
      allowedPermissions: ['canRead', 'canWrite'],
      allowedRoles: ['admin', 'root'], // D1=NEIN: Employees können keine Dept-Leads sein
    },
    {
      code: 'manage-teams',
      label: 'Teams verwalten',
      icon: 'fa-users',
      allowedPermissions: ['canRead', 'canWrite'],
    },
    {
      code: 'manage-employees',
      label: 'Mitarbeiter verwalten',
      icon: 'fa-user-tie',
      allowedPermissions: ['canRead', 'canWrite'],
    },
    {
      code: 'manage-permissions',
      label: 'Berechtigungen verwalten',
      icon: 'fa-shield-alt',
      allowedPermissions: ['canRead', 'canWrite'],
      // Kein allowedRoles: alle Rollen können diese Permission bekommen.
      // Root entscheidet wer Delegationsrechte erhält.
      // canRead = Permission-Seite von Untergebenen sehen
      // canWrite = Permissions von Untergebenen ändern
    },
  ],
};

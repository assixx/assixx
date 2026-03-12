/**
 * Work Orders — Permission Definition (ADR-020)
 *
 * Defines the permission category and modules for the Work Orders addon.
 * Two modules:
 * - work-orders-manage: Admin — create, edit, delete, assign
 * - work-orders-execute: Employee — view assigned, update status, comment, upload photos
 *
 * Registered automatically via WorkOrdersPermissionRegistrar on module init.
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const WORK_ORDER_PERMISSIONS: PermissionCategoryDef = {
  code: 'work_orders',
  label: 'Arbeitsaufträge',
  icon: 'fa-clipboard-check',
  modules: [
    {
      code: 'work-orders-manage',
      label: 'Aufträge verwalten',
      icon: 'fa-tasks',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'work-orders-execute',
      label: 'Aufträge ausführen',
      icon: 'fa-wrench',
      allowedPermissions: ['canRead', 'canWrite'],
    },
  ],
};

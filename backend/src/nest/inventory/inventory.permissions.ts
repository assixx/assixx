/**
 * Inventory Permission Definition (ADR-020)
 *
 * Defines the permission category and modules for the inventory addon.
 * Registered automatically via InventoryPermissionRegistrar on module init.
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const INVENTORY_PERMISSIONS: PermissionCategoryDef = {
  code: 'inventory',
  label: 'Inventar',
  icon: 'fa-boxes-stacked',
  modules: [
    {
      code: 'inventory-lists',
      label: 'Inventarlisten',
      icon: 'fa-list',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'inventory-items',
      label: 'Inventargegenstände',
      icon: 'fa-cube',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
  ],
};

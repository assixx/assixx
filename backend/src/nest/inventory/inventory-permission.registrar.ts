/**
 * Inventory Permission Registrar (ADR-020)
 *
 * Registers inventory permission modules with the central PermissionRegistryService
 * on application startup via OnModuleInit lifecycle hook.
 */
import { Injectable, type OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { INVENTORY_PERMISSIONS } from './inventory.permissions.js';

@Injectable()
export class InventoryPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(INVENTORY_PERMISSIONS);
  }
}

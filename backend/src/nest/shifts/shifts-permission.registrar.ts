/**
 * Shifts Permission Registrar
 *
 * Registers shift planning permission definitions with the global registry
 * during module initialization. Decentralized pattern — shifts
 * owns its own permission definitions.
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 */
import { Injectable, OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { SHIFTS_PERMISSIONS } from './shifts.permissions.js';

@Injectable()
export class ShiftsPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(SHIFTS_PERMISSIONS);
  }
}

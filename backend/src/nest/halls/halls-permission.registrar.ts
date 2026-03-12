/**
 * Halls Permission Registrar
 *
 * Registers hall permission definitions with the global registry
 * during module initialization.
 */
import { Injectable, OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { HALLS_PERMISSIONS } from './halls.permissions.js';

@Injectable()
export class HallsPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(HALLS_PERMISSIONS);
  }
}

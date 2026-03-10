/**
 * Users Permission Registrar
 *
 * Registers user management permission definitions with the global registry
 * during module initialization.
 */
import { Injectable, OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { USERS_PERMISSIONS } from './users.permissions.js';

@Injectable()
export class UsersPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(USERS_PERMISSIONS);
  }
}

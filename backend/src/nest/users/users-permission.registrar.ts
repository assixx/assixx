/**
 * Users Permission Registrar (ADR-020)
 *
 * Registers user profile permission modules with the central PermissionRegistryService
 * on application startup via OnModuleInit lifecycle hook.
 */
import { Injectable, type OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { USER_PROFILES_PERMISSIONS } from './users.permissions.js';

@Injectable()
export class UsersPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(USER_PROFILES_PERMISSIONS);
  }
}

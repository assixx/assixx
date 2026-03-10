/**
 * Dummy Users Permission Registrar
 */
import { Injectable, OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { DUMMY_USERS_PERMISSIONS } from './dummy-users.permissions.js';

@Injectable()
export class DummyUsersPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(DUMMY_USERS_PERMISSIONS);
  }
}

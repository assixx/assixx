/**
 * Assets Permission Registrar
 */
import { Injectable, OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { ASSETS_PERMISSIONS } from './assets.permissions.js';

@Injectable()
export class AssetsPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(ASSETS_PERMISSIONS);
  }
}

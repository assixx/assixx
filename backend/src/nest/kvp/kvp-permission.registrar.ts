/**
 * KVP Permission Registrar
 *
 * Registers KVP permission definitions with the global registry
 * during module initialization. Decentralized pattern — KVP
 * owns its own permission definitions.
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 */
import { Injectable, OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { KVP_PERMISSIONS } from './kvp.permissions.js';

@Injectable()
export class KvpPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(KVP_PERMISSIONS);
  }
}

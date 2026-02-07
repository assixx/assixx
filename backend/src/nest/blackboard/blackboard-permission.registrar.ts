/**
 * Blackboard Permission Registrar
 *
 * Registers blackboard permission definitions with the global registry
 * during module initialization. Decentralized pattern — blackboard
 * owns its own permission definitions.
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 */
import { Injectable, OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { BLACKBOARD_PERMISSIONS } from './blackboard.permissions.js';

@Injectable()
export class BlackboardPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(BLACKBOARD_PERMISSIONS);
  }
}

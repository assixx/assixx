/**
 * Approvals — Permission Registrar (ADR-020)
 * @module approvals/approvals-permission.registrar
 *
 * Registers approval permission categories at module init.
 * Decentralized pattern: each module owns its permission definitions.
 */
import { Injectable, type OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { APPROVALS_PERMISSIONS } from './approvals.permissions.js';

@Injectable()
export class ApprovalsPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(APPROVALS_PERMISSIONS);
  }
}

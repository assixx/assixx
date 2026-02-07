/**
 * Chat Permission Registrar
 *
 * Registers chat permission definitions with the global registry
 * during module initialization. Decentralized pattern — chat
 * owns its own permission definitions.
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 */
import { Injectable, OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { CHAT_PERMISSIONS } from './chat.permissions.js';

@Injectable()
export class ChatPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(CHAT_PERMISSIONS);
  }
}

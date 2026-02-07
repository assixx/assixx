/**
 * Documents Permission Registrar
 *
 * Registers documents permission definitions with the global registry
 * during module initialization. Decentralized pattern — documents
 * owns its own permission definitions.
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 */
import { Injectable, OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { DOCUMENTS_PERMISSIONS } from './documents.permissions.js';

@Injectable()
export class DocumentsPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(DOCUMENTS_PERMISSIONS);
  }
}

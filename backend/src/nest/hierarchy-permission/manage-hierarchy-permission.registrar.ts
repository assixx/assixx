/**
 * Manage Hierarchy Permission Registrar
 *
 * Registers manage_hierarchy permission definitions with the global registry
 * during module initialization. Decentralized pattern (ADR-020).
 */
import { Injectable, OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { MANAGE_HIERARCHY_PERMISSIONS } from './manage-hierarchy.permissions.js';

@Injectable()
export class ManageHierarchyPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(MANAGE_HIERARCHY_PERMISSIONS);
  }
}

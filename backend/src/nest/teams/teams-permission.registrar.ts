/**
 * Teams Permission Registrar
 *
 * Registers team permission definitions with the global registry
 * during module initialization.
 */
import { Injectable, OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { TEAMS_PERMISSIONS } from './teams.permissions.js';

@Injectable()
export class TeamsPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(TEAMS_PERMISSIONS);
  }
}

/**
 * Surveys Permission Registrar
 *
 * Registers surveys permission definitions with the global registry
 * during module initialization. Decentralized pattern — surveys
 * owns its own permission definitions.
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 */
import { Injectable, OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { SURVEYS_PERMISSIONS } from './surveys.permissions.js';

@Injectable()
export class SurveysPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(SURVEYS_PERMISSIONS);
  }
}

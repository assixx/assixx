/**
 * Vacation Permission Registrar (ADR-020)
 *
 * Registers vacation permission modules with the central PermissionRegistryService
 * on application startup via OnModuleInit lifecycle hook.
 */
import { Injectable, type OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { VACATION_PERMISSIONS } from './vacation.permissions.js';

@Injectable()
export class VacationPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(VACATION_PERMISSIONS);
  }
}

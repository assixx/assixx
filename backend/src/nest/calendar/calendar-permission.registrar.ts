/**
 * Calendar Permission Registrar
 *
 * Registers calendar permission definitions with the global registry
 * during module initialization. Decentralized pattern — calendar
 * owns its own permission definitions.
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 */
import { Injectable, OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { CALENDAR_PERMISSIONS } from './calendar.permissions.js';

@Injectable()
export class CalendarPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(CALENDAR_PERMISSIONS);
  }
}

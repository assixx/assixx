/**
 * Work Orders — Permission Registrar (ADR-020)
 *
 * Registers work order permission modules with the central PermissionRegistryService
 * on application startup via OnModuleInit lifecycle hook.
 */
import { Injectable, type OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { WORK_ORDER_PERMISSIONS } from './work-orders.permissions.js';

@Injectable()
export class WorkOrdersPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(WORK_ORDER_PERMISSIONS);
  }
}

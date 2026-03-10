/**
 * Reports Permission Registrar
 */
import { Injectable, OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { REPORTS_PERMISSIONS } from './reports.permissions.js';

@Injectable()
export class ReportsPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(REPORTS_PERMISSIONS);
  }
}

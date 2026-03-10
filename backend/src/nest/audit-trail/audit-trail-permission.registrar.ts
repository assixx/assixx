/**
 * Audit Trail Permission Registrar
 */
import { Injectable, OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { AUDIT_TRAIL_PERMISSIONS } from './audit-trail.permissions.js';

@Injectable()
export class AuditTrailPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(AUDIT_TRAIL_PERMISSIONS);
  }
}

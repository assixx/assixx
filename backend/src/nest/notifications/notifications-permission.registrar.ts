/**
 * Notifications Permission Registrar
 */
import { Injectable, OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import { NOTIFICATIONS_PERMISSIONS } from './notifications.permissions.js';

@Injectable()
export class NotificationsPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(NOTIFICATIONS_PERMISSIONS);
  }
}

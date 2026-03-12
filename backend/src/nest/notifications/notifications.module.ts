/**
 * Notifications Module
 *
 * Handles notification management, preferences, and real-time SSE streaming.
 *
 * Sub-services:
 * - NotificationPreferencesService - user preference CRUD
 * - NotificationStatisticsService - analytics and stats
 * - NotificationAddonService - addon-specific notifications (ADR-004)
 */
import { Module } from '@nestjs/common';

import { UserPermissionsModule } from '../user-permissions/user-permissions.module.js';
import { NotificationAddonService } from './notification-addon.service.js';
import { NotificationPreferencesService } from './notification-preferences.service.js';
import { NotificationStatisticsService } from './notification-statistics.service.js';
import { NotificationsPermissionRegistrar } from './notifications-permission.registrar.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [UserPermissionsModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationPreferencesService,
    NotificationStatisticsService,
    NotificationAddonService,
    NotificationsPermissionRegistrar,
  ],
  exports: [NotificationsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty classes by design
export class NotificationsModule {}

/**
 * Notifications Module
 *
 * Handles notification management, preferences, and real-time SSE streaming.
 */
import { Module } from '@nestjs/common';

import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty classes by design
export class NotificationsModule {}

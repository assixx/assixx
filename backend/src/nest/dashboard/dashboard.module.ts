/**
 * Dashboard Module
 *
 * Aggregates data from multiple modules for dashboard views.
 * Provides optimized endpoints that combine multiple data sources.
 *
 * Performance Benefits:
 * - Reduces HTTP requests from frontend (5 → 1 for counts)
 * - Executes queries in parallel on server
 * - Adds caching headers for browser optimization
 */
import { Module } from '@nestjs/common';

import { BlackboardModule } from '../blackboard/blackboard.module.js';
import { CalendarModule } from '../calendar/calendar.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [ChatModule, NotificationsModule, BlackboardModule, CalendarModule, DocumentsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class DashboardModule {}

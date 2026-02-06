/**
 * Calendar Module
 *
 * NestJS module for calendar event management.
 * Provides CRUD operations for calendar events with tenant isolation.
 *
 * Sub-services:
 * - CalendarPermissionService: Access control and permission filtering
 * - CalendarCreationService: Event creation and attendee management
 * - CalendarOverviewService: Dashboard views and notification counts
 */
import { Module } from '@nestjs/common';

import { FeatureVisitsModule } from '../feature-visits/feature-visits.module.js';
import { CalendarCreationService } from './calendar-creation.service.js';
import { CalendarOverviewService } from './calendar-overview.service.js';
import { CalendarPermissionService } from './calendar-permission.service.js';
import { CalendarController } from './calendar.controller.js';
import { CalendarService } from './calendar.service.js';

@Module({
  imports: [FeatureVisitsModule],
  controllers: [CalendarController],
  providers: [
    CalendarService,
    CalendarPermissionService,
    CalendarCreationService,
    CalendarOverviewService,
  ],
  exports: [CalendarService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class CalendarModule {}

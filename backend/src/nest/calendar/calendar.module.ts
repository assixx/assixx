/**
 * Calendar Module
 *
 * NestJS module for calendar event management.
 * Provides CRUD operations for calendar events with tenant isolation.
 */
import { Module } from '@nestjs/common';

import { FeatureVisitsModule } from '../feature-visits/feature-visits.module.js';
import { CalendarController } from './calendar.controller.js';
import { CalendarService } from './calendar.service.js';

@Module({
  imports: [FeatureVisitsModule],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class CalendarModule {}

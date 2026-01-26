/**
 * Surveys Module
 *
 * Module for survey management including questions, assignments, and responses.
 */
import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module.js';
import { SurveysController } from './surveys.controller.js';
import { SurveysService } from './surveys.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [SurveysController],
  providers: [SurveysService],
  exports: [SurveysService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class SurveysModule {}

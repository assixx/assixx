/**
 * Surveys Module
 *
 * Module for survey management including questions, assignments, and responses.
 */
import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module.js';
import { SurveyAccessService } from './survey-access.service.js';
import { SurveyQuestionsService } from './survey-questions.service.js';
import { SurveyResponsesService } from './survey-responses.service.js';
import { SurveyStatisticsService } from './survey-statistics.service.js';
import { SurveysController } from './surveys.controller.js';
import { SurveysService } from './surveys.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [SurveysController],
  providers: [
    SurveysService,
    SurveyAccessService,
    SurveyQuestionsService,
    SurveyResponsesService,
    SurveyStatisticsService,
  ],
  exports: [SurveysService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class SurveysModule {}

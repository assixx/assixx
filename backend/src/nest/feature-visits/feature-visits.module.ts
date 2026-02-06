/**
 * Feature Visits Module
 *
 * NestJS module for tracking user visits to features.
 * Used for notification badge reset logic.
 */
import { Module } from '@nestjs/common';

import { FeatureVisitsController } from './feature-visits.controller.js';
import { FeatureVisitsService } from './feature-visits.service.js';

@Module({
  controllers: [FeatureVisitsController],
  providers: [FeatureVisitsService],
  exports: [FeatureVisitsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class FeatureVisitsModule {}

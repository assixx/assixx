/**
 * Addon Visits Module
 *
 * NestJS module for tracking user visits to addons.
 * Used for notification badge reset logic.
 */
import { Module } from '@nestjs/common';

import { AddonVisitsController } from './addon-visits.controller.js';
import { AddonVisitsService } from './addon-visits.service.js';

@Module({
  controllers: [AddonVisitsController],
  providers: [AddonVisitsService],
  exports: [AddonVisitsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class AddonVisitsModule {}

/**
 * Features Module
 */
import { Module } from '@nestjs/common';

import { FeaturesController } from './features.controller.js';
import { FeaturesService } from './features.service.js';

@Module({
  controllers: [FeaturesController],
  providers: [FeaturesService],
  exports: [FeaturesService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured
export class FeaturesModule {}

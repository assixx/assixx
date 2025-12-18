/**
 * Plans Module
 */
import { Module } from '@nestjs/common';

import { PlansController } from './plans.controller.js';
import { PlansService } from './plans.service.js';

@Module({
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured
export class PlansModule {}

/**
 * Root Module
 */
import { Module } from '@nestjs/common';

import { RootController } from './root.controller.js';
import { RootService } from './root.service.js';

@Module({
  controllers: [RootController],
  providers: [RootService],
  exports: [RootService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured
export class RootModule {}

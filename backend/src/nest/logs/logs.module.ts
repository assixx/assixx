/**
 * Logs Module
 *
 * Handles system audit logs access and management.
 * All endpoints require root role.
 */
import { Module } from '@nestjs/common';

import { LogsController } from './logs.controller.js';
import { LogsService } from './logs.service.js';

@Module({
  controllers: [LogsController],
  providers: [LogsService],
  exports: [LogsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class LogsModule {}

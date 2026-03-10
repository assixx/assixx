/**
 * Reports Module
 */
import { Module } from '@nestjs/common';

import { ReportsPermissionRegistrar } from './reports-permission.registrar.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportsPermissionRegistrar],
  exports: [ReportsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured
export class ReportsModule {}

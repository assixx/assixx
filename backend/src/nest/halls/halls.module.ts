/**
 * Halls Module
 *
 * NestJS module for hall management.
 * Provides CRUD operations for halls with tenant isolation.
 */
import { Module } from '@nestjs/common';

import { HallsPermissionRegistrar } from './halls-permission.registrar.js';
import { HallsController } from './halls.controller.js';
import { HallsService } from './halls.service.js';

@Module({
  controllers: [HallsController],
  providers: [HallsService, HallsPermissionRegistrar],
  exports: [HallsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class HallsModule {}

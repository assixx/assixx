/**
 * Areas Module
 *
 * NestJS module for area/location management.
 * Provides CRUD operations for areas with tenant isolation.
 */
import { Module } from '@nestjs/common';

import { ScopeModule } from '../hierarchy-permission/scope.module.js';
import { AreasController } from './areas.controller.js';
import { AreasService } from './areas.service.js';

@Module({
  imports: [ScopeModule],
  controllers: [AreasController],
  providers: [AreasService],
  exports: [AreasService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class AreasModule {}

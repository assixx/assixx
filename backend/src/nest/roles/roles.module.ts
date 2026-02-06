/**
 * Roles Module
 *
 * NestJS module for role management.
 * Provides role information and hierarchy.
 */
import { Module } from '@nestjs/common';

import { RolesController } from './roles.controller.js';
import { RolesService } from './roles.service.js';

@Module({
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class RolesModule {}

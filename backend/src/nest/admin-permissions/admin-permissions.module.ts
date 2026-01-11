/**
 * Admin Permissions Module
 *
 * NestJS module for admin permissions management.
 * Provides department, group, and area permission management for admins.
 */
import { Module } from '@nestjs/common';

import { AdminPermissionsController } from './admin-permissions.controller.js';
import { AdminPermissionsService } from './admin-permissions.service.js';

@Module({
  controllers: [AdminPermissionsController],
  providers: [AdminPermissionsService],
  exports: [AdminPermissionsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class AdminPermissionsModule {}

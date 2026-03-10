/**
 * Departments Module
 *
 * NestJS module for department management.
 * Provides CRUD operations for departments with tenant isolation.
 */
import { Module } from '@nestjs/common';

import { DepartmentsPermissionRegistrar } from './departments-permission.registrar.js';
import { DepartmentsController } from './departments.controller.js';
import { DepartmentsService } from './departments.service.js';

@Module({
  controllers: [DepartmentsController],
  providers: [DepartmentsService, DepartmentsPermissionRegistrar],
  exports: [DepartmentsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class DepartmentsModule {}

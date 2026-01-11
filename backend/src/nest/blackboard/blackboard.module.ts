/**
 * Blackboard Module
 *
 * NestJS module for blackboard/bulletin board management.
 * Provides CRUD operations for company announcements with tenant isolation.
 * Native NestJS implementation - no dependency on routes/v2/
 */
import { Module } from '@nestjs/common';

import { DocumentsModule } from '../documents/documents.module.js';
import { BlackboardController } from './blackboard.controller.js';
import { BlackboardService } from './blackboard.service.js';

@Module({
  imports: [DocumentsModule],
  controllers: [BlackboardController],
  providers: [BlackboardService],
  exports: [BlackboardService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class BlackboardModule {}

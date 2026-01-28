/**
 * Blackboard Module
 *
 * NestJS module for blackboard/bulletin board management.
 * Provides CRUD operations for company announcements with tenant isolation.
 * Native NestJS implementation - no dependency on routes/v2/
 */
import { Module } from '@nestjs/common';

import { DocumentsModule } from '../documents/documents.module.js';
import { BlackboardAccessService } from './blackboard-access.service.js';
import { BlackboardArchiveService } from './blackboard-archive.service.js';
import { BlackboardAttachmentsService } from './blackboard-attachments.service.js';
import { BlackboardCommentsService } from './blackboard-comments.service.js';
import { BlackboardConfirmationsService } from './blackboard-confirmations.service.js';
import { BlackboardEntriesService } from './blackboard-entries.service.js';
import { BlackboardController } from './blackboard.controller.js';
import { BlackboardService } from './blackboard.service.js';

@Module({
  imports: [DocumentsModule],
  controllers: [BlackboardController],
  providers: [
    // Main facade service
    BlackboardService,
    // Sub-services
    BlackboardEntriesService,
    BlackboardAccessService,
    BlackboardCommentsService,
    BlackboardConfirmationsService,
    BlackboardAttachmentsService,
    // Cron job service
    BlackboardArchiveService,
  ],
  exports: [BlackboardService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class BlackboardModule {}

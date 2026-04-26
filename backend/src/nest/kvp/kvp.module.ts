/**
 * KVP Module
 *
 * NestJS module for Continuous Improvement Process (KVP) management.
 * Provides CRUD operations for improvement suggestions with tenant isolation.
 *
 * Sub-services:
 * - KvpApprovalService — Approval bridge (ADR-037 integration, EventBus listener)
 * - KvpCategoriesService — Category customization (kvp_categories_custom table)
 * - KvpCommentsService — Comment CRUD (kvp_comments table)
 * - KvpAttachmentsService — Attachment CRUD (kvp_attachments table)
 * - KvpConfirmationsService — Read confirmation tracking (kvp_confirmations table)
 * - KvpLifecycleService — Share/unshare + archive/unarchive state transitions
 * - KvpParticipantsService — Co-originator tagging (kvp_participants table, FEAT_KVP_PARTICIPANTS_MASTERPLAN §2.2)
 */
import { Module } from '@nestjs/common';

import { ApprovalsModule } from '../approvals/approvals.module.js';
import { ScopeModule } from '../hierarchy-permission/scope.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { KvpApprovalArchiveCronService } from './kvp-approval-archive-cron.service.js';
import { KvpApprovalService } from './kvp-approval.service.js';
import { KvpAttachmentsService } from './kvp-attachments.service.js';
import { KvpCategoriesService } from './kvp-categories.service.js';
import { KvpCommentsService } from './kvp-comments.service.js';
import { KvpConfirmationsService } from './kvp-confirmations.service.js';
import { KvpLifecycleService } from './kvp-lifecycle.service.js';
import { KvpParticipantsService } from './kvp-participants.service.js';
import { KvpPermissionRegistrar } from './kvp-permission.registrar.js';
import { KvpRewardTiersService } from './kvp-reward-tiers.service.js';
import { KvpController } from './kvp.controller.js';
import { KvpService } from './kvp.service.js';

@Module({
  imports: [ApprovalsModule, NotificationsModule, ScopeModule],
  controllers: [KvpController],
  providers: [
    KvpService,
    KvpCategoriesService,
    KvpCommentsService,
    KvpAttachmentsService,
    KvpConfirmationsService,
    KvpApprovalService,
    KvpApprovalArchiveCronService,
    KvpLifecycleService,
    KvpParticipantsService,
    KvpRewardTiersService,
    // Permission registration (ADR-020)
    KvpPermissionRegistrar,
  ],
  exports: [KvpService, KvpParticipantsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class KvpModule {}

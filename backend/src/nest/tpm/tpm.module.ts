/**
 * TPM Module
 *
 * NestJS module for Total Productive Maintenance (Kamishibai Board).
 * Provides maintenance plan management, card lifecycle, execution tracking,
 * approval workflow, escalation scheduling, and configuration.
 *
 * Services and controllers will be added incrementally in Phase 2 sessions.
 */
import { Module } from '@nestjs/common';

import { FeatureCheckModule } from '../feature-check/feature-check.module.js';
import { TpmApprovalService } from './tpm-approval.service.js';
import { TpmCardCascadeService } from './tpm-card-cascade.service.js';
import { TpmCardDuplicateService } from './tpm-card-duplicate.service.js';
import { TpmCardStatusService } from './tpm-card-status.service.js';
import { TpmCardsController } from './tpm-cards.controller.js';
import { TpmCardsService } from './tpm-cards.service.js';
import { TpmColorConfigService } from './tpm-color-config.service.js';
import { TpmEscalationService } from './tpm-escalation.service.js';
import { TpmExecutionsService } from './tpm-executions.service.js';
import { TpmNotificationService } from './tpm-notification.service.js';
import { TpmPermissionRegistrar } from './tpm-permission.registrar.js';
import { TpmPlansIntervalService } from './tpm-plans-interval.service.js';
import { TpmPlansController } from './tpm-plans.controller.js';
import { TpmPlansService } from './tpm-plans.service.js';
import { TpmSlotAssistantService } from './tpm-slot-assistant.service.js';
import { TpmTemplatesService } from './tpm-templates.service.js';
import { TpmTimeEstimatesService } from './tpm-time-estimates.service.js';

@Module({
  imports: [FeatureCheckModule],
  controllers: [TpmPlansController, TpmCardsController],
  providers: [
    // Permission registration (ADR-020)
    TpmPermissionRegistrar,

    // Plan management (Session 6)
    TpmPlansService,
    TpmPlansIntervalService,

    // Config services (Session 7)
    TpmTimeEstimatesService,
    TpmTemplatesService,
    TpmColorConfigService,

    // Card services (Session 8)
    TpmCardsService,
    TpmCardStatusService,

    // Cascade + Duplicate detection (Session 9)
    TpmCardCascadeService,
    TpmCardDuplicateService,

    // Slot availability (Session 10)
    TpmSlotAssistantService,

    // Executions + Approval (Session 11)
    TpmExecutionsService,
    TpmApprovalService,

    // Notification + Escalation (Session 12)
    TpmNotificationService,
    TpmEscalationService,
  ],
  exports: [
    TpmPlansService,
    TpmPlansIntervalService,
    TpmTimeEstimatesService,
    TpmTemplatesService,
    TpmColorConfigService,
    TpmCardsService,
    TpmCardStatusService,
    TpmCardCascadeService,
    TpmCardDuplicateService,
    TpmSlotAssistantService,
    TpmExecutionsService,
    TpmApprovalService,
    TpmNotificationService,
    TpmEscalationService,
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class TpmModule {}

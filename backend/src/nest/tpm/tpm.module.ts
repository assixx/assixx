/**
 * TPM Module
 *
 * NestJS module for Total Productive Maintenance (Kamishibai Board).
 * Provides maintenance plan management, card lifecycle, execution tracking,
 * approval workflow, escalation scheduling, and configuration.
 *
 * Sub-modules:
 * - TpmLocationsModule — self-contained location management (controller + service)
 * - TpmConfigServicesModule — pure config services (color, templates, time estimates)
 */
/* eslint-disable import-x/max-dependencies -- NestJS feature module: 18 services + 4 sub-modules; NestJS DI requires explicit imports */
import { Module } from '@nestjs/common';

import { AddonCheckModule } from '../addon-check/addon-check.module.js';
import { ApprovalsModule } from '../approvals/approvals.module.js';
import { ScopeModule } from '../hierarchy-permission/scope.module.js';
import { TpmApprovalService } from './tpm-approval.service.js';
import { TpmCardCascadeService } from './tpm-card-cascade.service.js';
import { TpmCardDuplicateService } from './tpm-card-duplicate.service.js';
import { TpmCardStatusService } from './tpm-card-status.service.js';
import { TpmCardsController } from './tpm-cards.controller.js';
import { TpmCardsService } from './tpm-cards.service.js';
import { TpmConfigServicesModule } from './tpm-config-services.module.js';
import { TpmConfigController } from './tpm-config.controller.js';
import { TpmDashboardService } from './tpm-dashboard.service.js';
import { TpmDefectStatsService } from './tpm-defect-stats.service.js';
import { TpmDueDateCronService } from './tpm-due-date-cron.service.js';
import { TpmEscalationService } from './tpm-escalation.service.js';
import { TpmExecutionsController } from './tpm-executions.controller.js';
import { TpmExecutionsService } from './tpm-executions.service.js';
import { TpmLocationsModule } from './tpm-locations.module.js';
import { TpmNotificationService } from './tpm-notification.service.js';
import { TpmPermissionRegistrar } from './tpm-permission.registrar.js';
import { TpmPlanApprovalService } from './tpm-plan-approval.service.js';
import { TpmPlanRevisionsService } from './tpm-plan-revisions.service.js';
import { TpmPlansIntervalService } from './tpm-plans-interval.service.js';
import { TpmPlansController } from './tpm-plans.controller.js';
import { TpmPlansService } from './tpm-plans.service.js';
import { TpmScheduleProjectionService } from './tpm-schedule-projection.service.js';
import { TpmSchedulingService } from './tpm-scheduling.service.js';
import { TpmShiftAssignmentsService } from './tpm-shift-assignments.service.js';
import { TpmSlotAssistantService } from './tpm-slot-assistant.service.js';

@Module({
  imports: [
    AddonCheckModule,
    ApprovalsModule,
    ScopeModule,
    TpmLocationsModule,
    TpmConfigServicesModule,
  ],
  controllers: [
    TpmPlansController,
    TpmCardsController,
    TpmExecutionsController,
    TpmConfigController,
  ],
  providers: [
    // Permission registration (ADR-020)
    TpmPermissionRegistrar,

    // Plan management (Session 6)
    TpmPlansService,
    TpmPlansIntervalService,
    TpmPlanRevisionsService,
    TpmPlanApprovalService,

    // Card services (Session 8)
    TpmCardsService,
    TpmCardStatusService,

    // Cascade + Duplicate detection (Session 9)
    TpmCardCascadeService,
    TpmCardDuplicateService,

    // Slot availability (Session 10)
    TpmSlotAssistantService,

    // Schedule projection (Session 32)
    TpmScheduleProjectionService,

    // Shift assignments — TPM Gesamtansicht employee rows
    TpmShiftAssignmentsService,

    // Executions + Approval (Session 11)
    TpmExecutionsService,
    TpmApprovalService,

    // Notification + Escalation (Session 12)
    TpmNotificationService,
    TpmEscalationService,

    // Scheduling + Cron (scheduling wiring)
    TpmSchedulingService,
    TpmDueDateCronService,

    // Defect statistics (Mängelgrafik)
    TpmDefectStatsService,

    // Dashboard count (Session 14)
    TpmDashboardService,
  ],
  exports: [
    // Re-export sub-modules so consumers of TpmModule get full access
    TpmLocationsModule,
    TpmConfigServicesModule,

    // Services from this module
    TpmPlansService,
    TpmPlansIntervalService,
    TpmPlanApprovalService,
    TpmCardsService,
    TpmCardStatusService,
    TpmCardCascadeService,
    TpmCardDuplicateService,
    TpmSlotAssistantService,
    TpmScheduleProjectionService,
    TpmShiftAssignmentsService,
    TpmExecutionsService,
    TpmApprovalService,
    TpmNotificationService,
    TpmEscalationService,
    TpmSchedulingService,
    TpmDueDateCronService,
    TpmDashboardService,
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class TpmModule {}

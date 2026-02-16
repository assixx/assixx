/**
 * Vacation Module
 *
 * NestJS module for vacation request management.
 * Provides vacation request workflow, capacity analysis, holiday management,
 * entitlement tracking, blackout periods, and staffing rules.
 */
import { Module } from '@nestjs/common';

import { FeatureCheckModule } from '../feature-check/feature-check.module.js';
import { VacationApproverService } from './vacation-approver.service.js';
import { VacationBlackoutsService } from './vacation-blackouts.service.js';
import { VacationCapacityService } from './vacation-capacity.service.js';
import { VacationEntitlementsService } from './vacation-entitlements.service.js';
import { VacationHolidaysService } from './vacation-holidays.service.js';
import { VacationNotificationService } from './vacation-notification.service.js';
import { VacationPermissionRegistrar } from './vacation-permission.registrar.js';
import { VacationQueriesService } from './vacation-queries.service.js';
import { VacationSettingsService } from './vacation-settings.service.js';
import { VacationStaffingRulesService } from './vacation-staffing-rules.service.js';
import { VacationValidationService } from './vacation-validation.service.js';
import { VacationController } from './vacation.controller.js';
import { VacationService } from './vacation.service.js';

@Module({
  imports: [FeatureCheckModule],
  controllers: [VacationController],
  providers: [
    // Permission registration (ADR-020)
    VacationPermissionRegistrar,
    // Services (order: holidays → settings → entitlements → blackouts/staffing → capacity → validation → approver → core)
    VacationHolidaysService,
    VacationSettingsService,
    VacationEntitlementsService,
    VacationBlackoutsService,
    VacationStaffingRulesService,
    VacationCapacityService,
    VacationValidationService,
    VacationNotificationService,
    VacationApproverService,
    VacationService,
    VacationQueriesService,
  ],
  exports: [
    VacationHolidaysService,
    VacationSettingsService,
    VacationEntitlementsService,
    VacationBlackoutsService,
    VacationStaffingRulesService,
    VacationCapacityService,
    VacationValidationService,
    VacationNotificationService,
    VacationService,
    VacationQueriesService,
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class VacationModule {}

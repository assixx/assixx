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
import { TpmColorConfigService } from './tpm-color-config.service.js';
import { TpmPermissionRegistrar } from './tpm-permission.registrar.js';
import { TpmPlansIntervalService } from './tpm-plans-interval.service.js';
import { TpmPlansService } from './tpm-plans.service.js';
import { TpmTemplatesService } from './tpm-templates.service.js';
import { TpmTimeEstimatesService } from './tpm-time-estimates.service.js';

@Module({
  imports: [FeatureCheckModule],
  controllers: [],
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
  ],
  exports: [
    TpmPlansService,
    TpmPlansIntervalService,
    TpmTimeEstimatesService,
    TpmTemplatesService,
    TpmColorConfigService,
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class TpmModule {}

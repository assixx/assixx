/**
 * Approvals Module — Core Addon for Freigabe-System
 * @module approvals/approvals.module
 *
 * Core addon (is_core=true) — always active, no AddonGuard needed.
 * Provides approval config management and approval request lifecycle.
 */
import { Module } from '@nestjs/common';

import { ScopeModule } from '../hierarchy-permission/scope.module.js';
import { ApprovalsConfigService } from './approvals-config.service.js';
import { ApprovalsPermissionRegistrar } from './approvals-permission.registrar.js';
import { ApprovalsController } from './approvals.controller.js';
import { ApprovalsService } from './approvals.service.js';

@Module({
  imports: [ScopeModule],
  controllers: [ApprovalsController],
  providers: [
    ApprovalsPermissionRegistrar,
    ApprovalsConfigService,
    ApprovalsService,
  ],
  exports: [ApprovalsService, ApprovalsConfigService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module pattern
export class ApprovalsModule {}

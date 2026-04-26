/**
 * Dummy Users Module
 *
 * Anonymous display accounts for factory TVs and screens.
 * Admin-only CRUD. No feature gate.
 */
import { Module } from '@nestjs/common';

import { DomainsModule } from '../domains/domains.module.js';
import { RootModule } from '../root/root.module.js';
import { DummyUsersPermissionRegistrar } from './dummy-users-permission.registrar.js';
import { DummyUsersController } from './dummy-users.controller.js';
import { DummyUsersService } from './dummy-users.service.js';

@Module({
  // DomainsModule provides `TenantVerificationService` — required by
  // `DummyUsersService.create` to call `assertVerified(tenantId)` before
  // any user-creation (§2.9, §0.2.5 #1 KISS gate).
  // RootModule provides `RootProtectionService` — required by
  // `DummyUsersService.delete` for defensive Layer-2 wiring per
  // FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §2.3 (target.role is always
  // 'dummy' so the guard is inert in normal flow, but catches any future
  // role-drift bug).
  imports: [DomainsModule, RootModule],
  controllers: [DummyUsersController],
  providers: [DummyUsersService, DummyUsersPermissionRegistrar],
  exports: [DummyUsersService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class DummyUsersModule {}

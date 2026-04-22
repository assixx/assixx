/**
 * Shift Handover — Permission Registrar (ADR-020 extension).
 *
 * Appends the two shift-handover permission modules to the existing
 * `shift_planning` category owned by `ShiftsPermissionRegistrar`.
 *
 * Lifecycle rationale: `onApplicationBootstrap()` fires AFTER every
 * module's `onModuleInit()` hook, so the `shift_planning` category is
 * guaranteed registered by the time we extend it — no fragile
 * cross-module init-order assumption. If the category is missing at
 * bootstrap, the registry throws (fail-fast, visible in logs).
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2.7 + §Spec Deviation #2
 * @see docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md
 */
import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service.js';
import {
  SHIFT_HANDOVER_PERMISSION_MODULES,
  SHIFT_PLANNING_ADDON,
} from './shift-handover.permissions.js';

@Injectable()
export class ShiftHandoverPermissionRegistrar implements OnApplicationBootstrap {
  constructor(private readonly registry: PermissionRegistryService) {}

  onApplicationBootstrap(): void {
    this.registry.addModulesToCategory(SHIFT_PLANNING_ADDON, SHIFT_HANDOVER_PERMISSION_MODULES);
  }
}

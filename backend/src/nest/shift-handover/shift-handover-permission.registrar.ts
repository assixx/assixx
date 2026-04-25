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
 * Permission scope split (plan §2.7 — must stay traceable here):
 *  - `shift-handover-templates` carries `canRead`/`canWrite`/`canDelete`
 *    that all map 1:1 to controller endpoints (`GET`/`PUT`/`DELETE
 *    /shift-handover/templates/:teamId`).
 *  - `shift-handover-entries` also carries `canRead`/`canWrite`/`canDelete`,
 *    but `canDelete` here gates **only** the attachment-delete endpoint
 *    (`DELETE /shift-handover/entries/:id/attachments/:attId`). There is
 *    deliberately no `DELETE /shift-handover/entries/:id` route — entry
 *    rows are never deleted via API in V1; they are auto-locked to
 *    `submitted` and stay for audit. A Root admin who needs to purge a
 *    row goes through direct DB access, not this permission. The full
 *    module list lives in `shift-handover.permissions.ts`
 *    (`SHIFT_HANDOVER_PERMISSION_MODULES`); reviewers landing here while
 *    grepping for `canDelete` will find this paragraph first.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2.7 + §Spec Deviation #2
 * @see docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md
 * @see docs/infrastructure/adr/ADR-045-permission-visibility-design.md
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

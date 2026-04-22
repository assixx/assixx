/**
 * Shift Handover Module.
 *
 * Belongs to the `shift_planning` addon (ADR-033). Owns the templates,
 * entries, and attachments tables created in Phase 1 of the masterplan.
 *
 * This is the Phase-2.1 skeleton — services/controller land in Phases
 * 2.2–2.6. The permission registrar is wired now so the two new modules
 * (`shift-handover-templates`, `shift-handover-entries`) are available
 * as soon as the app boots.
 *
 * The global `PermissionRegistryModule` provides `PermissionRegistryService`
 * tenant-wide, so no explicit import is needed here (ADR-020 + global
 * `@Global()` registration in `app.module.ts`).
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2
 * @see docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md
 */
import { Module } from '@nestjs/common';

import { ActiveShiftResolverService } from './active-shift-resolver.service.js';
import { ShiftHandoverAttachmentsService } from './shift-handover-attachments.service.js';
import { ShiftHandoverEntriesService } from './shift-handover-entries.service.js';
import { ShiftHandoverPermissionRegistrar } from './shift-handover-permission.registrar.js';
import { ShiftHandoverTemplatesService } from './shift-handover-templates.service.js';
import { SHIFT_HANDOVER_CLOCK, type ShiftHandoverClock } from './shift-handover.tokens.js';

/**
 * Production binding for the injected clock token. Tests rebind this
 * provider with a fixed-instant factory so night-shift edge cases and
 * the 24 h auto-lock window become deterministic (plan §2.3 purity
 * contract extended to §2.5).
 */
const REAL_CLOCK: ShiftHandoverClock = () => new Date();

@Module({
  providers: [
    ShiftHandoverPermissionRegistrar,
    ShiftHandoverTemplatesService,
    ActiveShiftResolverService,
    ShiftHandoverAttachmentsService,
    ShiftHandoverEntriesService,
    { provide: SHIFT_HANDOVER_CLOCK, useValue: REAL_CLOCK },
  ],
  exports: [
    ShiftHandoverTemplatesService,
    ActiveShiftResolverService,
    ShiftHandoverAttachmentsService,
    ShiftHandoverEntriesService,
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is the standard pattern (matches PermissionRegistryModule, AppModule, and the rest of the nest/ tree)
export class ShiftHandoverModule {}

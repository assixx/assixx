/**
 * Shift Handover — Internal Types.
 *
 * Row shapes mirror DB columns (snake_case) for 1:1 fidelity with the
 * three tables created in Phase 1 (templates, entries, attachments).
 * Domain-facing types (ActiveShiftContext) use camelCase.
 *
 * `ShiftHandoverSlot` is the V1 whitelist for `shift_key` — plan §R13
 * locked it to {early, late, night} until the V2 relaxation.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §1 (migrations) + §2.1
 */
import type { ShiftHandoverFieldDef } from '@assixx/shared/shift-handover';

/** V1 shift-key whitelist (mirrors DB CHECK on `shift_handover_entries.shift_key`). */
export const SHIFT_HANDOVER_SLOTS = ['early', 'late', 'night'] as const;
export type ShiftHandoverSlot = (typeof SHIFT_HANDOVER_SLOTS)[number];

/** Entry status machine (mirrors `shift_handover_status` ENUM). */
export const SHIFT_HANDOVER_ENTRY_STATUSES = ['draft', 'submitted', 'reopened'] as const;
export type ShiftHandoverEntryStatus = (typeof SHIFT_HANDOVER_ENTRY_STATUSES)[number];

/** Row shape for `shift_handover_templates` — snake_case preserves DB fidelity. */
export interface ShiftHandoverTemplateRow {
  id: string;
  tenant_id: number;
  team_id: number;
  fields: ShiftHandoverFieldDef[];
  is_active: number;
  created_at: Date;
  updated_at: Date;
  created_by: number | null;
  updated_by: number | null;
}

/** Row shape for `shift_handover_entries`. */
export interface ShiftHandoverEntryRow {
  id: string;
  tenant_id: number;
  team_id: number;
  shift_date: Date;
  shift_key: ShiftHandoverSlot;
  protocol_text: string;
  custom_values: Record<string, unknown>;
  schema_snapshot: ShiftHandoverFieldDef[];
  status: ShiftHandoverEntryStatus;
  submitted_at: Date | null;
  submitted_by: number | null;
  reopened_at: Date | null;
  reopened_by: number | null;
  reopen_reason: string | null;
  is_active: number;
  created_at: Date;
  updated_at: Date;
  created_by: number;
  updated_by: number | null;
}

/** Row shape for `shift_handover_attachments`. */
export interface ShiftHandoverAttachmentRow {
  id: string;
  tenant_id: number;
  entry_id: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  sort_order: number;
  caption: string | null;
  is_active: number;
  created_at: Date;
  created_by: number;
}

/**
 * Context injected into the active-shift resolver (Phase 2.3).
 * All time inputs are parameters — services MUST NOT call `Date.now()`
 * directly; tests substitute a fixed `nowUtc`.
 */
export interface ActiveShiftContext {
  tenantId: number;
  userId: number;
  teamId: number;
  shiftDate: Date;
  shiftKey: ShiftHandoverSlot;
  nowUtc: Date;
}

/**
 * Attachment upload limits (plan §2.4, §1.3). Exported so §2.6 controller's
 * `FileInterceptor({ limits: { fileSize: … } })` and the service's
 * defense-in-depth validation can reference one source of truth (mirrors
 * `inventory.types.ts` `MAX_PHOTO_FILE_SIZE` pattern).
 *
 * The 5-attachment cap is deliberately NOT a DB CHECK on
 * `shift_handover_attachments` (plan §1.3 note — "soft-limit room for
 * future tenant-configurability"), so the service enforces it.
 *
 * The MIME whitelist is stricter than Inventory (which has none) because
 * Phase-5 frontend renders inline images; only browser-safe formats are
 * permitted.
 */
export const SHIFT_HANDOVER_MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5 MB
export const SHIFT_HANDOVER_MAX_ATTACHMENTS_PER_ENTRY = 5;
export const SHIFT_HANDOVER_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;
export type ShiftHandoverAllowedMimeType = (typeof SHIFT_HANDOVER_ALLOWED_MIME_TYPES)[number];

/**
 * TPM-/Blackboard-style `/my-permissions` response shape (plan §2.6).
 *
 * Layer-2 permissions only (ADR-045). Frontend computes the Layer-1
 * `canManage` flag locally from `role + hasFullAccess + orgScope.isAnyLead`
 * which are already loaded via SvelteKit layout data — keeping one source
 * of truth per gate layer.
 *
 * Spec deviation (recorded in plan changelog): the plan's literal shape
 * `{canManageTemplates, canWriteForToday}` is reshaped into this canonical
 * TPM pattern because (a) `canWriteForToday` is a runtime per-slot check
 * that belongs on the draft-create path, not a static permission flag;
 * (b) `canManageTemplates` duplicates layout-data state and would drift.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2.6
 * @see docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md
 * @see docs/infrastructure/adr/ADR-045-permission-visibility-design.md
 */
export interface ShiftHandoverModulePermissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

export interface ShiftHandoverMyPermissions {
  templates: ShiftHandoverModulePermissions;
  entries: ShiftHandoverModulePermissions;
}

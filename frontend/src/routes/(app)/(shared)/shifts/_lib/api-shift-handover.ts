/**
 * Shift Handover — Browser API client wrappers.
 *
 * Thin `apiClient`-backed helpers for the 9 backend endpoints defined in
 * `backend/src/nest/shift-handover/shift-handover.controller.ts`. Kept
 * co-located with the shifts route because Phase-5 §5.1 lives inside the
 * existing shift grid; the template-config page (§5.2) will add its own
 * barrel in a sibling `_lib/` next session.
 *
 * Browser-only — MUST NOT be imported from `+page.server.ts` (no runtime).
 * SSR callers use `apiFetch` via `$lib/server/api-fetch` instead
 * (HOW-TO-INTEGRATE-FEATURE §3.2).
 *
 * All responses are raw data per ADR-007 — `apiClient` unwraps
 * `{ success, data }` internally.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §5.1 §5.2
 * @see docs/infrastructure/adr/ADR-007-api-response-standardization.md
 */
import { apiClient } from '$lib/utils/api-client';

import type { HandoverSlot } from './shift-handover-types';
import type { ShiftHandoverFieldDef } from '@assixx/shared/shift-handover';

// ── Shared row shapes (mirror backend types, camelCase not applicable — ADR-007
// keeps snake_case for DB-row pass-through) ─────────────────────────────────

export interface ShiftHandoverTemplateResponse {
  id?: string;
  team_id: number;
  fields: ShiftHandoverFieldDef[];
}

export interface ShiftHandoverEntry {
  id: string;
  tenant_id: number;
  team_id: number;
  shift_date: string;
  shift_key: HandoverSlot;
  protocol_text: string;
  custom_values: Record<string, unknown>;
  schema_snapshot: ShiftHandoverFieldDef[];
  status: 'draft' | 'submitted' | 'reopened';
  submitted_at: string | null;
  submitted_by: number | null;
  reopened_at: string | null;
  reopened_by: number | null;
  reopen_reason: string | null;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number | null;
}

export interface ShiftHandoverAttachment {
  id: string;
  entry_id: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  sort_order: number;
  caption: string | null;
  created_at: string;
  created_by: number;
}

/**
 * `GET /shift-handover/entries/:id` response. Plain entry plus the embedded
 * attachment list AND the denormalised author display name — backend returns
 * them inline (Inventory pattern). `created_by_name` shows "who had the shift"
 * in the meta block; backend builds it from `users.first_name + last_name`
 * with `email` as fallback (Session 24, resolves the Session-18 Known
 * Limitation about no-assignee-display).
 *
 * Mutations (`POST` / `PATCH` / `submit` / `reopen`) intentionally return the
 * bare `ShiftHandoverEntry` because their callers immediately `goto('/shifts')`
 * and do not render attachments or the author chip — pulling them on every
 * write would be wasted I/O. Mirrors backend `ShiftHandoverEntryWithAttachments`.
 */
export interface ShiftHandoverEntryWithAttachments extends ShiftHandoverEntry {
  attachments: ShiftHandoverAttachment[];
  created_by_name: string | null;
}

export interface ShiftHandoverMyPermissions {
  templates: { canRead: boolean; canWrite: boolean; canDelete: boolean };
  entries: { canRead: boolean; canWrite: boolean; canDelete: boolean };
}

export interface ListEntriesResponse {
  items: ShiftHandoverEntry[];
  total: number;
  page: number;
  limit: number;
}

// ── Templates ────────────────────────────────────────────────────────────────

export async function getTemplate(teamId: number): Promise<ShiftHandoverTemplateResponse> {
  return await apiClient.get<ShiftHandoverTemplateResponse>(`/shift-handover/templates/${teamId}`, {
    skipCache: true,
  });
}

// ── Entries ──────────────────────────────────────────────────────────────────

/**
 * Idempotent: returns existing draft for `(teamId, shiftDate, shiftKey)` or
 * creates one. Backend enforces assignee + write-window checks (plan §2.5).
 */
export async function getOrCreateDraft(
  teamId: number,
  shiftDate: string,
  shiftKey: HandoverSlot,
): Promise<ShiftHandoverEntry> {
  return await apiClient.post<ShiftHandoverEntry>('/shift-handover/entries', {
    teamId,
    shiftDate,
    shiftKey,
  });
}

export async function getEntry(entryId: string): Promise<ShiftHandoverEntryWithAttachments> {
  return await apiClient.get<ShiftHandoverEntryWithAttachments>(
    `/shift-handover/entries/${entryId}`,
    {
      skipCache: true,
    },
  );
}

/** List entries for a team within an optional date range (used for grid button status). */
export async function listEntries(params: {
  teamId: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}): Promise<ListEntriesResponse> {
  const qs = new URLSearchParams();
  qs.set('teamId', String(params.teamId));
  if (params.dateFrom !== undefined) qs.set('dateFrom', params.dateFrom);
  if (params.dateTo !== undefined) qs.set('dateTo', params.dateTo);
  qs.set('limit', String(params.limit ?? 100));
  return await apiClient.get<ListEntriesResponse>(`/shift-handover/entries?${qs.toString()}`, {
    skipCache: true,
  });
}

export async function updateEntry(
  entryId: string,
  payload: { protocolText?: string; customValues?: Record<string, unknown> },
): Promise<ShiftHandoverEntry> {
  return await apiClient.patch<ShiftHandoverEntry>(`/shift-handover/entries/${entryId}`, payload);
}

export async function submitEntry(entryId: string): Promise<ShiftHandoverEntry> {
  return await apiClient.post<ShiftHandoverEntry>(`/shift-handover/entries/${entryId}/submit`);
}

export async function reopenEntry(entryId: string, reason: string): Promise<ShiftHandoverEntry> {
  return await apiClient.post<ShiftHandoverEntry>(`/shift-handover/entries/${entryId}/reopen`, {
    reason,
  });
}

// ── Attachments ──────────────────────────────────────────────────────────────

export async function uploadAttachment(
  entryId: string,
  file: File,
): Promise<ShiftHandoverAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  return await apiClient.post<ShiftHandoverAttachment>(
    `/shift-handover/entries/${entryId}/attachments`,
    formData,
  );
}

export async function deleteAttachment(entryId: string, attachmentId: string): Promise<void> {
  await apiClient.delete(`/shift-handover/entries/${entryId}/attachments/${attachmentId}`);
}

/**
 * Streaming URL for `<img src={...}>`. The browser sends the session cookie
 * automatically; the backend enforces same-team scope per request.
 */
export function attachmentUrl(entryId: string, attachmentId: string): string {
  return `/api/v2/shift-handover/entries/${entryId}/attachments/${attachmentId}`;
}

// ── My permissions ───────────────────────────────────────────────────────────

export async function getMyPermissions(): Promise<ShiftHandoverMyPermissions> {
  return await apiClient.get<ShiftHandoverMyPermissions>('/shift-handover/my-permissions', {
    skipCache: true,
  });
}

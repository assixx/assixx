/**
 * Shift-Handover Templates — Browser API client wrappers.
 *
 * Browser-only — MUST NOT be imported from `+page.server.ts` (no runtime).
 * SSR callers use `apiFetch` via `$lib/server/api-fetch` instead
 * (HOW-TO-INTEGRATE-FEATURE §3.2).
 *
 * Backend endpoints (controller §2.6):
 *   - GET    /shift-handover/templates/:teamId
 *   - PUT    /shift-handover/templates/:teamId   { fields }
 *   - DELETE /shift-handover/templates/:teamId   → 204
 *
 * Self-contained: keeps the response shape locally (1 interface) instead of
 * importing from `../../shifts/_lib/api-shift-handover` to avoid cross-route
 * `_lib` coupling. The shared field type lives in `@assixx/shared/shift-handover`.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §5.2
 * @see docs/infrastructure/adr/ADR-007-api-response-standardization.md
 */
import { apiClient } from '$lib/utils/api-client';

import type { ShiftHandoverFieldDef } from '@assixx/shared/shift-handover';

/**
 * Server returns either the persisted row or a placeholder `{ team_id, fields: [] }`
 * for teams without a configured template (controller §2.6 line 149–168).
 */
export interface ShiftHandoverTemplateResponse {
  id?: string;
  team_id: number;
  fields: ShiftHandoverFieldDef[];
}

export async function getTemplate(teamId: number): Promise<ShiftHandoverTemplateResponse> {
  return await apiClient.get<ShiftHandoverTemplateResponse>(`/shift-handover/templates/${teamId}`, {
    skipCache: true,
  });
}

export async function upsertTemplate(
  teamId: number,
  fields: ShiftHandoverFieldDef[],
): Promise<ShiftHandoverTemplateResponse> {
  return await apiClient.put<ShiftHandoverTemplateResponse>(`/shift-handover/templates/${teamId}`, {
    fields,
  });
}

export async function deleteTemplate(teamId: number): Promise<void> {
  await apiClient.delete(`/shift-handover/templates/${teamId}`);
}

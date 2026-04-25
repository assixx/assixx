/**
 * Write-Endpoint Payload Builders for Load Tests
 *
 * Generates minimal valid POST bodies matching the production Zod DTOs
 * (CreateEntryDto, …). Bodies are deliberately tagged with a per-run-id
 * prefix in the title so accumulated test rows can be cleaned up via:
 *
 *   docker exec assixx-postgres psql -U assixx_user -d assixx -c \
 *     "DELETE FROM blackboard_entries WHERE title LIKE 'LOAD-%';"
 *
 * Why a separate file?
 *   - Single source of truth for write payloads — multiple load tests
 *     (baseline, soak, write-stress) share the same shape, so DTO drift
 *     is caught in one place.
 *   - Run-id tagging works for any test that imports it.
 *
 * DTO references (verified 2026-04-25):
 *   - CreateEntrySchema: backend/src/nest/blackboard/dto/create-entry.dto.ts
 *     `title` 1-200 chars, `content` 1-5000 chars; rest optional.
 *
 * KVP intentionally excluded — CreateSuggestionSchema requires the creator
 * to be in `user_teams` (team auto-assignment), which is environment-
 * dependent. Add when test-tenant always seeds team membership.
 */

/**
 * Build a unique run-id of the form `LOAD-YYYYMMDD-HHmmss-<random>`.
 * Stamped into every write payload's title so post-run cleanup is a
 * one-liner SQL `WHERE title LIKE 'LOAD-%'`.
 */
export function makeRunId(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  const ts = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  // 5-char random suffix → distinguishes parallel runs (same minute) without
  // pulling in a UUID dependency. Math.random in goja is fine for tagging.
  const rand = Math.random().toString(36).slice(2, 7);
  return `LOAD-${ts}-${rand}`;
}

export interface BlackboardEntryPayload {
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

/**
 * Build a minimal CreateEntryDto-valid blackboard entry. Tag the title
 * with the run-id and an iteration-count so even at 250 VU × 5min the
 * resulting rows are individually traceable.
 *
 * `orgLevel`/`orgId`/`departmentIds`/`teamIds` deliberately omitted —
 * CreateEntrySchema treats them as optional and the controller's default
 * targets the tenant-wide audience, which is the most expensive RLS path
 * (touches `blackboard_entry_organizations` materialization).
 */
export function blackboardEntry(runId: string, vuId: number, iter: number): BlackboardEntryPayload {
  return {
    title: `${runId} vu${vuId} iter${iter}`,
    content: `Synthetic load-test entry. Generated ${new Date().toISOString()}. Safe to delete via "DELETE FROM blackboard_entries WHERE title LIKE 'LOAD-%'".`,
    priority: 'low',
  };
}

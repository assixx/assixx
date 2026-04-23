/**
 * Global teardown for API integration tests.
 *
 * Cleans transient test data for the apitest tenant AFTER tests run.
 * Prevents stale data accumulation across repeated test runs
 * (e.g. chat messages, E2E keys, conversations piling up).
 *
 * WHITELIST approach: Only cleans tables that actually accumulate
 * across test runs. Seed/config data (tenant_addons, vacation_settings,
 * vacation_entitlements, etc.) is deliberately preserved.
 *
 * Dummy users (role='dummy') are hard-deleted after the table cleanup.
 * CASCADE FKs auto-clean user_addon_permissions, addon_visits, etc.
 *
 * Runs via `docker exec` against the real PostgreSQL container.
 */
import { execSync } from 'node:child_process';

/**
 * Tables that accumulate transient data across test runs.
 * Order: children first, parents last (FK dependency safe).
 *
 * Add new tables here when tests start failing due to stale data.
 */
const TRANSIENT_TABLES = [
  // Chat: messages pile up in reused 1:1 conversations
  'chat_messages',
  'chat_scheduled_messages',
  'chat_conversation_participants',
  'chat_conversations',

  // E2E encryption: key versions increment on every test run
  'e2e_key_escrow',
  'e2e_user_keys',

  // Notifications: accumulate from feature tests
  'notification_read_status',
  'notifications',

  // Blackboard: entries + children accumulate from blackboard API tests
  // Order: confirmations → comments → entries (FK CASCADE exists, but explicit is safer)
  'blackboard_confirmations',
  'blackboard_comments',
  'blackboard_entries',

  // Audit/Logs: grow on every run (partitioned tables — DELETE routes to correct partitions)
  'audit_trail',
  'root_logs',
  'deletion_audit_trail',
  'admin_logs',
  'admin_permission_logs',

  // Refresh tokens: created on every login
  'refresh_tokens',

  // Vacation: requests + children accumulate from vacation API tests
  // Order: status_log → requests → staffing_rules → holidays → blackouts
  'vacation_request_status_log',
  'vacation_requests',
  'vacation_staffing_rules',
  'vacation_holidays',
  'vacation_blackouts',

  // TPM: plans, cards, executions accumulate across test runs
  // Order: deepest children first (execution_photos → executions → cards → rest)
  'tpm_card_execution_photos',
  'tpm_card_executions',
  'tpm_time_estimates',
  'tpm_cards',
  'tpm_maintenance_plans',

  // Work Orders: photos → comments → assignees → work_orders (FK CASCADE safe)
  'work_order_photos',
  'work_order_comments',
  'work_order_assignees',
  'work_orders',

  // Organigram: layout positions (no FK to org entities, safe to delete first)
  'org_chart_positions',

  // Halls: created by halls API tests, no FK children
  'halls',

  // Shifts: RESTRICT FK into departments — MUST delete before departments.
  // Order: shift_swap_requests (RESTRICT → shifts) → shifts (CASCADE handles
  // shift_assignments children). Shift-handover feature (2026-04) started
  // writing real shift rows for apitest, which surfaced the blocker the
  // prior teardown comment anticipated.
  'shift_swap_requests',
  'shifts',

  // Document permissions: RESTRICT FK into both departments AND teams —
  // MUST delete before either. Currently 0 rows for apitest but listed
  // defensively so future document-scope tests don't re-break teardown.
  'document_permissions',

  // Org structure: departments, teams, assets accumulate ~2-3 rows/run.
  // Order: assets first (tpm_cards already cleaned above), then teams
  // (FK CASCADE handles user_teams, asset_teams, etc.), then departments last.
  // Seed data from 00-auth.api.test.ts is auto-recreated via WHERE NOT EXISTS.
  'assets',
  'teams',
  'departments',

  // Inventory: photos → custom_values → custom_fields → items → lists (FK CASCADE safe)
  'inventory_item_photos',
  'inventory_custom_values',
  'inventory_custom_fields',
  'inventory_items',
  'inventory_lists',

  // Organigram: user→position assignments. Table has NO is_active, so UNIQUE
  // (tenant_id, user_id, position_id) blocks re-runs of organigram.api.test.ts
  // once the same user is re-assigned to the same position. Hard-delete is
  // the only viable cleanup (partial-unique-index wouldn't apply).
  'user_positions',

  // tenant_domains is intentionally NOT in this list — it needs a filtered
  // DELETE (WHERE is_primary = false) to preserve the seed apitest.de row.
  // See the dedicated statement in CLEANUP_SQL below.
] as const;

const CLEANUP_SQL = `
DO $$
DECLARE
  _tenant_id integer;
  _tbl text;
  _tables text[] := ARRAY[${TRANSIENT_TABLES.map((t) => `'${t}'`).join(', ')}];
  _deleted bigint;
  _total bigint := 0;
BEGIN
  SELECT id INTO _tenant_id FROM tenants WHERE subdomain = 'apitest';
  IF _tenant_id IS NULL THEN
    RAISE NOTICE 'apitest tenant not found — skipping cleanup';
    RETURN;
  END IF;

  FOREACH _tbl IN ARRAY _tables LOOP
    EXECUTE format('DELETE FROM %I WHERE tenant_id = $1', _tbl) USING _tenant_id;
    GET DIAGNOSTICS _deleted = ROW_COUNT;
    _total := _total + _deleted;
  END LOOP;

  -- Dummy users: soft-deleted by tests but rows stay forever.
  -- CASCADE FKs auto-clean user_addon_permissions, addon_visits, etc.
  DELETE FROM users WHERE tenant_id = _tenant_id AND role = 'dummy';
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  _total := _total + _deleted;

  -- Tenant domains: preserve the seed primary (is_primary=true, e.g. apitest.de).
  -- Backend blocks POST /users + /dummy-users with 403 if the tenant has no
  -- verified primary domain (feat: add tenant domain as subdomain). Clean only
  -- non-primary rows — active test-created and soft-deleted phase4 debris.
  DELETE FROM tenant_domains WHERE tenant_id = _tenant_id AND is_primary = false;
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  _total := _total + _deleted;

  -- NOTE (2026-04-23): Accumulating role=admin/employee test users
  -- (esp. perm-api-test-{timestamp}@apitest.de from user-permissions tests,
  -- currently ~140 rows) are NOT cleaned here. Reason: 27 tables hold
  -- RESTRICT FKs into users (password_reset_tokens, admin_logs, addon_usage_logs,
  -- audit_trail children, etc.). Hard-deleting users would trip at least one
  -- of them, and the list grows with every new feature module. Tests stay
  -- correct because emails are unique (timestamp-based), so no UNIQUE collision
  -- — it's pure storage bloat, not a correctness bug. A dedicated cleanup ADR
  -- with per-FK strategy is the right way to address this; out of scope here.
  -- See docs/how-to/HOW-TO-CREATE-TEST-USER.md for the intended baseline
  -- (admin@apitest.de + employee@apitest.de).

  RAISE NOTICE 'apitest tenant (id=%): cleaned % rows (% from % tables + % dummy users)',
    _tenant_id, _total, _total - _deleted, array_length(_tables, 1), _deleted;
END $$;
`;

/**
 * Vitest globalTeardown hook — runs once after all API tests.
 * Cleans transient test data so the DB stays lean between runs.
 *
 * Failures MUST be loud: silently swallowing them (the previous behaviour) lets
 * stale rows accumulate across runs, which then trip UNIQUE constraints and
 * makes the next run fail in a way that looks like a product bug — wasting
 * hours of debugging. See docs/DATABASE-MIGRATION-GUIDE.md "Migration Quality
 * Standards → Required Patterns → FAIL LOUD" for the project-wide posture.
 */
export function teardown(): void {
  try {
    execSync('docker exec -i assixx-postgres psql -U assixx_user -d assixx -v ON_ERROR_STOP=1', {
      input: CLEANUP_SQL,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30_000,
    });
  } catch (error: unknown) {
    const stderr = error instanceof Error && 'stderr' in error ? String(error.stderr) : '';
    console.error('[global-teardown] Tenant cleanup FAILED — next run will start dirty');
    if (stderr !== '') console.error(stderr);
    throw error;
  }
}

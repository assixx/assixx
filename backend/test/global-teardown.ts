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

  // Org structure: departments, teams, assets accumulate ~2-3 rows/run.
  // Order: assets first (tpm_cards already cleaned above), then teams
  // (FK CASCADE handles user_teams, asset_teams, etc.), then departments last.
  // RESTRICT FKs: shifts + document_permissions reference departments/teams
  // with RESTRICT — currently 0 rows for apitest tenant, but if they ever
  // accumulate, add them BEFORE these three tables.
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

  RAISE NOTICE 'apitest tenant (id=%): cleaned % rows (% from % tables + % dummy users)',
    _tenant_id, _total, _total - _deleted, array_length(_tables, 1), _deleted;
END $$;
`;

/**
 * Vitest globalTeardown hook — runs once after all API tests.
 * Cleans transient test data so the DB stays lean between runs.
 */
export function teardown(): void {
  try {
    execSync('docker exec -i assixx-postgres psql -U assixx_user -d assixx', {
      input: CLEANUP_SQL,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30_000,
    });
  } catch {
    console.warn('[global-teardown] Tenant cleanup failed — data will be cleaned on next run');
  }
}

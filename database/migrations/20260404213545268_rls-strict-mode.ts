/**
 * Migration: RLS Strict Mode
 *
 * Purpose: Remove the bypass clause from all RLS policies so queries WITHOUT
 * set_config('app.tenant_id') return 0 rows instead of all rows.
 *
 * Before: NULLIF(...) IS NULL OR tenant_id = NULLIF(...)::integer  → allows all when unset
 * After:  tenant_id = NULLIF(...)::integer                         → blocks when unset
 *
 * Also: GRANT to sys_user (BYPASSRLS role for cron/auth/root operations)
 * Also: Fix documents.chat_participant_isolation PERMISSIVE → RESTRICTIVE
 */
import type { MigrationBuilder } from 'node-pg-migrate';

// ============================================================================
// Standard tenant_isolation tables (tenant_id = ...)
// ============================================================================
const STANDARD_TABLES = [
  'addon_usage_logs',
  'addon_visits',
  'admin_area_permissions',
  'admin_department_permissions',
  'admin_logs',
  'admin_permission_logs',
  'api_keys',
  'approval_configs',
  'approval_read_status',
  'approvals',
  'areas',
  'asset_availability',
  'asset_documents',
  'asset_maintenance_history',
  'asset_metrics',
  'asset_teams',
  'assets',
  'audit_trail',
  'blackboard_comments',
  'blackboard_confirmations',
  'blackboard_entries',
  'calendar_attendees',
  'calendar_events',
  'calendar_recurring_patterns',
  'chat_conversation_participants',
  'chat_messages',
  'chat_scheduled_messages',
  'deletion_audit_trail',
  'deletion_dry_run_reports',
  'department_halls',
  'departments',
  'document_permissions',
  'document_read_status',
  'e2e_key_escrow',
  'e2e_user_keys',
  'halls',
  'kvp_categories_custom',
  'kvp_comments',
  'kvp_confirmations',
  'kvp_reward_tiers',
  'kvp_suggestions',
  'kvp_votes',
  'legal_holds',
  'notification_preferences',
  'notification_read_status',
  'notifications',
  'oauth_tokens',
  'org_chart_positions',
  'payment_history',
  'position_catalog',
  'refresh_tokens',
  'root_logs',
  'shift_assignments',
  'shift_favorites',
  'shift_plans',
  'shift_rotation_assignments',
  'shift_rotation_history',
  'shift_rotation_patterns',
  'shift_swap_requests',
  'shift_times',
  'shifts',
  'survey_answers',
  'survey_assignments',
  'survey_comments',
  'survey_participants',
  'survey_question_options',
  'survey_questions',
  'survey_reminders',
  'survey_responses',
  'survey_templates',
  'surveys',
  'team_halls',
  'teams',
  'tenant_data_exports',
  'tenant_deletion_backups',
  'tenant_deletion_queue',
  'tenant_settings',
  'tenant_subscriptions',
  'tenant_webhooks',
  'tpm_card_execution_photos',
  'tpm_card_executions',
  'tpm_cards',
  'tpm_color_config',
  'tpm_defect_photos',
  'tpm_escalation_config',
  'tpm_execution_defects',
  'tpm_execution_participants',
  'tpm_locations',
  'tpm_maintenance_plans',
  'tpm_plan_assignments',
  'tpm_plan_revisions',
  'tpm_scheduled_dates',
  'tpm_time_estimates',
  'usage_quotas',
  'user_addon_permissions',
  'user_availability',
  'user_departments',
  'user_positions',
  'user_settings',
  'user_teams',
  'users',
  'vacation_blackout_scopes',
  'vacation_blackouts',
  'vacation_entitlements',
  'vacation_holidays',
  'vacation_request_status_log',
  'vacation_requests',
  'vacation_settings',
  'vacation_staffing_rules',
  'work_order_assignees',
  'work_order_comments',
  'work_order_photos',
  'work_order_read_status',
  'work_orders',
] as const;

const STRICT_USING = `(tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)`;

const BYPASS_USING = `(NULLIF(current_setting('app.tenant_id', true), '') IS NULL OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)`;

export function up(pgm: MigrationBuilder): void {
  // ================================================================
  // 1. GRANT sys_user on all tables + sequences
  // ================================================================
  pgm.sql(`
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sys_user;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sys_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sys_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sys_user;
  `);

  // ================================================================
  // 2. Update standard tenant_isolation policies → strict
  // ================================================================
  for (const table of STANDARD_TABLES) {
    // vacation_blackout_scopes has a special policy (subquery-based)
    if (table === 'vacation_blackout_scopes') continue;

    pgm.sql(`
      DROP POLICY IF EXISTS tenant_isolation ON ${table};
      CREATE POLICY tenant_isolation ON ${table}
        FOR ALL USING ${STRICT_USING};
    `);
  }

  // ================================================================
  // 3. Special policies
  // ================================================================

  // tenants: uses id instead of tenant_id
  pgm.sql(`
    DROP POLICY IF EXISTS tenant_self_isolation ON tenants;
    CREATE POLICY tenant_self_isolation ON tenants
      FOR ALL USING (id = NULLIF(current_setting('app.tenant_id', true), '')::integer);
  `);

  // tenant_addons: non-standard name
  pgm.sql(`
    DROP POLICY IF EXISTS tenant_addons_isolation ON tenant_addons;
    CREATE POLICY tenant_addons_isolation ON tenant_addons
      FOR ALL USING ${STRICT_USING};
  `);

  // tenant_storage: non-standard name
  pgm.sql(`
    DROP POLICY IF EXISTS tenant_storage_isolation ON tenant_storage;
    CREATE POLICY tenant_storage_isolation ON tenant_storage
      FOR ALL USING ${STRICT_USING};
  `);

  // vacation_blackout_scopes: subquery-based (no direct tenant_id)
  pgm.sql(`
    DROP POLICY IF EXISTS tenant_isolation ON vacation_blackout_scopes;
    CREATE POLICY tenant_isolation ON vacation_blackout_scopes
      FOR ALL USING (
        blackout_id IN (
          SELECT id FROM vacation_blackouts
          WHERE tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        )
      );
  `);

  // chat_conversations: per-command policies
  pgm.sql(`
    DROP POLICY IF EXISTS chat_conversations_select ON chat_conversations;
    DROP POLICY IF EXISTS chat_conversations_update ON chat_conversations;
    DROP POLICY IF EXISTS chat_conversations_delete ON chat_conversations;

    CREATE POLICY chat_conversations_select ON chat_conversations
      FOR SELECT USING ${STRICT_USING};
    CREATE POLICY chat_conversations_update ON chat_conversations
      FOR UPDATE USING ${STRICT_USING};
    CREATE POLICY chat_conversations_delete ON chat_conversations
      FOR DELETE USING ${STRICT_USING};
  `);
  // chat_conversations_insert stays as-is (WITH CHECK (true))

  // chat_messages.participant_isolation: strict user-level
  pgm.sql(`
    DROP POLICY IF EXISTS participant_isolation ON chat_messages;
    CREATE POLICY participant_isolation ON chat_messages AS RESTRICTIVE
      FOR ALL USING (
        NULLIF(current_setting('app.user_id', true), '') IS NULL
        OR EXISTS (
          SELECT 1 FROM chat_conversation_participants cp
          WHERE cp.conversation_id = chat_messages.conversation_id
            AND cp.user_id = NULLIF(current_setting('app.user_id', true), '')::integer
            AND cp.tenant_id = chat_messages.tenant_id
        )
      );
  `);

  // ================================================================
  // 4. Fix documents.chat_participant_isolation: PERMISSIVE → RESTRICTIVE
  // ================================================================
  pgm.sql(`
    DROP POLICY IF EXISTS chat_participant_isolation ON documents;
    CREATE POLICY chat_participant_isolation ON documents AS RESTRICTIVE
      FOR ALL USING (
        access_scope <> 'chat'
        OR (
          NULLIF(current_setting('app.user_id', true), '') IS NULL
          OR (conversation_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM chat_conversation_participants cp
            WHERE cp.conversation_id = documents.conversation_id
              AND cp.user_id = NULLIF(current_setting('app.user_id', true), '')::integer
              AND cp.tenant_id = documents.tenant_id
          ))
        )
      );
  `);
}

export function down(pgm: MigrationBuilder): void {
  // ================================================================
  // 1. Restore bypass clause on standard tables
  // ================================================================
  for (const table of STANDARD_TABLES) {
    if (table === 'vacation_blackout_scopes') continue;

    pgm.sql(`
      DROP POLICY IF EXISTS tenant_isolation ON ${table};
      CREATE POLICY tenant_isolation ON ${table}
        FOR ALL USING ${BYPASS_USING};
    `);
  }

  // ================================================================
  // 2. Restore special policies with bypass
  // ================================================================

  pgm.sql(`
    DROP POLICY IF EXISTS tenant_self_isolation ON tenants;
    CREATE POLICY tenant_self_isolation ON tenants
      FOR ALL USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );
  `);

  pgm.sql(`
    DROP POLICY IF EXISTS tenant_addons_isolation ON tenant_addons;
    CREATE POLICY tenant_addons_isolation ON tenant_addons
      FOR ALL USING ${BYPASS_USING};
  `);

  pgm.sql(`
    DROP POLICY IF EXISTS tenant_storage_isolation ON tenant_storage;
    CREATE POLICY tenant_storage_isolation ON tenant_storage
      FOR ALL USING ${BYPASS_USING};
  `);

  pgm.sql(`
    DROP POLICY IF EXISTS tenant_isolation ON vacation_blackout_scopes;
    CREATE POLICY tenant_isolation ON vacation_blackout_scopes
      FOR ALL USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR blackout_id IN (
          SELECT id FROM vacation_blackouts
          WHERE tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        )
      );
  `);

  pgm.sql(`
    DROP POLICY IF EXISTS chat_conversations_select ON chat_conversations;
    DROP POLICY IF EXISTS chat_conversations_update ON chat_conversations;
    DROP POLICY IF EXISTS chat_conversations_delete ON chat_conversations;

    CREATE POLICY chat_conversations_select ON chat_conversations
      FOR SELECT USING ${BYPASS_USING};
    CREATE POLICY chat_conversations_update ON chat_conversations
      FOR UPDATE USING ${BYPASS_USING};
    CREATE POLICY chat_conversations_delete ON chat_conversations
      FOR DELETE USING ${BYPASS_USING};
  `);

  pgm.sql(`
    DROP POLICY IF EXISTS participant_isolation ON chat_messages;
    CREATE POLICY participant_isolation ON chat_messages AS RESTRICTIVE
      FOR ALL USING (
        NULLIF(current_setting('app.user_id', true), '') IS NULL
        OR EXISTS (
          SELECT 1 FROM chat_conversation_participants cp
          WHERE cp.conversation_id = chat_messages.conversation_id
            AND cp.user_id = NULLIF(current_setting('app.user_id', true), '')::integer
            AND cp.tenant_id = chat_messages.tenant_id
        )
      );
  `);

  // Restore documents.chat_participant_isolation as PERMISSIVE
  pgm.sql(`
    DROP POLICY IF EXISTS chat_participant_isolation ON documents;
    CREATE POLICY chat_participant_isolation ON documents
      FOR ALL USING (
        access_scope <> 'chat'
        OR (
          NULLIF(current_setting('app.user_id', true), '') IS NULL
          OR (conversation_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM chat_conversation_participants cp
            WHERE cp.conversation_id = documents.conversation_id
              AND cp.user_id = NULLIF(current_setting('app.user_id', true), '')::integer
              AND cp.tenant_id = documents.tenant_id
          ))
        )
      );
  `);

  // ================================================================
  // 3. Revoke sys_user grants (keep role, just remove table access)
  // ================================================================
  pgm.sql(`
    REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM sys_user;
    REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public FROM sys_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM sys_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE, SELECT ON SEQUENCES FROM sys_user;
  `);
}

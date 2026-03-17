/**
 * Migration: Fix problematic CASCADE constraints + rename legacy _ibfk_ names
 *
 * 1. Make 15 columns nullable (required for SET NULL foreign keys)
 * 2. Fix 23 dangerous CASCADE constraints (→ SET NULL or RESTRICT)
 * 3. Rename 109 legacy _ibfk_ constraint names to descriptive fk_ names
 *
 * WARNING: Lossy rollback. If SET NULL foreign keys have already fired
 * (users deleted after this migration), down() cannot restore the original
 * references and will fail on SET NOT NULL if NULL values exist.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

// ============================================================
// DATA
// ============================================================

interface FkChange {
  table: string;
  column: string;
  target: string;
  oldName: string;
  newName: string;
  newOnDelete: string;
  oldOnDelete: string;
  onUpdate: string;
  oldOnUpdate: string;
}

/** Columns that must become nullable for SET NULL foreign keys */
const NULLABLE_COLUMNS: [string, string][] = [
  ['admin_permission_logs', 'admin_user_id'],
  ['blackboard_comments', 'user_id'],
  ['blackboard_entries', 'author_id'],
  ['chat_messages', 'sender_id'],
  ['kvp_attachments', 'uploaded_by'],
  ['kvp_comments', 'user_id'],
  ['kvp_ratings', 'user_id'],
  ['kvp_status_history', 'changed_by'],
  ['kvp_suggestions', 'submitted_by'],
  ['shift_plans', 'created_by'],
  ['shift_rotation_history', 'user_id'],
  ['shifts', 'user_id'],
  ['survey_comments', 'user_id'],
  ['vacation_entitlements', 'user_id'],
  ['vacation_requests', 'requester_id'],
];

/** Constraints that need behavior change (CASCADE → SET NULL or RESTRICT) */
const BEHAVIOR_CHANGES: FkChange[] = [
  // --- CRITICAL: Business data survives user deletion ---
  {
    table: 'blackboard_entries',
    column: 'author_id',
    target: 'users(id)',
    oldName: 'blackboard_entries_ibfk_2',
    newName: 'fk_blackboard_entries_author',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'RESTRICT',
  },
  {
    table: 'documents',
    column: 'owner_user_id',
    target: 'users(id)',
    oldName: 'fk_documents_owner_user',
    newName: 'fk_documents_owner_user',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'CASCADE',
  },
  {
    table: 'kvp_suggestions',
    column: 'submitted_by',
    target: 'users(id)',
    oldName: 'kvp_suggestions_ibfk_3',
    newName: 'fk_kvp_suggestions_submitted_by',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'RESTRICT',
  },
  {
    table: 'shift_plans',
    column: 'created_by',
    target: 'users(id)',
    oldName: 'shift_plans_ibfk_4',
    newName: 'fk_shift_plans_created_by',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'RESTRICT',
  },

  // --- PROBLEMATIC: Context/history preserved ---
  {
    table: 'admin_permission_logs',
    column: 'admin_user_id',
    target: 'users(id)',
    oldName: 'admin_permission_logs_ibfk_2',
    newName: 'fk_admin_perm_logs_user',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'RESTRICT',
  },
  {
    table: 'blackboard_comments',
    column: 'user_id',
    target: 'users(id)',
    oldName: 'fk_blackboard_comments_user',
    newName: 'fk_blackboard_comments_user',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'RESTRICT',
  },
  {
    table: 'chat_messages',
    column: 'sender_id',
    target: 'users(id)',
    oldName: 'fk_chat_messages_sender',
    newName: 'fk_chat_messages_sender',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'RESTRICT',
  },
  {
    table: 'kvp_attachments',
    column: 'uploaded_by',
    target: 'users(id)',
    oldName: 'kvp_attachments_ibfk_2',
    newName: 'fk_kvp_attachments_uploaded_by',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'RESTRICT',
  },
  {
    table: 'kvp_comments',
    column: 'user_id',
    target: 'users(id)',
    oldName: 'kvp_comments_ibfk_2',
    newName: 'fk_kvp_comments_user',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'RESTRICT',
  },
  {
    table: 'kvp_ratings',
    column: 'user_id',
    target: 'users(id)',
    oldName: 'kvp_ratings_ibfk_2',
    newName: 'fk_kvp_ratings_user',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'RESTRICT',
  },
  {
    table: 'kvp_status_history',
    column: 'changed_by',
    target: 'users(id)',
    oldName: 'kvp_status_history_ibfk_2',
    newName: 'fk_kvp_status_history_changed_by',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'RESTRICT',
  },
  {
    table: 'shift_rotation_history',
    column: 'user_id',
    target: 'users(id)',
    oldName: 'fk_rotation_history_user',
    newName: 'fk_rotation_history_user',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'RESTRICT',
  },
  {
    table: 'shifts',
    column: 'user_id',
    target: 'users(id)',
    oldName: 'shifts_ibfk_2',
    newName: 'fk_shifts_user',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'RESTRICT',
  },
  {
    table: 'survey_comments',
    column: 'user_id',
    target: 'users(id)',
    oldName: 'survey_comments_ibfk_2',
    newName: 'fk_survey_comments_user',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'RESTRICT',
  },
  {
    table: 'vacation_entitlements',
    column: 'user_id',
    target: 'users(id)',
    oldName: 'vacation_entitlements_user_id_fkey',
    newName: 'fk_vacation_entitlements_user',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'NO ACTION',
  },
  {
    table: 'vacation_requests',
    column: 'requester_id',
    target: 'users(id)',
    oldName: 'vacation_requests_requester_id_fkey',
    newName: 'fk_vacation_requests_requester',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'NO ACTION',
  },

  // --- ORG STRUCTURE: Hierarchy survives deletion ---
  {
    table: 'survey_assignments',
    column: 'area_id',
    target: 'areas(id)',
    oldName: 'fk_survey_assignments_area',
    newName: 'fk_survey_assignments_area',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'RESTRICT',
  },
  {
    table: 'survey_assignments',
    column: 'department_id',
    target: 'departments(id)',
    oldName: 'survey_assignments_ibfk_2',
    newName: 'fk_survey_assignments_department',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'RESTRICT',
  },
  {
    table: 'survey_assignments',
    column: 'team_id',
    target: 'teams(id)',
    oldName: 'survey_assignments_ibfk_3',
    newName: 'fk_survey_assignments_team',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'RESTRICT',
  },
  {
    table: 'teams',
    column: 'department_id',
    target: 'departments(id)',
    oldName: 'teams_ibfk_2',
    newName: 'fk_teams_department',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'RESTRICT',
  },
  {
    table: 'user_settings',
    column: 'team_id',
    target: 'teams(id)',
    oldName: 'user_settings_team_fk',
    newName: 'fk_user_settings_team',
    newOnDelete: 'SET NULL',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'RESTRICT',
  },

  // --- ASSET PROTECTION: TPM data blocks asset deletion ---
  {
    table: 'tpm_cards',
    column: 'asset_id',
    target: 'assets(id)',
    oldName: 'fk_tpm_cards_asset',
    newName: 'fk_tpm_cards_asset',
    newOnDelete: 'RESTRICT',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'RESTRICT',
  },
  {
    table: 'tpm_maintenance_plans',
    column: 'asset_id',
    target: 'assets(id)',
    oldName: 'fk_tpm_plans_asset',
    newName: 'fk_tpm_plans_asset',
    newOnDelete: 'RESTRICT',
    oldOnDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    oldOnUpdate: 'RESTRICT',
  },
];

/** Pure renames: _ibfk_ → descriptive fk_ names (no behavior change) */
const RENAMES: [string, string, string][] = [
  [
    'admin_department_permissions',
    'admin_department_permissions_ibfk_1',
    'fk_admin_dept_perm_tenant',
  ],
  [
    'admin_department_permissions',
    'admin_department_permissions_ibfk_2',
    'fk_admin_dept_perm_user',
  ],
  [
    'admin_department_permissions',
    'admin_department_permissions_ibfk_3',
    'fk_admin_dept_perm_department',
  ],
  [
    'admin_department_permissions',
    'admin_department_permissions_ibfk_4',
    'fk_admin_dept_perm_assigned_by',
  ],
  ['admin_logs', 'admin_logs_ibfk_1', 'fk_admin_logs_user'],
  [
    'admin_permission_logs',
    'admin_permission_logs_ibfk_1',
    'fk_admin_perm_logs_tenant',
  ],
  [
    'admin_permission_logs',
    'admin_permission_logs_ibfk_3',
    'fk_admin_perm_logs_changed_by',
  ],
  ['api_keys', 'api_keys_ibfk_1', 'fk_api_keys_tenant'],
  ['api_keys', 'api_keys_ibfk_2', 'fk_api_keys_created_by'],
  [
    'blackboard_confirmations',
    'blackboard_confirmations_ibfk_1',
    'fk_bb_confirmations_entry',
  ],
  [
    'blackboard_confirmations',
    'blackboard_confirmations_ibfk_2',
    'fk_bb_confirmations_user',
  ],
  [
    'blackboard_entries',
    'blackboard_entries_ibfk_1',
    'fk_blackboard_entries_tenant',
  ],
  [
    'calendar_attendees',
    'calendar_attendees_ibfk_1',
    'fk_calendar_attendees_event',
  ],
  [
    'calendar_attendees',
    'calendar_attendees_ibfk_2',
    'fk_calendar_attendees_user',
  ],
  ['calendar_events', 'calendar_events_ibfk_1', 'fk_calendar_events_tenant'],
  ['calendar_events', 'calendar_events_ibfk_2', 'fk_calendar_events_user'],
  ['calendar_events', 'calendar_events_ibfk_3', 'fk_calendar_events_parent'],
  [
    'calendar_recurring_patterns',
    'calendar_recurring_patterns_ibfk_1',
    'fk_calendar_patterns_event',
  ],
  [
    'calendar_recurring_patterns',
    'calendar_recurring_patterns_ibfk_2',
    'fk_calendar_patterns_tenant',
  ],
  ['deletion_alerts', 'deletion_alerts_ibfk_1', 'fk_deletion_alerts_queue'],
  [
    'deletion_dry_run_reports',
    'deletion_dry_run_reports_ibfk_1',
    'fk_deletion_reports_tenant',
  ],
  [
    'deletion_dry_run_reports',
    'deletion_dry_run_reports_ibfk_2',
    'fk_deletion_reports_user',
  ],
  [
    'deletion_partial_options',
    'deletion_partial_options_ibfk_1',
    'fk_deletion_options_queue',
  ],
  ['departments', 'departments_ibfk_4', 'fk_departments_created_by'],
  [
    'document_permissions',
    'document_permissions_ibfk_1',
    'fk_doc_perm_document',
  ],
  ['document_permissions', 'document_permissions_ibfk_2', 'fk_doc_perm_user'],
  [
    'document_permissions',
    'document_permissions_ibfk_3',
    'fk_doc_perm_department',
  ],
  ['document_permissions', 'document_permissions_ibfk_4', 'fk_doc_perm_team'],
  ['document_permissions', 'document_permissions_ibfk_5', 'fk_doc_perm_tenant'],
  [
    'document_read_status',
    'document_read_status_ibfk_1',
    'fk_doc_read_document',
  ],
  ['document_read_status', 'document_read_status_ibfk_2', 'fk_doc_read_user'],
  ['document_read_status', 'document_read_status_ibfk_3', 'fk_doc_read_tenant'],
  ['document_shares', 'document_shares_ibfk_1', 'fk_doc_shares_document'],
  ['document_shares', 'document_shares_ibfk_2', 'fk_doc_shares_owner_tenant'],
  ['document_shares', 'document_shares_ibfk_3', 'fk_doc_shares_shared_tenant'],
  ['documents', 'documents_ibfk_1', 'fk_documents_tenant'],
  ['documents', 'documents_ibfk_3', 'fk_documents_created_by'],
  [
    'failed_file_deletions',
    'failed_file_deletions_ibfk_1',
    'fk_failed_file_del_queue',
  ],
  [
    'failed_file_deletions',
    'failed_file_deletions_ibfk_2',
    'fk_failed_file_del_user',
  ],
  [
    'kvp_attachments',
    'kvp_attachments_ibfk_1',
    'fk_kvp_attachments_suggestion',
  ],
  ['kvp_comments', 'kvp_comments_ibfk_1', 'fk_kvp_comments_suggestion'],
  ['kvp_ratings', 'kvp_ratings_ibfk_1', 'fk_kvp_ratings_suggestion'],
  [
    'kvp_status_history',
    'kvp_status_history_ibfk_1',
    'fk_kvp_status_history_suggestion',
  ],
  ['kvp_suggestions', 'kvp_suggestions_ibfk_1', 'fk_kvp_suggestions_tenant'],
  [
    'kvp_suggestions',
    'kvp_suggestions_ibfk_4',
    'fk_kvp_suggestions_assigned_to',
  ],
  ['kvp_votes', 'kvp_votes_ibfk_1', 'fk_kvp_votes_suggestion'],
  ['kvp_votes', 'kvp_votes_ibfk_2', 'fk_kvp_votes_user'],
  ['kvp_votes', 'kvp_votes_ibfk_3', 'fk_kvp_votes_tenant'],
  ['legal_holds', 'legal_holds_ibfk_1', 'fk_legal_holds_tenant'],
  ['legal_holds', 'legal_holds_ibfk_2', 'fk_legal_holds_created_by'],
  ['legal_holds', 'legal_holds_ibfk_3', 'fk_legal_holds_released_by'],
  [
    'notification_preferences',
    'notification_preferences_ibfk_1',
    'fk_notification_prefs_user',
  ],
  [
    'notification_read_status',
    'notification_read_status_ibfk_1',
    'fk_notification_read_notification',
  ],
  [
    'notification_read_status',
    'notification_read_status_ibfk_2',
    'fk_notification_read_user',
  ],
  [
    'notification_read_status',
    'notification_read_status_ibfk_3',
    'fk_notification_read_tenant',
  ],
  ['notifications', 'notifications_ibfk_1', 'fk_notifications_tenant'],
  ['notifications', 'notifications_ibfk_2', 'fk_notifications_created_by'],
  ['oauth_tokens', 'oauth_tokens_ibfk_1', 'fk_oauth_tokens_tenant'],
  ['oauth_tokens', 'oauth_tokens_ibfk_2', 'fk_oauth_tokens_user'],
  [
    'password_reset_tokens',
    'password_reset_tokens_ibfk_1',
    'fk_password_reset_user',
  ],
  ['payment_history', 'payment_history_ibfk_1', 'fk_payment_history_tenant'],
  [
    'payment_history',
    'payment_history_ibfk_2',
    'fk_payment_history_subscription',
  ],
  [
    'shift_assignments',
    'shift_assignments_ibfk_1',
    'fk_shift_assignments_shift',
  ],
  [
    'shift_assignments',
    'shift_assignments_ibfk_2',
    'fk_shift_assignments_user',
  ],
  [
    'shift_assignments',
    'shift_assignments_ibfk_3',
    'fk_shift_assignments_assigned_by',
  ],
  ['shift_plans', 'shift_plans_ibfk_1', 'fk_shift_plans_tenant'],
  ['shift_plans', 'shift_plans_ibfk_2', 'fk_shift_plans_department'],
  ['shift_plans', 'shift_plans_ibfk_3', 'fk_shift_plans_team'],
  ['shift_plans', 'shift_plans_ibfk_5', 'fk_shift_plans_approved_by'],
  [
    'shift_swap_requests',
    'shift_swap_requests_ibfk_1',
    'fk_shift_swap_assignment',
  ],
  [
    'shift_swap_requests',
    'shift_swap_requests_ibfk_2',
    'fk_shift_swap_requested_by',
  ],
  [
    'shift_swap_requests',
    'shift_swap_requests_ibfk_3',
    'fk_shift_swap_requested_with',
  ],
  [
    'shift_swap_requests',
    'shift_swap_requests_ibfk_4',
    'fk_shift_swap_approved_by',
  ],
  ['shift_swap_requests', 'shift_swap_requests_ibfk_5', 'fk_shift_swap_tenant'],
  ['shifts', 'shifts_ibfk_1', 'fk_shifts_tenant'],
  ['shifts', 'shifts_ibfk_4', 'fk_shifts_created_by'],
  ['shifts', 'shifts_ibfk_5', 'fk_shifts_plan'],
  ['shifts', 'shifts_ibfk_6', 'fk_shifts_department'],
  ['shifts', 'shifts_ibfk_7', 'fk_shifts_team'],
  ['shifts', 'shifts_ibfk_8', 'fk_shifts_area'],
  ['survey_answers', 'survey_answers_ibfk_1', 'fk_survey_answers_response'],
  ['survey_answers', 'survey_answers_ibfk_2', 'fk_survey_answers_question'],
  [
    'survey_assignments',
    'survey_assignments_ibfk_1',
    'fk_survey_assignments_survey',
  ],
  [
    'survey_assignments',
    'survey_assignments_ibfk_4',
    'fk_survey_assignments_user',
  ],
  ['survey_comments', 'survey_comments_ibfk_1', 'fk_survey_comments_survey'],
  [
    'survey_participants',
    'survey_participants_ibfk_1',
    'fk_survey_participants_survey',
  ],
  [
    'survey_participants',
    'survey_participants_ibfk_2',
    'fk_survey_participants_user',
  ],
  ['survey_questions', 'survey_questions_ibfk_1', 'fk_survey_questions_survey'],
  ['survey_reminders', 'survey_reminders_ibfk_1', 'fk_survey_reminders_survey'],
  ['survey_responses', 'survey_responses_ibfk_1', 'fk_survey_responses_survey'],
  ['survey_responses', 'survey_responses_ibfk_2', 'fk_survey_responses_user'],
  ['survey_templates', 'survey_templates_ibfk_1', 'fk_survey_templates_tenant'],
  [
    'survey_templates',
    'survey_templates_ibfk_2',
    'fk_survey_templates_created_by',
  ],
  ['surveys', 'surveys_ibfk_1', 'fk_surveys_tenant'],
  ['surveys', 'surveys_ibfk_2', 'fk_surveys_created_by'],
  ['teams', 'teams_ibfk_1', 'fk_teams_tenant'],
  ['teams', 'teams_ibfk_3', 'fk_teams_lead'],
  ['teams', 'teams_ibfk_4', 'fk_teams_created_by'],
  [
    'tenant_deletion_queue',
    'tenant_deletion_queue_ibfk_1',
    'fk_deletion_queue_tenant',
  ],
  [
    'tenant_deletion_queue',
    'tenant_deletion_queue_ibfk_2',
    'fk_deletion_queue_created_by',
  ],
  ['tenant_settings', 'tenant_settings_ibfk_1', 'fk_tenant_settings_tenant'],
  [
    'tenant_subscriptions',
    'tenant_subscriptions_ibfk_1',
    'fk_tenant_subscriptions_tenant',
  ],
  ['tenant_webhooks', 'tenant_webhooks_ibfk_1', 'fk_tenant_webhooks_tenant'],
  ['usage_quotas', 'usage_quotas_ibfk_1', 'fk_usage_quotas_tenant'],
  ['user_sessions', 'user_sessions_ibfk_1', 'fk_user_sessions_user'],
  ['user_settings', 'user_settings_ibfk_1', 'fk_user_settings_user'],
  ['user_teams', 'user_teams_ibfk_1', 'fk_user_teams_tenant'],
  ['user_teams', 'user_teams_ibfk_2', 'fk_user_teams_user'],
  ['user_teams', 'user_teams_ibfk_3', 'fk_user_teams_team'],
];

// ============================================================
// MIGRATION
// ============================================================

export function up(pgm: MigrationBuilder): void {
  for (const [table, column] of NULLABLE_COLUMNS) {
    pgm.sql(`ALTER TABLE ${table} ALTER COLUMN ${column} DROP NOT NULL`);
  }

  for (const c of BEHAVIOR_CHANGES) {
    pgm.sql(`ALTER TABLE ${c.table} DROP CONSTRAINT ${c.oldName}`);
    pgm.sql(
      `ALTER TABLE ${c.table} ADD CONSTRAINT ${c.newName} FOREIGN KEY (${c.column}) REFERENCES ${c.target} ON UPDATE ${c.onUpdate} ON DELETE ${c.newOnDelete}`,
    );
  }

  for (const [table, oldName, newName] of RENAMES) {
    pgm.sql(`ALTER TABLE ${table} RENAME CONSTRAINT ${oldName} TO ${newName}`);
  }
}

export function down(pgm: MigrationBuilder): void {
  for (const [table, oldName, newName] of [...RENAMES].reverse()) {
    pgm.sql(`ALTER TABLE ${table} RENAME CONSTRAINT ${newName} TO ${oldName}`);
  }

  for (const c of [...BEHAVIOR_CHANGES].reverse()) {
    pgm.sql(`ALTER TABLE ${c.table} DROP CONSTRAINT ${c.newName}`);
    pgm.sql(
      `ALTER TABLE ${c.table} ADD CONSTRAINT ${c.oldName} FOREIGN KEY (${c.column}) REFERENCES ${c.target} ON UPDATE ${c.oldOnUpdate} ON DELETE ${c.oldOnDelete}`,
    );
  }

  for (const [table, column] of [...NULLABLE_COLUMNS].reverse()) {
    pgm.sql(`ALTER TABLE ${table} ALTER COLUMN ${column} SET NOT NULL`);
  }
}

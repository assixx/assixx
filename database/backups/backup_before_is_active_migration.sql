--
-- PostgreSQL database dump
--

\restrict YZgyCpmdTdyg6dcWXSL4rjoGb5XeZcaVYRoE9PslyUyQCwvON4icbN2ZXqL06bc

-- Dumped from database version 17.7
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pgloader
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO pgloader;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pgloader
--

COMMENT ON SCHEMA public IS '';


--
-- Name: absences_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.absences_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled'
);


ALTER TYPE public.absences_status OWNER TO pgloader;

--
-- Name: absences_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.absences_type AS ENUM (
    'vacation',
    'sick',
    'training',
    'other'
);


ALTER TYPE public.absences_type OWNER TO pgloader;

--
-- Name: areas_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.areas_type AS ENUM (
    'building',
    'warehouse',
    'office',
    'production',
    'outdoor',
    'other'
);


ALTER TYPE public.areas_type OWNER TO pgloader;

--
-- Name: audit_trail_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.audit_trail_status AS ENUM (
    'success',
    'failure'
);


ALTER TYPE public.audit_trail_status OWNER TO pgloader;

--
-- Name: backup_retention_policy_backup_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.backup_retention_policy_backup_type AS ENUM (
    'daily',
    'weekly',
    'monthly',
    'deletion',
    'final'
);


ALTER TYPE public.backup_retention_policy_backup_type OWNER TO pgloader;

--
-- Name: blackboard_entries_org_level; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.blackboard_entries_org_level AS ENUM (
    'company',
    'department',
    'team',
    'area'
);


ALTER TYPE public.blackboard_entries_org_level OWNER TO pgloader;

--
-- Name: blackboard_entries_priority; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.blackboard_entries_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


ALTER TYPE public.blackboard_entries_priority OWNER TO pgloader;

--
-- Name: blackboard_entries_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.blackboard_entries_status AS ENUM (
    'active',
    'archived'
);


ALTER TYPE public.blackboard_entries_status OWNER TO pgloader;

--
-- Name: blackboard_entry_organizations_org_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.blackboard_entry_organizations_org_type AS ENUM (
    'department',
    'team',
    'area'
);


ALTER TYPE public.blackboard_entry_organizations_org_type OWNER TO pgloader;

--
-- Name: calendar_events_created_by_role; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.calendar_events_created_by_role AS ENUM (
    'admin',
    'lead',
    'user'
);


ALTER TYPE public.calendar_events_created_by_role OWNER TO pgloader;

--
-- Name: calendar_events_org_level; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.calendar_events_org_level AS ENUM (
    'company',
    'department',
    'team',
    'area',
    'personal'
);


ALTER TYPE public.calendar_events_org_level OWNER TO pgloader;

--
-- Name: calendar_events_organizations_org_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.calendar_events_organizations_org_type AS ENUM (
    'department',
    'team',
    'area'
);


ALTER TYPE public.calendar_events_organizations_org_type OWNER TO pgloader;

--
-- Name: calendar_events_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.calendar_events_status AS ENUM (
    'confirmed',
    'tentative',
    'cancelled'
);


ALTER TYPE public.calendar_events_status OWNER TO pgloader;

--
-- Name: calendar_events_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.calendar_events_type AS ENUM (
    'meeting',
    'training',
    'other'
);


ALTER TYPE public.calendar_events_type OWNER TO pgloader;

--
-- Name: calendar_recurring_patterns_frequency; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.calendar_recurring_patterns_frequency AS ENUM (
    'daily',
    'weekly',
    'monthly',
    'yearly'
);


ALTER TYPE public.calendar_recurring_patterns_frequency OWNER TO pgloader;

--
-- Name: chat_channel_members_role; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.chat_channel_members_role AS ENUM (
    'member',
    'moderator',
    'admin'
);


ALTER TYPE public.chat_channel_members_role OWNER TO pgloader;

--
-- Name: chat_channels_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.chat_channels_type AS ENUM (
    'public',
    'private',
    'direct'
);


ALTER TYPE public.chat_channels_type OWNER TO pgloader;

--
-- Name: chat_channels_visibility_scope; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.chat_channels_visibility_scope AS ENUM (
    'company',
    'department',
    'team'
);


ALTER TYPE public.chat_channels_visibility_scope OWNER TO pgloader;

--
-- Name: chat_messages_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.chat_messages_type AS ENUM (
    'text',
    'file',
    'system'
);


ALTER TYPE public.chat_messages_type OWNER TO pgloader;

--
-- Name: deletion_alerts_alert_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.deletion_alerts_alert_type AS ENUM (
    'slack',
    'teams',
    'pagerduty',
    'email'
);


ALTER TYPE public.deletion_alerts_alert_type OWNER TO pgloader;

--
-- Name: deletion_alerts_severity; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.deletion_alerts_severity AS ENUM (
    'info',
    'warning',
    'critical'
);


ALTER TYPE public.deletion_alerts_severity OWNER TO pgloader;

--
-- Name: document_permissions_permission_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.document_permissions_permission_type AS ENUM (
    'view',
    'download',
    'edit',
    'delete'
);


ALTER TYPE public.document_permissions_permission_type OWNER TO pgloader;

--
-- Name: documents_access_scope; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.documents_access_scope AS ENUM (
    'personal',
    'team',
    'department',
    'company',
    'payroll',
    'blackboard'
);


ALTER TYPE public.documents_access_scope OWNER TO pgloader;

--
-- Name: documents_storage_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.documents_storage_type AS ENUM (
    'database',
    'filesystem',
    's3'
);


ALTER TYPE public.documents_storage_type OWNER TO pgloader;

--
-- Name: email_queue_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.email_queue_status AS ENUM (
    'pending',
    'sending',
    'sent',
    'failed'
);


ALTER TYPE public.email_queue_status OWNER TO pgloader;

--
-- Name: employee_availability_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.employee_availability_status AS ENUM (
    'available',
    'unavailable',
    'vacation',
    'sick',
    'training',
    'other'
);


ALTER TYPE public.employee_availability_status OWNER TO pgloader;

--
-- Name: features_category; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.features_category AS ENUM (
    'basic',
    'core',
    'premium',
    'enterprise'
);


ALTER TYPE public.features_category OWNER TO pgloader;

--
-- Name: kvp_points_reason; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.kvp_points_reason AS ENUM (
    'submission',
    'implementation',
    'rating',
    'bonus'
);


ALTER TYPE public.kvp_points_reason OWNER TO pgloader;

--
-- Name: kvp_status_history_new_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.kvp_status_history_new_status AS ENUM (
    'new',
    'pending',
    'in_review',
    'approved',
    'implemented',
    'rejected',
    'archived'
);


ALTER TYPE public.kvp_status_history_new_status OWNER TO pgloader;

--
-- Name: kvp_status_history_old_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.kvp_status_history_old_status AS ENUM (
    'new',
    'pending',
    'in_review',
    'approved',
    'implemented',
    'rejected',
    'archived'
);


ALTER TYPE public.kvp_status_history_old_status OWNER TO pgloader;

--
-- Name: kvp_suggestions_org_level; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.kvp_suggestions_org_level AS ENUM (
    'company',
    'department',
    'area',
    'team'
);


ALTER TYPE public.kvp_suggestions_org_level OWNER TO pgloader;

--
-- Name: kvp_suggestions_priority; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.kvp_suggestions_priority AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);


ALTER TYPE public.kvp_suggestions_priority OWNER TO pgloader;

--
-- Name: kvp_suggestions_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.kvp_suggestions_status AS ENUM (
    'new',
    'in_review',
    'approved',
    'implemented',
    'rejected',
    'archived'
);


ALTER TYPE public.kvp_suggestions_status OWNER TO pgloader;

--
-- Name: kvp_votes_vote_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.kvp_votes_vote_type AS ENUM (
    'up',
    'down'
);


ALTER TYPE public.kvp_votes_vote_type OWNER TO pgloader;

--
-- Name: machine_documents_document_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.machine_documents_document_type AS ENUM (
    'manual',
    'certificate',
    'warranty',
    'inspection_report',
    'maintenance_report',
    'invoice',
    'other'
);


ALTER TYPE public.machine_documents_document_type OWNER TO pgloader;

--
-- Name: machine_maintenance_history_maintenance_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.machine_maintenance_history_maintenance_type AS ENUM (
    'preventive',
    'corrective',
    'inspection',
    'calibration',
    'cleaning',
    'other'
);


ALTER TYPE public.machine_maintenance_history_maintenance_type OWNER TO pgloader;

--
-- Name: machine_maintenance_history_status_after; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.machine_maintenance_history_status_after AS ENUM (
    'operational',
    'needs_repair',
    'decommissioned'
);


ALTER TYPE public.machine_maintenance_history_status_after OWNER TO pgloader;

--
-- Name: machines_machine_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.machines_machine_type AS ENUM (
    'production',
    'packaging',
    'quality_control',
    'logistics',
    'utility',
    'other'
);


ALTER TYPE public.machines_machine_type OWNER TO pgloader;

--
-- Name: machines_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.machines_status AS ENUM (
    'operational',
    'maintenance',
    'repair',
    'standby',
    'decommissioned'
);


ALTER TYPE public.machines_status OWNER TO pgloader;

--
-- Name: notification_preferences_frequency; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.notification_preferences_frequency AS ENUM (
    'immediate',
    'hourly',
    'daily',
    'weekly'
);


ALTER TYPE public.notification_preferences_frequency OWNER TO pgloader;

--
-- Name: notifications_priority; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.notifications_priority AS ENUM (
    'low',
    'normal',
    'medium',
    'high',
    'urgent'
);


ALTER TYPE public.notifications_priority OWNER TO pgloader;

--
-- Name: notifications_recipient_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.notifications_recipient_type AS ENUM (
    'user',
    'department',
    'team',
    'all'
);


ALTER TYPE public.notifications_recipient_type OWNER TO pgloader;

--
-- Name: payment_history_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.payment_history_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'refunded'
);


ALTER TYPE public.payment_history_status OWNER TO pgloader;

--
-- Name: security_logs_action; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.security_logs_action AS ENUM (
    'login_success',
    'login_failed',
    'logout',
    'password_reset',
    'account_locked',
    'suspicious_activity'
);


ALTER TYPE public.security_logs_action OWNER TO pgloader;

--
-- Name: shift_assignments_assignment_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.shift_assignments_assignment_type AS ENUM (
    'assigned',
    'requested',
    'available',
    'unavailable'
);


ALTER TYPE public.shift_assignments_assignment_type OWNER TO pgloader;

--
-- Name: shift_assignments_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.shift_assignments_status AS ENUM (
    'pending',
    'accepted',
    'declined',
    'cancelled'
);


ALTER TYPE public.shift_assignments_status OWNER TO pgloader;

--
-- Name: shift_plans_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.shift_plans_status AS ENUM (
    'draft',
    'published',
    'locked',
    'archived'
);


ALTER TYPE public.shift_plans_status OWNER TO pgloader;

--
-- Name: shift_rotation_assignments_shift_group; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.shift_rotation_assignments_shift_group AS ENUM (
    'F',
    'S',
    'N'
);


ALTER TYPE public.shift_rotation_assignments_shift_group OWNER TO pgloader;

--
-- Name: shift_rotation_history_shift_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.shift_rotation_history_shift_type AS ENUM (
    'F',
    'S',
    'N'
);


ALTER TYPE public.shift_rotation_history_shift_type OWNER TO pgloader;

--
-- Name: shift_rotation_history_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.shift_rotation_history_status AS ENUM (
    'generated',
    'confirmed',
    'modified',
    'cancelled'
);


ALTER TYPE public.shift_rotation_history_status OWNER TO pgloader;

--
-- Name: shift_rotation_patterns_pattern_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.shift_rotation_patterns_pattern_type AS ENUM (
    'alternate_fs',
    'fixed_n',
    'custom'
);


ALTER TYPE public.shift_rotation_patterns_pattern_type OWNER TO pgloader;

--
-- Name: shift_swap_requests_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.shift_swap_requests_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled'
);


ALTER TYPE public.shift_swap_requests_status OWNER TO pgloader;

--
-- Name: shifts_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.shifts_status AS ENUM (
    'planned',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE public.shifts_status OWNER TO pgloader;

--
-- Name: shifts_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.shifts_type AS ENUM (
    'regular',
    'overtime',
    'standby',
    'vacation',
    'sick',
    'holiday',
    'early',
    'late',
    'night',
    'day',
    'flexible',
    'F',
    'S',
    'N'
);


ALTER TYPE public.shifts_type OWNER TO pgloader;

--
-- Name: survey_assignments_assignment_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.survey_assignments_assignment_type AS ENUM (
    'all_users',
    'area',
    'department',
    'team',
    'user'
);


ALTER TYPE public.survey_assignments_assignment_type OWNER TO pgloader;

--
-- Name: survey_questions_question_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.survey_questions_question_type AS ENUM (
    'single_choice',
    'multiple_choice',
    'text',
    'rating',
    'scale',
    'yes_no',
    'date',
    'number'
);


ALTER TYPE public.survey_questions_question_type OWNER TO pgloader;

--
-- Name: survey_responses_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.survey_responses_status AS ENUM (
    'in_progress',
    'completed',
    'abandoned'
);


ALTER TYPE public.survey_responses_status OWNER TO pgloader;

--
-- Name: surveys_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.surveys_status AS ENUM (
    'draft',
    'active',
    'paused',
    'completed',
    'archived'
);


ALTER TYPE public.surveys_status OWNER TO pgloader;

--
-- Name: surveys_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.surveys_type AS ENUM (
    'feedback',
    'satisfaction',
    'poll',
    'assessment',
    'other'
);


ALTER TYPE public.surveys_type OWNER TO pgloader;

--
-- Name: system_logs_level; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.system_logs_level AS ENUM (
    'debug',
    'info',
    'warning',
    'error',
    'critical'
);


ALTER TYPE public.system_logs_level OWNER TO pgloader;

--
-- Name: system_settings_value_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.system_settings_value_type AS ENUM (
    'string',
    'number',
    'boolean',
    'json'
);


ALTER TYPE public.system_settings_value_type OWNER TO pgloader;

--
-- Name: tenant_addons_addon_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.tenant_addons_addon_type AS ENUM (
    'employees',
    'admins',
    'storage_gb'
);


ALTER TYPE public.tenant_addons_addon_type OWNER TO pgloader;

--
-- Name: tenant_addons_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.tenant_addons_status AS ENUM (
    'active',
    'cancelled'
);


ALTER TYPE public.tenant_addons_status OWNER TO pgloader;

--
-- Name: tenant_deletion_approvals_action; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.tenant_deletion_approvals_action AS ENUM (
    'requested',
    'approved',
    'rejected',
    'cancelled'
);


ALTER TYPE public.tenant_deletion_approvals_action OWNER TO pgloader;

--
-- Name: tenant_deletion_backups_backup_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.tenant_deletion_backups_backup_type AS ENUM (
    'pre_deletion',
    'final',
    'partial'
);


ALTER TYPE public.tenant_deletion_backups_backup_type OWNER TO pgloader;

--
-- Name: tenant_deletion_log_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.tenant_deletion_log_status AS ENUM (
    'success',
    'failed',
    'skipped'
);


ALTER TYPE public.tenant_deletion_log_status OWNER TO pgloader;

--
-- Name: tenant_deletion_queue_approval_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.tenant_deletion_queue_approval_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE public.tenant_deletion_queue_approval_status OWNER TO pgloader;

--
-- Name: tenant_deletion_queue_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.tenant_deletion_queue_status AS ENUM (
    'queued',
    'processing',
    'completed',
    'failed',
    'pending_approval',
    'cancelled'
);


ALTER TYPE public.tenant_deletion_queue_status OWNER TO pgloader;

--
-- Name: tenant_plans_billing_cycle; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.tenant_plans_billing_cycle AS ENUM (
    'monthly',
    'yearly'
);


ALTER TYPE public.tenant_plans_billing_cycle OWNER TO pgloader;

--
-- Name: tenant_plans_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.tenant_plans_status AS ENUM (
    'active',
    'trial',
    'cancelled',
    'expired'
);


ALTER TYPE public.tenant_plans_status OWNER TO pgloader;

--
-- Name: tenant_settings_value_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.tenant_settings_value_type AS ENUM (
    'string',
    'number',
    'boolean',
    'json'
);


ALTER TYPE public.tenant_settings_value_type OWNER TO pgloader;

--
-- Name: tenant_subscriptions_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.tenant_subscriptions_status AS ENUM (
    'active',
    'cancelled',
    'expired',
    'suspended'
);


ALTER TYPE public.tenant_subscriptions_status OWNER TO pgloader;

--
-- Name: tenants_current_plan; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.tenants_current_plan AS ENUM (
    'basic',
    'premium',
    'enterprise'
);


ALTER TYPE public.tenants_current_plan OWNER TO pgloader;

--
-- Name: tenants_deletion_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.tenants_deletion_status AS ENUM (
    'active',
    'marked_for_deletion',
    'suspended',
    'deleting'
);


ALTER TYPE public.tenants_deletion_status OWNER TO pgloader;

--
-- Name: tenants_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.tenants_status AS ENUM (
    'trial',
    'active',
    'suspended',
    'cancelled'
);


ALTER TYPE public.tenants_status OWNER TO pgloader;

--
-- Name: usage_quotas_reset_period; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.usage_quotas_reset_period AS ENUM (
    'daily',
    'weekly',
    'monthly',
    'yearly'
);


ALTER TYPE public.usage_quotas_reset_period OWNER TO pgloader;

--
-- Name: usage_quotas_resource_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.usage_quotas_resource_type AS ENUM (
    'users',
    'storage',
    'api_calls',
    'documents',
    'messages'
);


ALTER TYPE public.usage_quotas_resource_type OWNER TO pgloader;

--
-- Name: user_settings_value_type; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.user_settings_value_type AS ENUM (
    'string',
    'number',
    'boolean',
    'json'
);


ALTER TYPE public.user_settings_value_type OWNER TO pgloader;

--
-- Name: user_teams_role; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.user_teams_role AS ENUM (
    'member',
    'lead'
);


ALTER TYPE public.user_teams_role OWNER TO pgloader;

--
-- Name: users_availability_status; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.users_availability_status AS ENUM (
    'available',
    'unavailable',
    'vacation',
    'sick'
);


ALTER TYPE public.users_availability_status OWNER TO pgloader;

--
-- Name: users_role; Type: TYPE; Schema: public; Owner: pgloader
--

CREATE TYPE public.users_role AS ENUM (
    'root',
    'admin',
    'employee'
);


ALTER TYPE public.users_role OWNER TO pgloader;

--
-- Name: create_tenant_rls_policy(text); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.create_tenant_rls_policy(table_name text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Enable RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);

    -- Force RLS for table owner too (important!)
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);

    -- Drop existing policy if exists
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);

    -- Create tenant isolation policy
    EXECUTE format('
        CREATE POLICY tenant_isolation ON %I
        FOR ALL
        USING (tenant_id = current_setting(''app.tenant_id'')::int)
        WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::int)
    ', table_name);

    RAISE NOTICE 'RLS enabled for table: %', table_name;
END;
$$;


ALTER FUNCTION public.create_tenant_rls_policy(table_name text) OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_areas(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_areas() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_areas() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_blackboard_entries(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_blackboard_entries() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_blackboard_entries() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_calendar_attendees(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_calendar_attendees() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_calendar_attendees() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_calendar_events(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_calendar_events() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_calendar_events() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_chat_channels(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_chat_channels() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_chat_channels() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_conversations(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_conversations() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_conversations() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_departments(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_departments() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_departments() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_email_templates(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_email_templates() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_email_templates() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_employee_availability(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_employee_availability() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_employee_availability() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_features(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_features() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_features() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_kvp_suggestions(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_kvp_suggestions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_kvp_suggestions() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_machines(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_machines() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_machines() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_notification_preferences(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_notification_preferences() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_notification_preferences() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_notifications(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_notifications() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_notifications() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_password_reset_tokens(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_password_reset_tokens() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.expires_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_password_reset_tokens() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_plans(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_plans() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_plans() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_scheduled_tasks(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_scheduled_tasks() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.scheduled_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_scheduled_tasks() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_shift_assignments(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_shift_assignments() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_shift_assignments() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_shift_plans(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_shift_plans() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_shift_plans() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_shift_rotation_assignments(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_shift_rotation_assignments() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_shift_rotation_assignments() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_shift_rotation_patterns(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_shift_rotation_patterns() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_shift_rotation_patterns() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_shift_swap_requests(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_shift_swap_requests() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_shift_swap_requests() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_shift_templates(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_shift_templates() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_shift_templates() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_shifts(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_shifts() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_shifts() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_subscription_plans(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_subscription_plans() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_subscription_plans() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_surveys(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_surveys() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_surveys() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_system_settings(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_system_settings() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_system_settings() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_teams(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_teams() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_teams() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_tenant_addons(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_tenant_addons() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_tenant_addons() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_tenant_features(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_tenant_features() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_tenant_features() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_tenant_plans(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_tenant_plans() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_tenant_plans() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_tenant_settings(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_tenant_settings() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_tenant_settings() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_tenants(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_tenants() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_tenants() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_user_sessions(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_user_sessions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.last_activity = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_user_sessions() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_user_settings(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_user_settings() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_user_settings() OWNER TO pgloader;

--
-- Name: on_update_current_timestamp_users(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.on_update_current_timestamp_users() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.on_update_current_timestamp_users() OWNER TO pgloader;

--
-- Name: prevent_delete_protected_table(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.prevent_delete_protected_table() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'PROTECTED TABLE: DELETE not allowed on % - system critical data', TG_TABLE_NAME;
END;
$$;


ALTER FUNCTION public.prevent_delete_protected_table() OWNER TO pgloader;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: pgloader
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO pgloader;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: absences; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.absences (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    user_id integer NOT NULL,
    type public.absences_type NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text,
    status public.absences_status DEFAULT 'pending'::public.absences_status,
    approved_by integer,
    approved_at timestamp with time zone,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.absences FORCE ROW LEVEL SECURITY;


ALTER TABLE public.absences OWNER TO pgloader;

--
-- Name: absences_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.absences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.absences_id_seq OWNER TO pgloader;

--
-- Name: absences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.absences_id_seq OWNED BY public.absences.id;


--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.activity_logs (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    user_id integer NOT NULL,
    action character varying(100) NOT NULL,
    entity_type character varying(50),
    entity_id integer,
    details text,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.activity_logs FORCE ROW LEVEL SECURITY;


ALTER TABLE public.activity_logs OWNER TO pgloader;

--
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.activity_logs_id_seq OWNER TO pgloader;

--
-- Name: activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;


--
-- Name: admin_area_permissions; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.admin_area_permissions (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    admin_user_id integer NOT NULL,
    area_id integer NOT NULL,
    can_read boolean DEFAULT true NOT NULL,
    can_write boolean DEFAULT false NOT NULL,
    can_delete boolean DEFAULT false NOT NULL,
    assigned_by integer NOT NULL,
    assigned_at timestamp with time zone
);

ALTER TABLE ONLY public.admin_area_permissions FORCE ROW LEVEL SECURITY;


ALTER TABLE public.admin_area_permissions OWNER TO pgloader;

--
-- Name: admin_area_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.admin_area_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_area_permissions_id_seq OWNER TO pgloader;

--
-- Name: admin_area_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.admin_area_permissions_id_seq OWNED BY public.admin_area_permissions.id;


--
-- Name: admin_department_permissions; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.admin_department_permissions (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    admin_user_id integer NOT NULL,
    department_id integer NOT NULL,
    can_read boolean DEFAULT true,
    can_write boolean DEFAULT false,
    can_delete boolean DEFAULT false,
    assigned_by integer NOT NULL,
    assigned_at timestamp with time zone
);

ALTER TABLE ONLY public.admin_department_permissions FORCE ROW LEVEL SECURITY;


ALTER TABLE public.admin_department_permissions OWNER TO pgloader;

--
-- Name: admin_department_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.admin_department_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_department_permissions_id_seq OWNER TO pgloader;

--
-- Name: admin_department_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.admin_department_permissions_id_seq OWNED BY public.admin_department_permissions.id;


--
-- Name: admin_logs; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.admin_logs (
    id integer NOT NULL,
    tenant_id integer,
    user_id integer NOT NULL,
    action character varying(255) NOT NULL,
    entity_type character varying(255),
    entity_id integer,
    details text,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.admin_logs FORCE ROW LEVEL SECURITY;


ALTER TABLE public.admin_logs OWNER TO pgloader;

--
-- Name: admin_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.admin_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_logs_id_seq OWNER TO pgloader;

--
-- Name: admin_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.admin_logs_id_seq OWNED BY public.admin_logs.id;


--
-- Name: admin_permission_logs; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.admin_permission_logs (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    action character varying(50) NOT NULL,
    admin_user_id integer NOT NULL,
    target_id integer NOT NULL,
    target_type character varying(20) NOT NULL,
    changed_by integer NOT NULL,
    old_permissions jsonb,
    new_permissions jsonb,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.admin_permission_logs FORCE ROW LEVEL SECURITY;


ALTER TABLE public.admin_permission_logs OWNER TO pgloader;

--
-- Name: admin_permission_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.admin_permission_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_permission_logs_id_seq OWNER TO pgloader;

--
-- Name: admin_permission_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.admin_permission_logs_id_seq OWNED BY public.admin_permission_logs.id;


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.api_keys (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    key_hash character varying(64) NOT NULL,
    name character varying(100),
    permissions jsonb,
    active boolean DEFAULT true,
    last_used timestamp with time zone,
    deactivated_at timestamp with time zone,
    created_at timestamp with time zone,
    created_by integer NOT NULL
);

ALTER TABLE ONLY public.api_keys FORCE ROW LEVEL SECURITY;


ALTER TABLE public.api_keys OWNER TO pgloader;

--
-- Name: api_keys_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.api_keys_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.api_keys_id_seq OWNER TO pgloader;

--
-- Name: api_keys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.api_keys_id_seq OWNED BY public.api_keys.id;


--
-- Name: api_logs; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.api_logs (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    user_id integer,
    method character varying(10) NOT NULL,
    endpoint character varying(255) NOT NULL,
    status_code integer,
    request_body text,
    response_time_ms integer,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.api_logs FORCE ROW LEVEL SECURITY;


ALTER TABLE public.api_logs OWNER TO pgloader;

--
-- Name: api_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.api_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.api_logs_id_seq OWNER TO pgloader;

--
-- Name: api_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.api_logs_id_seq OWNED BY public.api_logs.id;


--
-- Name: archived_tenant_invoices; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.archived_tenant_invoices (
    id integer NOT NULL,
    original_tenant_id integer NOT NULL,
    tenant_name character varying(255) NOT NULL,
    tenant_tax_id character varying(50),
    invoice_data jsonb NOT NULL,
    invoice_number character varying(50),
    invoice_date date,
    invoice_amount numeric(10,2),
    archived_at timestamp with time zone,
    delete_after date NOT NULL
);


ALTER TABLE public.archived_tenant_invoices OWNER TO pgloader;

--
-- Name: archived_tenant_invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.archived_tenant_invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.archived_tenant_invoices_id_seq OWNER TO pgloader;

--
-- Name: archived_tenant_invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.archived_tenant_invoices_id_seq OWNED BY public.archived_tenant_invoices.id;


--
-- Name: areas; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.areas (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    area_lead_id integer,
    type public.areas_type DEFAULT 'other'::public.areas_type NOT NULL,
    capacity integer,
    address text,
    is_active smallint DEFAULT 1 NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    created_by integer NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.areas FORCE ROW LEVEL SECURITY;


ALTER TABLE public.areas OWNER TO pgloader;

--
-- Name: TABLE areas; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON TABLE public.areas IS 'Physical locations/areas (e.g., buildings, halls, warehouses)';


--
-- Name: COLUMN areas.capacity; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.areas.capacity IS 'Maximum number of people';


--
-- Name: COLUMN areas.address; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.areas.address IS 'Physical address if applicable';


--
-- Name: areas_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.areas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.areas_id_seq OWNER TO pgloader;

--
-- Name: areas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.areas_id_seq OWNED BY public.areas.id;


--
-- Name: audit_trail; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.audit_trail (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    user_id integer NOT NULL,
    user_name character varying(100),
    user_role character varying(50),
    action character varying(50) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id integer,
    resource_name character varying(255),
    changes jsonb,
    ip_address character varying(45),
    user_agent text,
    status public.audit_trail_status DEFAULT 'success'::public.audit_trail_status NOT NULL,
    error_message text,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.audit_trail FORCE ROW LEVEL SECURITY;


ALTER TABLE public.audit_trail OWNER TO pgloader;

--
-- Name: audit_trail_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.audit_trail_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_trail_id_seq OWNER TO pgloader;

--
-- Name: audit_trail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.audit_trail_id_seq OWNED BY public.audit_trail.id;


--
-- Name: backup_retention_policy; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.backup_retention_policy (
    id integer NOT NULL,
    tenant_id integer,
    backup_type public.backup_retention_policy_backup_type DEFAULT 'deletion'::public.backup_retention_policy_backup_type,
    backup_file character varying(500),
    backup_size bigint,
    retention_days integer DEFAULT 90,
    created_at timestamp with time zone,
    expires_at timestamp with time zone
);

ALTER TABLE ONLY public.backup_retention_policy FORCE ROW LEVEL SECURITY;


ALTER TABLE public.backup_retention_policy OWNER TO pgloader;

--
-- Name: backup_retention_policy_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.backup_retention_policy_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.backup_retention_policy_id_seq OWNER TO pgloader;

--
-- Name: backup_retention_policy_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.backup_retention_policy_id_seq OWNED BY public.backup_retention_policy.id;


--
-- Name: blackboard_comments; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.blackboard_comments (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    entry_id integer NOT NULL,
    user_id integer NOT NULL,
    comment text NOT NULL,
    is_internal boolean DEFAULT false,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.blackboard_comments FORCE ROW LEVEL SECURITY;


ALTER TABLE public.blackboard_comments OWNER TO pgloader;

--
-- Name: blackboard_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.blackboard_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.blackboard_comments_id_seq OWNER TO pgloader;

--
-- Name: blackboard_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.blackboard_comments_id_seq OWNED BY public.blackboard_comments.id;


--
-- Name: blackboard_confirmations; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.blackboard_confirmations (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    entry_id integer NOT NULL,
    user_id integer NOT NULL,
    confirmed_at timestamp with time zone
);

ALTER TABLE ONLY public.blackboard_confirmations FORCE ROW LEVEL SECURITY;


ALTER TABLE public.blackboard_confirmations OWNER TO pgloader;

--
-- Name: blackboard_confirmations_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.blackboard_confirmations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.blackboard_confirmations_id_seq OWNER TO pgloader;

--
-- Name: blackboard_confirmations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.blackboard_confirmations_id_seq OWNED BY public.blackboard_confirmations.id;


--
-- Name: blackboard_entries; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.blackboard_entries (
    id integer NOT NULL,
    uuid character(36),
    tenant_id integer NOT NULL,
    org_level public.blackboard_entries_org_level DEFAULT 'company'::public.blackboard_entries_org_level,
    org_id integer,
    area_id integer,
    author_id integer NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    priority public.blackboard_entries_priority DEFAULT 'medium'::public.blackboard_entries_priority,
    color character varying(20) DEFAULT 'blue'::character varying,
    category character varying(50),
    valid_from date,
    valid_until date,
    expires_at timestamp with time zone,
    is_pinned boolean DEFAULT false,
    views integer DEFAULT 0,
    is_active smallint DEFAULT 1,
    status public.blackboard_entries_status DEFAULT 'active'::public.blackboard_entries_status,
    requires_confirmation boolean DEFAULT false,
    attachment_count integer DEFAULT 0,
    attachment_path character varying(500),
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    uuid_created_at timestamp with time zone
);

ALTER TABLE ONLY public.blackboard_entries FORCE ROW LEVEL SECURITY;


ALTER TABLE public.blackboard_entries OWNER TO pgloader;

--
-- Name: COLUMN blackboard_entries.org_level; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.blackboard_entries.org_level IS 'Legacy: Use blackboard_entry_organizations for multi-org. NULL = company-wide';


--
-- Name: COLUMN blackboard_entries.org_id; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.blackboard_entries.org_id IS 'Legacy: Use blackboard_entry_organizations for multi-org';


--
-- Name: blackboard_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.blackboard_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.blackboard_entries_id_seq OWNER TO pgloader;

--
-- Name: blackboard_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.blackboard_entries_id_seq OWNED BY public.blackboard_entries.id;


--
-- Name: blackboard_entry_organizations; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.blackboard_entry_organizations (
    id integer NOT NULL,
    entry_id integer NOT NULL,
    org_type public.blackboard_entry_organizations_org_type NOT NULL,
    org_id integer NOT NULL,
    created_at timestamp with time zone
);


ALTER TABLE public.blackboard_entry_organizations OWNER TO pgloader;

--
-- Name: TABLE blackboard_entry_organizations; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON TABLE public.blackboard_entry_organizations IS 'Many-to-many mapping between blackboard entries and organizations (departments/teams/areas)';


--
-- Name: blackboard_entry_organizations_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.blackboard_entry_organizations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.blackboard_entry_organizations_id_seq OWNER TO pgloader;

--
-- Name: blackboard_entry_organizations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.blackboard_entry_organizations_id_seq OWNED BY public.blackboard_entry_organizations.id;


--
-- Name: calendar_attendees; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.calendar_attendees (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    event_id integer NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.calendar_attendees FORCE ROW LEVEL SECURITY;


ALTER TABLE public.calendar_attendees OWNER TO pgloader;

--
-- Name: calendar_attendees_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.calendar_attendees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.calendar_attendees_id_seq OWNER TO pgloader;

--
-- Name: calendar_attendees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.calendar_attendees_id_seq OWNED BY public.calendar_attendees.id;


--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.calendar_events (
    id integer NOT NULL,
    uuid character(36) NOT NULL,
    tenant_id integer NOT NULL,
    user_id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    location character varying(255),
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    type public.calendar_events_type DEFAULT 'other'::public.calendar_events_type,
    status public.calendar_events_status DEFAULT 'confirmed'::public.calendar_events_status,
    is_private boolean DEFAULT false,
    all_day boolean DEFAULT false,
    org_level public.calendar_events_org_level DEFAULT 'personal'::public.calendar_events_org_level,
    department_id integer,
    team_id integer,
    area_id integer,
    org_id integer,
    reminder_minutes integer,
    color character varying(7) DEFAULT '#3498db'::character varying,
    recurrence_rule text,
    parent_event_id integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    allow_attendees boolean DEFAULT true,
    created_by_role public.calendar_events_created_by_role DEFAULT 'user'::public.calendar_events_created_by_role,
    uuid_created_at timestamp with time zone
);

ALTER TABLE ONLY public.calendar_events FORCE ROW LEVEL SECURITY;


ALTER TABLE public.calendar_events OWNER TO pgloader;

--
-- Name: COLUMN calendar_events.org_level; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.calendar_events.org_level IS 'Legacy: Use calendar_events_organizations for multi-org';


--
-- Name: COLUMN calendar_events.department_id; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.calendar_events.department_id IS 'Legacy: Use calendar_events_organizations for multi-org';


--
-- Name: COLUMN calendar_events.team_id; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.calendar_events.team_id IS 'Legacy: Use calendar_events_organizations for multi-org';


--
-- Name: COLUMN calendar_events.area_id; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.calendar_events.area_id IS 'Legacy: Use calendar_events_organizations for multi-org';


--
-- Name: calendar_events_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.calendar_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.calendar_events_id_seq OWNER TO pgloader;

--
-- Name: calendar_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.calendar_events_id_seq OWNED BY public.calendar_events.id;


--
-- Name: calendar_events_organizations; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.calendar_events_organizations (
    id integer NOT NULL,
    event_id integer NOT NULL,
    org_type public.calendar_events_organizations_org_type NOT NULL,
    org_id integer NOT NULL,
    created_at timestamp with time zone
);


ALTER TABLE public.calendar_events_organizations OWNER TO pgloader;

--
-- Name: calendar_events_organizations_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.calendar_events_organizations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.calendar_events_organizations_id_seq OWNER TO pgloader;

--
-- Name: calendar_events_organizations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.calendar_events_organizations_id_seq OWNED BY public.calendar_events_organizations.id;


--
-- Name: calendar_recurring_patterns; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.calendar_recurring_patterns (
    id integer NOT NULL,
    event_id integer NOT NULL,
    frequency public.calendar_recurring_patterns_frequency NOT NULL,
    interval_value integer DEFAULT 1,
    days_of_week character varying(50),
    end_date timestamp with time zone,
    tenant_id integer NOT NULL
);

ALTER TABLE ONLY public.calendar_recurring_patterns FORCE ROW LEVEL SECURITY;


ALTER TABLE public.calendar_recurring_patterns OWNER TO pgloader;

--
-- Name: calendar_recurring_patterns_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.calendar_recurring_patterns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.calendar_recurring_patterns_id_seq OWNER TO pgloader;

--
-- Name: calendar_recurring_patterns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.calendar_recurring_patterns_id_seq OWNED BY public.calendar_recurring_patterns.id;


--
-- Name: chat_channel_members; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.chat_channel_members (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    user_id integer NOT NULL,
    role public.chat_channel_members_role DEFAULT 'member'::public.chat_channel_members_role,
    tenant_id integer NOT NULL,
    joined_at timestamp with time zone
);

ALTER TABLE ONLY public.chat_channel_members FORCE ROW LEVEL SECURITY;


ALTER TABLE public.chat_channel_members OWNER TO pgloader;

--
-- Name: chat_channel_members_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.chat_channel_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_channel_members_id_seq OWNER TO pgloader;

--
-- Name: chat_channel_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.chat_channel_members_id_seq OWNED BY public.chat_channel_members.id;


--
-- Name: chat_channels; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.chat_channels (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    type public.chat_channels_type NOT NULL,
    visibility_scope public.chat_channels_visibility_scope DEFAULT 'company'::public.chat_channels_visibility_scope,
    target_id integer,
    created_by integer NOT NULL,
    tenant_id integer NOT NULL,
    is_archived boolean DEFAULT false,
    archived_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.chat_channels FORCE ROW LEVEL SECURITY;


ALTER TABLE public.chat_channels OWNER TO pgloader;

--
-- Name: chat_channels_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.chat_channels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_channels_id_seq OWNER TO pgloader;

--
-- Name: chat_channels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.chat_channels_id_seq OWNED BY public.chat_channels.id;


--
-- Name: chat_message_edits; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.chat_message_edits (
    id integer NOT NULL,
    message_id integer NOT NULL,
    previous_content text NOT NULL,
    edited_by integer NOT NULL,
    edited_at timestamp with time zone,
    tenant_id integer NOT NULL
);

ALTER TABLE ONLY public.chat_message_edits FORCE ROW LEVEL SECURITY;


ALTER TABLE public.chat_message_edits OWNER TO pgloader;

--
-- Name: chat_message_edits_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.chat_message_edits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_message_edits_id_seq OWNER TO pgloader;

--
-- Name: chat_message_edits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.chat_message_edits_id_seq OWNED BY public.chat_message_edits.id;


--
-- Name: chat_message_reactions; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.chat_message_reactions (
    id integer NOT NULL,
    message_id integer NOT NULL,
    user_id integer NOT NULL,
    emoji character varying(10) NOT NULL,
    tenant_id integer NOT NULL,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.chat_message_reactions FORCE ROW LEVEL SECURITY;


ALTER TABLE public.chat_message_reactions OWNER TO pgloader;

--
-- Name: chat_message_reactions_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.chat_message_reactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_message_reactions_id_seq OWNER TO pgloader;

--
-- Name: chat_message_reactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.chat_message_reactions_id_seq OWNED BY public.chat_message_reactions.id;


--
-- Name: chat_message_read_receipts; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.chat_message_read_receipts (
    id integer NOT NULL,
    message_id integer NOT NULL,
    user_id integer NOT NULL,
    channel_id integer NOT NULL,
    read_at timestamp with time zone,
    tenant_id integer NOT NULL
);

ALTER TABLE ONLY public.chat_message_read_receipts FORCE ROW LEVEL SECURITY;


ALTER TABLE public.chat_message_read_receipts OWNER TO pgloader;

--
-- Name: chat_message_read_receipts_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.chat_message_read_receipts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_message_read_receipts_id_seq OWNER TO pgloader;

--
-- Name: chat_message_read_receipts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.chat_message_read_receipts_id_seq OWNED BY public.chat_message_read_receipts.id;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.chat_messages (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    sender_id integer NOT NULL,
    content text NOT NULL,
    type public.chat_messages_type DEFAULT 'text'::public.chat_messages_type,
    reply_to_id integer,
    is_edited boolean DEFAULT false,
    edited_at timestamp with time zone,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    is_pinned boolean DEFAULT false,
    tenant_id integer NOT NULL,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.chat_messages FORCE ROW LEVEL SECURITY;


ALTER TABLE public.chat_messages OWNER TO pgloader;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_messages_id_seq OWNER TO pgloader;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.conversation_participants (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    conversation_id integer NOT NULL,
    user_id integer NOT NULL,
    joined_at timestamp with time zone,
    is_admin boolean DEFAULT false,
    last_read_message_id integer,
    last_read_at timestamp with time zone
);

ALTER TABLE ONLY public.conversation_participants FORCE ROW LEVEL SECURITY;


ALTER TABLE public.conversation_participants OWNER TO pgloader;

--
-- Name: conversation_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.conversation_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversation_participants_id_seq OWNER TO pgloader;

--
-- Name: conversation_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.conversation_participants_id_seq OWNED BY public.conversation_participants.id;


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.conversations (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    name character varying(255),
    is_group boolean DEFAULT false,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.conversations FORCE ROW LEVEL SECURITY;


ALTER TABLE public.conversations OWNER TO pgloader;

--
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversations_id_seq OWNER TO pgloader;

--
-- Name: conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;


--
-- Name: deletion_alerts; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.deletion_alerts (
    id integer NOT NULL,
    queue_id integer NOT NULL,
    alert_type public.deletion_alerts_alert_type NOT NULL,
    severity public.deletion_alerts_severity NOT NULL,
    channel character varying(255),
    title character varying(500),
    message text,
    sent_at timestamp with time zone,
    response_code integer,
    response_body text,
    created_at timestamp with time zone
);


ALTER TABLE public.deletion_alerts OWNER TO pgloader;

--
-- Name: deletion_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.deletion_alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.deletion_alerts_id_seq OWNER TO pgloader;

--
-- Name: deletion_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.deletion_alerts_id_seq OWNED BY public.deletion_alerts.id;


--
-- Name: deletion_audit_trail; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.deletion_audit_trail (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    tenant_name character varying(255) NOT NULL,
    user_count integer DEFAULT 0,
    deleted_by integer NOT NULL,
    deleted_by_ip character varying(45),
    deletion_reason text,
    metadata jsonb,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.deletion_audit_trail FORCE ROW LEVEL SECURITY;


ALTER TABLE public.deletion_audit_trail OWNER TO pgloader;

--
-- Name: deletion_audit_trail_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.deletion_audit_trail_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.deletion_audit_trail_id_seq OWNER TO pgloader;

--
-- Name: deletion_audit_trail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.deletion_audit_trail_id_seq OWNED BY public.deletion_audit_trail.id;


--
-- Name: deletion_dry_run_reports; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.deletion_dry_run_reports (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    requested_by integer NOT NULL,
    estimated_duration_seconds integer,
    total_affected_records integer,
    report_data jsonb,
    warnings jsonb,
    blockers jsonb,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.deletion_dry_run_reports FORCE ROW LEVEL SECURITY;


ALTER TABLE public.deletion_dry_run_reports OWNER TO pgloader;

--
-- Name: deletion_dry_run_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.deletion_dry_run_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.deletion_dry_run_reports_id_seq OWNER TO pgloader;

--
-- Name: deletion_dry_run_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.deletion_dry_run_reports_id_seq OWNED BY public.deletion_dry_run_reports.id;


--
-- Name: deletion_partial_options; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.deletion_partial_options (
    id integer NOT NULL,
    queue_id integer NOT NULL,
    option_name character varying(100) NOT NULL,
    included boolean DEFAULT true,
    created_at timestamp with time zone
);


ALTER TABLE public.deletion_partial_options OWNER TO pgloader;

--
-- Name: deletion_partial_options_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.deletion_partial_options_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.deletion_partial_options_id_seq OWNER TO pgloader;

--
-- Name: deletion_partial_options_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.deletion_partial_options_id_seq OWNED BY public.deletion_partial_options.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    department_lead_id integer,
    area_id integer,
    is_active smallint DEFAULT 1 NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    notes text,
    created_by integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.departments FORCE ROW LEVEL SECURITY;


ALTER TABLE public.departments OWNER TO pgloader;

--
-- Name: TABLE departments; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON TABLE public.departments IS 'Organizational departments within areas';


--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.departments_id_seq OWNER TO pgloader;

--
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- Name: document_permissions; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.document_permissions (
    id integer NOT NULL,
    document_id integer NOT NULL,
    user_id integer,
    department_id integer,
    team_id integer,
    permission_type public.document_permissions_permission_type NOT NULL,
    tenant_id integer NOT NULL,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.document_permissions FORCE ROW LEVEL SECURITY;


ALTER TABLE public.document_permissions OWNER TO pgloader;

--
-- Name: document_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.document_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_permissions_id_seq OWNER TO pgloader;

--
-- Name: document_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.document_permissions_id_seq OWNED BY public.document_permissions.id;


--
-- Name: document_read_status; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.document_read_status (
    id integer NOT NULL,
    document_id integer NOT NULL,
    user_id integer NOT NULL,
    tenant_id integer NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.document_read_status FORCE ROW LEVEL SECURITY;


ALTER TABLE public.document_read_status OWNER TO pgloader;

--
-- Name: document_read_status_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.document_read_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_read_status_id_seq OWNER TO pgloader;

--
-- Name: document_read_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.document_read_status_id_seq OWNED BY public.document_read_status.id;


--
-- Name: document_shares; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.document_shares (
    id integer NOT NULL,
    document_id integer NOT NULL,
    owner_tenant_id integer NOT NULL,
    shared_with_tenant_id integer NOT NULL,
    permissions jsonb,
    created_at timestamp with time zone,
    expires_at timestamp with time zone
);


ALTER TABLE public.document_shares OWNER TO pgloader;

--
-- Name: document_shares_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.document_shares_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_shares_id_seq OWNER TO pgloader;

--
-- Name: document_shares_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.document_shares_id_seq OWNED BY public.document_shares.id;


--
-- Name: documents; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.documents (
    id integer NOT NULL,
    uuid character(36) NOT NULL,
    file_uuid character varying(36),
    version integer DEFAULT 1,
    parent_version_id integer,
    tenant_id integer NOT NULL,
    access_scope public.documents_access_scope NOT NULL,
    owner_user_id integer,
    target_team_id integer,
    target_department_id integer,
    salary_year integer,
    salary_month integer,
    blackboard_entry_id integer,
    category character varying(50),
    filename character varying(255) NOT NULL,
    original_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size integer NOT NULL,
    file_checksum character varying(64),
    file_content bytea,
    storage_type public.documents_storage_type DEFAULT 'filesystem'::public.documents_storage_type,
    mime_type character varying(100),
    description text,
    tags jsonb,
    is_public boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    uploaded_at timestamp with time zone,
    archived_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_by integer,
    uuid_created_at timestamp with time zone
);

ALTER TABLE ONLY public.documents FORCE ROW LEVEL SECURITY;


ALTER TABLE public.documents OWNER TO pgloader;

--
-- Name: COLUMN documents.file_uuid; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.documents.file_uuid IS 'UUID v4 for unique filename';


--
-- Name: COLUMN documents.version; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.documents.version IS 'Version number for file versioning';


--
-- Name: COLUMN documents.parent_version_id; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.documents.parent_version_id IS 'Previous version ID for versioning';


--
-- Name: COLUMN documents.owner_user_id; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.documents.owner_user_id IS 'User who owns this document (for personal/payroll scopes)';


--
-- Name: COLUMN documents.target_team_id; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.documents.target_team_id IS 'Team that can access this document (for team scope)';


--
-- Name: COLUMN documents.target_department_id; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.documents.target_department_id IS 'Department that can access this document (for department scope)';


--
-- Name: COLUMN documents.salary_year; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.documents.salary_year IS 'Year for payroll documents (e.g., 2025)';


--
-- Name: COLUMN documents.salary_month; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.documents.salary_month IS 'Month for payroll documents (1-12)';


--
-- Name: COLUMN documents.category; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.documents.category IS 'Document type classification (flexible metadata)';


--
-- Name: COLUMN documents.file_checksum; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.documents.file_checksum IS 'SHA-256 hash for integrity verification';


--
-- Name: COLUMN documents.storage_type; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.documents.storage_type IS 'Where the file is stored';


--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.documents_id_seq OWNER TO pgloader;

--
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- Name: email_queue; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.email_queue (
    id integer NOT NULL,
    tenant_id integer,
    to_email character varying(255) NOT NULL,
    subject character varying(500),
    status public.email_queue_status DEFAULT 'pending'::public.email_queue_status,
    attempts integer DEFAULT 0,
    created_at timestamp with time zone,
    sent_at timestamp with time zone
);

ALTER TABLE ONLY public.email_queue FORCE ROW LEVEL SECURITY;


ALTER TABLE public.email_queue OWNER TO pgloader;

--
-- Name: email_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.email_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_queue_id_seq OWNER TO pgloader;

--
-- Name: email_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.email_queue_id_seq OWNED BY public.email_queue.id;


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.email_templates (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    template_key character varying(100) NOT NULL,
    subject character varying(255) NOT NULL,
    body_html text NOT NULL,
    body_text text,
    variables jsonb,
    is_system boolean DEFAULT false,
    is_active smallint DEFAULT 1,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.email_templates FORCE ROW LEVEL SECURITY;


ALTER TABLE public.email_templates OWNER TO pgloader;

--
-- Name: email_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.email_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_templates_id_seq OWNER TO pgloader;

--
-- Name: email_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.email_templates_id_seq OWNED BY public.email_templates.id;


--
-- Name: employee_availability; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.employee_availability (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    tenant_id integer NOT NULL,
    status public.employee_availability_status DEFAULT 'available'::public.employee_availability_status NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason character varying(255),
    notes text,
    created_by integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.employee_availability FORCE ROW LEVEL SECURITY;


ALTER TABLE public.employee_availability OWNER TO pgloader;

--
-- Name: employee_availability_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.employee_availability_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_availability_id_seq OWNER TO pgloader;

--
-- Name: employee_availability_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.employee_availability_id_seq OWNED BY public.employee_availability.id;


--
-- Name: failed_file_deletions; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.failed_file_deletions (
    id integer NOT NULL,
    queue_id integer NOT NULL,
    file_data jsonb,
    created_at timestamp with time zone,
    resolved boolean DEFAULT false,
    resolved_at timestamp with time zone,
    resolved_by integer
);


ALTER TABLE public.failed_file_deletions OWNER TO pgloader;

--
-- Name: failed_file_deletions_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.failed_file_deletions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.failed_file_deletions_id_seq OWNER TO pgloader;

--
-- Name: failed_file_deletions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.failed_file_deletions_id_seq OWNED BY public.failed_file_deletions.id;


--
-- Name: feature_usage_logs; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.feature_usage_logs (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    feature_id integer NOT NULL,
    user_id integer NOT NULL,
    action character varying(100) NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.feature_usage_logs FORCE ROW LEVEL SECURITY;


ALTER TABLE public.feature_usage_logs OWNER TO pgloader;

--
-- Name: feature_usage_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.feature_usage_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.feature_usage_logs_id_seq OWNER TO pgloader;

--
-- Name: feature_usage_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.feature_usage_logs_id_seq OWNED BY public.feature_usage_logs.id;


--
-- Name: features; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.features (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    category public.features_category DEFAULT 'basic'::public.features_category,
    base_price numeric(10,2) DEFAULT 0.00,
    is_active smallint DEFAULT 1,
    requires_setup boolean DEFAULT false,
    setup_instructions text,
    icon character varying(100),
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.features OWNER TO pgloader;

--
-- Name: TABLE features; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON TABLE public.features IS 'Global available features - NO RLS (shared across all tenants)';


--
-- Name: features_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.features_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.features_id_seq OWNER TO pgloader;

--
-- Name: features_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.features_id_seq OWNED BY public.features.id;


--
-- Name: kvp_attachments; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.kvp_attachments (
    id integer NOT NULL,
    file_uuid character varying(36) NOT NULL,
    suggestion_id integer NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_type character varying(100) NOT NULL,
    file_size integer NOT NULL,
    uploaded_by integer NOT NULL,
    uploaded_at timestamp with time zone
);


ALTER TABLE public.kvp_attachments OWNER TO pgloader;

--
-- Name: kvp_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.kvp_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kvp_attachments_id_seq OWNER TO pgloader;

--
-- Name: kvp_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.kvp_attachments_id_seq OWNED BY public.kvp_attachments.id;


--
-- Name: kvp_categories; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.kvp_categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    color character varying(20) DEFAULT '#3498db'::character varying,
    icon character varying(50) DEFAULT 'ðŸ’¡'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.kvp_categories OWNER TO pgloader;

--
-- Name: TABLE kvp_categories; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON TABLE public.kvp_categories IS 'Global KVP categories - NO RLS (shared across all tenants)';


--
-- Name: kvp_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.kvp_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kvp_categories_id_seq OWNER TO pgloader;

--
-- Name: kvp_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.kvp_categories_id_seq OWNED BY public.kvp_categories.id;


--
-- Name: kvp_comments; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.kvp_comments (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    suggestion_id integer NOT NULL,
    user_id integer NOT NULL,
    comment text NOT NULL,
    is_internal boolean DEFAULT false,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.kvp_comments FORCE ROW LEVEL SECURITY;


ALTER TABLE public.kvp_comments OWNER TO pgloader;

--
-- Name: kvp_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.kvp_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kvp_comments_id_seq OWNER TO pgloader;

--
-- Name: kvp_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.kvp_comments_id_seq OWNED BY public.kvp_comments.id;


--
-- Name: kvp_points; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.kvp_points (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    user_id integer NOT NULL,
    suggestion_id integer NOT NULL,
    points integer NOT NULL,
    reason public.kvp_points_reason NOT NULL,
    awarded_by integer NOT NULL,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.kvp_points FORCE ROW LEVEL SECURITY;


ALTER TABLE public.kvp_points OWNER TO pgloader;

--
-- Name: kvp_points_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.kvp_points_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kvp_points_id_seq OWNER TO pgloader;

--
-- Name: kvp_points_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.kvp_points_id_seq OWNED BY public.kvp_points.id;


--
-- Name: kvp_ratings; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.kvp_ratings (
    id integer NOT NULL,
    suggestion_id integer NOT NULL,
    user_id integer NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone
);


ALTER TABLE public.kvp_ratings OWNER TO pgloader;

--
-- Name: kvp_ratings_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.kvp_ratings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kvp_ratings_id_seq OWNER TO pgloader;

--
-- Name: kvp_ratings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.kvp_ratings_id_seq OWNED BY public.kvp_ratings.id;


--
-- Name: kvp_status_history; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.kvp_status_history (
    id integer NOT NULL,
    suggestion_id integer NOT NULL,
    old_status public.kvp_status_history_old_status,
    new_status public.kvp_status_history_new_status NOT NULL,
    changed_by integer NOT NULL,
    change_reason text,
    created_at timestamp with time zone
);


ALTER TABLE public.kvp_status_history OWNER TO pgloader;

--
-- Name: kvp_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.kvp_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kvp_status_history_id_seq OWNER TO pgloader;

--
-- Name: kvp_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.kvp_status_history_id_seq OWNED BY public.kvp_status_history.id;


--
-- Name: kvp_suggestions; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.kvp_suggestions (
    id integer NOT NULL,
    uuid character(36) NOT NULL,
    tenant_id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    category_id integer,
    department_id integer,
    org_level public.kvp_suggestions_org_level DEFAULT 'team'::public.kvp_suggestions_org_level NOT NULL,
    org_id integer NOT NULL,
    is_shared boolean DEFAULT false,
    submitted_by integer NOT NULL,
    team_id integer,
    assigned_to integer,
    status public.kvp_suggestions_status DEFAULT 'new'::public.kvp_suggestions_status,
    priority public.kvp_suggestions_priority DEFAULT 'normal'::public.kvp_suggestions_priority,
    expected_benefit text,
    estimated_cost text,
    actual_savings numeric(10,2),
    implementation_date date,
    rejection_reason text,
    shared_by integer,
    shared_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    uuid_created_at timestamp with time zone
);

ALTER TABLE ONLY public.kvp_suggestions FORCE ROW LEVEL SECURITY;


ALTER TABLE public.kvp_suggestions OWNER TO pgloader;

--
-- Name: COLUMN kvp_suggestions.org_level; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.kvp_suggestions.org_level IS 'Organization level for visibility: company (entire tenant), department, area (physical location), or team';


--
-- Name: COLUMN kvp_suggestions.is_shared; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.kvp_suggestions.is_shared IS 'FALSE = private (only creator + team_leader), TRUE = shared to org_level/org_id';


--
-- Name: COLUMN kvp_suggestions.estimated_cost; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.kvp_suggestions.estimated_cost IS 'Estimated cost as free text (can include currency symbols and descriptions)';


--
-- Name: COLUMN kvp_suggestions.uuid_created_at; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.kvp_suggestions.uuid_created_at IS 'Track when UUID was generated';


--
-- Name: kvp_suggestions_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.kvp_suggestions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kvp_suggestions_id_seq OWNER TO pgloader;

--
-- Name: kvp_suggestions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.kvp_suggestions_id_seq OWNED BY public.kvp_suggestions.id;


--
-- Name: kvp_votes; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.kvp_votes (
    id integer NOT NULL,
    suggestion_id integer NOT NULL,
    user_id integer NOT NULL,
    vote_type public.kvp_votes_vote_type NOT NULL,
    tenant_id integer NOT NULL,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.kvp_votes FORCE ROW LEVEL SECURITY;


ALTER TABLE public.kvp_votes OWNER TO pgloader;

--
-- Name: kvp_votes_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.kvp_votes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kvp_votes_id_seq OWNER TO pgloader;

--
-- Name: kvp_votes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.kvp_votes_id_seq OWNED BY public.kvp_votes.id;


--
-- Name: legal_holds; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.legal_holds (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    reason character varying(500) NOT NULL,
    case_number character varying(100),
    created_by integer NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone,
    expires_at timestamp with time zone,
    released_at timestamp with time zone,
    released_by integer
);

ALTER TABLE ONLY public.legal_holds FORCE ROW LEVEL SECURITY;


ALTER TABLE public.legal_holds OWNER TO pgloader;

--
-- Name: legal_holds_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.legal_holds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.legal_holds_id_seq OWNER TO pgloader;

--
-- Name: legal_holds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.legal_holds_id_seq OWNED BY public.legal_holds.id;


--
-- Name: login_attempts; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.login_attempts (
    id integer NOT NULL,
    username character varying(255) NOT NULL,
    ip_address character varying(45),
    success boolean DEFAULT false,
    attempted_at timestamp with time zone
);


ALTER TABLE public.login_attempts OWNER TO pgloader;

--
-- Name: login_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.login_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.login_attempts_id_seq OWNER TO pgloader;

--
-- Name: login_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.login_attempts_id_seq OWNED BY public.login_attempts.id;


--
-- Name: machine_categories; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.machine_categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    sort_order integer DEFAULT 0,
    is_active smallint DEFAULT 1
);


ALTER TABLE public.machine_categories OWNER TO pgloader;

--
-- Name: machine_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.machine_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.machine_categories_id_seq OWNER TO pgloader;

--
-- Name: machine_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.machine_categories_id_seq OWNED BY public.machine_categories.id;


--
-- Name: machine_documents; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.machine_documents (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    machine_id integer NOT NULL,
    document_type public.machine_documents_document_type NOT NULL,
    title character varying(200) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size integer,
    valid_from date,
    valid_until date,
    uploaded_at timestamp with time zone,
    uploaded_by integer
);

ALTER TABLE ONLY public.machine_documents FORCE ROW LEVEL SECURITY;


ALTER TABLE public.machine_documents OWNER TO pgloader;

--
-- Name: machine_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.machine_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.machine_documents_id_seq OWNER TO pgloader;

--
-- Name: machine_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.machine_documents_id_seq OWNED BY public.machine_documents.id;


--
-- Name: machine_maintenance_history; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.machine_maintenance_history (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    machine_id integer NOT NULL,
    maintenance_type public.machine_maintenance_history_maintenance_type NOT NULL,
    performed_date timestamp with time zone,
    performed_by integer,
    external_company character varying(100),
    description text,
    parts_replaced text,
    cost numeric(10,2),
    duration_hours numeric(5,2),
    status_after public.machine_maintenance_history_status_after DEFAULT 'operational'::public.machine_maintenance_history_status_after,
    next_maintenance_date date,
    report_url character varying(500),
    created_at timestamp with time zone,
    created_by integer
);

ALTER TABLE ONLY public.machine_maintenance_history FORCE ROW LEVEL SECURITY;


ALTER TABLE public.machine_maintenance_history OWNER TO pgloader;

--
-- Name: machine_maintenance_history_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.machine_maintenance_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.machine_maintenance_history_id_seq OWNER TO pgloader;

--
-- Name: machine_maintenance_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.machine_maintenance_history_id_seq OWNED BY public.machine_maintenance_history.id;


--
-- Name: machine_metrics; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.machine_metrics (
    id bigint NOT NULL,
    tenant_id integer NOT NULL,
    machine_id integer NOT NULL,
    metric_type character varying(50) NOT NULL,
    metric_value numeric(15,4) NOT NULL,
    unit character varying(20),
    recorded_at timestamp with time zone,
    is_anomaly boolean DEFAULT false
);

ALTER TABLE ONLY public.machine_metrics FORCE ROW LEVEL SECURITY;


ALTER TABLE public.machine_metrics OWNER TO pgloader;

--
-- Name: machine_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.machine_metrics_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.machine_metrics_id_seq OWNER TO pgloader;

--
-- Name: machine_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.machine_metrics_id_seq OWNED BY public.machine_metrics.id;


--
-- Name: machine_teams; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.machine_teams (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    machine_id integer NOT NULL,
    team_id integer NOT NULL,
    assigned_at timestamp with time zone,
    assigned_by integer,
    is_primary boolean DEFAULT false,
    notes text
);

ALTER TABLE ONLY public.machine_teams FORCE ROW LEVEL SECURITY;


ALTER TABLE public.machine_teams OWNER TO pgloader;

--
-- Name: TABLE machine_teams; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON TABLE public.machine_teams IS 'Junction table: which teams work on which machines';


--
-- Name: COLUMN machine_teams.is_primary; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.machine_teams.is_primary IS 'Main team responsible for this machine';


--
-- Name: machine_teams_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.machine_teams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.machine_teams_id_seq OWNER TO pgloader;

--
-- Name: machine_teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.machine_teams_id_seq OWNED BY public.machine_teams.id;


--
-- Name: machines; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.machines (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    name character varying(100) NOT NULL,
    model character varying(100),
    manufacturer character varying(100),
    serial_number character varying(100),
    asset_number character varying(50),
    department_id integer,
    area_id integer,
    location character varying(255),
    machine_type public.machines_machine_type DEFAULT 'production'::public.machines_machine_type,
    status public.machines_status DEFAULT 'operational'::public.machines_status,
    purchase_date date,
    installation_date date,
    warranty_until date,
    last_maintenance date,
    next_maintenance date,
    operating_hours numeric(10,2) DEFAULT 0.00,
    production_capacity character varying(100),
    energy_consumption character varying(100),
    manual_url character varying(500),
    qr_code character varying(100),
    notes text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    created_by integer,
    updated_by integer,
    is_active smallint DEFAULT 1
);

ALTER TABLE ONLY public.machines FORCE ROW LEVEL SECURITY;


ALTER TABLE public.machines OWNER TO pgloader;

--
-- Name: TABLE machines; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON TABLE public.machines IS 'Machines located in departments/areas';


--
-- Name: machines_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.machines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.machines_id_seq OWNER TO pgloader;

--
-- Name: machines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.machines_id_seq OWNED BY public.machines.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    conversation_id integer NOT NULL,
    sender_id integer NOT NULL,
    content text NOT NULL,
    attachment_path character varying(500),
    attachment_name character varying(255),
    attachment_type character varying(100),
    attachment_size bigint,
    is_system boolean DEFAULT false,
    created_at timestamp with time zone,
    deleted_at timestamp with time zone
);

ALTER TABLE ONLY public.messages FORCE ROW LEVEL SECURITY;


ALTER TABLE public.messages OWNER TO pgloader;

--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.messages_id_seq OWNER TO pgloader;

--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: migration_log; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.migration_log (
    id integer NOT NULL,
    migration_name character varying(255),
    executed_at timestamp with time zone,
    status character varying(50)
);


ALTER TABLE public.migration_log OWNER TO pgloader;

--
-- Name: migration_log_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.migration_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.migration_log_id_seq OWNER TO pgloader;

--
-- Name: migration_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.migration_log_id_seq OWNED BY public.migration_log.id;


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.notification_preferences (
    id integer NOT NULL,
    user_id integer NOT NULL,
    tenant_id integer NOT NULL,
    notification_type character varying(50) NOT NULL,
    email_notifications boolean DEFAULT true,
    push_notifications boolean DEFAULT true,
    sms_notifications boolean DEFAULT false,
    preferences jsonb,
    email_enabled boolean DEFAULT true,
    push_enabled boolean DEFAULT true,
    in_app_enabled boolean DEFAULT true,
    frequency public.notification_preferences_frequency DEFAULT 'immediate'::public.notification_preferences_frequency,
    quiet_hours_start time without time zone,
    quiet_hours_end time without time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.notification_preferences FORCE ROW LEVEL SECURITY;


ALTER TABLE public.notification_preferences OWNER TO pgloader;

--
-- Name: notification_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.notification_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_preferences_id_seq OWNER TO pgloader;

--
-- Name: notification_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.notification_preferences_id_seq OWNED BY public.notification_preferences.id;


--
-- Name: notification_read_status; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.notification_read_status (
    id integer NOT NULL,
    notification_id integer NOT NULL,
    user_id integer NOT NULL,
    tenant_id integer NOT NULL,
    read_at timestamp with time zone
);

ALTER TABLE ONLY public.notification_read_status FORCE ROW LEVEL SECURITY;


ALTER TABLE public.notification_read_status OWNER TO pgloader;

--
-- Name: notification_read_status_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.notification_read_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_read_status_id_seq OWNER TO pgloader;

--
-- Name: notification_read_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.notification_read_status_id_seq OWNED BY public.notification_read_status.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    priority public.notifications_priority DEFAULT 'normal'::public.notifications_priority,
    recipient_id integer,
    recipient_type public.notifications_recipient_type NOT NULL,
    action_url character varying(500),
    action_label character varying(100),
    metadata jsonb,
    scheduled_for timestamp with time zone,
    created_by integer NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.notifications FORCE ROW LEVEL SECURITY;


ALTER TABLE public.notifications OWNER TO pgloader;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO pgloader;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: oauth_tokens; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.oauth_tokens (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    user_id integer NOT NULL,
    token character varying(500) NOT NULL,
    token_type character varying(50),
    expires_at timestamp with time zone,
    revoked boolean DEFAULT false,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.oauth_tokens FORCE ROW LEVEL SECURITY;


ALTER TABLE public.oauth_tokens OWNER TO pgloader;

--
-- Name: oauth_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.oauth_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.oauth_tokens_id_seq OWNER TO pgloader;

--
-- Name: oauth_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.oauth_tokens_id_seq OWNED BY public.oauth_tokens.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token character varying(255) NOT NULL,
    expires_at timestamp with time zone,
    used boolean DEFAULT false,
    created_at timestamp with time zone
);


ALTER TABLE public.password_reset_tokens OWNER TO pgloader;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.password_reset_tokens_id_seq OWNER TO pgloader;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- Name: payment_history; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.payment_history (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    subscription_id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'EUR'::character varying,
    status public.payment_history_status DEFAULT 'pending'::public.payment_history_status,
    payment_method character varying(50),
    transaction_id character varying(100),
    invoice_number character varying(50),
    invoice_url character varying(500),
    failure_reason text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.payment_history FORCE ROW LEVEL SECURITY;


ALTER TABLE public.payment_history OWNER TO pgloader;

--
-- Name: payment_history_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.payment_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_history_id_seq OWNER TO pgloader;

--
-- Name: payment_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.payment_history_id_seq OWNED BY public.payment_history.id;


--
-- Name: plan_features; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.plan_features (
    id integer NOT NULL,
    plan_id integer NOT NULL,
    feature_id integer NOT NULL,
    is_included boolean DEFAULT true,
    created_at timestamp with time zone
);


ALTER TABLE public.plan_features OWNER TO pgloader;

--
-- Name: TABLE plan_features; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON TABLE public.plan_features IS 'Global plan-feature mapping - NO RLS (shared across all tenants)';


--
-- Name: plan_features_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.plan_features_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.plan_features_id_seq OWNER TO pgloader;

--
-- Name: plan_features_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.plan_features_id_seq OWNED BY public.plan_features.id;


--
-- Name: plans; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.plans (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    base_price numeric(10,2) DEFAULT 0.00 NOT NULL,
    max_employees integer,
    max_admins integer,
    max_storage_gb integer DEFAULT 100,
    is_active smallint DEFAULT 1,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.plans OWNER TO pgloader;

--
-- Name: TABLE plans; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON TABLE public.plans IS 'Global subscription plans - NO RLS (shared across all tenants)';


--
-- Name: plans_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.plans_id_seq OWNER TO pgloader;

--
-- Name: plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.plans_id_seq OWNED BY public.plans.id;


--
-- Name: recurring_jobs; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.recurring_jobs (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    job_name character varying(100) NOT NULL,
    cron_expression character varying(100) NOT NULL,
    active boolean DEFAULT true,
    last_run timestamp with time zone,
    next_run timestamp with time zone,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.recurring_jobs FORCE ROW LEVEL SECURITY;


ALTER TABLE public.recurring_jobs OWNER TO pgloader;

--
-- Name: recurring_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.recurring_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.recurring_jobs_id_seq OWNER TO pgloader;

--
-- Name: recurring_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.recurring_jobs_id_seq OWNED BY public.recurring_jobs.id;


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.refresh_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    tenant_id integer NOT NULL,
    token_hash character varying(64) NOT NULL,
    token_family character varying(36) NOT NULL,
    expires_at timestamp with time zone,
    is_revoked boolean DEFAULT false,
    used_at timestamp with time zone,
    replaced_by_hash character varying(64),
    created_at timestamp with time zone,
    ip_address character varying(45),
    user_agent character varying(512)
);

ALTER TABLE ONLY public.refresh_tokens FORCE ROW LEVEL SECURITY;


ALTER TABLE public.refresh_tokens OWNER TO pgloader;

--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON TABLE public.refresh_tokens IS 'Stores refresh token hashes for rotation and reuse detection';


--
-- Name: COLUMN refresh_tokens.token_hash; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.refresh_tokens.token_hash IS 'SHA-256 hash of the refresh token';


--
-- Name: COLUMN refresh_tokens.token_family; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.refresh_tokens.token_family IS 'UUID to track token chain for reuse detection';


--
-- Name: COLUMN refresh_tokens.is_revoked; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.refresh_tokens.is_revoked IS 'TRUE when token is invalidated';


--
-- Name: COLUMN refresh_tokens.used_at; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.refresh_tokens.used_at IS 'When token was used for refresh (for reuse detection)';


--
-- Name: COLUMN refresh_tokens.replaced_by_hash; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.refresh_tokens.replaced_by_hash IS 'Hash of the replacement token';


--
-- Name: COLUMN refresh_tokens.ip_address; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.refresh_tokens.ip_address IS 'IPv4 or IPv6 address';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.refresh_tokens_id_seq OWNER TO pgloader;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;


--
-- Name: released_subdomains; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.released_subdomains (
    id integer NOT NULL,
    subdomain character varying(50) NOT NULL,
    original_tenant_id integer,
    original_company_name character varying(255),
    released_at timestamp with time zone,
    reused boolean DEFAULT false,
    reused_at timestamp with time zone,
    new_tenant_id integer
);


ALTER TABLE public.released_subdomains OWNER TO pgloader;

--
-- Name: released_subdomains_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.released_subdomains_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.released_subdomains_id_seq OWNER TO pgloader;

--
-- Name: released_subdomains_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.released_subdomains_id_seq OWNED BY public.released_subdomains.id;


--
-- Name: root_logs; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.root_logs (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    user_id integer NOT NULL,
    action character varying(100) NOT NULL,
    entity_type character varying(50),
    entity_id integer,
    details text,
    old_values jsonb,
    new_values jsonb,
    ip_address character varying(45),
    user_agent text,
    was_role_switched boolean DEFAULT false,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.root_logs FORCE ROW LEVEL SECURITY;


ALTER TABLE public.root_logs OWNER TO pgloader;

--
-- Name: TABLE root_logs; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON TABLE public.root_logs IS 'Logs all administrative actions performed by users';


--
-- Name: COLUMN root_logs.was_role_switched; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.root_logs.was_role_switched IS 'Indicates if the action was performed while user had switched roles';


--
-- Name: root_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.root_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.root_logs_id_seq OWNER TO pgloader;

--
-- Name: root_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.root_logs_id_seq OWNED BY public.root_logs.id;


--
-- Name: scheduled_tasks; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.scheduled_tasks (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    task_type character varying(50) NOT NULL,
    task_data jsonb,
    scheduled_at timestamp with time zone,
    executed boolean DEFAULT false,
    executed_at timestamp with time zone,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.scheduled_tasks FORCE ROW LEVEL SECURITY;


ALTER TABLE public.scheduled_tasks OWNER TO pgloader;

--
-- Name: scheduled_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.scheduled_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.scheduled_tasks_id_seq OWNER TO pgloader;

--
-- Name: scheduled_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.scheduled_tasks_id_seq OWNED BY public.scheduled_tasks.id;


--
-- Name: security_logs; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.security_logs (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    user_id integer,
    action public.security_logs_action NOT NULL,
    ip_address character varying(45),
    user_agent text,
    details jsonb,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.security_logs FORCE ROW LEVEL SECURITY;


ALTER TABLE public.security_logs OWNER TO pgloader;

--
-- Name: security_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.security_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.security_logs_id_seq OWNER TO pgloader;

--
-- Name: security_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.security_logs_id_seq OWNED BY public.security_logs.id;


--
-- Name: shift_assignments; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.shift_assignments (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    shift_id integer NOT NULL,
    user_id integer NOT NULL,
    assignment_type public.shift_assignments_assignment_type DEFAULT 'assigned'::public.shift_assignments_assignment_type,
    status public.shift_assignments_status DEFAULT 'pending'::public.shift_assignments_status,
    assigned_by integer,
    assigned_at timestamp with time zone,
    response_at timestamp with time zone,
    notes text,
    overtime_hours numeric(4,2) DEFAULT 0.00,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.shift_assignments FORCE ROW LEVEL SECURITY;


ALTER TABLE public.shift_assignments OWNER TO pgloader;

--
-- Name: shift_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.shift_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shift_assignments_id_seq OWNER TO pgloader;

--
-- Name: shift_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.shift_assignments_id_seq OWNED BY public.shift_assignments.id;


--
-- Name: shift_favorites; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.shift_favorites (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    user_id integer NOT NULL,
    name character varying(100) NOT NULL,
    area_id integer NOT NULL,
    area_name character varying(100) NOT NULL,
    department_id integer NOT NULL,
    department_name character varying(100) NOT NULL,
    machine_id integer NOT NULL,
    machine_name character varying(100) NOT NULL,
    team_id integer NOT NULL,
    team_name character varying(100) NOT NULL,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.shift_favorites FORCE ROW LEVEL SECURITY;


ALTER TABLE public.shift_favorites OWNER TO pgloader;

--
-- Name: TABLE shift_favorites; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON TABLE public.shift_favorites IS 'Stores user-specific favorite filter combinations for shift planning';


--
-- Name: shift_favorites_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.shift_favorites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shift_favorites_id_seq OWNER TO pgloader;

--
-- Name: shift_favorites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.shift_favorites_id_seq OWNED BY public.shift_favorites.id;


--
-- Name: shift_plans; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.shift_plans (
    id integer NOT NULL,
    uuid character(36) NOT NULL,
    tenant_id integer NOT NULL,
    name character varying(200) NOT NULL,
    shift_notes text,
    department_id integer,
    team_id integer,
    machine_id integer,
    area_id integer,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status public.shift_plans_status DEFAULT 'draft'::public.shift_plans_status,
    created_by integer NOT NULL,
    approved_by integer,
    approved_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    uuid_created_at timestamp with time zone
);

ALTER TABLE ONLY public.shift_plans FORCE ROW LEVEL SECURITY;


ALTER TABLE public.shift_plans OWNER TO pgloader;

--
-- Name: shift_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.shift_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shift_plans_id_seq OWNER TO pgloader;

--
-- Name: shift_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.shift_plans_id_seq OWNED BY public.shift_plans.id;


--
-- Name: shift_rotation_assignments; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.shift_rotation_assignments (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    pattern_id integer NOT NULL,
    user_id integer NOT NULL,
    team_id integer,
    shift_group public.shift_rotation_assignments_shift_group NOT NULL,
    rotation_order integer DEFAULT 0,
    can_override boolean DEFAULT true,
    override_dates jsonb,
    is_active smallint DEFAULT 1 NOT NULL,
    starts_at date NOT NULL,
    ends_at date,
    assigned_by integer NOT NULL,
    assigned_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.shift_rotation_assignments FORCE ROW LEVEL SECURITY;


ALTER TABLE public.shift_rotation_assignments OWNER TO pgloader;

--
-- Name: shift_rotation_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.shift_rotation_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shift_rotation_assignments_id_seq OWNER TO pgloader;

--
-- Name: shift_rotation_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.shift_rotation_assignments_id_seq OWNED BY public.shift_rotation_assignments.id;


--
-- Name: shift_rotation_history; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.shift_rotation_history (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    pattern_id integer NOT NULL,
    assignment_id integer NOT NULL,
    user_id integer NOT NULL,
    team_id integer,
    shift_date date NOT NULL,
    shift_type public.shift_rotation_history_shift_type NOT NULL,
    week_number integer NOT NULL,
    status public.shift_rotation_history_status DEFAULT 'generated'::public.shift_rotation_history_status,
    modified_reason text,
    generated_at timestamp with time zone,
    confirmed_at timestamp with time zone,
    confirmed_by integer
);

ALTER TABLE ONLY public.shift_rotation_history FORCE ROW LEVEL SECURITY;


ALTER TABLE public.shift_rotation_history OWNER TO pgloader;

--
-- Name: shift_rotation_history_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.shift_rotation_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shift_rotation_history_id_seq OWNER TO pgloader;

--
-- Name: shift_rotation_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.shift_rotation_history_id_seq OWNED BY public.shift_rotation_history.id;


--
-- Name: shift_rotation_patterns; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.shift_rotation_patterns (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    team_id integer,
    name character varying(100) NOT NULL,
    description text,
    pattern_type public.shift_rotation_patterns_pattern_type DEFAULT 'alternate_fs'::public.shift_rotation_patterns_pattern_type NOT NULL,
    pattern_config jsonb NOT NULL,
    cycle_length_weeks integer DEFAULT 2 NOT NULL,
    starts_at date NOT NULL,
    ends_at date,
    is_active smallint DEFAULT 1 NOT NULL,
    created_by integer NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.shift_rotation_patterns FORCE ROW LEVEL SECURITY;


ALTER TABLE public.shift_rotation_patterns OWNER TO pgloader;

--
-- Name: shift_rotation_patterns_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.shift_rotation_patterns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shift_rotation_patterns_id_seq OWNER TO pgloader;

--
-- Name: shift_rotation_patterns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.shift_rotation_patterns_id_seq OWNED BY public.shift_rotation_patterns.id;


--
-- Name: shift_swap_requests; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.shift_swap_requests (
    id integer NOT NULL,
    assignment_id integer NOT NULL,
    requested_by integer NOT NULL,
    requested_with integer,
    reason text,
    status public.shift_swap_requests_status DEFAULT 'pending'::public.shift_swap_requests_status,
    approved_by integer,
    tenant_id integer NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.shift_swap_requests FORCE ROW LEVEL SECURITY;


ALTER TABLE public.shift_swap_requests OWNER TO pgloader;

--
-- Name: shift_swap_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.shift_swap_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shift_swap_requests_id_seq OWNER TO pgloader;

--
-- Name: shift_swap_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.shift_swap_requests_id_seq OWNED BY public.shift_swap_requests.id;


--
-- Name: shift_templates; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.shift_templates (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    name character varying(100) NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    break_minutes integer DEFAULT 0,
    color character varying(7) DEFAULT '#3498db'::character varying,
    is_night_shift boolean DEFAULT false,
    is_active smallint DEFAULT 1,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.shift_templates FORCE ROW LEVEL SECURITY;


ALTER TABLE public.shift_templates OWNER TO pgloader;

--
-- Name: shift_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.shift_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shift_templates_id_seq OWNER TO pgloader;

--
-- Name: shift_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.shift_templates_id_seq OWNED BY public.shift_templates.id;


--
-- Name: shifts; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.shifts (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    area_id integer,
    plan_id integer,
    user_id integer NOT NULL,
    template_id integer,
    date date NOT NULL,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    title character varying(200),
    required_employees integer DEFAULT 1,
    actual_start timestamp with time zone,
    actual_end timestamp with time zone,
    break_minutes integer DEFAULT 0,
    status public.shifts_status DEFAULT 'planned'::public.shifts_status,
    type public.shifts_type DEFAULT 'regular'::public.shifts_type,
    notes text,
    department_id integer NOT NULL,
    team_id integer,
    machine_id integer,
    created_by integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    metadata jsonb
);

ALTER TABLE ONLY public.shifts FORCE ROW LEVEL SECURITY;


ALTER TABLE public.shifts OWNER TO pgloader;

--
-- Name: COLUMN shifts.metadata; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.shifts.metadata IS 'Flexible metadata for notes, tags, etc.';


--
-- Name: shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shifts_id_seq OWNER TO pgloader;

--
-- Name: shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.shifts_id_seq OWNED BY public.shifts.id;


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.subscription_plans (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    price_monthly numeric(10,2) NOT NULL,
    price_yearly numeric(10,2),
    max_users integer,
    max_storage_gb integer,
    features jsonb,
    is_active smallint DEFAULT 1,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.subscription_plans OWNER TO pgloader;

--
-- Name: subscription_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.subscription_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subscription_plans_id_seq OWNER TO pgloader;

--
-- Name: subscription_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.subscription_plans_id_seq OWNED BY public.subscription_plans.id;


--
-- Name: survey_answers; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.survey_answers (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    response_id integer NOT NULL,
    question_id integer NOT NULL,
    answer_text text,
    answer_options jsonb,
    answer_number numeric(10,2),
    answer_date date,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.survey_answers FORCE ROW LEVEL SECURITY;


ALTER TABLE public.survey_answers OWNER TO pgloader;

--
-- Name: survey_answers_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.survey_answers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.survey_answers_id_seq OWNER TO pgloader;

--
-- Name: survey_answers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.survey_answers_id_seq OWNED BY public.survey_answers.id;


--
-- Name: survey_assignments; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.survey_assignments (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    survey_id integer NOT NULL,
    assignment_type public.survey_assignments_assignment_type NOT NULL,
    department_id integer,
    team_id integer,
    user_id integer,
    area_id integer,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.survey_assignments FORCE ROW LEVEL SECURITY;


ALTER TABLE public.survey_assignments OWNER TO pgloader;

--
-- Name: survey_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.survey_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.survey_assignments_id_seq OWNER TO pgloader;

--
-- Name: survey_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.survey_assignments_id_seq OWNED BY public.survey_assignments.id;


--
-- Name: survey_comments; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.survey_comments (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    survey_id integer NOT NULL,
    user_id integer NOT NULL,
    comment text NOT NULL,
    is_public boolean DEFAULT false,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.survey_comments FORCE ROW LEVEL SECURITY;


ALTER TABLE public.survey_comments OWNER TO pgloader;

--
-- Name: survey_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.survey_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.survey_comments_id_seq OWNER TO pgloader;

--
-- Name: survey_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.survey_comments_id_seq OWNED BY public.survey_comments.id;


--
-- Name: survey_participants; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.survey_participants (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    survey_id integer NOT NULL,
    user_id integer NOT NULL,
    invited_at timestamp with time zone,
    reminder_sent_at timestamp with time zone,
    completed boolean DEFAULT false
);

ALTER TABLE ONLY public.survey_participants FORCE ROW LEVEL SECURITY;


ALTER TABLE public.survey_participants OWNER TO pgloader;

--
-- Name: survey_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.survey_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.survey_participants_id_seq OWNER TO pgloader;

--
-- Name: survey_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.survey_participants_id_seq OWNED BY public.survey_participants.id;


--
-- Name: survey_question_options; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.survey_question_options (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    question_id integer NOT NULL,
    option_text character varying(500) NOT NULL,
    order_position integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.survey_question_options FORCE ROW LEVEL SECURITY;


ALTER TABLE public.survey_question_options OWNER TO pgloader;

--
-- Name: survey_question_options_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.survey_question_options_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.survey_question_options_id_seq OWNER TO pgloader;

--
-- Name: survey_question_options_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.survey_question_options_id_seq OWNED BY public.survey_question_options.id;


--
-- Name: survey_questions; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.survey_questions (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    survey_id integer NOT NULL,
    question_text text NOT NULL,
    question_type public.survey_questions_question_type NOT NULL,
    is_required boolean DEFAULT true,
    validation_rules jsonb,
    order_index integer DEFAULT 0,
    help_text text,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.survey_questions FORCE ROW LEVEL SECURITY;


ALTER TABLE public.survey_questions OWNER TO pgloader;

--
-- Name: COLUMN survey_questions.validation_rules; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.survey_questions.validation_rules IS 'Validation rules for text/number inputs (not for choice options)';


--
-- Name: survey_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.survey_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.survey_questions_id_seq OWNER TO pgloader;

--
-- Name: survey_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.survey_questions_id_seq OWNED BY public.survey_questions.id;


--
-- Name: survey_reminders; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.survey_reminders (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    survey_id integer NOT NULL,
    reminder_date timestamp with time zone,
    message text,
    is_sent boolean DEFAULT false,
    sent_at timestamp with time zone,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.survey_reminders FORCE ROW LEVEL SECURITY;


ALTER TABLE public.survey_reminders OWNER TO pgloader;

--
-- Name: survey_reminders_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.survey_reminders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.survey_reminders_id_seq OWNER TO pgloader;

--
-- Name: survey_reminders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.survey_reminders_id_seq OWNED BY public.survey_reminders.id;


--
-- Name: survey_responses; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.survey_responses (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    survey_id integer NOT NULL,
    user_id integer,
    session_id character varying(100),
    status public.survey_responses_status DEFAULT 'in_progress'::public.survey_responses_status,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    ip_address character varying(45),
    user_agent text
);

ALTER TABLE ONLY public.survey_responses FORCE ROW LEVEL SECURITY;


ALTER TABLE public.survey_responses OWNER TO pgloader;

--
-- Name: survey_responses_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.survey_responses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.survey_responses_id_seq OWNER TO pgloader;

--
-- Name: survey_responses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.survey_responses_id_seq OWNED BY public.survey_responses.id;


--
-- Name: survey_templates; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.survey_templates (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(50),
    template_data jsonb NOT NULL,
    is_public boolean DEFAULT false,
    created_by integer NOT NULL,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.survey_templates FORCE ROW LEVEL SECURITY;


ALTER TABLE public.survey_templates OWNER TO pgloader;

--
-- Name: survey_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.survey_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.survey_templates_id_seq OWNER TO pgloader;

--
-- Name: survey_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.survey_templates_id_seq OWNED BY public.survey_templates.id;


--
-- Name: surveys; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.surveys (
    id integer NOT NULL,
    uuid character(36) NOT NULL,
    tenant_id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    type public.surveys_type DEFAULT 'feedback'::public.surveys_type,
    status public.surveys_status DEFAULT 'draft'::public.surveys_status,
    is_anonymous boolean DEFAULT false,
    is_mandatory boolean DEFAULT false,
    allow_multiple_responses boolean DEFAULT false,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    created_by integer NOT NULL,
    notification_sent boolean DEFAULT false,
    reminder_sent boolean DEFAULT false,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    uuid_created_at timestamp with time zone
);

ALTER TABLE ONLY public.surveys FORCE ROW LEVEL SECURITY;


ALTER TABLE public.surveys OWNER TO pgloader;

--
-- Name: TABLE surveys; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON TABLE public.surveys IS 'Survey definitions - assignment targets now managed via survey_assignments table';


--
-- Name: COLUMN surveys.is_mandatory; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.surveys.is_mandatory IS 'Whether survey completion is mandatory';


--
-- Name: surveys_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.surveys_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.surveys_id_seq OWNER TO pgloader;

--
-- Name: surveys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.surveys_id_seq OWNED BY public.surveys.id;


--
-- Name: system_logs; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.system_logs (
    id integer NOT NULL,
    level public.system_logs_level NOT NULL,
    category character varying(50) NOT NULL,
    message text NOT NULL,
    context jsonb,
    stack_trace text,
    created_at timestamp with time zone
);


ALTER TABLE public.system_logs OWNER TO pgloader;

--
-- Name: system_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.system_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_logs_id_seq OWNER TO pgloader;

--
-- Name: system_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.system_logs_id_seq OWNED BY public.system_logs.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    setting_key character varying(100) NOT NULL,
    setting_value text,
    value_type public.system_settings_value_type DEFAULT 'string'::public.system_settings_value_type,
    category character varying(50),
    description text,
    is_public boolean DEFAULT false,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.system_settings OWNER TO pgloader;

--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_settings_id_seq OWNER TO pgloader;

--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: teams; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.teams (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    department_id integer,
    name character varying(100) NOT NULL,
    description text,
    team_lead_id integer,
    is_active smallint DEFAULT 1,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    created_by integer
);

ALTER TABLE ONLY public.teams FORCE ROW LEVEL SECURITY;


ALTER TABLE public.teams OWNER TO pgloader;

--
-- Name: TABLE teams; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON TABLE public.teams IS 'Teams that work in departments and operate machines';


--
-- Name: teams_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.teams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.teams_id_seq OWNER TO pgloader;

--
-- Name: teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.teams_id_seq OWNED BY public.teams.id;


--
-- Name: tenant_addons; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.tenant_addons (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    addon_type public.tenant_addons_addon_type NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    total_price numeric(10,2),
    status public.tenant_addons_status DEFAULT 'active'::public.tenant_addons_status,
    started_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.tenant_addons FORCE ROW LEVEL SECURITY;


ALTER TABLE public.tenant_addons OWNER TO pgloader;

--
-- Name: tenant_addons_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.tenant_addons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tenant_addons_id_seq OWNER TO pgloader;

--
-- Name: tenant_addons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.tenant_addons_id_seq OWNED BY public.tenant_addons.id;


--
-- Name: tenant_data_exports; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.tenant_data_exports (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size bigint,
    checksum character varying(64),
    created_at timestamp with time zone,
    expires_at timestamp with time zone,
    downloaded boolean DEFAULT false,
    downloaded_at timestamp with time zone,
    downloaded_by integer
);

ALTER TABLE ONLY public.tenant_data_exports FORCE ROW LEVEL SECURITY;


ALTER TABLE public.tenant_data_exports OWNER TO pgloader;

--
-- Name: tenant_data_exports_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.tenant_data_exports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tenant_data_exports_id_seq OWNER TO pgloader;

--
-- Name: tenant_data_exports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.tenant_data_exports_id_seq OWNED BY public.tenant_data_exports.id;


--
-- Name: tenant_deletion_approvals; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.tenant_deletion_approvals (
    id integer NOT NULL,
    queue_id integer NOT NULL,
    approver_id integer NOT NULL,
    action public.tenant_deletion_approvals_action NOT NULL,
    comment text,
    created_at timestamp with time zone
);


ALTER TABLE public.tenant_deletion_approvals OWNER TO pgloader;

--
-- Name: tenant_deletion_approvals_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.tenant_deletion_approvals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tenant_deletion_approvals_id_seq OWNER TO pgloader;

--
-- Name: tenant_deletion_approvals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.tenant_deletion_approvals_id_seq OWNED BY public.tenant_deletion_approvals.id;


--
-- Name: tenant_deletion_backups; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.tenant_deletion_backups (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    backup_file character varying(500) NOT NULL,
    backup_size bigint,
    backup_type public.tenant_deletion_backups_backup_type DEFAULT 'final'::public.tenant_deletion_backups_backup_type,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.tenant_deletion_backups FORCE ROW LEVEL SECURITY;


ALTER TABLE public.tenant_deletion_backups OWNER TO pgloader;

--
-- Name: tenant_deletion_backups_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.tenant_deletion_backups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tenant_deletion_backups_id_seq OWNER TO pgloader;

--
-- Name: tenant_deletion_backups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.tenant_deletion_backups_id_seq OWNED BY public.tenant_deletion_backups.id;


--
-- Name: tenant_deletion_log; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.tenant_deletion_log (
    id integer NOT NULL,
    queue_id integer NOT NULL,
    step_name character varying(100),
    table_name character varying(100),
    records_deleted integer DEFAULT 0,
    duration_ms integer,
    status public.tenant_deletion_log_status,
    error_message text,
    created_at timestamp with time zone
);


ALTER TABLE public.tenant_deletion_log OWNER TO pgloader;

--
-- Name: tenant_deletion_log_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.tenant_deletion_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tenant_deletion_log_id_seq OWNER TO pgloader;

--
-- Name: tenant_deletion_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.tenant_deletion_log_id_seq OWNED BY public.tenant_deletion_log.id;


--
-- Name: tenant_deletion_queue; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.tenant_deletion_queue (
    id integer NOT NULL,
    tenant_id integer,
    status public.tenant_deletion_queue_status DEFAULT 'queued'::public.tenant_deletion_queue_status,
    progress integer DEFAULT 0,
    current_step character varying(100),
    total_steps integer DEFAULT 0,
    error_message text,
    retry_count integer DEFAULT 0,
    grace_period_days integer DEFAULT 30,
    scheduled_deletion_date timestamp with time zone,
    created_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_by integer,
    approval_required boolean DEFAULT true,
    second_approver_id integer,
    approval_requested_at timestamp with time zone,
    approved_at timestamp with time zone,
    approval_status public.tenant_deletion_queue_approval_status DEFAULT 'pending'::public.tenant_deletion_queue_approval_status,
    deletion_reason text,
    ip_address character varying(45),
    emergency_stop boolean DEFAULT false,
    emergency_stopped_at timestamp with time zone,
    emergency_stopped_by integer,
    cooling_off_hours integer DEFAULT 24
);

ALTER TABLE ONLY public.tenant_deletion_queue FORCE ROW LEVEL SECURITY;


ALTER TABLE public.tenant_deletion_queue OWNER TO pgloader;

--
-- Name: tenant_deletion_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.tenant_deletion_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tenant_deletion_queue_id_seq OWNER TO pgloader;

--
-- Name: tenant_deletion_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.tenant_deletion_queue_id_seq OWNED BY public.tenant_deletion_queue.id;


--
-- Name: tenant_deletion_rollback; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.tenant_deletion_rollback (
    id integer NOT NULL,
    queue_id integer NOT NULL,
    rollback_data text,
    can_rollback boolean DEFAULT true,
    rollback_expires_at timestamp with time zone,
    created_at timestamp with time zone,
    rolled_back boolean DEFAULT false,
    rolled_back_at timestamp with time zone,
    rolled_back_by integer
);


ALTER TABLE public.tenant_deletion_rollback OWNER TO pgloader;

--
-- Name: tenant_deletion_rollback_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.tenant_deletion_rollback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tenant_deletion_rollback_id_seq OWNER TO pgloader;

--
-- Name: tenant_deletion_rollback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.tenant_deletion_rollback_id_seq OWNED BY public.tenant_deletion_rollback.id;


--
-- Name: tenant_features; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.tenant_features (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    feature_id integer NOT NULL,
    is_active smallint DEFAULT 1,
    activated_at timestamp with time zone,
    activated_by integer,
    expires_at timestamp with time zone,
    custom_config jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.tenant_features FORCE ROW LEVEL SECURITY;


ALTER TABLE public.tenant_features OWNER TO pgloader;

--
-- Name: tenant_features_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.tenant_features_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tenant_features_id_seq OWNER TO pgloader;

--
-- Name: tenant_features_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.tenant_features_id_seq OWNED BY public.tenant_features.id;


--
-- Name: tenant_plans; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.tenant_plans (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    plan_id integer NOT NULL,
    status public.tenant_plans_status DEFAULT 'active'::public.tenant_plans_status,
    started_at timestamp with time zone,
    expires_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    custom_price numeric(10,2),
    billing_cycle public.tenant_plans_billing_cycle DEFAULT 'monthly'::public.tenant_plans_billing_cycle,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.tenant_plans FORCE ROW LEVEL SECURITY;


ALTER TABLE public.tenant_plans OWNER TO pgloader;

--
-- Name: tenant_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.tenant_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tenant_plans_id_seq OWNER TO pgloader;

--
-- Name: tenant_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.tenant_plans_id_seq OWNED BY public.tenant_plans.id;


--
-- Name: tenant_settings; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.tenant_settings (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    setting_key character varying(100) NOT NULL,
    setting_value text,
    value_type public.tenant_settings_value_type DEFAULT 'string'::public.tenant_settings_value_type,
    category character varying(50),
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.tenant_settings FORCE ROW LEVEL SECURITY;


ALTER TABLE public.tenant_settings OWNER TO pgloader;

--
-- Name: tenant_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.tenant_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tenant_settings_id_seq OWNER TO pgloader;

--
-- Name: tenant_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.tenant_settings_id_seq OWNED BY public.tenant_settings.id;


--
-- Name: tenant_subscriptions; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.tenant_subscriptions (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    plan_id integer,
    status public.tenant_subscriptions_status DEFAULT 'active'::public.tenant_subscriptions_status,
    started_at timestamp with time zone,
    expires_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    stripe_subscription_id character varying(255)
);

ALTER TABLE ONLY public.tenant_subscriptions FORCE ROW LEVEL SECURITY;


ALTER TABLE public.tenant_subscriptions OWNER TO pgloader;

--
-- Name: tenant_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.tenant_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tenant_subscriptions_id_seq OWNER TO pgloader;

--
-- Name: tenant_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.tenant_subscriptions_id_seq OWNED BY public.tenant_subscriptions.id;


--
-- Name: tenant_webhooks; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.tenant_webhooks (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    url character varying(500) NOT NULL,
    events jsonb,
    active boolean DEFAULT true,
    secret character varying(100),
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.tenant_webhooks FORCE ROW LEVEL SECURITY;


ALTER TABLE public.tenant_webhooks OWNER TO pgloader;

--
-- Name: tenant_webhooks_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.tenant_webhooks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tenant_webhooks_id_seq OWNER TO pgloader;

--
-- Name: tenant_webhooks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.tenant_webhooks_id_seq OWNED BY public.tenant_webhooks.id;


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.tenants (
    id integer NOT NULL,
    company_name character varying(255) NOT NULL,
    subdomain character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(30),
    address text,
    status public.tenants_status DEFAULT 'trial'::public.tenants_status,
    trial_ends_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    settings jsonb,
    stripe_customer_id character varying(255),
    stripe_subscription_id character varying(255),
    current_plan public.tenants_current_plan DEFAULT 'basic'::public.tenants_current_plan,
    billing_email character varying(255),
    logo_url character varying(500),
    primary_color character varying(7) DEFAULT '#0066cc'::character varying,
    created_by integer,
    current_plan_id integer,
    deletion_status public.tenants_deletion_status DEFAULT 'active'::public.tenants_deletion_status,
    deletion_requested_at timestamp with time zone,
    deletion_requested_by integer
);

ALTER TABLE ONLY public.tenants FORCE ROW LEVEL SECURITY;


ALTER TABLE public.tenants OWNER TO pgloader;

--
-- Name: tenants_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.tenants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tenants_id_seq OWNER TO pgloader;

--
-- Name: tenants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.tenants_id_seq OWNED BY public.tenants.id;


--
-- Name: usage_quotas; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.usage_quotas (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    resource_type public.usage_quotas_resource_type NOT NULL,
    used_amount integer DEFAULT 0,
    limit_amount integer,
    reset_period public.usage_quotas_reset_period DEFAULT 'monthly'::public.usage_quotas_reset_period,
    last_reset timestamp with time zone
);

ALTER TABLE ONLY public.usage_quotas FORCE ROW LEVEL SECURITY;


ALTER TABLE public.usage_quotas OWNER TO pgloader;

--
-- Name: usage_quotas_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.usage_quotas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usage_quotas_id_seq OWNER TO pgloader;

--
-- Name: usage_quotas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.usage_quotas_id_seq OWNED BY public.usage_quotas.id;


--
-- Name: user_2fa_backup_codes; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.user_2fa_backup_codes (
    id integer NOT NULL,
    user_id integer NOT NULL,
    code_hash character varying(64) NOT NULL,
    used boolean DEFAULT false,
    used_at timestamp with time zone,
    created_at timestamp with time zone
);


ALTER TABLE public.user_2fa_backup_codes OWNER TO pgloader;

--
-- Name: user_2fa_backup_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.user_2fa_backup_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_2fa_backup_codes_id_seq OWNER TO pgloader;

--
-- Name: user_2fa_backup_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.user_2fa_backup_codes_id_seq OWNED BY public.user_2fa_backup_codes.id;


--
-- Name: user_2fa_secrets; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.user_2fa_secrets (
    id integer NOT NULL,
    user_id integer NOT NULL,
    secret character varying(100) NOT NULL,
    enabled boolean DEFAULT false,
    created_at timestamp with time zone
);


ALTER TABLE public.user_2fa_secrets OWNER TO pgloader;

--
-- Name: user_2fa_secrets_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.user_2fa_secrets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_2fa_secrets_id_seq OWNER TO pgloader;

--
-- Name: user_2fa_secrets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.user_2fa_secrets_id_seq OWNED BY public.user_2fa_secrets.id;


--
-- Name: user_departments; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.user_departments (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    user_id integer NOT NULL,
    department_id integer NOT NULL,
    is_primary boolean DEFAULT true NOT NULL,
    assigned_by integer,
    assigned_at timestamp with time zone
);

ALTER TABLE ONLY public.user_departments FORCE ROW LEVEL SECURITY;


ALTER TABLE public.user_departments OWNER TO pgloader;

--
-- Name: user_departments_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.user_departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_departments_id_seq OWNER TO pgloader;

--
-- Name: user_departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.user_departments_id_seq OWNED BY public.user_departments.id;


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.user_sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    session_id character varying(50) NOT NULL,
    fingerprint text,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone,
    expires_at timestamp with time zone,
    last_activity timestamp with time zone
);


ALTER TABLE public.user_sessions OWNER TO pgloader;

--
-- Name: user_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.user_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_sessions_id_seq OWNER TO pgloader;

--
-- Name: user_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.user_sessions_id_seq OWNED BY public.user_sessions.id;


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.user_settings (
    id integer NOT NULL,
    user_id integer NOT NULL,
    tenant_id integer NOT NULL,
    team_id integer,
    setting_key character varying(100) NOT NULL,
    setting_value text,
    value_type public.user_settings_value_type DEFAULT 'string'::public.user_settings_value_type,
    category character varying(50),
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.user_settings FORCE ROW LEVEL SECURITY;


ALTER TABLE public.user_settings OWNER TO pgloader;

--
-- Name: TABLE user_settings; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON TABLE public.user_settings IS 'User settings with team-specific support and multi-tenant isolation';


--
-- Name: user_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.user_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_settings_id_seq OWNER TO pgloader;

--
-- Name: user_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.user_settings_id_seq OWNED BY public.user_settings.id;


--
-- Name: user_teams; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.user_teams (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    user_id integer NOT NULL,
    team_id integer NOT NULL,
    joined_at timestamp with time zone,
    role public.user_teams_role DEFAULT 'member'::public.user_teams_role
);

ALTER TABLE ONLY public.user_teams FORCE ROW LEVEL SECURITY;


ALTER TABLE public.user_teams OWNER TO pgloader;

--
-- Name: user_teams_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.user_teams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_teams_id_seq OWNER TO pgloader;

--
-- Name: user_teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.user_teams_id_seq OWNED BY public.user_teams.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: pgloader
--

CREATE TABLE public.users (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    password character varying(255) NOT NULL,
    role public.users_role DEFAULT 'employee'::public.users_role NOT NULL,
    has_full_access boolean DEFAULT false NOT NULL,
    first_name character varying(50),
    last_name character varying(50),
    age integer,
    employee_id character varying(50),
    employee_number character varying(30) NOT NULL,
    notes text,
    "position" character varying(100),
    phone character varying(30),
    landline character varying(30),
    profile_picture character varying(255),
    address text,
    date_of_birth date,
    hire_date date,
    emergency_contact text,
    editable_fields jsonb,
    notification_preferences jsonb,
    is_active smallint DEFAULT 1,
    is_archived boolean DEFAULT false,
    last_login timestamp with time zone,
    password_reset_token character varying(255),
    password_reset_expires timestamp with time zone,
    two_factor_secret character varying(255),
    two_factor_enabled boolean DEFAULT false,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    archived_at timestamp with time zone,
    created_by integer,
    availability_status public.users_availability_status DEFAULT 'available'::public.users_availability_status,
    availability_start date,
    availability_end date,
    availability_notes text
);

ALTER TABLE ONLY public.users FORCE ROW LEVEL SECURITY;


ALTER TABLE public.users OWNER TO pgloader;

--
-- Name: COLUMN users.employee_number; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.users.employee_number IS 'Personalnummer: Max 10 Zeichen, Buchstaben, Zahlen und Bindestrich erlaubt';


--
-- Name: COLUMN users.phone; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.users.phone IS 'Handynummer/Mobile (optional, can have duplicates)';


--
-- Name: COLUMN users.landline; Type: COMMENT; Schema: public; Owner: pgloader
--

COMMENT ON COLUMN public.users.landline IS 'Festnetznummer (optional)';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: pgloader
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO pgloader;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pgloader
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: absences id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.absences ALTER COLUMN id SET DEFAULT nextval('public.absences_id_seq'::regclass);


--
-- Name: activity_logs id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);


--
-- Name: admin_area_permissions id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.admin_area_permissions ALTER COLUMN id SET DEFAULT nextval('public.admin_area_permissions_id_seq'::regclass);


--
-- Name: admin_department_permissions id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.admin_department_permissions ALTER COLUMN id SET DEFAULT nextval('public.admin_department_permissions_id_seq'::regclass);


--
-- Name: admin_logs id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.admin_logs ALTER COLUMN id SET DEFAULT nextval('public.admin_logs_id_seq'::regclass);


--
-- Name: admin_permission_logs id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.admin_permission_logs ALTER COLUMN id SET DEFAULT nextval('public.admin_permission_logs_id_seq'::regclass);


--
-- Name: api_keys id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.api_keys ALTER COLUMN id SET DEFAULT nextval('public.api_keys_id_seq'::regclass);


--
-- Name: api_logs id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.api_logs ALTER COLUMN id SET DEFAULT nextval('public.api_logs_id_seq'::regclass);


--
-- Name: archived_tenant_invoices id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.archived_tenant_invoices ALTER COLUMN id SET DEFAULT nextval('public.archived_tenant_invoices_id_seq'::regclass);


--
-- Name: areas id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.areas ALTER COLUMN id SET DEFAULT nextval('public.areas_id_seq'::regclass);


--
-- Name: audit_trail id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.audit_trail ALTER COLUMN id SET DEFAULT nextval('public.audit_trail_id_seq'::regclass);


--
-- Name: backup_retention_policy id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.backup_retention_policy ALTER COLUMN id SET DEFAULT nextval('public.backup_retention_policy_id_seq'::regclass);


--
-- Name: blackboard_comments id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.blackboard_comments ALTER COLUMN id SET DEFAULT nextval('public.blackboard_comments_id_seq'::regclass);


--
-- Name: blackboard_confirmations id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.blackboard_confirmations ALTER COLUMN id SET DEFAULT nextval('public.blackboard_confirmations_id_seq'::regclass);


--
-- Name: blackboard_entries id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.blackboard_entries ALTER COLUMN id SET DEFAULT nextval('public.blackboard_entries_id_seq'::regclass);


--
-- Name: blackboard_entry_organizations id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.blackboard_entry_organizations ALTER COLUMN id SET DEFAULT nextval('public.blackboard_entry_organizations_id_seq'::regclass);


--
-- Name: calendar_attendees id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.calendar_attendees ALTER COLUMN id SET DEFAULT nextval('public.calendar_attendees_id_seq'::regclass);


--
-- Name: calendar_events id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.calendar_events ALTER COLUMN id SET DEFAULT nextval('public.calendar_events_id_seq'::regclass);


--
-- Name: calendar_events_organizations id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.calendar_events_organizations ALTER COLUMN id SET DEFAULT nextval('public.calendar_events_organizations_id_seq'::regclass);


--
-- Name: calendar_recurring_patterns id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.calendar_recurring_patterns ALTER COLUMN id SET DEFAULT nextval('public.calendar_recurring_patterns_id_seq'::regclass);


--
-- Name: chat_channel_members id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_channel_members ALTER COLUMN id SET DEFAULT nextval('public.chat_channel_members_id_seq'::regclass);


--
-- Name: chat_channels id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_channels ALTER COLUMN id SET DEFAULT nextval('public.chat_channels_id_seq'::regclass);


--
-- Name: chat_message_edits id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_message_edits ALTER COLUMN id SET DEFAULT nextval('public.chat_message_edits_id_seq'::regclass);


--
-- Name: chat_message_reactions id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_message_reactions ALTER COLUMN id SET DEFAULT nextval('public.chat_message_reactions_id_seq'::regclass);


--
-- Name: chat_message_read_receipts id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_message_read_receipts ALTER COLUMN id SET DEFAULT nextval('public.chat_message_read_receipts_id_seq'::regclass);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: conversation_participants id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.conversation_participants ALTER COLUMN id SET DEFAULT nextval('public.conversation_participants_id_seq'::regclass);


--
-- Name: conversations id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);


--
-- Name: deletion_alerts id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.deletion_alerts ALTER COLUMN id SET DEFAULT nextval('public.deletion_alerts_id_seq'::regclass);


--
-- Name: deletion_audit_trail id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.deletion_audit_trail ALTER COLUMN id SET DEFAULT nextval('public.deletion_audit_trail_id_seq'::regclass);


--
-- Name: deletion_dry_run_reports id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.deletion_dry_run_reports ALTER COLUMN id SET DEFAULT nextval('public.deletion_dry_run_reports_id_seq'::regclass);


--
-- Name: deletion_partial_options id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.deletion_partial_options ALTER COLUMN id SET DEFAULT nextval('public.deletion_partial_options_id_seq'::regclass);


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- Name: document_permissions id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.document_permissions ALTER COLUMN id SET DEFAULT nextval('public.document_permissions_id_seq'::regclass);


--
-- Name: document_read_status id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.document_read_status ALTER COLUMN id SET DEFAULT nextval('public.document_read_status_id_seq'::regclass);


--
-- Name: document_shares id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.document_shares ALTER COLUMN id SET DEFAULT nextval('public.document_shares_id_seq'::regclass);


--
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- Name: email_queue id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.email_queue ALTER COLUMN id SET DEFAULT nextval('public.email_queue_id_seq'::regclass);


--
-- Name: email_templates id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.email_templates ALTER COLUMN id SET DEFAULT nextval('public.email_templates_id_seq'::regclass);


--
-- Name: employee_availability id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.employee_availability ALTER COLUMN id SET DEFAULT nextval('public.employee_availability_id_seq'::regclass);


--
-- Name: failed_file_deletions id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.failed_file_deletions ALTER COLUMN id SET DEFAULT nextval('public.failed_file_deletions_id_seq'::regclass);


--
-- Name: feature_usage_logs id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.feature_usage_logs ALTER COLUMN id SET DEFAULT nextval('public.feature_usage_logs_id_seq'::regclass);


--
-- Name: features id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.features ALTER COLUMN id SET DEFAULT nextval('public.features_id_seq'::regclass);


--
-- Name: kvp_attachments id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_attachments ALTER COLUMN id SET DEFAULT nextval('public.kvp_attachments_id_seq'::regclass);


--
-- Name: kvp_categories id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_categories ALTER COLUMN id SET DEFAULT nextval('public.kvp_categories_id_seq'::regclass);


--
-- Name: kvp_comments id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_comments ALTER COLUMN id SET DEFAULT nextval('public.kvp_comments_id_seq'::regclass);


--
-- Name: kvp_points id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_points ALTER COLUMN id SET DEFAULT nextval('public.kvp_points_id_seq'::regclass);


--
-- Name: kvp_ratings id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_ratings ALTER COLUMN id SET DEFAULT nextval('public.kvp_ratings_id_seq'::regclass);


--
-- Name: kvp_status_history id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_status_history ALTER COLUMN id SET DEFAULT nextval('public.kvp_status_history_id_seq'::regclass);


--
-- Name: kvp_suggestions id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_suggestions ALTER COLUMN id SET DEFAULT nextval('public.kvp_suggestions_id_seq'::regclass);


--
-- Name: kvp_votes id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_votes ALTER COLUMN id SET DEFAULT nextval('public.kvp_votes_id_seq'::regclass);


--
-- Name: legal_holds id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.legal_holds ALTER COLUMN id SET DEFAULT nextval('public.legal_holds_id_seq'::regclass);


--
-- Name: login_attempts id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.login_attempts ALTER COLUMN id SET DEFAULT nextval('public.login_attempts_id_seq'::regclass);


--
-- Name: machine_categories id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_categories ALTER COLUMN id SET DEFAULT nextval('public.machine_categories_id_seq'::regclass);


--
-- Name: machine_documents id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_documents ALTER COLUMN id SET DEFAULT nextval('public.machine_documents_id_seq'::regclass);


--
-- Name: machine_maintenance_history id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_maintenance_history ALTER COLUMN id SET DEFAULT nextval('public.machine_maintenance_history_id_seq'::regclass);


--
-- Name: machine_metrics id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_metrics ALTER COLUMN id SET DEFAULT nextval('public.machine_metrics_id_seq'::regclass);


--
-- Name: machine_teams id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_teams ALTER COLUMN id SET DEFAULT nextval('public.machine_teams_id_seq'::regclass);


--
-- Name: machines id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machines ALTER COLUMN id SET DEFAULT nextval('public.machines_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: migration_log id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.migration_log ALTER COLUMN id SET DEFAULT nextval('public.migration_log_id_seq'::regclass);


--
-- Name: notification_preferences id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.notification_preferences ALTER COLUMN id SET DEFAULT nextval('public.notification_preferences_id_seq'::regclass);


--
-- Name: notification_read_status id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.notification_read_status ALTER COLUMN id SET DEFAULT nextval('public.notification_read_status_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: oauth_tokens id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.oauth_tokens ALTER COLUMN id SET DEFAULT nextval('public.oauth_tokens_id_seq'::regclass);


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- Name: payment_history id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.payment_history ALTER COLUMN id SET DEFAULT nextval('public.payment_history_id_seq'::regclass);


--
-- Name: plan_features id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.plan_features ALTER COLUMN id SET DEFAULT nextval('public.plan_features_id_seq'::regclass);


--
-- Name: plans id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.plans ALTER COLUMN id SET DEFAULT nextval('public.plans_id_seq'::regclass);


--
-- Name: recurring_jobs id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.recurring_jobs ALTER COLUMN id SET DEFAULT nextval('public.recurring_jobs_id_seq'::regclass);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- Name: released_subdomains id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.released_subdomains ALTER COLUMN id SET DEFAULT nextval('public.released_subdomains_id_seq'::regclass);


--
-- Name: root_logs id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.root_logs ALTER COLUMN id SET DEFAULT nextval('public.root_logs_id_seq'::regclass);


--
-- Name: scheduled_tasks id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.scheduled_tasks ALTER COLUMN id SET DEFAULT nextval('public.scheduled_tasks_id_seq'::regclass);


--
-- Name: security_logs id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.security_logs ALTER COLUMN id SET DEFAULT nextval('public.security_logs_id_seq'::regclass);


--
-- Name: shift_assignments id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_assignments ALTER COLUMN id SET DEFAULT nextval('public.shift_assignments_id_seq'::regclass);


--
-- Name: shift_favorites id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_favorites ALTER COLUMN id SET DEFAULT nextval('public.shift_favorites_id_seq'::regclass);


--
-- Name: shift_plans id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_plans ALTER COLUMN id SET DEFAULT nextval('public.shift_plans_id_seq'::regclass);


--
-- Name: shift_rotation_assignments id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_rotation_assignments ALTER COLUMN id SET DEFAULT nextval('public.shift_rotation_assignments_id_seq'::regclass);


--
-- Name: shift_rotation_history id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_rotation_history ALTER COLUMN id SET DEFAULT nextval('public.shift_rotation_history_id_seq'::regclass);


--
-- Name: shift_rotation_patterns id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_rotation_patterns ALTER COLUMN id SET DEFAULT nextval('public.shift_rotation_patterns_id_seq'::regclass);


--
-- Name: shift_swap_requests id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_swap_requests ALTER COLUMN id SET DEFAULT nextval('public.shift_swap_requests_id_seq'::regclass);


--
-- Name: shift_templates id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_templates ALTER COLUMN id SET DEFAULT nextval('public.shift_templates_id_seq'::regclass);


--
-- Name: shifts id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shifts ALTER COLUMN id SET DEFAULT nextval('public.shifts_id_seq'::regclass);


--
-- Name: subscription_plans id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.subscription_plans ALTER COLUMN id SET DEFAULT nextval('public.subscription_plans_id_seq'::regclass);


--
-- Name: survey_answers id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_answers ALTER COLUMN id SET DEFAULT nextval('public.survey_answers_id_seq'::regclass);


--
-- Name: survey_assignments id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_assignments ALTER COLUMN id SET DEFAULT nextval('public.survey_assignments_id_seq'::regclass);


--
-- Name: survey_comments id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_comments ALTER COLUMN id SET DEFAULT nextval('public.survey_comments_id_seq'::regclass);


--
-- Name: survey_participants id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_participants ALTER COLUMN id SET DEFAULT nextval('public.survey_participants_id_seq'::regclass);


--
-- Name: survey_question_options id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_question_options ALTER COLUMN id SET DEFAULT nextval('public.survey_question_options_id_seq'::regclass);


--
-- Name: survey_questions id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_questions ALTER COLUMN id SET DEFAULT nextval('public.survey_questions_id_seq'::regclass);


--
-- Name: survey_reminders id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_reminders ALTER COLUMN id SET DEFAULT nextval('public.survey_reminders_id_seq'::regclass);


--
-- Name: survey_responses id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_responses ALTER COLUMN id SET DEFAULT nextval('public.survey_responses_id_seq'::regclass);


--
-- Name: survey_templates id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_templates ALTER COLUMN id SET DEFAULT nextval('public.survey_templates_id_seq'::regclass);


--
-- Name: surveys id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.surveys ALTER COLUMN id SET DEFAULT nextval('public.surveys_id_seq'::regclass);


--
-- Name: system_logs id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.system_logs ALTER COLUMN id SET DEFAULT nextval('public.system_logs_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: teams id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.teams ALTER COLUMN id SET DEFAULT nextval('public.teams_id_seq'::regclass);


--
-- Name: tenant_addons id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_addons ALTER COLUMN id SET DEFAULT nextval('public.tenant_addons_id_seq'::regclass);


--
-- Name: tenant_data_exports id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_data_exports ALTER COLUMN id SET DEFAULT nextval('public.tenant_data_exports_id_seq'::regclass);


--
-- Name: tenant_deletion_approvals id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_deletion_approvals ALTER COLUMN id SET DEFAULT nextval('public.tenant_deletion_approvals_id_seq'::regclass);


--
-- Name: tenant_deletion_backups id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_deletion_backups ALTER COLUMN id SET DEFAULT nextval('public.tenant_deletion_backups_id_seq'::regclass);


--
-- Name: tenant_deletion_log id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_deletion_log ALTER COLUMN id SET DEFAULT nextval('public.tenant_deletion_log_id_seq'::regclass);


--
-- Name: tenant_deletion_queue id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_deletion_queue ALTER COLUMN id SET DEFAULT nextval('public.tenant_deletion_queue_id_seq'::regclass);


--
-- Name: tenant_deletion_rollback id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_deletion_rollback ALTER COLUMN id SET DEFAULT nextval('public.tenant_deletion_rollback_id_seq'::regclass);


--
-- Name: tenant_features id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_features ALTER COLUMN id SET DEFAULT nextval('public.tenant_features_id_seq'::regclass);


--
-- Name: tenant_plans id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_plans ALTER COLUMN id SET DEFAULT nextval('public.tenant_plans_id_seq'::regclass);


--
-- Name: tenant_settings id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_settings ALTER COLUMN id SET DEFAULT nextval('public.tenant_settings_id_seq'::regclass);


--
-- Name: tenant_subscriptions id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.tenant_subscriptions_id_seq'::regclass);


--
-- Name: tenant_webhooks id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_webhooks ALTER COLUMN id SET DEFAULT nextval('public.tenant_webhooks_id_seq'::regclass);


--
-- Name: tenants id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenants ALTER COLUMN id SET DEFAULT nextval('public.tenants_id_seq'::regclass);


--
-- Name: usage_quotas id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.usage_quotas ALTER COLUMN id SET DEFAULT nextval('public.usage_quotas_id_seq'::regclass);


--
-- Name: user_2fa_backup_codes id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_2fa_backup_codes ALTER COLUMN id SET DEFAULT nextval('public.user_2fa_backup_codes_id_seq'::regclass);


--
-- Name: user_2fa_secrets id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_2fa_secrets ALTER COLUMN id SET DEFAULT nextval('public.user_2fa_secrets_id_seq'::regclass);


--
-- Name: user_departments id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_departments ALTER COLUMN id SET DEFAULT nextval('public.user_departments_id_seq'::regclass);


--
-- Name: user_sessions id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_sessions_id_seq'::regclass);


--
-- Name: user_settings id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_settings ALTER COLUMN id SET DEFAULT nextval('public.user_settings_id_seq'::regclass);


--
-- Name: user_teams id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_teams ALTER COLUMN id SET DEFAULT nextval('public.user_teams_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: absences; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.absences (id, tenant_id, user_id, type, start_date, end_date, reason, status, approved_by, approved_at, created_at) FROM stdin;
\.


--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.activity_logs (id, tenant_id, user_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: admin_area_permissions; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.admin_area_permissions (id, tenant_id, admin_user_id, area_id, can_read, can_write, can_delete, assigned_by, assigned_at) FROM stdin;
\.


--
-- Data for Name: admin_department_permissions; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.admin_department_permissions (id, tenant_id, admin_user_id, department_id, can_read, can_write, can_delete, assigned_by, assigned_at) FROM stdin;
\.


--
-- Data for Name: admin_logs; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.admin_logs (id, tenant_id, user_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: admin_permission_logs; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.admin_permission_logs (id, tenant_id, action, admin_user_id, target_id, target_type, changed_by, old_permissions, new_permissions, created_at) FROM stdin;
\.


--
-- Data for Name: api_keys; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.api_keys (id, tenant_id, key_hash, name, permissions, active, last_used, deactivated_at, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: api_logs; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.api_logs (id, tenant_id, user_id, method, endpoint, status_code, request_body, response_time_ms, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: archived_tenant_invoices; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.archived_tenant_invoices (id, original_tenant_id, tenant_name, tenant_tax_id, invoice_data, invoice_number, invoice_date, invoice_amount, archived_at, delete_after) FROM stdin;
\.


--
-- Data for Name: areas; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.areas (id, tenant_id, name, description, area_lead_id, type, capacity, address, is_active, is_archived, created_by, created_at, updated_at) FROM stdin;
2	8	Produktionshalle	Testbereich	7	other	\N	\N	1	f	7	\N	\N
\.


--
-- Data for Name: audit_trail; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.audit_trail (id, tenant_id, user_id, user_name, user_role, action, resource_type, resource_id, resource_name, changes, ip_address, user_agent, status, error_message, created_at) FROM stdin;
\.


--
-- Data for Name: backup_retention_policy; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.backup_retention_policy (id, tenant_id, backup_type, backup_file, backup_size, retention_days, created_at, expires_at) FROM stdin;
\.


--
-- Data for Name: blackboard_comments; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.blackboard_comments (id, tenant_id, entry_id, user_id, comment, is_internal, created_at) FROM stdin;
\.


--
-- Data for Name: blackboard_confirmations; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.blackboard_confirmations (id, tenant_id, entry_id, user_id, confirmed_at) FROM stdin;
\.


--
-- Data for Name: blackboard_entries; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.blackboard_entries (id, uuid, tenant_id, org_level, org_id, area_id, author_id, title, content, priority, color, category, valid_from, valid_until, expires_at, is_pinned, views, is_active, status, requires_confirmation, attachment_count, attachment_path, created_at, updated_at, uuid_created_at) FROM stdin;
\.


--
-- Data for Name: blackboard_entry_organizations; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.blackboard_entry_organizations (id, entry_id, org_type, org_id, created_at) FROM stdin;
\.


--
-- Data for Name: calendar_attendees; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.calendar_attendees (id, tenant_id, event_id, user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: calendar_events; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.calendar_events (id, uuid, tenant_id, user_id, title, description, location, start_date, end_date, type, status, is_private, all_day, org_level, department_id, team_id, area_id, org_id, reminder_minutes, color, recurrence_rule, parent_event_id, created_at, updated_at, allow_attendees, created_by_role, uuid_created_at) FROM stdin;
\.


--
-- Data for Name: calendar_events_organizations; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.calendar_events_organizations (id, event_id, org_type, org_id, created_at) FROM stdin;
\.


--
-- Data for Name: calendar_recurring_patterns; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.calendar_recurring_patterns (id, event_id, frequency, interval_value, days_of_week, end_date, tenant_id) FROM stdin;
\.


--
-- Data for Name: chat_channel_members; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.chat_channel_members (id, channel_id, user_id, role, tenant_id, joined_at) FROM stdin;
\.


--
-- Data for Name: chat_channels; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.chat_channels (id, name, description, type, visibility_scope, target_id, created_by, tenant_id, is_archived, archived_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: chat_message_edits; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.chat_message_edits (id, message_id, previous_content, edited_by, edited_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: chat_message_reactions; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.chat_message_reactions (id, message_id, user_id, emoji, tenant_id, created_at) FROM stdin;
\.


--
-- Data for Name: chat_message_read_receipts; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.chat_message_read_receipts (id, message_id, user_id, channel_id, read_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.chat_messages (id, channel_id, sender_id, content, type, reply_to_id, is_edited, edited_at, is_deleted, deleted_at, is_pinned, tenant_id, created_at) FROM stdin;
\.


--
-- Data for Name: conversation_participants; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.conversation_participants (id, tenant_id, conversation_id, user_id, joined_at, is_admin, last_read_message_id, last_read_at) FROM stdin;
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.conversations (id, tenant_id, name, is_group, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: deletion_alerts; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.deletion_alerts (id, queue_id, alert_type, severity, channel, title, message, sent_at, response_code, response_body, created_at) FROM stdin;
\.


--
-- Data for Name: deletion_audit_trail; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.deletion_audit_trail (id, tenant_id, tenant_name, user_count, deleted_by, deleted_by_ip, deletion_reason, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: deletion_dry_run_reports; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.deletion_dry_run_reports (id, tenant_id, requested_by, estimated_duration_seconds, total_affected_records, report_data, warnings, blockers, created_at) FROM stdin;
\.


--
-- Data for Name: deletion_partial_options; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.deletion_partial_options (id, queue_id, option_name, included, created_at) FROM stdin;
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.departments (id, tenant_id, name, description, department_lead_id, area_id, is_active, is_archived, notes, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: document_permissions; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.document_permissions (id, document_id, user_id, department_id, team_id, permission_type, tenant_id, created_at) FROM stdin;
\.


--
-- Data for Name: document_read_status; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.document_read_status (id, document_id, user_id, tenant_id, read_at, created_at) FROM stdin;
\.


--
-- Data for Name: document_shares; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.document_shares (id, document_id, owner_tenant_id, shared_with_tenant_id, permissions, created_at, expires_at) FROM stdin;
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.documents (id, uuid, file_uuid, version, parent_version_id, tenant_id, access_scope, owner_user_id, target_team_id, target_department_id, salary_year, salary_month, blackboard_entry_id, category, filename, original_name, file_path, file_size, file_checksum, file_content, storage_type, mime_type, description, tags, is_public, is_archived, uploaded_at, archived_at, expires_at, created_by, uuid_created_at) FROM stdin;
\.


--
-- Data for Name: email_queue; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.email_queue (id, tenant_id, to_email, subject, status, attempts, created_at, sent_at) FROM stdin;
\.


--
-- Data for Name: email_templates; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.email_templates (id, tenant_id, template_key, subject, body_html, body_text, variables, is_system, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: employee_availability; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.employee_availability (id, employee_id, tenant_id, status, start_date, end_date, reason, notes, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: failed_file_deletions; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.failed_file_deletions (id, queue_id, file_data, created_at, resolved, resolved_at, resolved_by) FROM stdin;
\.


--
-- Data for Name: feature_usage_logs; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.feature_usage_logs (id, tenant_id, feature_id, user_id, action, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: features; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.features (id, code, name, description, category, base_price, is_active, requires_setup, setup_instructions, icon, sort_order, created_at, updated_at) FROM stdin;
1	dashboard	Dashboard	Dashboard mit Ãœbersicht	basic	0.00	1	f	\N	\N	0	2025-07-23 09:56:05+02	2025-07-23 09:56:05+02
2	employees	Mitarbeiterverwaltung	Mitarbeiter verwalten	core	0.00	1	f	\N	\N	0	2025-07-23 09:56:05+02	2025-07-23 09:56:05+02
3	departments	Abteilungen	Abteilungen verwalten	core	0.00	1	f	\N	\N	0	2025-07-23 09:56:05+02	2025-07-23 09:56:05+02
4	teams	Teams	Teams verwalten	core	0.00	1	f	\N	\N	0	2025-07-23 09:56:05+02	2025-07-23 09:56:05+02
5	shift_planning	Schichtplanung	SchichtplÃ¤ne erstellen und verwalten	premium	0.00	1	f	\N	\N	0	2025-07-23 09:56:05+02	2025-07-23 09:56:05+02
6	calendar	Kalender	Gemeinsamer Kalender	basic	0.00	1	f	\N	\N	0	2025-07-23 09:56:05+02	2025-07-23 09:56:05+02
7	blackboard	Schwarzes Brett	Digitales schwarzes Brett	basic	0.00	1	f	\N	\N	0	2025-07-23 09:56:05+02	2025-07-23 09:56:05+02
8	chat	Chat	Team-Chat Funktion	premium	0.00	1	f	\N	\N	0	2025-07-23 09:56:05+02	2025-07-23 09:56:05+02
9	documents	Dokumente	Dokumentenverwaltung	core	0.00	1	f	\N	\N	0	2025-07-23 09:56:05+02	2025-07-23 09:56:05+02
10	surveys	Umfragen	Umfragen erstellen und auswerten	premium	0.00	1	f	\N	\N	0	2025-07-23 09:56:05+02	2025-07-23 09:56:05+02
11	kvp	KVP	Kontinuierlicher Verbesserungsprozess	enterprise	0.00	1	f	\N	\N	0	2025-07-23 09:56:05+02	2025-07-23 09:56:05+02
12	settings	Einstellungen	Systemeinstellungen	basic	0.00	1	f	\N	\N	0	2025-07-23 09:56:05+02	2025-07-23 09:56:05+02
\.


--
-- Data for Name: kvp_attachments; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.kvp_attachments (id, file_uuid, suggestion_id, file_name, file_path, file_type, file_size, uploaded_by, uploaded_at) FROM stdin;
\.


--
-- Data for Name: kvp_categories; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.kvp_categories (id, name, description, color, icon, created_at) FROM stdin;
1	Sicherheit	Verbesserungen zur Arbeitssicherheit	#e74c3c	🛡️	2025-11-13 22:07:17+01
2	Effizienz	Prozessoptimierungen und Zeitersparnis	#2ecc71	⚡	2025-11-13 22:07:17+01
3	Qualität	Qualitätsverbesserungen und Fehlervermeidung	#3498db	⭐	2025-11-13 22:07:17+01
4	Umwelt	Umweltfreundliche Verbesserungen	#27ae60	🌱	2025-11-13 22:07:17+01
5	Ergonomie	Arbeitsplatzverbesserungen	#9b59b6	💤	2025-11-13 22:07:17+01
6	Kosteneinsparung	Maßnahmen zur Kostenreduzierung	#f39c12	💰	2025-11-13 22:07:17+01
\.


--
-- Data for Name: kvp_comments; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.kvp_comments (id, tenant_id, suggestion_id, user_id, comment, is_internal, created_at) FROM stdin;
\.


--
-- Data for Name: kvp_points; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.kvp_points (id, tenant_id, user_id, suggestion_id, points, reason, awarded_by, created_at) FROM stdin;
\.


--
-- Data for Name: kvp_ratings; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.kvp_ratings (id, suggestion_id, user_id, rating, comment, created_at) FROM stdin;
\.


--
-- Data for Name: kvp_status_history; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.kvp_status_history (id, suggestion_id, old_status, new_status, changed_by, change_reason, created_at) FROM stdin;
\.


--
-- Data for Name: kvp_suggestions; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.kvp_suggestions (id, uuid, tenant_id, title, description, category_id, department_id, org_level, org_id, is_shared, submitted_by, team_id, assigned_to, status, priority, expected_benefit, estimated_cost, actual_savings, implementation_date, rejection_reason, shared_by, shared_at, created_at, updated_at, uuid_created_at) FROM stdin;
\.


--
-- Data for Name: kvp_votes; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.kvp_votes (id, suggestion_id, user_id, vote_type, tenant_id, created_at) FROM stdin;
\.


--
-- Data for Name: legal_holds; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.legal_holds (id, tenant_id, reason, case_number, created_by, active, created_at, expires_at, released_at, released_by) FROM stdin;
\.


--
-- Data for Name: login_attempts; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.login_attempts (id, username, ip_address, success, attempted_at) FROM stdin;
\.


--
-- Data for Name: machine_categories; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.machine_categories (id, name, description, icon, sort_order, is_active) FROM stdin;
1	CNC-Maschinen	Computer Numerical Control Maschinen	fa-cogs	1	1
2	Spritzgussmaschinen	Kunststoff-Spritzgussmaschinen	fa-industry	2	1
3	Pressen	Hydraulische und mechanische Pressen	fa-compress	3	1
4	SchweiÃŸanlagen	Verschiedene SchweiÃŸtechnologien	fa-fire	4	1
5	MessgerÃ¤te	QualitÃ¤tskontrolle und Messtechnik	fa-ruler	5	1
6	Verpackungsmaschinen	Verpackung und Etikettierung	fa-box	6	1
7	FÃ¶rdertechnik	TransportbÃ¤nder und FÃ¶rdersysteme	fa-truck	7	1
8	Kompressoren	Druckluft und Vakuumsysteme	fa-wind	8	1
9	KÃ¼hlanlagen	Klimatisierung und KÃ¼hlung	fa-snowflake	9	1
10	Sonstige	Andere Maschinentypen	fa-wrench	10	1
11	Test Category	Test Category Description	fa-test	99	1
\.


--
-- Data for Name: machine_documents; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.machine_documents (id, tenant_id, machine_id, document_type, title, file_path, file_size, valid_from, valid_until, uploaded_at, uploaded_by) FROM stdin;
\.


--
-- Data for Name: machine_maintenance_history; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.machine_maintenance_history (id, tenant_id, machine_id, maintenance_type, performed_date, performed_by, external_company, description, parts_replaced, cost, duration_hours, status_after, next_maintenance_date, report_url, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: machine_metrics; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.machine_metrics (id, tenant_id, machine_id, metric_type, metric_value, unit, recorded_at, is_anomaly) FROM stdin;
\.


--
-- Data for Name: machine_teams; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.machine_teams (id, tenant_id, machine_id, team_id, assigned_at, assigned_by, is_primary, notes) FROM stdin;
\.


--
-- Data for Name: machines; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.machines (id, tenant_id, name, model, manufacturer, serial_number, asset_number, department_id, area_id, location, machine_type, status, purchase_date, installation_date, warranty_until, last_maintenance, next_maintenance, operating_hours, production_capacity, energy_consumption, manual_url, qr_code, notes, created_at, updated_at, created_by, updated_by, is_active) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.messages (id, tenant_id, conversation_id, sender_id, content, attachment_path, attachment_name, attachment_type, attachment_size, is_system, created_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: migration_log; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.migration_log (id, migration_name, executed_at, status) FROM stdin;
\.


--
-- Data for Name: notification_preferences; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.notification_preferences (id, user_id, tenant_id, notification_type, email_notifications, push_notifications, sms_notifications, preferences, email_enabled, push_enabled, in_app_enabled, frequency, quiet_hours_start, quiet_hours_end, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notification_read_status; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.notification_read_status (id, notification_id, user_id, tenant_id, read_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.notifications (id, tenant_id, type, title, message, priority, recipient_id, recipient_type, action_url, action_label, metadata, scheduled_for, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: oauth_tokens; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.oauth_tokens (id, tenant_id, user_id, token, token_type, expires_at, revoked, revoked_at, created_at) FROM stdin;
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.password_reset_tokens (id, user_id, token, expires_at, used, created_at) FROM stdin;
\.


--
-- Data for Name: payment_history; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.payment_history (id, tenant_id, subscription_id, amount, currency, status, payment_method, transaction_id, invoice_number, invoice_url, failure_reason, paid_at, created_at) FROM stdin;
\.


--
-- Data for Name: plan_features; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.plan_features (id, plan_id, feature_id, is_included, created_at) FROM stdin;
1	1	1	t	2025-07-23 09:56:05+02
2	1	2	t	2025-07-23 09:56:05+02
3	1	3	t	2025-07-23 09:56:05+02
4	1	4	f	2025-07-23 09:56:05+02
5	1	5	f	2025-07-23 09:56:05+02
6	1	6	t	2025-07-23 09:56:05+02
7	1	7	t	2025-07-23 09:56:05+02
8	1	8	f	2025-07-23 09:56:05+02
9	1	9	t	2025-07-23 09:56:05+02
10	1	10	f	2025-07-23 09:56:05+02
11	1	11	f	2025-07-23 09:56:05+02
12	1	12	t	2025-07-23 09:56:05+02
13	2	1	t	2025-07-23 09:56:05+02
14	2	2	t	2025-07-23 09:56:05+02
15	2	3	t	2025-07-23 09:56:05+02
16	2	4	t	2025-07-23 09:56:05+02
17	2	5	t	2025-07-23 09:56:05+02
18	2	6	t	2025-07-23 09:56:05+02
19	2	7	t	2025-07-23 09:56:05+02
20	2	8	t	2025-07-23 09:56:05+02
21	2	9	t	2025-07-23 09:56:05+02
22	2	10	t	2025-07-23 09:56:05+02
23	2	11	f	2025-07-23 09:56:05+02
24	2	12	t	2025-07-23 09:56:05+02
25	3	1	t	2025-07-23 09:56:05+02
26	3	2	t	2025-07-23 09:56:05+02
27	3	3	t	2025-07-23 09:56:05+02
28	3	4	t	2025-07-23 09:56:05+02
29	3	5	t	2025-07-23 09:56:05+02
30	3	6	t	2025-07-23 09:56:05+02
31	3	7	t	2025-07-23 09:56:05+02
32	3	8	t	2025-07-23 09:56:05+02
33	3	9	t	2025-07-23 09:56:05+02
34	3	10	t	2025-07-23 09:56:05+02
35	3	11	t	2025-07-23 09:56:05+02
36	3	12	t	2025-07-23 09:56:05+02
\.


--
-- Data for Name: plans; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.plans (id, code, name, description, base_price, max_employees, max_admins, max_storage_gb, is_active, sort_order, created_at, updated_at) FROM stdin;
1	basic	Basic	Perfekt fÃ¼r kleine Teams und Startups	49.00	10	1	100	1	1	2025-06-02 19:21:07+02	2025-06-02 19:21:07+02
2	professional	Professional	FÃ¼r wachsende Unternehmen	149.00	50	3	500	1	2	2025-06-02 19:21:07+02	2025-06-02 19:21:07+02
3	enterprise	Enterprise	FÃ¼r groÃŸe Organisationen	299.00	\N	\N	1000	1	3	2025-06-02 19:21:07+02	2025-06-02 19:21:07+02
\.


--
-- Data for Name: recurring_jobs; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.recurring_jobs (id, tenant_id, job_name, cron_expression, active, last_run, next_run, created_at) FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.refresh_tokens (id, user_id, tenant_id, token_hash, token_family, expires_at, is_revoked, used_at, replaced_by_hash, created_at, ip_address, user_agent) FROM stdin;
9	7	8	a9b2bea45adc43d093ede3c1b3f012fc10bbd9436ae1867362ac86ecd0ea0658	4309f7dc-f14c-45b8-ab51-c22a20fef2d2	2025-12-07 21:09:01.574+01	t	\N	\N	\N	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0
10	7	8	7c06839f8af1c1b1d1a16f31c22f8adcfe2b441cd7cf02d9882bddf0cc4f80df	fae1f729-b078-4a49-8fd6-4be60f844059	2025-12-07 21:11:30.231+01	t	\N	\N	\N	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0
11	7	8	81b34cc89cb719c990579e9c12ca0f83f7cf1235dce16b7587fc214d90619ac7	7ab80cce-e5fb-4752-9d95-7031f0f98476	2025-12-07 21:31:45.586+01	t	\N	\N	\N	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0
12	7	8	da3a6123d7d787b951f7b00490a4f3e59e4fde5f5e6d3a74ee9652e36a911742	5dd61ee2-7d7a-48af-8d78-36f57cf6ac9d	2025-12-07 21:56:30.163+01	t	\N	\N	\N	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0
13	7	8	03782b7810f34297bb41fdc1e601d296c1bfb70b1776c50f15ed314cb93df9c6	dae42e7f-6861-4b0c-a089-91a65bafaf1f	2025-12-08 22:25:43.599+01	f	\N	\N	\N	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0
14	7	8	fb1a761a4426dd14bcc9373d7bb9fcb7ad88a1f16994b5931e9f6e4438783f7f	aabe7608-61fd-456d-a5b7-4809c451ccca	2025-12-08 22:49:07.141+01	f	\N	\N	\N	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0
15	7	8	4f087d90f217fbdf04bd9275d9512cb4b26d54822f1cdc3eca1d865b253a6570	7d5383c2-4f0d-4719-b3c2-4446a3fe8fd0	2025-12-08 23:15:19.588+01	f	\N	\N	\N	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0
16	7	8	efe349079c554e7db1d381605c70e23523307b469e2609359dfc773be2abad04	b7a6e401-56dc-43b3-a7e4-fe506ca18ac4	2025-12-08 23:29:08.293+01	f	\N	\N	\N	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0
17	7	8	a7deb123b5f53bffba1b665e038eb751c256b6a8779661d5b66f82fb2a9984c4	2b18c920-5f68-4d25-ae2c-1d7e20f0127e	2025-12-08 23:35:33.925+01	f	\N	\N	\N	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0
18	7	8	5f542597470091c21fd98d8187176770544efa4537e173fdd98405e213604c21	a1d1aeb8-952d-41f0-b48b-554e7517ca0a	2025-12-08 23:37:10.808+01	f	\N	\N	\N	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0
19	7	8	9934d081b3f70e9e52caaf56594c5b4ccc8ede3b2932abe71da388720c88fb57	6753660b-c832-4679-b5be-ae11db8247ff	2025-12-08 23:39:50.952+01	f	\N	\N	\N	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0
20	7	8	8328e332d9e2e7de345c4d9f9a31c64b44ab01be4170a5d5f70d6120947b0d91	7f57f1b6-d777-445c-acde-7a4967405878	2025-12-08 23:42:50.682+01	f	\N	\N	\N	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0
21	7	8	1203d6c352a85ebdd71e0c88ea82dae0f0359f70cf0e0714875c91a2d10e9bd7	252598c9-eded-4c57-a997-54259dc42b77	2025-12-09 11:56:22.513+01	f	\N	\N	\N	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0
\.


--
-- Data for Name: released_subdomains; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.released_subdomains (id, subdomain, original_tenant_id, original_company_name, released_at, reused, reused_at, new_tenant_id) FROM stdin;
\.


--
-- Data for Name: root_logs; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.root_logs (id, tenant_id, user_id, action, entity_type, entity_id, details, old_values, new_values, ip_address, user_agent, was_role_switched, created_at) FROM stdin;
3	8	7	register	tenant	8	Registriert: Testfirma	\N	{"plan": "enterprise", "phone": "+497878788890", "subdomain": "testfirma", "admin_email": "root_all@testfirma.de", "company_name": "Testfirma", "admin_last_name": "Mustermann", "admin_first_name": "Max"}	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0	f	\N
4	8	7	login	auth	7	Angemeldet als root	\N	{"role": "root", "email": "root_all@testfirma.de", "login_method": "password"}	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0	f	\N
5	8	7	role_switch_root_to_admin	user	7	\N	\N	{"to_role": "admin", "from_role": "root", "timestamp": "2025-11-30T20:12:28.633Z"}	\N	\N	t	\N
6	8	7	login	auth	7	Angemeldet als root	\N	{"role": "root", "email": "root_all@testfirma.de", "login_method": "password"}	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0	f	\N
7	8	7	role_switch_root_to_admin	user	7	\N	\N	{"to_role": "admin", "from_role": "root", "timestamp": "2025-11-30T20:32:51.999Z"}	\N	\N	t	\N
8	8	7	role_switch_to_root	user	7	\N	\N	{"to_role": "root", "from_role": "employee", "timestamp": "2025-11-30T20:32:58.033Z"}	\N	\N	t	\N
9	8	7	role_switch_root_to_admin	user	7	\N	\N	{"to_role": "admin", "from_role": "root", "timestamp": "2025-11-30T20:39:44.732Z"}	\N	\N	t	\N
10	8	7	role_switch_to_root	user	7	\N	\N	{"to_role": "root", "from_role": "employee", "timestamp": "2025-11-30T20:40:25.622Z"}	\N	\N	t	\N
11	8	7	role_switch_root_to_admin	user	7	\N	\N	{"to_role": "admin", "from_role": "root", "timestamp": "2025-11-30T20:40:38.018Z"}	\N	\N	t	\N
12	8	7	login	auth	7	Angemeldet als root	\N	{"role": "root", "email": "root_all@testfirma.de", "login_method": "password"}	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0	f	\N
13	8	7	role_switch_root_to_admin	user	7	\N	\N	{"to_role": "admin", "from_role": "root", "timestamp": "2025-11-30T20:56:48.303Z"}	\N	\N	t	\N
14	8	7	role_switch_to_employee	user	7	\N	\N	{"to_role": "employee", "from_role": "root", "timestamp": "2025-11-30T20:57:03.585Z"}	\N	\N	t	\N
15	8	7	role_switch_to_root	user	7	\N	\N	{"to_role": "root", "from_role": "employee", "timestamp": "2025-11-30T20:57:23.573Z"}	\N	\N	t	\N
16	8	7	role_switch_root_to_admin	user	7	\N	\N	{"to_role": "admin", "from_role": "root", "timestamp": "2025-11-30T20:58:57.619Z"}	\N	\N	t	\N
17	8	7	logout	auth	7	Abgemeldet (4 Tokens widerrufen)	\N	{"role": "root", "email": "root_all@testfirma.de", "tokens_revoked": 4}	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0	f	\N
18	8	7	login	auth	7	Angemeldet als root	\N	{"role": "root", "email": "root_all@testfirma.de", "login_method": "password"}	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0	f	\N
19	8	7	role_switch_root_to_admin	user	7	\N	\N	{"to_role": "admin", "from_role": "root", "timestamp": "2025-12-01T21:34:22.220Z"}	\N	\N	t	\N
20	8	7	role_switch_to_employee	user	7	\N	\N	{"to_role": "employee", "from_role": "root", "timestamp": "2025-12-01T21:34:45.788Z"}	\N	\N	t	\N
21	8	7	role_switch_to_root	user	7	\N	\N	{"to_role": "root", "from_role": "employee", "timestamp": "2025-12-01T21:34:55.989Z"}	\N	\N	t	\N
22	8	7	role_switch_root_to_admin	user	7	\N	\N	{"to_role": "admin", "from_role": "root", "timestamp": "2025-12-01T21:35:00.443Z"}	\N	\N	t	\N
23	8	7	role_switch_to_root	user	7	\N	\N	{"to_role": "root", "from_role": "employee", "timestamp": "2025-12-01T21:44:29.377Z"}	\N	\N	t	\N
24	8	7	role_switch_to_employee	user	7	\N	\N	{"to_role": "employee", "from_role": "root", "timestamp": "2025-12-01T21:44:34.578Z"}	\N	\N	t	\N
25	8	7	login	auth	7	Angemeldet als root	\N	{"role": "root", "email": "root_all@testfirma.de", "login_method": "password"}	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0	f	\N
26	8	7	role_switch_root_to_admin	user	7	\N	\N	{"to_role": "admin", "from_role": "root", "timestamp": "2025-12-01T21:49:15.456Z"}	\N	\N	t	\N
27	8	7	login	auth	7	Angemeldet als root	\N	{"role": "root", "email": "root_all@testfirma.de", "login_method": "password"}	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0	f	\N
28	8	7	role_switch_root_to_admin	user	7	\N	\N	{"to_role": "admin", "from_role": "root", "timestamp": "2025-12-01T22:18:29.806Z"}	\N	\N	t	\N
29	8	7	role_switch_to_root	user	7	\N	\N	{"to_role": "root", "from_role": "employee", "timestamp": "2025-12-01T22:18:32.660Z"}	\N	\N	t	\N
30	8	7	role_switch_root_to_admin	user	7	\N	\N	{"to_role": "admin", "from_role": "root", "timestamp": "2025-12-01T22:19:57.994Z"}	\N	\N	t	\N
31	8	7	role_switch_to_root	user	7	\N	\N	{"to_role": "root", "from_role": "employee", "timestamp": "2025-12-01T22:20:16.715Z"}	\N	\N	t	\N
32	8	7	login	auth	7	Angemeldet als root	\N	{"role": "root", "email": "root_all@testfirma.de", "login_method": "password"}	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0	f	\N
33	8	7	login	auth	7	Angemeldet als root	\N	{"role": "root", "email": "root_all@testfirma.de", "login_method": "password"}	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0	f	\N
34	8	7	login	auth	7	Angemeldet als root	\N	{"role": "root", "email": "root_all@testfirma.de", "login_method": "password"}	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0	f	\N
35	8	7	login	auth	7	Angemeldet als root	\N	{"role": "root", "email": "root_all@testfirma.de", "login_method": "password"}	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0	f	\N
36	8	7	login	auth	7	Angemeldet als root	\N	{"role": "root", "email": "root_all@testfirma.de", "login_method": "password"}	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0	f	\N
37	8	7	delete	area	6	Gelöscht: Produktionshalle	{"name": "Produktionshalle", "type": "other", "address": null, "capacity": null, "deleted_by": "root_all@testfirma.de"}	\N	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0	f	\N
38	8	7	delete	area	5	Gelöscht: Produktionshalle	{"name": "Produktionshalle", "type": "other", "address": null, "capacity": null, "deleted_by": "root_all@testfirma.de"}	\N	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0	f	\N
39	8	7	delete	area	4	Gelöscht: Produktionshalle	{"name": "Produktionshalle", "type": "other", "address": null, "capacity": null, "deleted_by": "root_all@testfirma.de"}	\N	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0	f	\N
40	8	7	delete	area	3	Gelöscht: Produktionshalle	{"name": "Produktionshalle", "type": "other", "address": null, "capacity": null, "deleted_by": "root_all@testfirma.de"}	\N	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0	f	\N
41	8	7	role_switch_root_to_admin	user	7	\N	\N	{"to_role": "admin", "from_role": "root", "timestamp": "2025-12-01T22:50:57.992Z"}	\N	\N	t	\N
42	8	7	role_switch_to_root	user	7	\N	\N	{"to_role": "root", "from_role": "employee", "timestamp": "2025-12-01T22:51:15.482Z"}	\N	\N	t	\N
43	8	7	login	auth	7	Angemeldet als root	\N	{"role": "root", "email": "root_all@testfirma.de", "login_method": "password"}	::ffff:172.18.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0	f	\N
\.


--
-- Data for Name: scheduled_tasks; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.scheduled_tasks (id, tenant_id, task_type, task_data, scheduled_at, executed, executed_at, created_at) FROM stdin;
\.


--
-- Data for Name: security_logs; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.security_logs (id, tenant_id, user_id, action, ip_address, user_agent, details, created_at) FROM stdin;
\.


--
-- Data for Name: shift_assignments; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.shift_assignments (id, tenant_id, shift_id, user_id, assignment_type, status, assigned_by, assigned_at, response_at, notes, overtime_hours, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: shift_favorites; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.shift_favorites (id, tenant_id, user_id, name, area_id, area_name, department_id, department_name, machine_id, machine_name, team_id, team_name, created_at) FROM stdin;
\.


--
-- Data for Name: shift_plans; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.shift_plans (id, uuid, tenant_id, name, shift_notes, department_id, team_id, machine_id, area_id, start_date, end_date, status, created_by, approved_by, approved_at, created_at, updated_at, uuid_created_at) FROM stdin;
\.


--
-- Data for Name: shift_rotation_assignments; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.shift_rotation_assignments (id, tenant_id, pattern_id, user_id, team_id, shift_group, rotation_order, can_override, override_dates, is_active, starts_at, ends_at, assigned_by, assigned_at, updated_at) FROM stdin;
\.


--
-- Data for Name: shift_rotation_history; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.shift_rotation_history (id, tenant_id, pattern_id, assignment_id, user_id, team_id, shift_date, shift_type, week_number, status, modified_reason, generated_at, confirmed_at, confirmed_by) FROM stdin;
\.


--
-- Data for Name: shift_rotation_patterns; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.shift_rotation_patterns (id, tenant_id, team_id, name, description, pattern_type, pattern_config, cycle_length_weeks, starts_at, ends_at, is_active, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: shift_swap_requests; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.shift_swap_requests (id, assignment_id, requested_by, requested_with, reason, status, approved_by, tenant_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: shift_templates; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.shift_templates (id, tenant_id, name, start_time, end_time, break_minutes, color, is_night_shift, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: shifts; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.shifts (id, tenant_id, area_id, plan_id, user_id, template_id, date, start_time, end_time, title, required_employees, actual_start, actual_end, break_minutes, status, type, notes, department_id, team_id, machine_id, created_by, created_at, updated_at, metadata) FROM stdin;
\.


--
-- Data for Name: subscription_plans; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.subscription_plans (id, name, code, description, price_monthly, price_yearly, max_users, max_storage_gb, features, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: survey_answers; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.survey_answers (id, tenant_id, response_id, question_id, answer_text, answer_options, answer_number, answer_date, created_at) FROM stdin;
\.


--
-- Data for Name: survey_assignments; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.survey_assignments (id, tenant_id, survey_id, assignment_type, department_id, team_id, user_id, area_id, created_at) FROM stdin;
\.


--
-- Data for Name: survey_comments; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.survey_comments (id, tenant_id, survey_id, user_id, comment, is_public, created_at) FROM stdin;
\.


--
-- Data for Name: survey_participants; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.survey_participants (id, tenant_id, survey_id, user_id, invited_at, reminder_sent_at, completed) FROM stdin;
\.


--
-- Data for Name: survey_question_options; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.survey_question_options (id, tenant_id, question_id, option_text, order_position, created_at) FROM stdin;
\.


--
-- Data for Name: survey_questions; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.survey_questions (id, tenant_id, survey_id, question_text, question_type, is_required, validation_rules, order_index, help_text, created_at) FROM stdin;
\.


--
-- Data for Name: survey_reminders; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.survey_reminders (id, tenant_id, survey_id, reminder_date, message, is_sent, sent_at, created_at) FROM stdin;
\.


--
-- Data for Name: survey_responses; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.survey_responses (id, tenant_id, survey_id, user_id, session_id, status, started_at, completed_at, ip_address, user_agent) FROM stdin;
\.


--
-- Data for Name: survey_templates; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.survey_templates (id, tenant_id, name, description, category, template_data, is_public, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: surveys; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.surveys (id, uuid, tenant_id, title, description, type, status, is_anonymous, is_mandatory, allow_multiple_responses, start_date, end_date, created_by, notification_sent, reminder_sent, created_at, updated_at, uuid_created_at) FROM stdin;
\.


--
-- Data for Name: system_logs; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.system_logs (id, level, category, message, context, stack_trace, created_at) FROM stdin;
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.system_settings (id, setting_key, setting_value, value_type, category, description, is_public, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.teams (id, tenant_id, department_id, name, description, team_lead_id, is_active, is_archived, created_at, updated_at, created_by) FROM stdin;
\.


--
-- Data for Name: tenant_addons; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.tenant_addons (id, tenant_id, addon_type, quantity, unit_price, total_price, status, started_at, cancelled_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: tenant_data_exports; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.tenant_data_exports (id, tenant_id, file_path, file_size, checksum, created_at, expires_at, downloaded, downloaded_at, downloaded_by) FROM stdin;
\.


--
-- Data for Name: tenant_deletion_approvals; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.tenant_deletion_approvals (id, queue_id, approver_id, action, comment, created_at) FROM stdin;
\.


--
-- Data for Name: tenant_deletion_backups; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.tenant_deletion_backups (id, tenant_id, backup_file, backup_size, backup_type, created_at) FROM stdin;
\.


--
-- Data for Name: tenant_deletion_log; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.tenant_deletion_log (id, queue_id, step_name, table_name, records_deleted, duration_ms, status, error_message, created_at) FROM stdin;
\.


--
-- Data for Name: tenant_deletion_queue; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.tenant_deletion_queue (id, tenant_id, status, progress, current_step, total_steps, error_message, retry_count, grace_period_days, scheduled_deletion_date, created_at, started_at, completed_at, created_by, approval_required, second_approver_id, approval_requested_at, approved_at, approval_status, deletion_reason, ip_address, emergency_stop, emergency_stopped_at, emergency_stopped_by, cooling_off_hours) FROM stdin;
\.


--
-- Data for Name: tenant_deletion_rollback; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.tenant_deletion_rollback (id, queue_id, rollback_data, can_rollback, rollback_expires_at, created_at, rolled_back, rolled_back_at, rolled_back_by) FROM stdin;
\.


--
-- Data for Name: tenant_features; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.tenant_features (id, tenant_id, feature_id, is_active, activated_at, activated_by, expires_at, custom_config, created_at, updated_at) FROM stdin;
14	8	1	1	\N	\N	2025-12-14 21:08:32.801502+01	\N	\N	\N
15	8	2	1	\N	\N	2025-12-14 21:08:32.801502+01	\N	\N	\N
16	8	3	1	\N	\N	2025-12-14 21:08:32.801502+01	\N	\N	\N
17	8	4	1	\N	\N	2025-12-14 21:08:32.801502+01	\N	\N	\N
18	8	5	1	\N	\N	2025-12-14 21:08:32.801502+01	\N	\N	\N
19	8	6	1	\N	\N	2025-12-14 21:08:32.801502+01	\N	\N	\N
20	8	7	1	\N	\N	2025-12-14 21:08:32.801502+01	\N	\N	\N
21	8	8	1	\N	\N	2025-12-14 21:08:32.801502+01	\N	\N	\N
22	8	9	1	\N	\N	2025-12-14 21:08:32.801502+01	\N	\N	\N
23	8	10	1	\N	\N	2025-12-14 21:08:32.801502+01	\N	\N	\N
24	8	11	1	\N	\N	2025-12-14 21:08:32.801502+01	\N	\N	\N
25	8	12	1	\N	\N	2025-12-14 21:08:32.801502+01	\N	\N	\N
\.


--
-- Data for Name: tenant_plans; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.tenant_plans (id, tenant_id, plan_id, status, started_at, expires_at, cancelled_at, custom_price, billing_cycle, created_at, updated_at) FROM stdin;
3	8	1	trial	2025-11-30 21:08:32.801502+01	\N	\N	\N	monthly	\N	\N
\.


--
-- Data for Name: tenant_settings; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.tenant_settings (id, tenant_id, setting_key, setting_value, value_type, category, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: tenant_subscriptions; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.tenant_subscriptions (id, tenant_id, plan_id, status, started_at, expires_at, cancelled_at, stripe_subscription_id) FROM stdin;
\.


--
-- Data for Name: tenant_webhooks; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.tenant_webhooks (id, tenant_id, url, events, active, secret, created_at) FROM stdin;
\.


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.tenants (id, company_name, subdomain, email, phone, address, status, trial_ends_at, created_at, updated_at, settings, stripe_customer_id, stripe_subscription_id, current_plan, billing_email, logo_url, primary_color, created_by, current_plan_id, deletion_status, deletion_requested_at, deletion_requested_by) FROM stdin;
8	Testfirma	testfirma	root_all@testfirma.de	+497878788890	\N	trial	2025-12-14 21:08:32.803+01	\N	2025-11-30 21:08:32.801502+01	\N	\N	\N	basic	root_all@testfirma.de	\N	#0066cc	\N	1	active	\N	\N
\.


--
-- Data for Name: usage_quotas; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.usage_quotas (id, tenant_id, resource_type, used_amount, limit_amount, reset_period, last_reset) FROM stdin;
\.


--
-- Data for Name: user_2fa_backup_codes; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.user_2fa_backup_codes (id, user_id, code_hash, used, used_at, created_at) FROM stdin;
\.


--
-- Data for Name: user_2fa_secrets; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.user_2fa_secrets (id, user_id, secret, enabled, created_at) FROM stdin;
\.


--
-- Data for Name: user_departments; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.user_departments (id, tenant_id, user_id, department_id, is_primary, assigned_by, assigned_at) FROM stdin;
\.


--
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.user_sessions (id, user_id, session_id, fingerprint, ip_address, user_agent, created_at, expires_at, last_activity) FROM stdin;
\.


--
-- Data for Name: user_settings; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.user_settings (id, user_id, tenant_id, team_id, setting_key, setting_value, value_type, category, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_teams; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.user_teams (id, tenant_id, user_id, team_id, joined_at, role) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: pgloader
--

COPY public.users (id, tenant_id, username, email, password, role, has_full_access, first_name, last_name, age, employee_id, employee_number, notes, "position", phone, landline, profile_picture, address, date_of_birth, hire_date, emergency_contact, editable_fields, notification_preferences, is_active, is_archived, last_login, password_reset_token, password_reset_expires, two_factor_secret, two_factor_enabled, created_at, updated_at, archived_at, created_by, availability_status, availability_start, availability_end, availability_notes) FROM stdin;
7	8	root_all@testfirma.de	root_all@testfirma.de	$2b$10$xrVLpQDtXRiwo/hAdsK0h.8X4hIb4vFYYQRKgObbUcV1//gR7E9ky	root	t	Max	Mustermann	\N	TESTFIRMART7301120252008	6346326	\N	\N	+497878788890	\N	\N	\N	\N	\N	\N	\N	\N	1	f	2025-12-02 11:56:22.529+01	\N	\N	\N	f	\N	2025-12-02 11:56:22.531322+01	\N	\N	available	\N	\N	\N
\.


--
-- Name: absences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.absences_id_seq', 1, true);


--
-- Name: activity_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.activity_logs_id_seq', 1, true);


--
-- Name: admin_area_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.admin_area_permissions_id_seq', 1, true);


--
-- Name: admin_department_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.admin_department_permissions_id_seq', 1, true);


--
-- Name: admin_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.admin_logs_id_seq', 1, true);


--
-- Name: admin_permission_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.admin_permission_logs_id_seq', 1, true);


--
-- Name: api_keys_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.api_keys_id_seq', 1, true);


--
-- Name: api_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.api_logs_id_seq', 1, true);


--
-- Name: archived_tenant_invoices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.archived_tenant_invoices_id_seq', 1, true);


--
-- Name: areas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.areas_id_seq', 7, true);


--
-- Name: audit_trail_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.audit_trail_id_seq', 1, true);


--
-- Name: backup_retention_policy_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.backup_retention_policy_id_seq', 1, true);


--
-- Name: blackboard_comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.blackboard_comments_id_seq', 1, true);


--
-- Name: blackboard_confirmations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.blackboard_confirmations_id_seq', 1, true);


--
-- Name: blackboard_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.blackboard_entries_id_seq', 1, true);


--
-- Name: blackboard_entry_organizations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.blackboard_entry_organizations_id_seq', 1, true);


--
-- Name: calendar_attendees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.calendar_attendees_id_seq', 1, true);


--
-- Name: calendar_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.calendar_events_id_seq', 1, true);


--
-- Name: calendar_events_organizations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.calendar_events_organizations_id_seq', 1, true);


--
-- Name: calendar_recurring_patterns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.calendar_recurring_patterns_id_seq', 1, true);


--
-- Name: chat_channel_members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.chat_channel_members_id_seq', 1, true);


--
-- Name: chat_channels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.chat_channels_id_seq', 1, true);


--
-- Name: chat_message_edits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.chat_message_edits_id_seq', 1, true);


--
-- Name: chat_message_reactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.chat_message_reactions_id_seq', 1, true);


--
-- Name: chat_message_read_receipts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.chat_message_read_receipts_id_seq', 1, true);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.chat_messages_id_seq', 1, true);


--
-- Name: conversation_participants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.conversation_participants_id_seq', 1, true);


--
-- Name: conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.conversations_id_seq', 1, true);


--
-- Name: deletion_alerts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.deletion_alerts_id_seq', 1, true);


--
-- Name: deletion_audit_trail_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.deletion_audit_trail_id_seq', 1, true);


--
-- Name: deletion_dry_run_reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.deletion_dry_run_reports_id_seq', 1, true);


--
-- Name: deletion_partial_options_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.deletion_partial_options_id_seq', 1, true);


--
-- Name: departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.departments_id_seq', 1, true);


--
-- Name: document_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.document_permissions_id_seq', 1, true);


--
-- Name: document_read_status_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.document_read_status_id_seq', 1, true);


--
-- Name: document_shares_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.document_shares_id_seq', 1, true);


--
-- Name: documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.documents_id_seq', 1, true);


--
-- Name: email_queue_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.email_queue_id_seq', 1, true);


--
-- Name: email_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.email_templates_id_seq', 1, true);


--
-- Name: employee_availability_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.employee_availability_id_seq', 1, true);


--
-- Name: failed_file_deletions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.failed_file_deletions_id_seq', 1, true);


--
-- Name: feature_usage_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.feature_usage_logs_id_seq', 1, true);


--
-- Name: features_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.features_id_seq', 12, true);


--
-- Name: kvp_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.kvp_attachments_id_seq', 1, true);


--
-- Name: kvp_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.kvp_categories_id_seq', 6, true);


--
-- Name: kvp_comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.kvp_comments_id_seq', 1, true);


--
-- Name: kvp_points_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.kvp_points_id_seq', 1, true);


--
-- Name: kvp_ratings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.kvp_ratings_id_seq', 1, true);


--
-- Name: kvp_status_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.kvp_status_history_id_seq', 1, true);


--
-- Name: kvp_suggestions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.kvp_suggestions_id_seq', 1, true);


--
-- Name: kvp_votes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.kvp_votes_id_seq', 1, true);


--
-- Name: legal_holds_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.legal_holds_id_seq', 1, true);


--
-- Name: login_attempts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.login_attempts_id_seq', 1, true);


--
-- Name: machine_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.machine_categories_id_seq', 11, true);


--
-- Name: machine_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.machine_documents_id_seq', 1, true);


--
-- Name: machine_maintenance_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.machine_maintenance_history_id_seq', 1, true);


--
-- Name: machine_metrics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.machine_metrics_id_seq', 1, true);


--
-- Name: machine_teams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.machine_teams_id_seq', 1, true);


--
-- Name: machines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.machines_id_seq', 1, true);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.messages_id_seq', 1, true);


--
-- Name: migration_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.migration_log_id_seq', 1, true);


--
-- Name: notification_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.notification_preferences_id_seq', 1, true);


--
-- Name: notification_read_status_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.notification_read_status_id_seq', 1, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, true);


--
-- Name: oauth_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.oauth_tokens_id_seq', 1, true);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 1, true);


--
-- Name: payment_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.payment_history_id_seq', 1, true);


--
-- Name: plan_features_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.plan_features_id_seq', 36, true);


--
-- Name: plans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.plans_id_seq', 3, true);


--
-- Name: recurring_jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.recurring_jobs_id_seq', 1, true);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.refresh_tokens_id_seq', 21, true);


--
-- Name: released_subdomains_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.released_subdomains_id_seq', 1, true);


--
-- Name: root_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.root_logs_id_seq', 43, true);


--
-- Name: scheduled_tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.scheduled_tasks_id_seq', 1, true);


--
-- Name: security_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.security_logs_id_seq', 1, true);


--
-- Name: shift_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.shift_assignments_id_seq', 1, true);


--
-- Name: shift_favorites_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.shift_favorites_id_seq', 1, true);


--
-- Name: shift_plans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.shift_plans_id_seq', 1, true);


--
-- Name: shift_rotation_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.shift_rotation_assignments_id_seq', 1, true);


--
-- Name: shift_rotation_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.shift_rotation_history_id_seq', 1, true);


--
-- Name: shift_rotation_patterns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.shift_rotation_patterns_id_seq', 1, true);


--
-- Name: shift_swap_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.shift_swap_requests_id_seq', 1, true);


--
-- Name: shift_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.shift_templates_id_seq', 1, true);


--
-- Name: shifts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.shifts_id_seq', 1, true);


--
-- Name: subscription_plans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.subscription_plans_id_seq', 1, true);


--
-- Name: survey_answers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.survey_answers_id_seq', 1, true);


--
-- Name: survey_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.survey_assignments_id_seq', 1, true);


--
-- Name: survey_comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.survey_comments_id_seq', 1, true);


--
-- Name: survey_participants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.survey_participants_id_seq', 1, true);


--
-- Name: survey_question_options_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.survey_question_options_id_seq', 1, true);


--
-- Name: survey_questions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.survey_questions_id_seq', 1, true);


--
-- Name: survey_reminders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.survey_reminders_id_seq', 1, true);


--
-- Name: survey_responses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.survey_responses_id_seq', 1, true);


--
-- Name: survey_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.survey_templates_id_seq', 1, true);


--
-- Name: surveys_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.surveys_id_seq', 1, true);


--
-- Name: system_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.system_logs_id_seq', 1, true);


--
-- Name: system_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.system_settings_id_seq', 1, true);


--
-- Name: teams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.teams_id_seq', 1, true);


--
-- Name: tenant_addons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.tenant_addons_id_seq', 1, true);


--
-- Name: tenant_data_exports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.tenant_data_exports_id_seq', 1, true);


--
-- Name: tenant_deletion_approvals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.tenant_deletion_approvals_id_seq', 1, true);


--
-- Name: tenant_deletion_backups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.tenant_deletion_backups_id_seq', 1, true);


--
-- Name: tenant_deletion_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.tenant_deletion_log_id_seq', 1, true);


--
-- Name: tenant_deletion_queue_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.tenant_deletion_queue_id_seq', 1, true);


--
-- Name: tenant_deletion_rollback_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.tenant_deletion_rollback_id_seq', 1, true);


--
-- Name: tenant_features_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.tenant_features_id_seq', 25, true);


--
-- Name: tenant_plans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.tenant_plans_id_seq', 3, true);


--
-- Name: tenant_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.tenant_settings_id_seq', 1, true);


--
-- Name: tenant_subscriptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.tenant_subscriptions_id_seq', 1, true);


--
-- Name: tenant_webhooks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.tenant_webhooks_id_seq', 1, true);


--
-- Name: tenants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.tenants_id_seq', 8, true);


--
-- Name: usage_quotas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.usage_quotas_id_seq', 1, true);


--
-- Name: user_2fa_backup_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.user_2fa_backup_codes_id_seq', 1, true);


--
-- Name: user_2fa_secrets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.user_2fa_secrets_id_seq', 1, true);


--
-- Name: user_departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.user_departments_id_seq', 1, true);


--
-- Name: user_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.user_sessions_id_seq', 1, true);


--
-- Name: user_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.user_settings_id_seq', 1, true);


--
-- Name: user_teams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.user_teams_id_seq', 1, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pgloader
--

SELECT pg_catalog.setval('public.users_id_seq', 7, true);


--
-- Name: absences idx_18930_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.absences
    ADD CONSTRAINT idx_18930_primary PRIMARY KEY (id);


--
-- Name: activity_logs idx_18938_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT idx_18938_primary PRIMARY KEY (id);


--
-- Name: admin_area_permissions idx_18945_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.admin_area_permissions
    ADD CONSTRAINT idx_18945_primary PRIMARY KEY (id);


--
-- Name: admin_department_permissions idx_18953_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.admin_department_permissions
    ADD CONSTRAINT idx_18953_primary PRIMARY KEY (id);


--
-- Name: admin_logs idx_18961_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT idx_18961_primary PRIMARY KEY (id);


--
-- Name: admin_permission_logs idx_18968_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.admin_permission_logs
    ADD CONSTRAINT idx_18968_primary PRIMARY KEY (id);


--
-- Name: api_keys idx_18975_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT idx_18975_primary PRIMARY KEY (id);


--
-- Name: api_logs idx_18983_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.api_logs
    ADD CONSTRAINT idx_18983_primary PRIMARY KEY (id);


--
-- Name: archived_tenant_invoices idx_18990_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.archived_tenant_invoices
    ADD CONSTRAINT idx_18990_primary PRIMARY KEY (id);


--
-- Name: areas idx_18997_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT idx_18997_primary PRIMARY KEY (id);


--
-- Name: audit_trail idx_19007_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.audit_trail
    ADD CONSTRAINT idx_19007_primary PRIMARY KEY (id);


--
-- Name: backup_retention_policy idx_19015_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.backup_retention_policy
    ADD CONSTRAINT idx_19015_primary PRIMARY KEY (id);


--
-- Name: blackboard_comments idx_19024_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.blackboard_comments
    ADD CONSTRAINT idx_19024_primary PRIMARY KEY (id);


--
-- Name: blackboard_confirmations idx_19032_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.blackboard_confirmations
    ADD CONSTRAINT idx_19032_primary PRIMARY KEY (id);


--
-- Name: blackboard_entries idx_19037_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.blackboard_entries
    ADD CONSTRAINT idx_19037_primary PRIMARY KEY (id);


--
-- Name: blackboard_entry_organizations idx_19053_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.blackboard_entry_organizations
    ADD CONSTRAINT idx_19053_primary PRIMARY KEY (id);


--
-- Name: calendar_attendees idx_19058_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.calendar_attendees
    ADD CONSTRAINT idx_19058_primary PRIMARY KEY (id);


--
-- Name: calendar_events idx_19063_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT idx_19063_primary PRIMARY KEY (id);


--
-- Name: calendar_events_organizations idx_19078_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.calendar_events_organizations
    ADD CONSTRAINT idx_19078_primary PRIMARY KEY (id);


--
-- Name: calendar_recurring_patterns idx_19083_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.calendar_recurring_patterns
    ADD CONSTRAINT idx_19083_primary PRIMARY KEY (id);


--
-- Name: chat_channels idx_19089_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT idx_19089_primary PRIMARY KEY (id);


--
-- Name: chat_channel_members idx_19098_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_channel_members
    ADD CONSTRAINT idx_19098_primary PRIMARY KEY (id);


--
-- Name: chat_messages idx_19104_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT idx_19104_primary PRIMARY KEY (id);


--
-- Name: chat_message_edits idx_19115_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_message_edits
    ADD CONSTRAINT idx_19115_primary PRIMARY KEY (id);


--
-- Name: chat_message_reactions idx_19122_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_message_reactions
    ADD CONSTRAINT idx_19122_primary PRIMARY KEY (id);


--
-- Name: chat_message_read_receipts idx_19127_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_message_read_receipts
    ADD CONSTRAINT idx_19127_primary PRIMARY KEY (id);


--
-- Name: conversations idx_19132_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT idx_19132_primary PRIMARY KEY (id);


--
-- Name: conversation_participants idx_19138_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT idx_19138_primary PRIMARY KEY (id);


--
-- Name: deletion_alerts idx_19144_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.deletion_alerts
    ADD CONSTRAINT idx_19144_primary PRIMARY KEY (id);


--
-- Name: deletion_audit_trail idx_19151_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.deletion_audit_trail
    ADD CONSTRAINT idx_19151_primary PRIMARY KEY (id);


--
-- Name: deletion_dry_run_reports idx_19159_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.deletion_dry_run_reports
    ADD CONSTRAINT idx_19159_primary PRIMARY KEY (id);


--
-- Name: deletion_partial_options idx_19166_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.deletion_partial_options
    ADD CONSTRAINT idx_19166_primary PRIMARY KEY (id);


--
-- Name: departments idx_19172_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT idx_19172_primary PRIMARY KEY (id);


--
-- Name: documents idx_19181_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT idx_19181_primary PRIMARY KEY (id);


--
-- Name: document_permissions idx_19192_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT idx_19192_primary PRIMARY KEY (id);


--
-- Name: document_read_status idx_19197_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.document_read_status
    ADD CONSTRAINT idx_19197_primary PRIMARY KEY (id);


--
-- Name: document_shares idx_19202_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.document_shares
    ADD CONSTRAINT idx_19202_primary PRIMARY KEY (id);


--
-- Name: email_queue idx_19209_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT idx_19209_primary PRIMARY KEY (id);


--
-- Name: email_templates idx_19218_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT idx_19218_primary PRIMARY KEY (id);


--
-- Name: employee_availability idx_19227_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.employee_availability
    ADD CONSTRAINT idx_19227_primary PRIMARY KEY (id);


--
-- Name: failed_file_deletions idx_19235_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.failed_file_deletions
    ADD CONSTRAINT idx_19235_primary PRIMARY KEY (id);


--
-- Name: features idx_19243_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.features
    ADD CONSTRAINT idx_19243_primary PRIMARY KEY (id);


--
-- Name: feature_usage_logs idx_19255_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.feature_usage_logs
    ADD CONSTRAINT idx_19255_primary PRIMARY KEY (id);


--
-- Name: kvp_attachments idx_19262_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_attachments
    ADD CONSTRAINT idx_19262_primary PRIMARY KEY (id);


--
-- Name: kvp_comments idx_19269_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_comments
    ADD CONSTRAINT idx_19269_primary PRIMARY KEY (id);


--
-- Name: kvp_points idx_19277_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_points
    ADD CONSTRAINT idx_19277_primary PRIMARY KEY (id);


--
-- Name: kvp_ratings idx_19282_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_ratings
    ADD CONSTRAINT idx_19282_primary PRIMARY KEY (id);


--
-- Name: kvp_status_history idx_19289_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_status_history
    ADD CONSTRAINT idx_19289_primary PRIMARY KEY (id);


--
-- Name: kvp_suggestions idx_19296_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_suggestions
    ADD CONSTRAINT idx_19296_primary PRIMARY KEY (id);


--
-- Name: kvp_votes idx_19307_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_votes
    ADD CONSTRAINT idx_19307_primary PRIMARY KEY (id);


--
-- Name: legal_holds idx_19312_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.legal_holds
    ADD CONSTRAINT idx_19312_primary PRIMARY KEY (id);


--
-- Name: login_attempts idx_19320_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.login_attempts
    ADD CONSTRAINT idx_19320_primary PRIMARY KEY (id);


--
-- Name: machines idx_19326_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT idx_19326_primary PRIMARY KEY (id);


--
-- Name: machine_documents idx_19337_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_documents
    ADD CONSTRAINT idx_19337_primary PRIMARY KEY (id);


--
-- Name: machine_maintenance_history idx_19344_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_maintenance_history
    ADD CONSTRAINT idx_19344_primary PRIMARY KEY (id);


--
-- Name: machine_metrics idx_19352_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_metrics
    ADD CONSTRAINT idx_19352_primary PRIMARY KEY (id);


--
-- Name: machine_teams idx_19358_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_teams
    ADD CONSTRAINT idx_19358_primary PRIMARY KEY (id);


--
-- Name: messages idx_19366_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT idx_19366_primary PRIMARY KEY (id);


--
-- Name: migration_log idx_19374_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.migration_log
    ADD CONSTRAINT idx_19374_primary PRIMARY KEY (id);


--
-- Name: notifications idx_19379_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT idx_19379_primary PRIMARY KEY (id);


--
-- Name: notification_preferences idx_19387_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT idx_19387_primary PRIMARY KEY (id);


--
-- Name: notification_read_status idx_19401_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.notification_read_status
    ADD CONSTRAINT idx_19401_primary PRIMARY KEY (id);


--
-- Name: oauth_tokens idx_19406_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.oauth_tokens
    ADD CONSTRAINT idx_19406_primary PRIMARY KEY (id);


--
-- Name: password_reset_tokens idx_19414_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT idx_19414_primary PRIMARY KEY (id);


--
-- Name: payment_history idx_19420_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.payment_history
    ADD CONSTRAINT idx_19420_primary PRIMARY KEY (id);


--
-- Name: plans idx_19429_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT idx_19429_primary PRIMARY KEY (id);


--
-- Name: plan_features idx_19440_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.plan_features
    ADD CONSTRAINT idx_19440_primary PRIMARY KEY (id);


--
-- Name: recurring_jobs idx_19446_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.recurring_jobs
    ADD CONSTRAINT idx_19446_primary PRIMARY KEY (id);


--
-- Name: refresh_tokens idx_19452_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT idx_19452_primary PRIMARY KEY (id);


--
-- Name: released_subdomains idx_19460_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.released_subdomains
    ADD CONSTRAINT idx_19460_primary PRIMARY KEY (id);


--
-- Name: root_logs idx_19466_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.root_logs
    ADD CONSTRAINT idx_19466_primary PRIMARY KEY (id);


--
-- Name: scheduled_tasks idx_19474_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.scheduled_tasks
    ADD CONSTRAINT idx_19474_primary PRIMARY KEY (id);


--
-- Name: security_logs idx_19482_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.security_logs
    ADD CONSTRAINT idx_19482_primary PRIMARY KEY (id);


--
-- Name: shifts idx_19489_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT idx_19489_primary PRIMARY KEY (id);


--
-- Name: shift_assignments idx_19500_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_assignments
    ADD CONSTRAINT idx_19500_primary PRIMARY KEY (id);


--
-- Name: shift_favorites idx_19510_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_favorites
    ADD CONSTRAINT idx_19510_primary PRIMARY KEY (id);


--
-- Name: shift_plans idx_19517_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_plans
    ADD CONSTRAINT idx_19517_primary PRIMARY KEY (id);


--
-- Name: shift_rotation_assignments idx_19525_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_rotation_assignments
    ADD CONSTRAINT idx_19525_primary PRIMARY KEY (id);


--
-- Name: shift_rotation_history idx_19535_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_rotation_history
    ADD CONSTRAINT idx_19535_primary PRIMARY KEY (id);


--
-- Name: shift_rotation_patterns idx_19543_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_rotation_patterns
    ADD CONSTRAINT idx_19543_primary PRIMARY KEY (id);


--
-- Name: shift_swap_requests idx_19553_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT idx_19553_primary PRIMARY KEY (id);


--
-- Name: shift_templates idx_19561_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_templates
    ADD CONSTRAINT idx_19561_primary PRIMARY KEY (id);


--
-- Name: subscription_plans idx_19570_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT idx_19570_primary PRIMARY KEY (id);


--
-- Name: surveys idx_19578_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT idx_19578_primary PRIMARY KEY (id);


--
-- Name: survey_answers idx_19592_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_answers
    ADD CONSTRAINT idx_19592_primary PRIMARY KEY (id);


--
-- Name: survey_assignments idx_19599_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_assignments
    ADD CONSTRAINT idx_19599_primary PRIMARY KEY (id);


--
-- Name: survey_comments idx_19604_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_comments
    ADD CONSTRAINT idx_19604_primary PRIMARY KEY (id);


--
-- Name: survey_participants idx_19612_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_participants
    ADD CONSTRAINT idx_19612_primary PRIMARY KEY (id);


--
-- Name: survey_questions idx_19618_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_questions
    ADD CONSTRAINT idx_19618_primary PRIMARY KEY (id);


--
-- Name: survey_question_options idx_19627_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_question_options
    ADD CONSTRAINT idx_19627_primary PRIMARY KEY (id);


--
-- Name: survey_reminders idx_19635_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_reminders
    ADD CONSTRAINT idx_19635_primary PRIMARY KEY (id);


--
-- Name: survey_responses idx_19643_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT idx_19643_primary PRIMARY KEY (id);


--
-- Name: survey_templates idx_19651_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_templates
    ADD CONSTRAINT idx_19651_primary PRIMARY KEY (id);


--
-- Name: system_logs idx_19659_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.system_logs
    ADD CONSTRAINT idx_19659_primary PRIMARY KEY (id);


--
-- Name: system_settings idx_19666_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT idx_19666_primary PRIMARY KEY (id);


--
-- Name: teams idx_19675_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT idx_19675_primary PRIMARY KEY (id);


--
-- Name: tenants idx_19684_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT idx_19684_primary PRIMARY KEY (id);


--
-- Name: tenant_addons idx_19695_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_addons
    ADD CONSTRAINT idx_19695_primary PRIMARY KEY (id);


--
-- Name: tenant_data_exports idx_19702_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_data_exports
    ADD CONSTRAINT idx_19702_primary PRIMARY KEY (id);


--
-- Name: tenant_deletion_approvals idx_19710_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_deletion_approvals
    ADD CONSTRAINT idx_19710_primary PRIMARY KEY (id);


--
-- Name: tenant_deletion_backups idx_19717_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_deletion_backups
    ADD CONSTRAINT idx_19717_primary PRIMARY KEY (id);


--
-- Name: tenant_deletion_log idx_19725_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_deletion_log
    ADD CONSTRAINT idx_19725_primary PRIMARY KEY (id);


--
-- Name: tenant_deletion_queue idx_19733_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_deletion_queue
    ADD CONSTRAINT idx_19733_primary PRIMARY KEY (id);


--
-- Name: tenant_deletion_rollback idx_19749_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_deletion_rollback
    ADD CONSTRAINT idx_19749_primary PRIMARY KEY (id);


--
-- Name: tenant_features idx_19758_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_features
    ADD CONSTRAINT idx_19758_primary PRIMARY KEY (id);


--
-- Name: tenant_plans idx_19766_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_plans
    ADD CONSTRAINT idx_19766_primary PRIMARY KEY (id);


--
-- Name: tenant_settings idx_19773_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT idx_19773_primary PRIMARY KEY (id);


--
-- Name: tenant_subscriptions idx_19781_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_subscriptions
    ADD CONSTRAINT idx_19781_primary PRIMARY KEY (id);


--
-- Name: tenant_webhooks idx_19787_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_webhooks
    ADD CONSTRAINT idx_19787_primary PRIMARY KEY (id);


--
-- Name: usage_quotas idx_19795_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.usage_quotas
    ADD CONSTRAINT idx_19795_primary PRIMARY KEY (id);


--
-- Name: users idx_19802_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT idx_19802_primary PRIMARY KEY (id);


--
-- Name: user_2fa_backup_codes idx_19815_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_2fa_backup_codes
    ADD CONSTRAINT idx_19815_primary PRIMARY KEY (id);


--
-- Name: user_2fa_secrets idx_19821_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_2fa_secrets
    ADD CONSTRAINT idx_19821_primary PRIMARY KEY (id);


--
-- Name: user_departments idx_19827_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_departments
    ADD CONSTRAINT idx_19827_primary PRIMARY KEY (id);


--
-- Name: user_sessions idx_19833_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT idx_19833_primary PRIMARY KEY (id);


--
-- Name: user_settings idx_19840_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT idx_19840_primary PRIMARY KEY (id);


--
-- Name: user_teams idx_19848_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_teams
    ADD CONSTRAINT idx_19848_primary PRIMARY KEY (id);


--
-- Name: kvp_categories idx_22142_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_categories
    ADD CONSTRAINT idx_22142_primary PRIMARY KEY (id);


--
-- Name: machine_categories idx_22152_primary; Type: CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_categories
    ADD CONSTRAINT idx_22152_primary PRIMARY KEY (id);


--
-- Name: idx_18930_approved_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18930_approved_by ON public.absences USING btree (approved_by);


--
-- Name: idx_18930_idx_dates; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18930_idx_dates ON public.absences USING btree (start_date, end_date);


--
-- Name: idx_18930_idx_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18930_idx_status ON public.absences USING btree (status);


--
-- Name: idx_18930_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18930_idx_tenant_id ON public.absences USING btree (tenant_id);


--
-- Name: idx_18930_idx_type; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18930_idx_type ON public.absences USING btree (type);


--
-- Name: idx_18930_idx_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18930_idx_user_id ON public.absences USING btree (user_id);


--
-- Name: idx_18938_idx_action; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18938_idx_action ON public.activity_logs USING btree (action);


--
-- Name: idx_18938_idx_created_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18938_idx_created_at ON public.activity_logs USING btree (created_at);


--
-- Name: idx_18938_idx_entity; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18938_idx_entity ON public.activity_logs USING btree (entity_type, entity_id);


--
-- Name: idx_18938_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18938_idx_tenant_id ON public.activity_logs USING btree (tenant_id);


--
-- Name: idx_18938_idx_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18938_idx_user_id ON public.activity_logs USING btree (user_id);


--
-- Name: idx_18945_fk_uap_area; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18945_fk_uap_area ON public.admin_area_permissions USING btree (area_id);


--
-- Name: idx_18945_fk_uap_assigned_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18945_fk_uap_assigned_by ON public.admin_area_permissions USING btree (assigned_by);


--
-- Name: idx_18945_idx_admin_area_permissions_admin; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18945_idx_admin_area_permissions_admin ON public.admin_area_permissions USING btree (admin_user_id);


--
-- Name: idx_18945_idx_uap_tenant_area; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18945_idx_uap_tenant_area ON public.admin_area_permissions USING btree (tenant_id, area_id);


--
-- Name: idx_18945_idx_uap_tenant_user; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18945_idx_uap_tenant_user ON public.admin_area_permissions USING btree (tenant_id, admin_user_id);


--
-- Name: idx_18945_uq_user_area_tenant; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_18945_uq_user_area_tenant ON public.admin_area_permissions USING btree (admin_user_id, area_id, tenant_id);


--
-- Name: idx_18953_assigned_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18953_assigned_by ON public.admin_department_permissions USING btree (assigned_by);


--
-- Name: idx_18953_department_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18953_department_id ON public.admin_department_permissions USING btree (department_id);


--
-- Name: idx_18953_idx_admin_permissions; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18953_idx_admin_permissions ON public.admin_department_permissions USING btree (admin_user_id, tenant_id);


--
-- Name: idx_18953_unique_admin_dept; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_18953_unique_admin_dept ON public.admin_department_permissions USING btree (tenant_id, admin_user_id, department_id);


--
-- Name: idx_18961_idx_created; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18961_idx_created ON public.admin_logs USING btree (created_at);


--
-- Name: idx_18961_idx_user_action; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18961_idx_user_action ON public.admin_logs USING btree (user_id, action);


--
-- Name: idx_18968_changed_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18968_changed_by ON public.admin_permission_logs USING btree (changed_by);


--
-- Name: idx_18968_idx_permission_logs; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18968_idx_permission_logs ON public.admin_permission_logs USING btree (admin_user_id, created_at);


--
-- Name: idx_18968_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18968_tenant_id ON public.admin_permission_logs USING btree (tenant_id);


--
-- Name: idx_18975_created_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18975_created_by ON public.api_keys USING btree (created_by);


--
-- Name: idx_18975_idx_active; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18975_idx_active ON public.api_keys USING btree (active);


--
-- Name: idx_18975_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18975_idx_tenant_id ON public.api_keys USING btree (tenant_id);


--
-- Name: idx_18975_unique_key_hash; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_18975_unique_key_hash ON public.api_keys USING btree (key_hash);


--
-- Name: idx_18983_idx_created_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18983_idx_created_at ON public.api_logs USING btree (created_at);


--
-- Name: idx_18983_idx_endpoint; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18983_idx_endpoint ON public.api_logs USING btree (endpoint);


--
-- Name: idx_18983_idx_status_code; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18983_idx_status_code ON public.api_logs USING btree (status_code);


--
-- Name: idx_18983_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18983_idx_tenant_id ON public.api_logs USING btree (tenant_id);


--
-- Name: idx_18983_idx_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18983_idx_user_id ON public.api_logs USING btree (user_id);


--
-- Name: idx_18990_idx_delete_after; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18990_idx_delete_after ON public.archived_tenant_invoices USING btree (delete_after);


--
-- Name: idx_18990_idx_invoice_number; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18990_idx_invoice_number ON public.archived_tenant_invoices USING btree (invoice_number);


--
-- Name: idx_18990_idx_original_tenant; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18990_idx_original_tenant ON public.archived_tenant_invoices USING btree (original_tenant_id);


--
-- Name: idx_18997_fk_areas_created_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18997_fk_areas_created_by ON public.areas USING btree (created_by);


--
-- Name: idx_18997_idx_area_lead_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18997_idx_area_lead_id ON public.areas USING btree (area_lead_id);


--
-- Name: idx_18997_idx_areas_active; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18997_idx_areas_active ON public.areas USING btree (is_active);


--
-- Name: idx_18997_idx_areas_is_archived; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18997_idx_areas_is_archived ON public.areas USING btree (is_archived);


--
-- Name: idx_18997_idx_areas_tenant; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18997_idx_areas_tenant ON public.areas USING btree (tenant_id);


--
-- Name: idx_18997_idx_areas_type; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_18997_idx_areas_type ON public.areas USING btree (type);


--
-- Name: idx_19007_audit_trail_user_fk; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19007_audit_trail_user_fk ON public.audit_trail USING btree (user_id);


--
-- Name: idx_19007_idx_action; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19007_idx_action ON public.audit_trail USING btree (action);


--
-- Name: idx_19007_idx_created_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19007_idx_created_at ON public.audit_trail USING btree (created_at);


--
-- Name: idx_19007_idx_resource; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19007_idx_resource ON public.audit_trail USING btree (resource_type, resource_id);


--
-- Name: idx_19007_idx_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19007_idx_status ON public.audit_trail USING btree (status);


--
-- Name: idx_19007_idx_tenant_user; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19007_idx_tenant_user ON public.audit_trail USING btree (tenant_id, user_id);


--
-- Name: idx_19015_idx_backup_type; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19015_idx_backup_type ON public.backup_retention_policy USING btree (backup_type);


--
-- Name: idx_19015_idx_expires_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19015_idx_expires_at ON public.backup_retention_policy USING btree (expires_at);


--
-- Name: idx_19015_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19015_idx_tenant_id ON public.backup_retention_policy USING btree (tenant_id);


--
-- Name: idx_19024_idx_blackboard_comments_created_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19024_idx_blackboard_comments_created_at ON public.blackboard_comments USING btree (created_at);


--
-- Name: idx_19024_idx_blackboard_comments_entry_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19024_idx_blackboard_comments_entry_id ON public.blackboard_comments USING btree (entry_id);


--
-- Name: idx_19024_idx_blackboard_comments_tenant_entry; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19024_idx_blackboard_comments_tenant_entry ON public.blackboard_comments USING btree (tenant_id, entry_id);


--
-- Name: idx_19024_idx_blackboard_comments_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19024_idx_blackboard_comments_tenant_id ON public.blackboard_comments USING btree (tenant_id);


--
-- Name: idx_19024_idx_blackboard_comments_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19024_idx_blackboard_comments_user_id ON public.blackboard_comments USING btree (user_id);


--
-- Name: idx_19032_idx_blackboard_confirmations_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19032_idx_blackboard_confirmations_tenant_id ON public.blackboard_confirmations USING btree (tenant_id);


--
-- Name: idx_19032_idx_entry_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19032_idx_entry_id ON public.blackboard_confirmations USING btree (entry_id);


--
-- Name: idx_19032_idx_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19032_idx_user_id ON public.blackboard_confirmations USING btree (user_id);


--
-- Name: idx_19032_unique_confirmation; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19032_unique_confirmation ON public.blackboard_confirmations USING btree (entry_id, user_id, tenant_id);


--
-- Name: idx_19037_idx_area_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19037_idx_area_id ON public.blackboard_entries USING btree (area_id);


--
-- Name: idx_19037_idx_author_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19037_idx_author_id ON public.blackboard_entries USING btree (author_id);


--
-- Name: idx_19037_idx_blackboard_entries_tenant_uuid; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19037_idx_blackboard_entries_tenant_uuid ON public.blackboard_entries USING btree (tenant_id, uuid);


--
-- Name: idx_19037_idx_blackboard_entries_uuid; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19037_idx_blackboard_entries_uuid ON public.blackboard_entries USING btree (uuid);


--
-- Name: idx_19037_idx_expires_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19037_idx_expires_at ON public.blackboard_entries USING btree (expires_at);


--
-- Name: idx_19037_idx_is_active; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19037_idx_is_active ON public.blackboard_entries USING btree (is_active);


--
-- Name: idx_19037_idx_is_pinned; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19037_idx_is_pinned ON public.blackboard_entries USING btree (is_pinned);


--
-- Name: idx_19037_idx_org_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19037_idx_org_id ON public.blackboard_entries USING btree (org_id);


--
-- Name: idx_19037_idx_org_level; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19037_idx_org_level ON public.blackboard_entries USING btree (org_level);


--
-- Name: idx_19037_idx_priority; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19037_idx_priority ON public.blackboard_entries USING btree (priority);


--
-- Name: idx_19037_idx_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19037_idx_status ON public.blackboard_entries USING btree (status);


--
-- Name: idx_19037_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19037_idx_tenant_id ON public.blackboard_entries USING btree (tenant_id);


--
-- Name: idx_19037_idx_valid_dates; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19037_idx_valid_dates ON public.blackboard_entries USING btree (valid_from, valid_until);


--
-- Name: idx_19037_uuid; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19037_uuid ON public.blackboard_entries USING btree (uuid);


--
-- Name: idx_19053_idx_combined; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19053_idx_combined ON public.blackboard_entry_organizations USING btree (entry_id, org_type, org_id);


--
-- Name: idx_19053_idx_entry_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19053_idx_entry_id ON public.blackboard_entry_organizations USING btree (entry_id);


--
-- Name: idx_19053_idx_org_type_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19053_idx_org_type_id ON public.blackboard_entry_organizations USING btree (org_type, org_id);


--
-- Name: idx_19053_unique_entry_org; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19053_unique_entry_org ON public.blackboard_entry_organizations USING btree (entry_id, org_type, org_id);


--
-- Name: idx_19058_idx_calendar_attendees_pending; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19058_idx_calendar_attendees_pending ON public.calendar_attendees USING btree (user_id, tenant_id);


--
-- Name: idx_19058_idx_event_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19058_idx_event_status ON public.calendar_attendees USING btree (event_id);


--
-- Name: idx_19058_idx_tenant_attendee; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19058_idx_tenant_attendee ON public.calendar_attendees USING btree (tenant_id, user_id);


--
-- Name: idx_19058_idx_tenant_event; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19058_idx_tenant_event ON public.calendar_attendees USING btree (tenant_id, event_id);


--
-- Name: idx_19058_unique_event_user; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19058_unique_event_user ON public.calendar_attendees USING btree (event_id, user_id);


--
-- Name: idx_19063_fk_calendar_events_department; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19063_fk_calendar_events_department ON public.calendar_events USING btree (department_id);


--
-- Name: idx_19063_fk_calendar_events_team; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19063_fk_calendar_events_team ON public.calendar_events USING btree (team_id);


--
-- Name: idx_19063_idx_calendar_department; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19063_idx_calendar_department ON public.calendar_events USING btree (tenant_id, department_id, start_date);


--
-- Name: idx_19063_idx_calendar_event_uuid; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19063_idx_calendar_event_uuid ON public.calendar_events USING btree (uuid);


--
-- Name: idx_19063_idx_calendar_events_area_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19063_idx_calendar_events_area_id ON public.calendar_events USING btree (area_id);


--
-- Name: idx_19063_idx_calendar_events_org_level; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19063_idx_calendar_events_org_level ON public.calendar_events USING btree (org_level);


--
-- Name: idx_19063_idx_calendar_filter_optimized; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19063_idx_calendar_filter_optimized ON public.calendar_events USING btree (tenant_id, start_date, end_date, org_level);


--
-- Name: idx_19063_idx_calendar_requires_response; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19063_idx_calendar_requires_response ON public.calendar_events USING btree (tenant_id, status);


--
-- Name: idx_19063_idx_calendar_team; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19063_idx_calendar_team ON public.calendar_events USING btree (tenant_id, team_id, start_date);


--
-- Name: idx_19063_idx_calendar_tenant_uuid; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19063_idx_calendar_tenant_uuid ON public.calendar_events USING btree (tenant_id, uuid);


--
-- Name: idx_19063_idx_org_filter; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19063_idx_org_filter ON public.calendar_events USING btree (tenant_id, org_level, org_id);


--
-- Name: idx_19063_idx_org_level_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19063_idx_org_level_id ON public.calendar_events USING btree (org_level, org_id);


--
-- Name: idx_19063_idx_tenant_dates; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19063_idx_tenant_dates ON public.calendar_events USING btree (tenant_id, start_date, end_date);


--
-- Name: idx_19063_idx_user_dates; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19063_idx_user_dates ON public.calendar_events USING btree (user_id, start_date, end_date);


--
-- Name: idx_19063_parent_event_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19063_parent_event_id ON public.calendar_events USING btree (parent_event_id);


--
-- Name: idx_19078_idx_combined; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19078_idx_combined ON public.calendar_events_organizations USING btree (event_id, org_type, org_id);


--
-- Name: idx_19078_idx_event_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19078_idx_event_id ON public.calendar_events_organizations USING btree (event_id);


--
-- Name: idx_19078_idx_org_type_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19078_idx_org_type_id ON public.calendar_events_organizations USING btree (org_type, org_id);


--
-- Name: idx_19078_unique_event_org; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19078_unique_event_org ON public.calendar_events_organizations USING btree (event_id, org_type, org_id);


--
-- Name: idx_19083_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19083_tenant_id ON public.calendar_recurring_patterns USING btree (tenant_id);


--
-- Name: idx_19083_unique_event; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19083_unique_event ON public.calendar_recurring_patterns USING btree (event_id);


--
-- Name: idx_19089_created_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19089_created_by ON public.chat_channels USING btree (created_by);


--
-- Name: idx_19089_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19089_tenant_id ON public.chat_channels USING btree (tenant_id);


--
-- Name: idx_19098_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19098_tenant_id ON public.chat_channel_members USING btree (tenant_id);


--
-- Name: idx_19098_unique_channel_user; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19098_unique_channel_user ON public.chat_channel_members USING btree (channel_id, user_id);


--
-- Name: idx_19098_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19098_user_id ON public.chat_channel_members USING btree (user_id);


--
-- Name: idx_19104_channel_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19104_channel_id ON public.chat_messages USING btree (channel_id);


--
-- Name: idx_19104_reply_to_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19104_reply_to_id ON public.chat_messages USING btree (reply_to_id);


--
-- Name: idx_19104_sender_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19104_sender_id ON public.chat_messages USING btree (sender_id);


--
-- Name: idx_19104_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19104_tenant_id ON public.chat_messages USING btree (tenant_id);


--
-- Name: idx_19115_edited_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19115_edited_by ON public.chat_message_edits USING btree (edited_by);


--
-- Name: idx_19115_message_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19115_message_id ON public.chat_message_edits USING btree (message_id);


--
-- Name: idx_19115_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19115_tenant_id ON public.chat_message_edits USING btree (tenant_id);


--
-- Name: idx_19122_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19122_tenant_id ON public.chat_message_reactions USING btree (tenant_id);


--
-- Name: idx_19122_unique_message_user_emoji; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19122_unique_message_user_emoji ON public.chat_message_reactions USING btree (message_id, user_id, emoji);


--
-- Name: idx_19122_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19122_user_id ON public.chat_message_reactions USING btree (user_id);


--
-- Name: idx_19127_channel_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19127_channel_id ON public.chat_message_read_receipts USING btree (channel_id);


--
-- Name: idx_19127_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19127_tenant_id ON public.chat_message_read_receipts USING btree (tenant_id);


--
-- Name: idx_19127_unique_message_user; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19127_unique_message_user ON public.chat_message_read_receipts USING btree (message_id, user_id);


--
-- Name: idx_19127_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19127_user_id ON public.chat_message_read_receipts USING btree (user_id);


--
-- Name: idx_19132_idx_tenant; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19132_idx_tenant ON public.conversations USING btree (tenant_id);


--
-- Name: idx_19138_idx_tenant; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19138_idx_tenant ON public.conversation_participants USING btree (tenant_id);


--
-- Name: idx_19138_idx_user; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19138_idx_user ON public.conversation_participants USING btree (user_id);


--
-- Name: idx_19138_unique_participant; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19138_unique_participant ON public.conversation_participants USING btree (conversation_id, user_id);


--
-- Name: idx_19144_idx_sent_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19144_idx_sent_status ON public.deletion_alerts USING btree (sent_at);


--
-- Name: idx_19144_idx_severity; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19144_idx_severity ON public.deletion_alerts USING btree (severity);


--
-- Name: idx_19144_queue_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19144_queue_id ON public.deletion_alerts USING btree (queue_id);


--
-- Name: idx_19151_idx_created_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19151_idx_created_at ON public.deletion_audit_trail USING btree (created_at);


--
-- Name: idx_19151_idx_deleted_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19151_idx_deleted_by ON public.deletion_audit_trail USING btree (deleted_by);


--
-- Name: idx_19151_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19151_idx_tenant_id ON public.deletion_audit_trail USING btree (tenant_id);


--
-- Name: idx_19159_idx_tenant_date; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19159_idx_tenant_date ON public.deletion_dry_run_reports USING btree (tenant_id, created_at);


--
-- Name: idx_19159_requested_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19159_requested_by ON public.deletion_dry_run_reports USING btree (requested_by);


--
-- Name: idx_19166_uk_queue_option; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19166_uk_queue_option ON public.deletion_partial_options USING btree (queue_id, option_name);


--
-- Name: idx_19172_created_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19172_created_by ON public.departments USING btree (created_by);


--
-- Name: idx_19172_idx_area_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19172_idx_area_id ON public.departments USING btree (area_id);


--
-- Name: idx_19172_idx_department_lead_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19172_idx_department_lead_id ON public.departments USING btree (department_lead_id);


--
-- Name: idx_19172_idx_departments_is_archived; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19172_idx_departments_is_archived ON public.departments USING btree (is_archived);


--
-- Name: idx_19172_idx_is_active; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19172_idx_is_active ON public.departments USING btree (is_active);


--
-- Name: idx_19172_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19172_idx_tenant_id ON public.departments USING btree (tenant_id);


--
-- Name: idx_19172_unique_dept_name_per_tenant; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19172_unique_dept_name_per_tenant ON public.departments USING btree (tenant_id, name);


--
-- Name: idx_19181_created_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19181_created_by ON public.documents USING btree (created_by);


--
-- Name: idx_19181_fk_documents_owner_user; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19181_fk_documents_owner_user ON public.documents USING btree (owner_user_id);


--
-- Name: idx_19181_fk_documents_target_dept; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19181_fk_documents_target_dept ON public.documents USING btree (target_department_id);


--
-- Name: idx_19181_fk_documents_target_team; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19181_fk_documents_target_team ON public.documents USING btree (target_team_id);


--
-- Name: idx_19181_idx_category; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19181_idx_category ON public.documents USING btree (category);


--
-- Name: idx_19181_idx_document_tenant_uuid; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19181_idx_document_tenant_uuid ON public.documents USING btree (tenant_id, uuid);


--
-- Name: idx_19181_idx_document_uuid; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19181_idx_document_uuid ON public.documents USING btree (uuid);


--
-- Name: idx_19181_idx_documents_blackboard_entry; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19181_idx_documents_blackboard_entry ON public.documents USING btree (blackboard_entry_id);


--
-- Name: idx_19181_idx_file_checksum; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19181_idx_file_checksum ON public.documents USING btree (file_checksum);


--
-- Name: idx_19181_idx_file_uuid; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19181_idx_file_uuid ON public.documents USING btree (file_uuid);


--
-- Name: idx_19181_idx_is_archived; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19181_idx_is_archived ON public.documents USING btree (is_archived);


--
-- Name: idx_19181_idx_storage_type; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19181_idx_storage_type ON public.documents USING btree (storage_type);


--
-- Name: idx_19181_idx_tenant_category_date; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19181_idx_tenant_category_date ON public.documents USING btree (tenant_id, category, uploaded_at);


--
-- Name: idx_19181_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19181_idx_tenant_id ON public.documents USING btree (tenant_id);


--
-- Name: idx_19181_idx_uploaded_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19181_idx_uploaded_at ON public.documents USING btree (uploaded_at);


--
-- Name: idx_19181_idx_version; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19181_idx_version ON public.documents USING btree (version);


--
-- Name: idx_19192_department_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19192_department_id ON public.document_permissions USING btree (department_id);


--
-- Name: idx_19192_document_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19192_document_id ON public.document_permissions USING btree (document_id);


--
-- Name: idx_19192_team_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19192_team_id ON public.document_permissions USING btree (team_id);


--
-- Name: idx_19192_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19192_tenant_id ON public.document_permissions USING btree (tenant_id);


--
-- Name: idx_19192_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19192_user_id ON public.document_permissions USING btree (user_id);


--
-- Name: idx_19197_idx_document_read_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19197_idx_document_read_status ON public.document_read_status USING btree (document_id, tenant_id);


--
-- Name: idx_19197_idx_user_read_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19197_idx_user_read_status ON public.document_read_status USING btree (user_id, tenant_id);


--
-- Name: idx_19197_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19197_tenant_id ON public.document_read_status USING btree (tenant_id);


--
-- Name: idx_19197_unique_document_user_read; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19197_unique_document_user_read ON public.document_read_status USING btree (document_id, user_id, tenant_id);


--
-- Name: idx_19202_document_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19202_document_id ON public.document_shares USING btree (document_id);


--
-- Name: idx_19202_idx_owner_tenant; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19202_idx_owner_tenant ON public.document_shares USING btree (owner_tenant_id);


--
-- Name: idx_19202_idx_shared_tenant; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19202_idx_shared_tenant ON public.document_shares USING btree (shared_with_tenant_id);


--
-- Name: idx_19209_idx_created_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19209_idx_created_at ON public.email_queue USING btree (created_at);


--
-- Name: idx_19209_idx_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19209_idx_status ON public.email_queue USING btree (status);


--
-- Name: idx_19209_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19209_idx_tenant_id ON public.email_queue USING btree (tenant_id);


--
-- Name: idx_19218_idx_is_active; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19218_idx_is_active ON public.email_templates USING btree (is_active);


--
-- Name: idx_19218_idx_template_key; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19218_idx_template_key ON public.email_templates USING btree (template_key);


--
-- Name: idx_19218_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19218_idx_tenant_id ON public.email_templates USING btree (tenant_id);


--
-- Name: idx_19218_unique_template; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19218_unique_template ON public.email_templates USING btree (tenant_id, template_key);


--
-- Name: idx_19227_fk_availability_created_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19227_fk_availability_created_by ON public.employee_availability USING btree (created_by);


--
-- Name: idx_19227_idx_availability_dates; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19227_idx_availability_dates ON public.employee_availability USING btree (start_date, end_date);


--
-- Name: idx_19227_idx_availability_employee; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19227_idx_availability_employee ON public.employee_availability USING btree (employee_id);


--
-- Name: idx_19227_idx_availability_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19227_idx_availability_status ON public.employee_availability USING btree (status);


--
-- Name: idx_19227_idx_availability_tenant; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19227_idx_availability_tenant ON public.employee_availability USING btree (tenant_id);


--
-- Name: idx_19235_idx_queue_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19235_idx_queue_id ON public.failed_file_deletions USING btree (queue_id);


--
-- Name: idx_19235_idx_resolved; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19235_idx_resolved ON public.failed_file_deletions USING btree (resolved);


--
-- Name: idx_19235_resolved_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19235_resolved_by ON public.failed_file_deletions USING btree (resolved_by);


--
-- Name: idx_19243_code; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19243_code ON public.features USING btree (code);


--
-- Name: idx_19243_idx_category; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19243_idx_category ON public.features USING btree (category);


--
-- Name: idx_19243_idx_code; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19243_idx_code ON public.features USING btree (code);


--
-- Name: idx_19243_idx_is_active; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19243_idx_is_active ON public.features USING btree (is_active);


--
-- Name: idx_19255_idx_created_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19255_idx_created_at ON public.feature_usage_logs USING btree (created_at);


--
-- Name: idx_19255_idx_feature_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19255_idx_feature_id ON public.feature_usage_logs USING btree (feature_id);


--
-- Name: idx_19255_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19255_idx_tenant_id ON public.feature_usage_logs USING btree (tenant_id);


--
-- Name: idx_19255_idx_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19255_idx_user_id ON public.feature_usage_logs USING btree (user_id);


--
-- Name: idx_19262_idx_suggestion_uploaded; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19262_idx_suggestion_uploaded ON public.kvp_attachments USING btree (suggestion_id, uploaded_at);


--
-- Name: idx_19262_suggestion_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19262_suggestion_id ON public.kvp_attachments USING btree (suggestion_id);


--
-- Name: idx_19262_unique_file_uuid; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19262_unique_file_uuid ON public.kvp_attachments USING btree (file_uuid);


--
-- Name: idx_19262_uploaded_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19262_uploaded_by ON public.kvp_attachments USING btree (uploaded_by);


--
-- Name: idx_19269_idx_kvp_comments_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19269_idx_kvp_comments_tenant_id ON public.kvp_comments USING btree (tenant_id);


--
-- Name: idx_19269_idx_kvp_comments_tenant_suggestion; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19269_idx_kvp_comments_tenant_suggestion ON public.kvp_comments USING btree (tenant_id, suggestion_id);


--
-- Name: idx_19269_suggestion_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19269_suggestion_id ON public.kvp_comments USING btree (suggestion_id);


--
-- Name: idx_19269_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19269_user_id ON public.kvp_comments USING btree (user_id);


--
-- Name: idx_19277_awarded_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19277_awarded_by ON public.kvp_points USING btree (awarded_by);


--
-- Name: idx_19277_suggestion_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19277_suggestion_id ON public.kvp_points USING btree (suggestion_id);


--
-- Name: idx_19277_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19277_tenant_id ON public.kvp_points USING btree (tenant_id);


--
-- Name: idx_19277_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19277_user_id ON public.kvp_points USING btree (user_id);


--
-- Name: idx_19282_suggestion_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19282_suggestion_id ON public.kvp_ratings USING btree (suggestion_id, user_id);


--
-- Name: idx_19282_suggestion_id_2; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19282_suggestion_id_2 ON public.kvp_ratings USING btree (suggestion_id);


--
-- Name: idx_19282_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19282_user_id ON public.kvp_ratings USING btree (user_id);


--
-- Name: idx_19289_changed_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19289_changed_by ON public.kvp_status_history USING btree (changed_by);


--
-- Name: idx_19289_suggestion_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19289_suggestion_id ON public.kvp_status_history USING btree (suggestion_id);


--
-- Name: idx_19296_assigned_to; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19296_assigned_to ON public.kvp_suggestions USING btree (assigned_to);


--
-- Name: idx_19296_category_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19296_category_id ON public.kvp_suggestions USING btree (category_id);


--
-- Name: idx_19296_idx_department_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19296_idx_department_id ON public.kvp_suggestions USING btree (department_id);


--
-- Name: idx_19296_idx_is_shared; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19296_idx_is_shared ON public.kvp_suggestions USING btree (is_shared);


--
-- Name: idx_19296_idx_kvp_team_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19296_idx_kvp_team_id ON public.kvp_suggestions USING btree (team_id);


--
-- Name: idx_19296_idx_kvp_tenant_uuid; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19296_idx_kvp_tenant_uuid ON public.kvp_suggestions USING btree (tenant_id, uuid);


--
-- Name: idx_19296_idx_kvp_uuid; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19296_idx_kvp_uuid ON public.kvp_suggestions USING btree (uuid);


--
-- Name: idx_19296_idx_org_level_area; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19296_idx_org_level_area ON public.kvp_suggestions USING btree (org_level, org_id, is_shared);


--
-- Name: idx_19296_idx_shared_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19296_idx_shared_by ON public.kvp_suggestions USING btree (shared_by);


--
-- Name: idx_19296_idx_visibility_query; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19296_idx_visibility_query ON public.kvp_suggestions USING btree (tenant_id, org_level, org_id, status);


--
-- Name: idx_19296_org_level; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19296_org_level ON public.kvp_suggestions USING btree (org_level, org_id);


--
-- Name: idx_19296_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19296_status ON public.kvp_suggestions USING btree (status);


--
-- Name: idx_19296_submitted_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19296_submitted_by ON public.kvp_suggestions USING btree (submitted_by);


--
-- Name: idx_19296_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19296_tenant_id ON public.kvp_suggestions USING btree (tenant_id);


--
-- Name: idx_19307_suggestion_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19307_suggestion_id ON public.kvp_votes USING btree (suggestion_id);


--
-- Name: idx_19307_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19307_tenant_id ON public.kvp_votes USING btree (tenant_id);


--
-- Name: idx_19307_unique_user_suggestion; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19307_unique_user_suggestion ON public.kvp_votes USING btree (user_id, suggestion_id);


--
-- Name: idx_19312_created_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19312_created_by ON public.legal_holds USING btree (created_by);


--
-- Name: idx_19312_idx_active; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19312_idx_active ON public.legal_holds USING btree (active);


--
-- Name: idx_19312_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19312_idx_tenant_id ON public.legal_holds USING btree (tenant_id);


--
-- Name: idx_19312_released_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19312_released_by ON public.legal_holds USING btree (released_by);


--
-- Name: idx_19320_idx_username_attempts; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19320_idx_username_attempts ON public.login_attempts USING btree (username, attempted_at);


--
-- Name: idx_19326_created_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19326_created_by ON public.machines USING btree (created_by);


--
-- Name: idx_19326_fk_machines_area; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19326_fk_machines_area ON public.machines USING btree (area_id);


--
-- Name: idx_19326_idx_asset; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19326_idx_asset ON public.machines USING btree (asset_number);


--
-- Name: idx_19326_idx_department_machines; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19326_idx_department_machines ON public.machines USING btree (department_id);


--
-- Name: idx_19326_idx_serial; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19326_idx_serial ON public.machines USING btree (serial_number);


--
-- Name: idx_19326_idx_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19326_idx_status ON public.machines USING btree (status);


--
-- Name: idx_19326_idx_tenant_machines; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19326_idx_tenant_machines ON public.machines USING btree (tenant_id);


--
-- Name: idx_19326_idx_type; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19326_idx_type ON public.machines USING btree (machine_type);


--
-- Name: idx_19326_serial_number; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19326_serial_number ON public.machines USING btree (serial_number);


--
-- Name: idx_19326_updated_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19326_updated_by ON public.machines USING btree (updated_by);


--
-- Name: idx_19337_idx_doc_type; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19337_idx_doc_type ON public.machine_documents USING btree (document_type);


--
-- Name: idx_19337_idx_machine_docs; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19337_idx_machine_docs ON public.machine_documents USING btree (machine_id);


--
-- Name: idx_19337_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19337_tenant_id ON public.machine_documents USING btree (tenant_id);


--
-- Name: idx_19337_uploaded_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19337_uploaded_by ON public.machine_documents USING btree (uploaded_by);


--
-- Name: idx_19344_created_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19344_created_by ON public.machine_maintenance_history USING btree (created_by);


--
-- Name: idx_19344_idx_machine_history; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19344_idx_machine_history ON public.machine_maintenance_history USING btree (machine_id);


--
-- Name: idx_19344_idx_maintenance_date; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19344_idx_maintenance_date ON public.machine_maintenance_history USING btree (performed_date);


--
-- Name: idx_19344_idx_maintenance_type; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19344_idx_maintenance_type ON public.machine_maintenance_history USING btree (maintenance_type);


--
-- Name: idx_19344_performed_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19344_performed_by ON public.machine_maintenance_history USING btree (performed_by);


--
-- Name: idx_19344_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19344_tenant_id ON public.machine_maintenance_history USING btree (tenant_id);


--
-- Name: idx_19352_idx_anomalies; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19352_idx_anomalies ON public.machine_metrics USING btree (is_anomaly, recorded_at);


--
-- Name: idx_19352_idx_machine_metrics; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19352_idx_machine_metrics ON public.machine_metrics USING btree (machine_id, recorded_at);


--
-- Name: idx_19352_idx_metric_type; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19352_idx_metric_type ON public.machine_metrics USING btree (metric_type, recorded_at);


--
-- Name: idx_19352_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19352_tenant_id ON public.machine_metrics USING btree (tenant_id);


--
-- Name: idx_19358_fk_machine_teams_assigned_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19358_fk_machine_teams_assigned_by ON public.machine_teams USING btree (assigned_by);


--
-- Name: idx_19358_idx_assigned_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19358_idx_assigned_at ON public.machine_teams USING btree (assigned_at);


--
-- Name: idx_19358_idx_machine_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19358_idx_machine_id ON public.machine_teams USING btree (machine_id);


--
-- Name: idx_19358_idx_team_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19358_idx_team_id ON public.machine_teams USING btree (team_id);


--
-- Name: idx_19358_idx_tenant_machine_teams; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19358_idx_tenant_machine_teams ON public.machine_teams USING btree (tenant_id);


--
-- Name: idx_19358_unique_machine_team_per_tenant; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19358_unique_machine_team_per_tenant ON public.machine_teams USING btree (tenant_id, machine_id, team_id);


--
-- Name: idx_19366_idx_conversation; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19366_idx_conversation ON public.messages USING btree (conversation_id);


--
-- Name: idx_19366_idx_created; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19366_idx_created ON public.messages USING btree (created_at);


--
-- Name: idx_19366_idx_messages_attachment_size; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19366_idx_messages_attachment_size ON public.messages USING btree (tenant_id, attachment_size);


--
-- Name: idx_19366_idx_sender; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19366_idx_sender ON public.messages USING btree (sender_id);


--
-- Name: idx_19366_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19366_tenant_id ON public.messages USING btree (tenant_id);


--
-- Name: idx_19374_migration_name; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19374_migration_name ON public.migration_log USING btree (migration_name);


--
-- Name: idx_19379_idx_created_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19379_idx_created_at ON public.notifications USING btree (created_at);


--
-- Name: idx_19379_idx_priority; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19379_idx_priority ON public.notifications USING btree (priority);


--
-- Name: idx_19379_idx_recipient_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19379_idx_recipient_id ON public.notifications USING btree (recipient_id);


--
-- Name: idx_19379_idx_recipient_type; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19379_idx_recipient_type ON public.notifications USING btree (recipient_type);


--
-- Name: idx_19379_idx_scheduled_for; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19379_idx_scheduled_for ON public.notifications USING btree (scheduled_for);


--
-- Name: idx_19379_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19379_idx_tenant_id ON public.notifications USING btree (tenant_id);


--
-- Name: idx_19379_idx_type; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19379_idx_type ON public.notifications USING btree (type);


--
-- Name: idx_19379_notifications_ibfk_2; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19379_notifications_ibfk_2 ON public.notifications USING btree (created_by);


--
-- Name: idx_19387_idx_notification_type; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19387_idx_notification_type ON public.notification_preferences USING btree (notification_type);


--
-- Name: idx_19387_idx_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19387_idx_user_id ON public.notification_preferences USING btree (user_id);


--
-- Name: idx_19387_notification_preferences_tenant_fk; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19387_notification_preferences_tenant_fk ON public.notification_preferences USING btree (tenant_id);


--
-- Name: idx_19387_unique_notification_pref; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19387_unique_notification_pref ON public.notification_preferences USING btree (user_id, notification_type);


--
-- Name: idx_19401_idx_notification_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19401_idx_notification_id ON public.notification_read_status USING btree (notification_id);


--
-- Name: idx_19401_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19401_idx_tenant_id ON public.notification_read_status USING btree (tenant_id);


--
-- Name: idx_19401_idx_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19401_idx_user_id ON public.notification_read_status USING btree (user_id);


--
-- Name: idx_19401_unique_notification_user; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19401_unique_notification_user ON public.notification_read_status USING btree (notification_id, user_id);


--
-- Name: idx_19406_idx_revoked; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19406_idx_revoked ON public.oauth_tokens USING btree (revoked);


--
-- Name: idx_19406_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19406_idx_tenant_id ON public.oauth_tokens USING btree (tenant_id);


--
-- Name: idx_19406_idx_token; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19406_idx_token ON public.oauth_tokens USING btree (token);


--
-- Name: idx_19406_idx_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19406_idx_user_id ON public.oauth_tokens USING btree (user_id);


--
-- Name: idx_19414_idx_token; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19414_idx_token ON public.password_reset_tokens USING btree (token);


--
-- Name: idx_19414_idx_user_expires; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19414_idx_user_expires ON public.password_reset_tokens USING btree (user_id, expires_at);


--
-- Name: idx_19420_idx_created_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19420_idx_created_at ON public.payment_history USING btree (created_at);


--
-- Name: idx_19420_idx_invoice_number; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19420_idx_invoice_number ON public.payment_history USING btree (invoice_number);


--
-- Name: idx_19420_idx_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19420_idx_status ON public.payment_history USING btree (status);


--
-- Name: idx_19420_idx_subscription_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19420_idx_subscription_id ON public.payment_history USING btree (subscription_id);


--
-- Name: idx_19420_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19420_idx_tenant_id ON public.payment_history USING btree (tenant_id);


--
-- Name: idx_19429_code; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19429_code ON public.plans USING btree (code);


--
-- Name: idx_19429_idx_code; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19429_idx_code ON public.plans USING btree (code);


--
-- Name: idx_19429_idx_is_active; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19429_idx_is_active ON public.plans USING btree (is_active);


--
-- Name: idx_19440_idx_feature_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19440_idx_feature_id ON public.plan_features USING btree (feature_id);


--
-- Name: idx_19440_idx_plan_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19440_idx_plan_id ON public.plan_features USING btree (plan_id);


--
-- Name: idx_19440_unique_plan_feature; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19440_unique_plan_feature ON public.plan_features USING btree (plan_id, feature_id);


--
-- Name: idx_19446_idx_active; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19446_idx_active ON public.recurring_jobs USING btree (active);


--
-- Name: idx_19446_idx_next_run; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19446_idx_next_run ON public.recurring_jobs USING btree (next_run);


--
-- Name: idx_19446_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19446_idx_tenant_id ON public.recurring_jobs USING btree (tenant_id);


--
-- Name: idx_19452_fk_refresh_tokens_tenant; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19452_fk_refresh_tokens_tenant ON public.refresh_tokens USING btree (tenant_id);


--
-- Name: idx_19452_idx_refresh_tokens_expires; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19452_idx_refresh_tokens_expires ON public.refresh_tokens USING btree (expires_at);


--
-- Name: idx_19452_idx_refresh_tokens_family; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19452_idx_refresh_tokens_family ON public.refresh_tokens USING btree (token_family);


--
-- Name: idx_19452_idx_refresh_tokens_hash; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19452_idx_refresh_tokens_hash ON public.refresh_tokens USING btree (token_hash);


--
-- Name: idx_19452_idx_refresh_tokens_revoked; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19452_idx_refresh_tokens_revoked ON public.refresh_tokens USING btree (is_revoked);


--
-- Name: idx_19452_idx_refresh_tokens_user_tenant; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19452_idx_refresh_tokens_user_tenant ON public.refresh_tokens USING btree (user_id, tenant_id);


--
-- Name: idx_19460_idx_released_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19460_idx_released_at ON public.released_subdomains USING btree (released_at);


--
-- Name: idx_19460_idx_reused; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19460_idx_reused ON public.released_subdomains USING btree (reused);


--
-- Name: idx_19460_idx_subdomain; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19460_idx_subdomain ON public.released_subdomains USING btree (subdomain);


--
-- Name: idx_19466_idx_action; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19466_idx_action ON public.root_logs USING btree (action);


--
-- Name: idx_19466_idx_created_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19466_idx_created_at ON public.root_logs USING btree (created_at);


--
-- Name: idx_19466_idx_entity_type; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19466_idx_entity_type ON public.root_logs USING btree (entity_type);


--
-- Name: idx_19466_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19466_idx_tenant_id ON public.root_logs USING btree (tenant_id);


--
-- Name: idx_19466_idx_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19466_idx_user_id ON public.root_logs USING btree (user_id);


--
-- Name: idx_19466_idx_was_role_switched; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19466_idx_was_role_switched ON public.root_logs USING btree (was_role_switched);


--
-- Name: idx_19474_idx_executed; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19474_idx_executed ON public.scheduled_tasks USING btree (executed);


--
-- Name: idx_19474_idx_scheduled_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19474_idx_scheduled_at ON public.scheduled_tasks USING btree (scheduled_at);


--
-- Name: idx_19474_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19474_idx_tenant_id ON public.scheduled_tasks USING btree (tenant_id);


--
-- Name: idx_19482_idx_action; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19482_idx_action ON public.security_logs USING btree (action);


--
-- Name: idx_19482_idx_created_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19482_idx_created_at ON public.security_logs USING btree (created_at);


--
-- Name: idx_19482_idx_ip_address; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19482_idx_ip_address ON public.security_logs USING btree (ip_address);


--
-- Name: idx_19482_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19482_idx_tenant_id ON public.security_logs USING btree (tenant_id);


--
-- Name: idx_19482_idx_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19482_idx_user_id ON public.security_logs USING btree (user_id);


--
-- Name: idx_19489_created_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19489_created_by ON public.shifts USING btree (created_by);


--
-- Name: idx_19489_fk_shifts_machine; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19489_fk_shifts_machine ON public.shifts USING btree (machine_id);


--
-- Name: idx_19489_idx_date; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19489_idx_date ON public.shifts USING btree (date);


--
-- Name: idx_19489_idx_shifts_area; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19489_idx_shifts_area ON public.shifts USING btree (area_id);


--
-- Name: idx_19489_idx_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19489_idx_status ON public.shifts USING btree (status);


--
-- Name: idx_19489_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19489_idx_tenant_id ON public.shifts USING btree (tenant_id);


--
-- Name: idx_19489_idx_type; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19489_idx_type ON public.shifts USING btree (type);


--
-- Name: idx_19489_idx_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19489_idx_user_id ON public.shifts USING btree (user_id);


--
-- Name: idx_19489_plan_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19489_plan_id ON public.shifts USING btree (plan_id);


--
-- Name: idx_19489_shifts_ibfk_6; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19489_shifts_ibfk_6 ON public.shifts USING btree (department_id);


--
-- Name: idx_19489_team_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19489_team_id ON public.shifts USING btree (team_id);


--
-- Name: idx_19489_template_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19489_template_id ON public.shifts USING btree (template_id);


--
-- Name: idx_19489_unique_user_shift; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19489_unique_user_shift ON public.shifts USING btree (user_id, date, start_time);


--
-- Name: idx_19500_idx_assigned_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19500_idx_assigned_by ON public.shift_assignments USING btree (assigned_by);


--
-- Name: idx_19500_idx_shift_type; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19500_idx_shift_type ON public.shift_assignments USING btree (shift_id, assignment_type);


--
-- Name: idx_19500_idx_user_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19500_idx_user_status ON public.shift_assignments USING btree (user_id, status);


--
-- Name: idx_19500_unique_shift_user; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19500_unique_shift_user ON public.shift_assignments USING btree (shift_id, user_id);


--
-- Name: idx_19510_fk_shift_fav_area; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19510_fk_shift_fav_area ON public.shift_favorites USING btree (area_id);


--
-- Name: idx_19510_fk_shift_fav_dept; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19510_fk_shift_fav_dept ON public.shift_favorites USING btree (department_id);


--
-- Name: idx_19510_fk_shift_fav_machine; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19510_fk_shift_fav_machine ON public.shift_favorites USING btree (machine_id);


--
-- Name: idx_19510_fk_shift_fav_team; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19510_fk_shift_fav_team ON public.shift_favorites USING btree (team_id);


--
-- Name: idx_19510_fk_shift_fav_user; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19510_fk_shift_fav_user ON public.shift_favorites USING btree (user_id);


--
-- Name: idx_19510_idx_created; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19510_idx_created ON public.shift_favorites USING btree (created_at);


--
-- Name: idx_19510_idx_user_favorites; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19510_idx_user_favorites ON public.shift_favorites USING btree (tenant_id, user_id);


--
-- Name: idx_19510_unique_user_favorite; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19510_unique_user_favorite ON public.shift_favorites USING btree (tenant_id, user_id, name);


--
-- Name: idx_19517_approved_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19517_approved_by ON public.shift_plans USING btree (approved_by);


--
-- Name: idx_19517_created_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19517_created_by ON public.shift_plans USING btree (created_by);


--
-- Name: idx_19517_idx_department; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19517_idx_department ON public.shift_plans USING btree (department_id);


--
-- Name: idx_19517_idx_shift_plan_tenant_uuid; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19517_idx_shift_plan_tenant_uuid ON public.shift_plans USING btree (tenant_id, uuid);


--
-- Name: idx_19517_idx_shift_plan_uuid; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19517_idx_shift_plan_uuid ON public.shift_plans USING btree (uuid);


--
-- Name: idx_19517_idx_shift_plans_area; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19517_idx_shift_plans_area ON public.shift_plans USING btree (area_id);


--
-- Name: idx_19517_idx_shift_plans_machine; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19517_idx_shift_plans_machine ON public.shift_plans USING btree (machine_id);


--
-- Name: idx_19517_idx_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19517_idx_status ON public.shift_plans USING btree (status);


--
-- Name: idx_19517_idx_team; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19517_idx_team ON public.shift_plans USING btree (team_id);


--
-- Name: idx_19517_idx_tenant_dates; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19517_idx_tenant_dates ON public.shift_plans USING btree (tenant_id, start_date, end_date);


--
-- Name: idx_19517_unique_shift_plan_period; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19517_unique_shift_plan_period ON public.shift_plans USING btree (tenant_id, team_id, start_date, end_date);


--
-- Name: idx_19525_fk_rotation_assignment_assigned_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19525_fk_rotation_assignment_assigned_by ON public.shift_rotation_assignments USING btree (assigned_by);


--
-- Name: idx_19525_idx_rotation_assignment_active; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19525_idx_rotation_assignment_active ON public.shift_rotation_assignments USING btree (tenant_id, is_active);


--
-- Name: idx_19525_idx_rotation_assignment_dates; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19525_idx_rotation_assignment_dates ON public.shift_rotation_assignments USING btree (starts_at, ends_at);


--
-- Name: idx_19525_idx_rotation_assignment_pattern; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19525_idx_rotation_assignment_pattern ON public.shift_rotation_assignments USING btree (pattern_id);


--
-- Name: idx_19525_idx_rotation_assignment_tenant; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19525_idx_rotation_assignment_tenant ON public.shift_rotation_assignments USING btree (tenant_id);


--
-- Name: idx_19525_idx_rotation_assignment_user; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19525_idx_rotation_assignment_user ON public.shift_rotation_assignments USING btree (user_id);


--
-- Name: idx_19525_idx_shift_rotation_assignments_team_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19525_idx_shift_rotation_assignments_team_id ON public.shift_rotation_assignments USING btree (team_id);


--
-- Name: idx_19525_uk_rotation_assignment; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19525_uk_rotation_assignment ON public.shift_rotation_assignments USING btree (tenant_id, pattern_id, user_id, starts_at);


--
-- Name: idx_19535_fk_rotation_history_assignment; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19535_fk_rotation_history_assignment ON public.shift_rotation_history USING btree (assignment_id);


--
-- Name: idx_19535_fk_rotation_history_confirmed_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19535_fk_rotation_history_confirmed_by ON public.shift_rotation_history USING btree (confirmed_by);


--
-- Name: idx_19535_idx_rotation_history_date; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19535_idx_rotation_history_date ON public.shift_rotation_history USING btree (shift_date);


--
-- Name: idx_19535_idx_rotation_history_pattern; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19535_idx_rotation_history_pattern ON public.shift_rotation_history USING btree (pattern_id);


--
-- Name: idx_19535_idx_rotation_history_tenant; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19535_idx_rotation_history_tenant ON public.shift_rotation_history USING btree (tenant_id);


--
-- Name: idx_19535_idx_rotation_history_user_date; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19535_idx_rotation_history_user_date ON public.shift_rotation_history USING btree (user_id, shift_date);


--
-- Name: idx_19535_idx_shift_rotation_history_team_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19535_idx_shift_rotation_history_team_id ON public.shift_rotation_history USING btree (team_id);


--
-- Name: idx_19535_uk_rotation_history; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19535_uk_rotation_history ON public.shift_rotation_history USING btree (tenant_id, user_id, shift_date);


--
-- Name: idx_19543_fk_rotation_pattern_creator; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19543_fk_rotation_pattern_creator ON public.shift_rotation_patterns USING btree (created_by);


--
-- Name: idx_19543_idx_rotation_pattern_active; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19543_idx_rotation_pattern_active ON public.shift_rotation_patterns USING btree (tenant_id, is_active);


--
-- Name: idx_19543_idx_rotation_pattern_dates; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19543_idx_rotation_pattern_dates ON public.shift_rotation_patterns USING btree (starts_at, ends_at);


--
-- Name: idx_19543_idx_rotation_pattern_tenant; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19543_idx_rotation_pattern_tenant ON public.shift_rotation_patterns USING btree (tenant_id);


--
-- Name: idx_19543_idx_shift_rotation_patterns_team_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19543_idx_shift_rotation_patterns_team_id ON public.shift_rotation_patterns USING btree (team_id);


--
-- Name: idx_19543_uk_rotation_pattern_name; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19543_uk_rotation_pattern_name ON public.shift_rotation_patterns USING btree (tenant_id, name);


--
-- Name: idx_19553_approved_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19553_approved_by ON public.shift_swap_requests USING btree (approved_by);


--
-- Name: idx_19553_assignment_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19553_assignment_id ON public.shift_swap_requests USING btree (assignment_id);


--
-- Name: idx_19553_requested_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19553_requested_by ON public.shift_swap_requests USING btree (requested_by);


--
-- Name: idx_19553_requested_with; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19553_requested_with ON public.shift_swap_requests USING btree (requested_with);


--
-- Name: idx_19553_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19553_tenant_id ON public.shift_swap_requests USING btree (tenant_id);


--
-- Name: idx_19561_idx_is_active; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19561_idx_is_active ON public.shift_templates USING btree (is_active);


--
-- Name: idx_19561_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19561_idx_tenant_id ON public.shift_templates USING btree (tenant_id);


--
-- Name: idx_19570_code; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19570_code ON public.subscription_plans USING btree (code);


--
-- Name: idx_19570_idx_code; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19570_idx_code ON public.subscription_plans USING btree (code);


--
-- Name: idx_19570_idx_is_active; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19570_idx_is_active ON public.subscription_plans USING btree (is_active);


--
-- Name: idx_19578_idx_created_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19578_idx_created_by ON public.surveys USING btree (created_by);


--
-- Name: idx_19578_idx_dates; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19578_idx_dates ON public.surveys USING btree (start_date, end_date);


--
-- Name: idx_19578_idx_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19578_idx_status ON public.surveys USING btree (status);


--
-- Name: idx_19578_idx_survey_tenant_uuid; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19578_idx_survey_tenant_uuid ON public.surveys USING btree (tenant_id, uuid);


--
-- Name: idx_19578_idx_survey_uuid; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19578_idx_survey_uuid ON public.surveys USING btree (uuid);


--
-- Name: idx_19578_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19578_idx_tenant_id ON public.surveys USING btree (tenant_id);


--
-- Name: idx_19578_idx_type; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19578_idx_type ON public.surveys USING btree (type);


--
-- Name: idx_19592_idx_question_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19592_idx_question_id ON public.survey_answers USING btree (question_id);


--
-- Name: idx_19592_idx_response_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19592_idx_response_id ON public.survey_answers USING btree (response_id);


--
-- Name: idx_19592_idx_sa_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19592_idx_sa_tenant_id ON public.survey_answers USING btree (tenant_id);


--
-- Name: idx_19592_idx_sa_tenant_response; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19592_idx_sa_tenant_response ON public.survey_answers USING btree (tenant_id, response_id);


--
-- Name: idx_19599_idx_area_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19599_idx_area_id ON public.survey_assignments USING btree (area_id);


--
-- Name: idx_19599_idx_assignment_type; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19599_idx_assignment_type ON public.survey_assignments USING btree (assignment_type);


--
-- Name: idx_19599_idx_department_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19599_idx_department_id ON public.survey_assignments USING btree (department_id);


--
-- Name: idx_19599_idx_survey_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19599_idx_survey_id ON public.survey_assignments USING btree (survey_id);


--
-- Name: idx_19599_idx_team_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19599_idx_team_id ON public.survey_assignments USING btree (team_id);


--
-- Name: idx_19599_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19599_idx_tenant_id ON public.survey_assignments USING btree (tenant_id);


--
-- Name: idx_19599_idx_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19599_idx_user_id ON public.survey_assignments USING btree (user_id);


--
-- Name: idx_19599_unique_assignment; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19599_unique_assignment ON public.survey_assignments USING btree (tenant_id, survey_id, assignment_type, department_id, team_id, user_id, area_id);


--
-- Name: idx_19604_idx_created_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19604_idx_created_at ON public.survey_comments USING btree (created_at);


--
-- Name: idx_19604_idx_sc_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19604_idx_sc_tenant_id ON public.survey_comments USING btree (tenant_id);


--
-- Name: idx_19604_idx_sc_tenant_survey; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19604_idx_sc_tenant_survey ON public.survey_comments USING btree (tenant_id, survey_id);


--
-- Name: idx_19604_idx_survey_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19604_idx_survey_id ON public.survey_comments USING btree (survey_id);


--
-- Name: idx_19604_idx_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19604_idx_user_id ON public.survey_comments USING btree (user_id);


--
-- Name: idx_19612_idx_completed; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19612_idx_completed ON public.survey_participants USING btree (completed);


--
-- Name: idx_19612_idx_sp_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19612_idx_sp_tenant_id ON public.survey_participants USING btree (tenant_id);


--
-- Name: idx_19612_idx_sp_tenant_survey; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19612_idx_sp_tenant_survey ON public.survey_participants USING btree (tenant_id, survey_id);


--
-- Name: idx_19612_idx_survey_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19612_idx_survey_id ON public.survey_participants USING btree (survey_id);


--
-- Name: idx_19612_idx_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19612_idx_user_id ON public.survey_participants USING btree (user_id);


--
-- Name: idx_19612_unique_participant; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19612_unique_participant ON public.survey_participants USING btree (survey_id, user_id);


--
-- Name: idx_19618_idx_order_index; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19618_idx_order_index ON public.survey_questions USING btree (order_index);


--
-- Name: idx_19618_idx_sq_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19618_idx_sq_tenant_id ON public.survey_questions USING btree (tenant_id);


--
-- Name: idx_19618_idx_sq_tenant_survey; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19618_idx_sq_tenant_survey ON public.survey_questions USING btree (tenant_id, survey_id);


--
-- Name: idx_19618_idx_survey_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19618_idx_survey_id ON public.survey_questions USING btree (survey_id);


--
-- Name: idx_19627_idx_order; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19627_idx_order ON public.survey_question_options USING btree (question_id, order_position);


--
-- Name: idx_19627_idx_question_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19627_idx_question_id ON public.survey_question_options USING btree (question_id);


--
-- Name: idx_19627_idx_tenant_question; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19627_idx_tenant_question ON public.survey_question_options USING btree (tenant_id, question_id);


--
-- Name: idx_19635_idx_is_sent; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19635_idx_is_sent ON public.survey_reminders USING btree (is_sent);


--
-- Name: idx_19635_idx_reminder_date; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19635_idx_reminder_date ON public.survey_reminders USING btree (reminder_date);


--
-- Name: idx_19635_idx_srem_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19635_idx_srem_tenant_id ON public.survey_reminders USING btree (tenant_id);


--
-- Name: idx_19635_idx_srem_tenant_survey; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19635_idx_srem_tenant_survey ON public.survey_reminders USING btree (tenant_id, survey_id);


--
-- Name: idx_19635_idx_survey_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19635_idx_survey_id ON public.survey_reminders USING btree (survey_id);


--
-- Name: idx_19643_idx_completed_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19643_idx_completed_at ON public.survey_responses USING btree (completed_at);


--
-- Name: idx_19643_idx_session_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19643_idx_session_id ON public.survey_responses USING btree (session_id);


--
-- Name: idx_19643_idx_sr_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19643_idx_sr_tenant_id ON public.survey_responses USING btree (tenant_id);


--
-- Name: idx_19643_idx_sr_tenant_survey; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19643_idx_sr_tenant_survey ON public.survey_responses USING btree (tenant_id, survey_id);


--
-- Name: idx_19643_idx_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19643_idx_status ON public.survey_responses USING btree (status);


--
-- Name: idx_19643_idx_survey_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19643_idx_survey_id ON public.survey_responses USING btree (survey_id);


--
-- Name: idx_19643_idx_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19643_idx_user_id ON public.survey_responses USING btree (user_id);


--
-- Name: idx_19651_created_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19651_created_by ON public.survey_templates USING btree (created_by);


--
-- Name: idx_19651_idx_category; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19651_idx_category ON public.survey_templates USING btree (category);


--
-- Name: idx_19651_idx_is_public; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19651_idx_is_public ON public.survey_templates USING btree (is_public);


--
-- Name: idx_19651_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19651_idx_tenant_id ON public.survey_templates USING btree (tenant_id);


--
-- Name: idx_19659_idx_category; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19659_idx_category ON public.system_logs USING btree (category);


--
-- Name: idx_19659_idx_created_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19659_idx_created_at ON public.system_logs USING btree (created_at);


--
-- Name: idx_19659_idx_level; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19659_idx_level ON public.system_logs USING btree (level);


--
-- Name: idx_19666_idx_category; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19666_idx_category ON public.system_settings USING btree (category);


--
-- Name: idx_19666_idx_is_public; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19666_idx_is_public ON public.system_settings USING btree (is_public);


--
-- Name: idx_19666_setting_key; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19666_setting_key ON public.system_settings USING btree (setting_key);


--
-- Name: idx_19675_created_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19675_created_by ON public.teams USING btree (created_by);


--
-- Name: idx_19675_idx_department_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19675_idx_department_id ON public.teams USING btree (department_id);


--
-- Name: idx_19675_idx_is_active; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19675_idx_is_active ON public.teams USING btree (is_active);


--
-- Name: idx_19675_idx_team_lead_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19675_idx_team_lead_id ON public.teams USING btree (team_lead_id);


--
-- Name: idx_19675_idx_teams_is_archived; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19675_idx_teams_is_archived ON public.teams USING btree (is_archived);


--
-- Name: idx_19675_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19675_idx_tenant_id ON public.teams USING btree (tenant_id);


--
-- Name: idx_19675_unique_team_name_per_dept; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19675_unique_team_name_per_dept ON public.teams USING btree (department_id, name);


--
-- Name: idx_19684_fk_deletion_requested_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19684_fk_deletion_requested_by ON public.tenants USING btree (deletion_requested_by);


--
-- Name: idx_19684_fk_tenants_created_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19684_fk_tenants_created_by ON public.tenants USING btree (created_by);


--
-- Name: idx_19684_idx_current_plan; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19684_idx_current_plan ON public.tenants USING btree (current_plan_id);


--
-- Name: idx_19684_idx_deletion_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19684_idx_deletion_status ON public.tenants USING btree (deletion_status);


--
-- Name: idx_19684_idx_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19684_idx_status ON public.tenants USING btree (status);


--
-- Name: idx_19684_idx_subdomain; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19684_idx_subdomain ON public.tenants USING btree (subdomain);


--
-- Name: idx_19684_idx_trial_ends; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19684_idx_trial_ends ON public.tenants USING btree (trial_ends_at);


--
-- Name: idx_19684_subdomain; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19684_subdomain ON public.tenants USING btree (subdomain);


--
-- Name: idx_19695_idx_addon_type; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19695_idx_addon_type ON public.tenant_addons USING btree (addon_type);


--
-- Name: idx_19695_idx_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19695_idx_status ON public.tenant_addons USING btree (status);


--
-- Name: idx_19695_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19695_idx_tenant_id ON public.tenant_addons USING btree (tenant_id);


--
-- Name: idx_19695_unique_tenant_addon; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19695_unique_tenant_addon ON public.tenant_addons USING btree (tenant_id, addon_type);


--
-- Name: idx_19702_idx_downloaded; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19702_idx_downloaded ON public.tenant_data_exports USING btree (downloaded);


--
-- Name: idx_19702_idx_expires_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19702_idx_expires_at ON public.tenant_data_exports USING btree (expires_at);


--
-- Name: idx_19702_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19702_idx_tenant_id ON public.tenant_data_exports USING btree (tenant_id);


--
-- Name: idx_19710_idx_approver; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19710_idx_approver ON public.tenant_deletion_approvals USING btree (approver_id);


--
-- Name: idx_19710_idx_queue_action; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19710_idx_queue_action ON public.tenant_deletion_approvals USING btree (queue_id, action);


--
-- Name: idx_19717_idx_created_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19717_idx_created_at ON public.tenant_deletion_backups USING btree (created_at);


--
-- Name: idx_19717_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19717_idx_tenant_id ON public.tenant_deletion_backups USING btree (tenant_id);


--
-- Name: idx_19725_idx_queue_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19725_idx_queue_id ON public.tenant_deletion_log USING btree (queue_id);


--
-- Name: idx_19725_idx_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19725_idx_status ON public.tenant_deletion_log USING btree (status);


--
-- Name: idx_19733_created_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19733_created_by ON public.tenant_deletion_queue USING btree (created_by);


--
-- Name: idx_19733_fk_emergency_stopped_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19733_fk_emergency_stopped_by ON public.tenant_deletion_queue USING btree (emergency_stopped_by);


--
-- Name: idx_19733_fk_second_approver; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19733_fk_second_approver ON public.tenant_deletion_queue USING btree (second_approver_id);


--
-- Name: idx_19733_idx_created; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19733_idx_created ON public.tenant_deletion_queue USING btree (created_at);


--
-- Name: idx_19733_idx_scheduled_deletion; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19733_idx_scheduled_deletion ON public.tenant_deletion_queue USING btree (scheduled_deletion_date);


--
-- Name: idx_19733_idx_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19733_idx_status ON public.tenant_deletion_queue USING btree (status);


--
-- Name: idx_19733_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19733_tenant_id ON public.tenant_deletion_queue USING btree (tenant_id);


--
-- Name: idx_19749_idx_can_rollback; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19749_idx_can_rollback ON public.tenant_deletion_rollback USING btree (can_rollback);


--
-- Name: idx_19749_idx_queue_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19749_idx_queue_id ON public.tenant_deletion_rollback USING btree (queue_id);


--
-- Name: idx_19749_idx_rollback_expires_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19749_idx_rollback_expires_at ON public.tenant_deletion_rollback USING btree (rollback_expires_at);


--
-- Name: idx_19749_rolled_back_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19749_rolled_back_by ON public.tenant_deletion_rollback USING btree (rolled_back_by);


--
-- Name: idx_19758_activated_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19758_activated_by ON public.tenant_features USING btree (activated_by);


--
-- Name: idx_19758_idx_feature_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19758_idx_feature_id ON public.tenant_features USING btree (feature_id);


--
-- Name: idx_19758_idx_is_active; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19758_idx_is_active ON public.tenant_features USING btree (is_active);


--
-- Name: idx_19758_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19758_idx_tenant_id ON public.tenant_features USING btree (tenant_id);


--
-- Name: idx_19758_unique_tenant_feature; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19758_unique_tenant_feature ON public.tenant_features USING btree (tenant_id, feature_id);


--
-- Name: idx_19766_idx_expires_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19766_idx_expires_at ON public.tenant_plans USING btree (expires_at);


--
-- Name: idx_19766_idx_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19766_idx_status ON public.tenant_plans USING btree (status);


--
-- Name: idx_19766_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19766_idx_tenant_id ON public.tenant_plans USING btree (tenant_id);


--
-- Name: idx_19766_plan_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19766_plan_id ON public.tenant_plans USING btree (plan_id);


--
-- Name: idx_19773_idx_category; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19773_idx_category ON public.tenant_settings USING btree (category);


--
-- Name: idx_19773_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19773_idx_tenant_id ON public.tenant_settings USING btree (tenant_id);


--
-- Name: idx_19773_unique_tenant_setting; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19773_unique_tenant_setting ON public.tenant_settings USING btree (tenant_id, setting_key);


--
-- Name: idx_19781_idx_expires_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19781_idx_expires_at ON public.tenant_subscriptions USING btree (expires_at);


--
-- Name: idx_19781_idx_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19781_idx_status ON public.tenant_subscriptions USING btree (status);


--
-- Name: idx_19781_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19781_idx_tenant_id ON public.tenant_subscriptions USING btree (tenant_id);


--
-- Name: idx_19787_idx_active; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19787_idx_active ON public.tenant_webhooks USING btree (active);


--
-- Name: idx_19787_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19787_idx_tenant_id ON public.tenant_webhooks USING btree (tenant_id);


--
-- Name: idx_19795_idx_resource_type; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19795_idx_resource_type ON public.usage_quotas USING btree (resource_type);


--
-- Name: idx_19795_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19795_idx_tenant_id ON public.usage_quotas USING btree (tenant_id);


--
-- Name: idx_19795_unique_quota; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19795_unique_quota ON public.usage_quotas USING btree (tenant_id, resource_type);


--
-- Name: idx_19802_idx_archived; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19802_idx_archived ON public.users USING btree (is_archived);


--
-- Name: idx_19802_idx_employee_number_search; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19802_idx_employee_number_search ON public.users USING btree (employee_number);


--
-- Name: idx_19802_idx_is_active; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19802_idx_is_active ON public.users USING btree (is_active);


--
-- Name: idx_19802_idx_role; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19802_idx_role ON public.users USING btree (role);


--
-- Name: idx_19802_idx_tenant_employee_number; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19802_idx_tenant_employee_number ON public.users USING btree (tenant_id, employee_number);


--
-- Name: idx_19802_idx_tenant_users; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19802_idx_tenant_users ON public.users USING btree (tenant_id);


--
-- Name: idx_19802_idx_username; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19802_idx_username ON public.users USING btree (username);


--
-- Name: idx_19802_idx_users_availability_status; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19802_idx_users_availability_status ON public.users USING btree (availability_status);


--
-- Name: idx_19802_idx_users_full_access; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19802_idx_users_full_access ON public.users USING btree (tenant_id, has_full_access);


--
-- Name: idx_19802_unique_email; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19802_unique_email ON public.users USING btree (email);


--
-- Name: idx_19802_username; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19802_username ON public.users USING btree (username);


--
-- Name: idx_19815_idx_used; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19815_idx_used ON public.user_2fa_backup_codes USING btree (used);


--
-- Name: idx_19815_idx_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19815_idx_user_id ON public.user_2fa_backup_codes USING btree (user_id);


--
-- Name: idx_19821_unique_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19821_unique_user_id ON public.user_2fa_secrets USING btree (user_id);


--
-- Name: idx_19827_fk_ud_assigned_by; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19827_fk_ud_assigned_by ON public.user_departments USING btree (assigned_by);


--
-- Name: idx_19827_fk_ud_department; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19827_fk_ud_department ON public.user_departments USING btree (department_id);


--
-- Name: idx_19827_idx_ud_primary; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19827_idx_ud_primary ON public.user_departments USING btree (tenant_id, is_primary);


--
-- Name: idx_19827_idx_ud_tenant_department; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19827_idx_ud_tenant_department ON public.user_departments USING btree (tenant_id, department_id);


--
-- Name: idx_19827_idx_ud_tenant_user; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19827_idx_ud_tenant_user ON public.user_departments USING btree (tenant_id, user_id);


--
-- Name: idx_19827_uq_user_department_tenant; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19827_uq_user_department_tenant ON public.user_departments USING btree (user_id, department_id, tenant_id);


--
-- Name: idx_19833_idx_user_sessions_expires_at; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19833_idx_user_sessions_expires_at ON public.user_sessions USING btree (expires_at);


--
-- Name: idx_19833_idx_user_sessions_session_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19833_idx_user_sessions_session_id ON public.user_sessions USING btree (session_id);


--
-- Name: idx_19833_idx_user_sessions_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19833_idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- Name: idx_19833_session_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19833_session_id ON public.user_sessions USING btree (session_id);


--
-- Name: idx_19840_idx_category; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19840_idx_category ON public.user_settings USING btree (category);


--
-- Name: idx_19840_idx_team_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19840_idx_team_id ON public.user_settings USING btree (team_id);


--
-- Name: idx_19840_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19840_idx_tenant_id ON public.user_settings USING btree (tenant_id);


--
-- Name: idx_19840_idx_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19840_idx_user_id ON public.user_settings USING btree (user_id);


--
-- Name: idx_19840_idx_user_tenant_team; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19840_idx_user_tenant_team ON public.user_settings USING btree (user_id, tenant_id, team_id);


--
-- Name: idx_19840_unique_user_team_setting; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19840_unique_user_team_setting ON public.user_settings USING btree (user_id, tenant_id, team_id, setting_key);


--
-- Name: idx_19848_idx_team_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19848_idx_team_id ON public.user_teams USING btree (team_id);


--
-- Name: idx_19848_idx_tenant_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19848_idx_tenant_id ON public.user_teams USING btree (tenant_id);


--
-- Name: idx_19848_idx_user_id; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE INDEX idx_19848_idx_user_id ON public.user_teams USING btree (user_id);


--
-- Name: idx_19848_unique_user_team; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_19848_unique_user_team ON public.user_teams USING btree (user_id, team_id);


--
-- Name: idx_22142_unique_name; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_22142_unique_name ON public.kvp_categories USING btree (name);


--
-- Name: idx_22152_name; Type: INDEX; Schema: public; Owner: pgloader
--

CREATE UNIQUE INDEX idx_22152_name ON public.machine_categories USING btree (name);


--
-- Name: areas on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.areas FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_areas();


--
-- Name: blackboard_entries on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.blackboard_entries FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_blackboard_entries();


--
-- Name: calendar_attendees on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.calendar_attendees FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_calendar_attendees();


--
-- Name: calendar_events on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_calendar_events();


--
-- Name: chat_channels on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.chat_channels FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_chat_channels();


--
-- Name: conversations on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_conversations();


--
-- Name: departments on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_departments();


--
-- Name: email_templates on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_email_templates();


--
-- Name: employee_availability on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.employee_availability FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_employee_availability();


--
-- Name: features on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.features FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_features();


--
-- Name: kvp_suggestions on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.kvp_suggestions FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_kvp_suggestions();


--
-- Name: machines on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_machines();


--
-- Name: notification_preferences on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_notification_preferences();


--
-- Name: notifications on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_notifications();


--
-- Name: password_reset_tokens on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.password_reset_tokens FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_password_reset_tokens();


--
-- Name: plans on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_plans();


--
-- Name: scheduled_tasks on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.scheduled_tasks FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_scheduled_tasks();


--
-- Name: shift_assignments on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.shift_assignments FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_shift_assignments();


--
-- Name: shift_plans on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.shift_plans FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_shift_plans();


--
-- Name: shift_rotation_assignments on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.shift_rotation_assignments FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_shift_rotation_assignments();


--
-- Name: shift_rotation_patterns on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.shift_rotation_patterns FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_shift_rotation_patterns();


--
-- Name: shift_swap_requests on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.shift_swap_requests FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_shift_swap_requests();


--
-- Name: shift_templates on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.shift_templates FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_shift_templates();


--
-- Name: shifts on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_shifts();


--
-- Name: subscription_plans on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_subscription_plans();


--
-- Name: surveys on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.surveys FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_surveys();


--
-- Name: system_settings on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_system_settings();


--
-- Name: teams on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_teams();


--
-- Name: tenant_addons on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.tenant_addons FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_tenant_addons();


--
-- Name: tenant_features on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.tenant_features FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_tenant_features();


--
-- Name: tenant_plans on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.tenant_plans FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_tenant_plans();


--
-- Name: tenant_settings on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.tenant_settings FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_tenant_settings();


--
-- Name: tenants on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_tenants();


--
-- Name: user_sessions on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.user_sessions FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_user_sessions();


--
-- Name: user_settings on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_user_settings();


--
-- Name: users on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_users();


--
-- Name: features prevent_features_delete; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER prevent_features_delete BEFORE DELETE ON public.features FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_protected_table();


--
-- Name: plan_features prevent_plan_features_delete; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER prevent_plan_features_delete BEFORE DELETE ON public.plan_features FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_protected_table();


--
-- Name: plans prevent_plans_delete; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER prevent_plans_delete BEFORE DELETE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_protected_table();


--
-- Name: areas update_areas_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_areas_updated_at BEFORE UPDATE ON public.areas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: blackboard_entries update_blackboard_entries_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_blackboard_entries_updated_at BEFORE UPDATE ON public.blackboard_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: calendar_attendees update_calendar_attendees_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_calendar_attendees_updated_at BEFORE UPDATE ON public.calendar_attendees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: calendar_events update_calendar_events_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: chat_channels update_chat_channels_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_chat_channels_updated_at BEFORE UPDATE ON public.chat_channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: conversations update_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: departments update_departments_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: email_templates update_email_templates_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: employee_availability update_employee_availability_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_employee_availability_updated_at BEFORE UPDATE ON public.employee_availability FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: features update_features_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_features_updated_at BEFORE UPDATE ON public.features FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: kvp_suggestions update_kvp_suggestions_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_kvp_suggestions_updated_at BEFORE UPDATE ON public.kvp_suggestions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: machines update_machines_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_machines_updated_at BEFORE UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_preferences update_notification_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notifications update_notifications_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: plans update_plans_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shift_assignments update_shift_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_shift_assignments_updated_at BEFORE UPDATE ON public.shift_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shift_plans update_shift_plans_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_shift_plans_updated_at BEFORE UPDATE ON public.shift_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shift_rotation_assignments update_shift_rotation_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_shift_rotation_assignments_updated_at BEFORE UPDATE ON public.shift_rotation_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shift_rotation_patterns update_shift_rotation_patterns_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_shift_rotation_patterns_updated_at BEFORE UPDATE ON public.shift_rotation_patterns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shift_swap_requests update_shift_swap_requests_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_shift_swap_requests_updated_at BEFORE UPDATE ON public.shift_swap_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shift_templates update_shift_templates_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_shift_templates_updated_at BEFORE UPDATE ON public.shift_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shifts update_shifts_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscription_plans update_subscription_plans_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: surveys update_surveys_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_surveys_updated_at BEFORE UPDATE ON public.surveys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: system_settings update_system_settings_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: teams update_teams_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenant_addons update_tenant_addons_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_tenant_addons_updated_at BEFORE UPDATE ON public.tenant_addons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenant_features update_tenant_features_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_tenant_features_updated_at BEFORE UPDATE ON public.tenant_features FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenant_plans update_tenant_plans_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_tenant_plans_updated_at BEFORE UPDATE ON public.tenant_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenant_settings update_tenant_settings_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_tenant_settings_updated_at BEFORE UPDATE ON public.tenant_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenants update_tenants_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_settings update_user_settings_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: pgloader
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: absences absences_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.absences
    ADD CONSTRAINT absences_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: absences absences_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.absences
    ADD CONSTRAINT absences_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: absences absences_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.absences
    ADD CONSTRAINT absences_ibfk_3 FOREIGN KEY (approved_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: activity_logs activity_logs_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_ibfk_1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: admin_department_permissions admin_department_permissions_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.admin_department_permissions
    ADD CONSTRAINT admin_department_permissions_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: admin_department_permissions admin_department_permissions_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.admin_department_permissions
    ADD CONSTRAINT admin_department_permissions_ibfk_2 FOREIGN KEY (admin_user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: admin_department_permissions admin_department_permissions_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.admin_department_permissions
    ADD CONSTRAINT admin_department_permissions_ibfk_3 FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: admin_department_permissions admin_department_permissions_ibfk_4; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.admin_department_permissions
    ADD CONSTRAINT admin_department_permissions_ibfk_4 FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: admin_logs admin_logs_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_ibfk_1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: root_logs admin_logs_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.root_logs
    ADD CONSTRAINT admin_logs_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: admin_permission_logs admin_permission_logs_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.admin_permission_logs
    ADD CONSTRAINT admin_permission_logs_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: admin_permission_logs admin_permission_logs_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.admin_permission_logs
    ADD CONSTRAINT admin_permission_logs_ibfk_2 FOREIGN KEY (admin_user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: admin_permission_logs admin_permission_logs_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.admin_permission_logs
    ADD CONSTRAINT admin_permission_logs_ibfk_3 FOREIGN KEY (changed_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: api_keys api_keys_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: api_keys api_keys_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_ibfk_2 FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: api_logs api_logs_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.api_logs
    ADD CONSTRAINT api_logs_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: audit_trail audit_trail_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.audit_trail
    ADD CONSTRAINT audit_trail_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: audit_trail audit_trail_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.audit_trail
    ADD CONSTRAINT audit_trail_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: blackboard_confirmations blackboard_confirmations_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.blackboard_confirmations
    ADD CONSTRAINT blackboard_confirmations_ibfk_1 FOREIGN KEY (entry_id) REFERENCES public.blackboard_entries(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: blackboard_confirmations blackboard_confirmations_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.blackboard_confirmations
    ADD CONSTRAINT blackboard_confirmations_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: blackboard_entries blackboard_entries_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.blackboard_entries
    ADD CONSTRAINT blackboard_entries_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: blackboard_entries blackboard_entries_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.blackboard_entries
    ADD CONSTRAINT blackboard_entries_ibfk_2 FOREIGN KEY (author_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: calendar_attendees calendar_attendees_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.calendar_attendees
    ADD CONSTRAINT calendar_attendees_ibfk_1 FOREIGN KEY (event_id) REFERENCES public.calendar_events(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: calendar_attendees calendar_attendees_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.calendar_attendees
    ADD CONSTRAINT calendar_attendees_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: calendar_events calendar_events_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: calendar_events calendar_events_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: calendar_events calendar_events_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_ibfk_3 FOREIGN KEY (parent_event_id) REFERENCES public.calendar_events(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: calendar_recurring_patterns calendar_recurring_patterns_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.calendar_recurring_patterns
    ADD CONSTRAINT calendar_recurring_patterns_ibfk_1 FOREIGN KEY (event_id) REFERENCES public.calendar_events(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: calendar_recurring_patterns calendar_recurring_patterns_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.calendar_recurring_patterns
    ADD CONSTRAINT calendar_recurring_patterns_ibfk_2 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_channel_members chat_channel_members_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_channel_members
    ADD CONSTRAINT chat_channel_members_ibfk_1 FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: chat_channel_members chat_channel_members_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_channel_members
    ADD CONSTRAINT chat_channel_members_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_channel_members chat_channel_members_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_channel_members
    ADD CONSTRAINT chat_channel_members_ibfk_3 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_channels chat_channels_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT chat_channels_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_channels chat_channels_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT chat_channels_ibfk_2 FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_message_edits chat_message_edits_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_message_edits
    ADD CONSTRAINT chat_message_edits_ibfk_1 FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: chat_message_edits chat_message_edits_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_message_edits
    ADD CONSTRAINT chat_message_edits_ibfk_2 FOREIGN KEY (edited_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_message_edits chat_message_edits_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_message_edits
    ADD CONSTRAINT chat_message_edits_ibfk_3 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_message_reactions chat_message_reactions_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_message_reactions
    ADD CONSTRAINT chat_message_reactions_ibfk_1 FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: chat_message_reactions chat_message_reactions_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_message_reactions
    ADD CONSTRAINT chat_message_reactions_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_message_reactions chat_message_reactions_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_message_reactions
    ADD CONSTRAINT chat_message_reactions_ibfk_3 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_message_read_receipts chat_message_read_receipts_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_message_read_receipts
    ADD CONSTRAINT chat_message_read_receipts_ibfk_1 FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: chat_message_read_receipts chat_message_read_receipts_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_message_read_receipts
    ADD CONSTRAINT chat_message_read_receipts_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_message_read_receipts chat_message_read_receipts_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_message_read_receipts
    ADD CONSTRAINT chat_message_read_receipts_ibfk_3 FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_message_read_receipts chat_message_read_receipts_ibfk_4; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_message_read_receipts
    ADD CONSTRAINT chat_message_read_receipts_ibfk_4 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_messages chat_messages_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_ibfk_1 FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_messages chat_messages_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_ibfk_2 FOREIGN KEY (sender_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_messages chat_messages_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_ibfk_3 FOREIGN KEY (reply_to_id) REFERENCES public.chat_messages(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_messages chat_messages_ibfk_4; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_ibfk_4 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: conversation_participants conversation_participants_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_ibfk_1 FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: conversations conversations_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: deletion_alerts deletion_alerts_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.deletion_alerts
    ADD CONSTRAINT deletion_alerts_ibfk_1 FOREIGN KEY (queue_id) REFERENCES public.tenant_deletion_queue(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: deletion_dry_run_reports deletion_dry_run_reports_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.deletion_dry_run_reports
    ADD CONSTRAINT deletion_dry_run_reports_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: deletion_dry_run_reports deletion_dry_run_reports_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.deletion_dry_run_reports
    ADD CONSTRAINT deletion_dry_run_reports_ibfk_2 FOREIGN KEY (requested_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: deletion_partial_options deletion_partial_options_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.deletion_partial_options
    ADD CONSTRAINT deletion_partial_options_ibfk_1 FOREIGN KEY (queue_id) REFERENCES public.tenant_deletion_queue(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: departments departments_ibfk_4; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_ibfk_4 FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: document_permissions document_permissions_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_ibfk_1 FOREIGN KEY (document_id) REFERENCES public.documents(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: document_permissions document_permissions_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: document_permissions document_permissions_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_ibfk_3 FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: document_permissions document_permissions_ibfk_4; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_ibfk_4 FOREIGN KEY (team_id) REFERENCES public.teams(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: document_permissions document_permissions_ibfk_5; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_ibfk_5 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: document_read_status document_read_status_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.document_read_status
    ADD CONSTRAINT document_read_status_ibfk_1 FOREIGN KEY (document_id) REFERENCES public.documents(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: document_read_status document_read_status_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.document_read_status
    ADD CONSTRAINT document_read_status_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: document_read_status document_read_status_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.document_read_status
    ADD CONSTRAINT document_read_status_ibfk_3 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: document_shares document_shares_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.document_shares
    ADD CONSTRAINT document_shares_ibfk_1 FOREIGN KEY (document_id) REFERENCES public.documents(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: document_shares document_shares_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.document_shares
    ADD CONSTRAINT document_shares_ibfk_2 FOREIGN KEY (owner_tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: document_shares document_shares_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.document_shares
    ADD CONSTRAINT document_shares_ibfk_3 FOREIGN KEY (shared_with_tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: documents documents_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: documents documents_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_ibfk_3 FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: failed_file_deletions failed_file_deletions_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.failed_file_deletions
    ADD CONSTRAINT failed_file_deletions_ibfk_1 FOREIGN KEY (queue_id) REFERENCES public.tenant_deletion_queue(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: failed_file_deletions failed_file_deletions_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.failed_file_deletions
    ADD CONSTRAINT failed_file_deletions_ibfk_2 FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: feature_usage_logs feature_usage_logs_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.feature_usage_logs
    ADD CONSTRAINT feature_usage_logs_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: feature_usage_logs feature_usage_logs_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.feature_usage_logs
    ADD CONSTRAINT feature_usage_logs_ibfk_2 FOREIGN KEY (feature_id) REFERENCES public.features(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: feature_usage_logs feature_usage_logs_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.feature_usage_logs
    ADD CONSTRAINT feature_usage_logs_ibfk_3 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: activity_logs fk_activity_logs_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT fk_activity_logs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: api_logs fk_api_logs_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.api_logs
    ADD CONSTRAINT fk_api_logs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: areas fk_areas_created_by; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT fk_areas_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: areas fk_areas_lead; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT fk_areas_lead FOREIGN KEY (area_lead_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: areas fk_areas_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT fk_areas_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: employee_availability fk_availability_created_by; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.employee_availability
    ADD CONSTRAINT fk_availability_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: employee_availability fk_availability_employee; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.employee_availability
    ADD CONSTRAINT fk_availability_employee FOREIGN KEY (employee_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: employee_availability fk_availability_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.employee_availability
    ADD CONSTRAINT fk_availability_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: blackboard_entries fk_blackboard_area; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.blackboard_entries
    ADD CONSTRAINT fk_blackboard_area FOREIGN KEY (area_id) REFERENCES public.areas(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: blackboard_comments fk_blackboard_comments_entry; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.blackboard_comments
    ADD CONSTRAINT fk_blackboard_comments_entry FOREIGN KEY (entry_id) REFERENCES public.blackboard_entries(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: blackboard_comments fk_blackboard_comments_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.blackboard_comments
    ADD CONSTRAINT fk_blackboard_comments_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: blackboard_comments fk_blackboard_comments_user; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.blackboard_comments
    ADD CONSTRAINT fk_blackboard_comments_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: blackboard_confirmations fk_blackboard_confirmations_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.blackboard_confirmations
    ADD CONSTRAINT fk_blackboard_confirmations_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: blackboard_entry_organizations fk_blackboard_entry_org_entry; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.blackboard_entry_organizations
    ADD CONSTRAINT fk_blackboard_entry_org_entry FOREIGN KEY (entry_id) REFERENCES public.blackboard_entries(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: calendar_attendees fk_calendar_attendees_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.calendar_attendees
    ADD CONSTRAINT fk_calendar_attendees_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: calendar_events_organizations fk_calendar_event_org_event; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.calendar_events_organizations
    ADD CONSTRAINT fk_calendar_event_org_event FOREIGN KEY (event_id) REFERENCES public.calendar_events(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: calendar_events fk_calendar_events_area; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT fk_calendar_events_area FOREIGN KEY (area_id) REFERENCES public.areas(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: calendar_events fk_calendar_events_department; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT fk_calendar_events_department FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: calendar_events fk_calendar_events_team; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT fk_calendar_events_team FOREIGN KEY (team_id) REFERENCES public.teams(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: conversation_participants fk_cp_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT fk_cp_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: tenants fk_deletion_requested_by; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT fk_deletion_requested_by FOREIGN KEY (deletion_requested_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: departments fk_departments_area; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT fk_departments_area FOREIGN KEY (area_id) REFERENCES public.areas(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: departments fk_departments_lead; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT fk_departments_lead FOREIGN KEY (department_lead_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: departments fk_departments_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT fk_departments_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: documents fk_documents_blackboard_entry; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT fk_documents_blackboard_entry FOREIGN KEY (blackboard_entry_id) REFERENCES public.blackboard_entries(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: documents fk_documents_owner_user; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT fk_documents_owner_user FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: documents fk_documents_target_dept; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT fk_documents_target_dept FOREIGN KEY (target_department_id) REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: documents fk_documents_target_team; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT fk_documents_target_team FOREIGN KEY (target_team_id) REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: email_templates fk_email_templates_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT fk_email_templates_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tenant_deletion_queue fk_emergency_stopped_by; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_deletion_queue
    ADD CONSTRAINT fk_emergency_stopped_by FOREIGN KEY (emergency_stopped_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: kvp_comments fk_kvp_comments_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_comments
    ADD CONSTRAINT fk_kvp_comments_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: kvp_suggestions fk_kvp_department; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_suggestions
    ADD CONSTRAINT fk_kvp_department FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: kvp_suggestions fk_kvp_shared_by; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_suggestions
    ADD CONSTRAINT fk_kvp_shared_by FOREIGN KEY (shared_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: kvp_suggestions fk_kvp_team; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_suggestions
    ADD CONSTRAINT fk_kvp_team FOREIGN KEY (team_id) REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: machine_teams fk_machine_teams_assigned_by; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_teams
    ADD CONSTRAINT fk_machine_teams_assigned_by FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: machine_teams fk_machine_teams_machine; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_teams
    ADD CONSTRAINT fk_machine_teams_machine FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: machine_teams fk_machine_teams_team; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_teams
    ADD CONSTRAINT fk_machine_teams_team FOREIGN KEY (team_id) REFERENCES public.teams(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: machine_teams fk_machine_teams_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_teams
    ADD CONSTRAINT fk_machine_teams_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: machines fk_machines_area; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT fk_machines_area FOREIGN KEY (area_id) REFERENCES public.areas(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: survey_question_options fk_option_question; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_question_options
    ADD CONSTRAINT fk_option_question FOREIGN KEY (question_id) REFERENCES public.survey_questions(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: refresh_tokens fk_refresh_tokens_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT fk_refresh_tokens_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: refresh_tokens fk_refresh_tokens_user; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shift_rotation_assignments fk_rotation_assignment_assigned_by; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_rotation_assignments
    ADD CONSTRAINT fk_rotation_assignment_assigned_by FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: shift_rotation_assignments fk_rotation_assignment_pattern; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_rotation_assignments
    ADD CONSTRAINT fk_rotation_assignment_pattern FOREIGN KEY (pattern_id) REFERENCES public.shift_rotation_patterns(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shift_rotation_assignments fk_rotation_assignment_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_rotation_assignments
    ADD CONSTRAINT fk_rotation_assignment_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shift_rotation_assignments fk_rotation_assignment_user; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_rotation_assignments
    ADD CONSTRAINT fk_rotation_assignment_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shift_rotation_assignments fk_rotation_assignments_team; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_rotation_assignments
    ADD CONSTRAINT fk_rotation_assignments_team FOREIGN KEY (team_id) REFERENCES public.teams(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: shift_rotation_history fk_rotation_history_assignment; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_rotation_history
    ADD CONSTRAINT fk_rotation_history_assignment FOREIGN KEY (assignment_id) REFERENCES public.shift_rotation_assignments(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shift_rotation_history fk_rotation_history_confirmed_by; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_rotation_history
    ADD CONSTRAINT fk_rotation_history_confirmed_by FOREIGN KEY (confirmed_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: shift_rotation_history fk_rotation_history_pattern; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_rotation_history
    ADD CONSTRAINT fk_rotation_history_pattern FOREIGN KEY (pattern_id) REFERENCES public.shift_rotation_patterns(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shift_rotation_history fk_rotation_history_team; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_rotation_history
    ADD CONSTRAINT fk_rotation_history_team FOREIGN KEY (team_id) REFERENCES public.teams(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: shift_rotation_history fk_rotation_history_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_rotation_history
    ADD CONSTRAINT fk_rotation_history_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shift_rotation_history fk_rotation_history_user; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_rotation_history
    ADD CONSTRAINT fk_rotation_history_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shift_rotation_patterns fk_rotation_pattern_creator; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_rotation_patterns
    ADD CONSTRAINT fk_rotation_pattern_creator FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: shift_rotation_patterns fk_rotation_pattern_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_rotation_patterns
    ADD CONSTRAINT fk_rotation_pattern_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shift_rotation_patterns fk_rotation_patterns_team; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_rotation_patterns
    ADD CONSTRAINT fk_rotation_patterns_team FOREIGN KEY (team_id) REFERENCES public.teams(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: tenant_deletion_queue fk_second_approver; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_deletion_queue
    ADD CONSTRAINT fk_second_approver FOREIGN KEY (second_approver_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: security_logs fk_security_logs_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.security_logs
    ADD CONSTRAINT fk_security_logs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: shift_favorites fk_shift_fav_area; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_favorites
    ADD CONSTRAINT fk_shift_fav_area FOREIGN KEY (area_id) REFERENCES public.areas(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shift_favorites fk_shift_fav_dept; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_favorites
    ADD CONSTRAINT fk_shift_fav_dept FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shift_favorites fk_shift_fav_machine; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_favorites
    ADD CONSTRAINT fk_shift_fav_machine FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shift_favorites fk_shift_fav_team; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_favorites
    ADD CONSTRAINT fk_shift_fav_team FOREIGN KEY (team_id) REFERENCES public.teams(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shift_favorites fk_shift_fav_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_favorites
    ADD CONSTRAINT fk_shift_fav_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shift_favorites fk_shift_fav_user; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_favorites
    ADD CONSTRAINT fk_shift_fav_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shift_plans fk_shift_plans_area; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_plans
    ADD CONSTRAINT fk_shift_plans_area FOREIGN KEY (area_id) REFERENCES public.areas(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: shift_plans fk_shift_plans_machine; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_plans
    ADD CONSTRAINT fk_shift_plans_machine FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: shifts fk_shifts_machine; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT fk_shifts_machine FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: survey_answers fk_survey_answers_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_answers
    ADD CONSTRAINT fk_survey_answers_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_assignments fk_survey_assignments_area; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_assignments
    ADD CONSTRAINT fk_survey_assignments_area FOREIGN KEY (area_id) REFERENCES public.areas(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_assignments fk_survey_assignments_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_assignments
    ADD CONSTRAINT fk_survey_assignments_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_comments fk_survey_comments_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_comments
    ADD CONSTRAINT fk_survey_comments_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_participants fk_survey_participants_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_participants
    ADD CONSTRAINT fk_survey_participants_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_questions fk_survey_questions_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_questions
    ADD CONSTRAINT fk_survey_questions_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_reminders fk_survey_reminders_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_reminders
    ADD CONSTRAINT fk_survey_reminders_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_responses fk_survey_responses_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT fk_survey_responses_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: tenants fk_tenants_created_by; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT fk_tenants_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: admin_area_permissions fk_uap_area; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.admin_area_permissions
    ADD CONSTRAINT fk_uap_area FOREIGN KEY (area_id) REFERENCES public.areas(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: admin_area_permissions fk_uap_assigned_by; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.admin_area_permissions
    ADD CONSTRAINT fk_uap_assigned_by FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: admin_area_permissions fk_uap_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.admin_area_permissions
    ADD CONSTRAINT fk_uap_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: admin_area_permissions fk_uap_user; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.admin_area_permissions
    ADD CONSTRAINT fk_uap_user FOREIGN KEY (admin_user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: user_departments fk_ud_assigned_by; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_departments
    ADD CONSTRAINT fk_ud_assigned_by FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: user_departments fk_ud_department; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_departments
    ADD CONSTRAINT fk_ud_department FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: user_departments fk_ud_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_departments
    ADD CONSTRAINT fk_ud_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: user_departments fk_ud_user; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_departments
    ADD CONSTRAINT fk_ud_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: users fk_users_tenant; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: kvp_attachments kvp_attachments_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_attachments
    ADD CONSTRAINT kvp_attachments_ibfk_1 FOREIGN KEY (suggestion_id) REFERENCES public.kvp_suggestions(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: kvp_attachments kvp_attachments_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_attachments
    ADD CONSTRAINT kvp_attachments_ibfk_2 FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: kvp_comments kvp_comments_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_comments
    ADD CONSTRAINT kvp_comments_ibfk_1 FOREIGN KEY (suggestion_id) REFERENCES public.kvp_suggestions(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: kvp_comments kvp_comments_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_comments
    ADD CONSTRAINT kvp_comments_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: kvp_points kvp_points_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_points
    ADD CONSTRAINT kvp_points_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: kvp_points kvp_points_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_points
    ADD CONSTRAINT kvp_points_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: kvp_points kvp_points_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_points
    ADD CONSTRAINT kvp_points_ibfk_3 FOREIGN KEY (suggestion_id) REFERENCES public.kvp_suggestions(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: kvp_points kvp_points_ibfk_4; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_points
    ADD CONSTRAINT kvp_points_ibfk_4 FOREIGN KEY (awarded_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: kvp_ratings kvp_ratings_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_ratings
    ADD CONSTRAINT kvp_ratings_ibfk_1 FOREIGN KEY (suggestion_id) REFERENCES public.kvp_suggestions(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: kvp_ratings kvp_ratings_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_ratings
    ADD CONSTRAINT kvp_ratings_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: kvp_status_history kvp_status_history_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_status_history
    ADD CONSTRAINT kvp_status_history_ibfk_1 FOREIGN KEY (suggestion_id) REFERENCES public.kvp_suggestions(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: kvp_status_history kvp_status_history_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_status_history
    ADD CONSTRAINT kvp_status_history_ibfk_2 FOREIGN KEY (changed_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: kvp_suggestions kvp_suggestions_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_suggestions
    ADD CONSTRAINT kvp_suggestions_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: kvp_suggestions kvp_suggestions_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_suggestions
    ADD CONSTRAINT kvp_suggestions_ibfk_3 FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: kvp_suggestions kvp_suggestions_ibfk_4; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_suggestions
    ADD CONSTRAINT kvp_suggestions_ibfk_4 FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: kvp_votes kvp_votes_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_votes
    ADD CONSTRAINT kvp_votes_ibfk_1 FOREIGN KEY (suggestion_id) REFERENCES public.kvp_suggestions(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: kvp_votes kvp_votes_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_votes
    ADD CONSTRAINT kvp_votes_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: kvp_votes kvp_votes_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.kvp_votes
    ADD CONSTRAINT kvp_votes_ibfk_3 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: legal_holds legal_holds_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.legal_holds
    ADD CONSTRAINT legal_holds_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: legal_holds legal_holds_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.legal_holds
    ADD CONSTRAINT legal_holds_ibfk_2 FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: legal_holds legal_holds_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.legal_holds
    ADD CONSTRAINT legal_holds_ibfk_3 FOREIGN KEY (released_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: machine_documents machine_documents_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_documents
    ADD CONSTRAINT machine_documents_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: machine_documents machine_documents_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_documents
    ADD CONSTRAINT machine_documents_ibfk_2 FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: machine_documents machine_documents_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_documents
    ADD CONSTRAINT machine_documents_ibfk_3 FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: machine_maintenance_history machine_maintenance_history_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_maintenance_history
    ADD CONSTRAINT machine_maintenance_history_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: machine_maintenance_history machine_maintenance_history_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_maintenance_history
    ADD CONSTRAINT machine_maintenance_history_ibfk_2 FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: machine_maintenance_history machine_maintenance_history_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_maintenance_history
    ADD CONSTRAINT machine_maintenance_history_ibfk_3 FOREIGN KEY (performed_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: machine_maintenance_history machine_maintenance_history_ibfk_4; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_maintenance_history
    ADD CONSTRAINT machine_maintenance_history_ibfk_4 FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: machine_metrics machine_metrics_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_metrics
    ADD CONSTRAINT machine_metrics_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: machine_metrics machine_metrics_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machine_metrics
    ADD CONSTRAINT machine_metrics_ibfk_2 FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: machines machines_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: machines machines_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_ibfk_2 FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: machines machines_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_ibfk_3 FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: machines machines_ibfk_4; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_ibfk_4 FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: messages messages_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: messages messages_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_ibfk_2 FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: messages messages_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_ibfk_3 FOREIGN KEY (sender_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_ibfk_1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: notification_read_status notification_read_status_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.notification_read_status
    ADD CONSTRAINT notification_read_status_ibfk_1 FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: notification_read_status notification_read_status_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.notification_read_status
    ADD CONSTRAINT notification_read_status_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: notification_read_status notification_read_status_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.notification_read_status
    ADD CONSTRAINT notification_read_status_ibfk_3 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: notifications notifications_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: notifications notifications_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_ibfk_2 FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: oauth_tokens oauth_tokens_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.oauth_tokens
    ADD CONSTRAINT oauth_tokens_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: oauth_tokens oauth_tokens_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.oauth_tokens
    ADD CONSTRAINT oauth_tokens_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: password_reset_tokens password_reset_tokens_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_ibfk_1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: payment_history payment_history_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.payment_history
    ADD CONSTRAINT payment_history_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: payment_history payment_history_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.payment_history
    ADD CONSTRAINT payment_history_ibfk_2 FOREIGN KEY (subscription_id) REFERENCES public.tenant_subscriptions(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: plan_features plan_features_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.plan_features
    ADD CONSTRAINT plan_features_ibfk_1 FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: plan_features plan_features_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.plan_features
    ADD CONSTRAINT plan_features_ibfk_2 FOREIGN KEY (feature_id) REFERENCES public.features(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: recurring_jobs recurring_jobs_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.recurring_jobs
    ADD CONSTRAINT recurring_jobs_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: root_logs root_logs_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.root_logs
    ADD CONSTRAINT root_logs_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: scheduled_tasks scheduled_tasks_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.scheduled_tasks
    ADD CONSTRAINT scheduled_tasks_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: security_logs security_logs_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.security_logs
    ADD CONSTRAINT security_logs_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: shift_assignments shift_assignments_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_assignments
    ADD CONSTRAINT shift_assignments_ibfk_1 FOREIGN KEY (shift_id) REFERENCES public.shifts(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shift_assignments shift_assignments_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_assignments
    ADD CONSTRAINT shift_assignments_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shift_assignments shift_assignments_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_assignments
    ADD CONSTRAINT shift_assignments_ibfk_3 FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: shift_plans shift_plans_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_plans
    ADD CONSTRAINT shift_plans_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shift_plans shift_plans_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_plans
    ADD CONSTRAINT shift_plans_ibfk_2 FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: shift_plans shift_plans_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_plans
    ADD CONSTRAINT shift_plans_ibfk_3 FOREIGN KEY (team_id) REFERENCES public.teams(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: shift_plans shift_plans_ibfk_4; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_plans
    ADD CONSTRAINT shift_plans_ibfk_4 FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shift_plans shift_plans_ibfk_5; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_plans
    ADD CONSTRAINT shift_plans_ibfk_5 FOREIGN KEY (approved_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: shift_swap_requests shift_swap_requests_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_ibfk_1 FOREIGN KEY (assignment_id) REFERENCES public.shift_assignments(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: shift_swap_requests shift_swap_requests_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_ibfk_2 FOREIGN KEY (requested_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: shift_swap_requests shift_swap_requests_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_ibfk_3 FOREIGN KEY (requested_with) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: shift_swap_requests shift_swap_requests_ibfk_4; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_ibfk_4 FOREIGN KEY (approved_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: shift_swap_requests shift_swap_requests_ibfk_5; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT shift_swap_requests_ibfk_5 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: shift_templates shift_templates_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shift_templates
    ADD CONSTRAINT shift_templates_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shifts shifts_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shifts shifts_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shifts shifts_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_ibfk_3 FOREIGN KEY (template_id) REFERENCES public.shift_templates(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: shifts shifts_ibfk_4; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_ibfk_4 FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: shifts shifts_ibfk_5; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_ibfk_5 FOREIGN KEY (plan_id) REFERENCES public.shift_plans(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: shifts shifts_ibfk_6; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_ibfk_6 FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: shifts shifts_ibfk_7; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_ibfk_7 FOREIGN KEY (team_id) REFERENCES public.teams(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: shifts shifts_ibfk_8; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_ibfk_8 FOREIGN KEY (area_id) REFERENCES public.areas(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: survey_answers survey_answers_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_answers
    ADD CONSTRAINT survey_answers_ibfk_1 FOREIGN KEY (response_id) REFERENCES public.survey_responses(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_answers survey_answers_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_answers
    ADD CONSTRAINT survey_answers_ibfk_2 FOREIGN KEY (question_id) REFERENCES public.survey_questions(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_assignments survey_assignments_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_assignments
    ADD CONSTRAINT survey_assignments_ibfk_1 FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_assignments survey_assignments_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_assignments
    ADD CONSTRAINT survey_assignments_ibfk_2 FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_assignments survey_assignments_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_assignments
    ADD CONSTRAINT survey_assignments_ibfk_3 FOREIGN KEY (team_id) REFERENCES public.teams(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_assignments survey_assignments_ibfk_4; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_assignments
    ADD CONSTRAINT survey_assignments_ibfk_4 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_comments survey_comments_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_comments
    ADD CONSTRAINT survey_comments_ibfk_1 FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_comments survey_comments_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_comments
    ADD CONSTRAINT survey_comments_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_participants survey_participants_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_participants
    ADD CONSTRAINT survey_participants_ibfk_1 FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_participants survey_participants_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_participants
    ADD CONSTRAINT survey_participants_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_questions survey_questions_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_questions
    ADD CONSTRAINT survey_questions_ibfk_1 FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_reminders survey_reminders_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_reminders
    ADD CONSTRAINT survey_reminders_ibfk_1 FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_responses survey_responses_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_ibfk_1 FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_responses survey_responses_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: survey_templates survey_templates_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_templates
    ADD CONSTRAINT survey_templates_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: survey_templates survey_templates_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.survey_templates
    ADD CONSTRAINT survey_templates_ibfk_2 FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: surveys surveys_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: surveys surveys_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_ibfk_2 FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: teams teams_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: teams teams_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_ibfk_2 FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: teams teams_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_ibfk_3 FOREIGN KEY (team_lead_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: teams teams_ibfk_4; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_ibfk_4 FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: tenant_addons tenant_addons_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_addons
    ADD CONSTRAINT tenant_addons_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: tenant_deletion_approvals tenant_deletion_approvals_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_deletion_approvals
    ADD CONSTRAINT tenant_deletion_approvals_ibfk_1 FOREIGN KEY (queue_id) REFERENCES public.tenant_deletion_queue(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: tenant_deletion_approvals tenant_deletion_approvals_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_deletion_approvals
    ADD CONSTRAINT tenant_deletion_approvals_ibfk_2 FOREIGN KEY (approver_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: tenant_deletion_log tenant_deletion_log_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_deletion_log
    ADD CONSTRAINT tenant_deletion_log_ibfk_1 FOREIGN KEY (queue_id) REFERENCES public.tenant_deletion_queue(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: tenant_deletion_queue tenant_deletion_queue_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_deletion_queue
    ADD CONSTRAINT tenant_deletion_queue_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: tenant_deletion_queue tenant_deletion_queue_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_deletion_queue
    ADD CONSTRAINT tenant_deletion_queue_ibfk_2 FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: tenant_deletion_rollback tenant_deletion_rollback_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_deletion_rollback
    ADD CONSTRAINT tenant_deletion_rollback_ibfk_1 FOREIGN KEY (queue_id) REFERENCES public.tenant_deletion_queue(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: tenant_deletion_rollback tenant_deletion_rollback_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_deletion_rollback
    ADD CONSTRAINT tenant_deletion_rollback_ibfk_2 FOREIGN KEY (rolled_back_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: tenant_features tenant_features_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_features
    ADD CONSTRAINT tenant_features_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: tenant_features tenant_features_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_features
    ADD CONSTRAINT tenant_features_ibfk_2 FOREIGN KEY (feature_id) REFERENCES public.features(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: tenant_features tenant_features_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_features
    ADD CONSTRAINT tenant_features_ibfk_3 FOREIGN KEY (activated_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- Name: tenant_plans tenant_plans_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_plans
    ADD CONSTRAINT tenant_plans_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: tenant_plans tenant_plans_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_plans
    ADD CONSTRAINT tenant_plans_ibfk_2 FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: tenant_settings tenant_settings_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: tenant_subscriptions tenant_subscriptions_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_subscriptions
    ADD CONSTRAINT tenant_subscriptions_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: tenant_webhooks tenant_webhooks_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenant_webhooks
    ADD CONSTRAINT tenant_webhooks_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: tenants tenants_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_ibfk_1 FOREIGN KEY (current_plan_id) REFERENCES public.plans(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: usage_quotas usage_quotas_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.usage_quotas
    ADD CONSTRAINT usage_quotas_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: user_2fa_backup_codes user_2fa_backup_codes_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_2fa_backup_codes
    ADD CONSTRAINT user_2fa_backup_codes_ibfk_1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: user_2fa_secrets user_2fa_secrets_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_2fa_secrets
    ADD CONSTRAINT user_2fa_secrets_ibfk_1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: user_sessions user_sessions_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_ibfk_1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: user_settings user_settings_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_ibfk_1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: user_settings user_settings_team_fk; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_team_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: user_settings user_settings_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: user_teams user_teams_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_teams
    ADD CONSTRAINT user_teams_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: user_teams user_teams_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_teams
    ADD CONSTRAINT user_teams_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: user_teams user_teams_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: pgloader
--

ALTER TABLE ONLY public.user_teams
    ADD CONSTRAINT user_teams_ibfk_3 FOREIGN KEY (team_id) REFERENCES public.teams(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: absences; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_area_permissions; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.admin_area_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_department_permissions; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.admin_department_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_logs; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_permission_logs; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.admin_permission_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: api_keys; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: api_logs; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: areas; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_trail; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_retention_policy; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.backup_retention_policy ENABLE ROW LEVEL SECURITY;

--
-- Name: blackboard_comments; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.blackboard_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: blackboard_confirmations; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.blackboard_confirmations ENABLE ROW LEVEL SECURITY;

--
-- Name: blackboard_entries; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.blackboard_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar_attendees; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.calendar_attendees ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar_events; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar_recurring_patterns; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.calendar_recurring_patterns ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_channel_members; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_channels; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_message_edits; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.chat_message_edits ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_message_reactions; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_message_read_receipts; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.chat_message_read_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_participants; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: deletion_audit_trail; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.deletion_audit_trail ENABLE ROW LEVEL SECURITY;

--
-- Name: deletion_dry_run_reports; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.deletion_dry_run_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: departments; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

--
-- Name: document_permissions; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.document_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: document_read_status; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.document_read_status ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: email_queue; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: email_templates; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_availability; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.employee_availability ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_usage_logs; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.feature_usage_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: kvp_comments; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.kvp_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: kvp_points; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.kvp_points ENABLE ROW LEVEL SECURITY;

--
-- Name: kvp_suggestions; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.kvp_suggestions ENABLE ROW LEVEL SECURITY;

--
-- Name: kvp_votes; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.kvp_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: legal_holds; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.legal_holds ENABLE ROW LEVEL SECURITY;

--
-- Name: machine_documents; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.machine_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: machine_maintenance_history; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.machine_maintenance_history ENABLE ROW LEVEL SECURITY;

--
-- Name: machine_metrics; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.machine_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: machine_teams; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.machine_teams ENABLE ROW LEVEL SECURITY;

--
-- Name: machines; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_read_status; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.notification_read_status ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: oauth_tokens; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_history; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

--
-- Name: recurring_jobs; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.recurring_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: root_logs; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.root_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: scheduled_tasks; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.scheduled_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: security_logs; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_assignments; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_favorites; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.shift_favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_plans; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.shift_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_rotation_assignments; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.shift_rotation_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_rotation_history; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.shift_rotation_history ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_rotation_patterns; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.shift_rotation_patterns ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_swap_requests; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.shift_swap_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_templates; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: shifts; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

--
-- Name: survey_answers; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.survey_answers ENABLE ROW LEVEL SECURITY;

--
-- Name: survey_assignments; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.survey_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: survey_comments; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.survey_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: survey_participants; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.survey_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: survey_question_options; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.survey_question_options ENABLE ROW LEVEL SECURITY;

--
-- Name: survey_questions; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: survey_reminders; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.survey_reminders ENABLE ROW LEVEL SECURITY;

--
-- Name: survey_responses; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: survey_templates; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.survey_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: surveys; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_addons; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.tenant_addons ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_data_exports; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.tenant_data_exports ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_deletion_backups; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.tenant_deletion_backups ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_deletion_queue; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.tenant_deletion_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_features; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.tenant_features ENABLE ROW LEVEL SECURITY;

--
-- Name: absences tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.absences USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: activity_logs tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.activity_logs USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: admin_area_permissions tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.admin_area_permissions USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: admin_department_permissions tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.admin_department_permissions USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: admin_logs tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.admin_logs USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: admin_permission_logs tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.admin_permission_logs USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: api_keys tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.api_keys USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: api_logs tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.api_logs USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: areas tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.areas USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: audit_trail tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.audit_trail USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: backup_retention_policy tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.backup_retention_policy USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: blackboard_comments tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.blackboard_comments USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: blackboard_confirmations tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.blackboard_confirmations USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: blackboard_entries tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.blackboard_entries USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: calendar_attendees tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.calendar_attendees USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: calendar_events tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.calendar_events USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: calendar_recurring_patterns tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.calendar_recurring_patterns USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: chat_channel_members tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.chat_channel_members USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: chat_channels tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.chat_channels USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: chat_message_edits tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.chat_message_edits USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: chat_message_reactions tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.chat_message_reactions USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: chat_message_read_receipts tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.chat_message_read_receipts USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: chat_messages tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.chat_messages USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: conversation_participants tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.conversation_participants USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: conversations tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.conversations USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: deletion_audit_trail tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.deletion_audit_trail USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: deletion_dry_run_reports tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.deletion_dry_run_reports USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: departments tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.departments USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: document_permissions tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.document_permissions USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: document_read_status tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.document_read_status USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: documents tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.documents USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: email_queue tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.email_queue USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: email_templates tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.email_templates USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: employee_availability tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.employee_availability USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: feature_usage_logs tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.feature_usage_logs USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: kvp_comments tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.kvp_comments USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: kvp_points tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.kvp_points USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: kvp_suggestions tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.kvp_suggestions USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: kvp_votes tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.kvp_votes USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: legal_holds tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.legal_holds USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: machine_documents tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.machine_documents USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: machine_maintenance_history tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.machine_maintenance_history USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: machine_metrics tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.machine_metrics USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: machine_teams tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.machine_teams USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: machines tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.machines USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: messages tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.messages USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: notification_preferences tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.notification_preferences USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: notification_read_status tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.notification_read_status USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: notifications tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.notifications USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: oauth_tokens tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.oauth_tokens USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: payment_history tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.payment_history USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: recurring_jobs tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.recurring_jobs USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: refresh_tokens tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.refresh_tokens USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: root_logs tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.root_logs USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: scheduled_tasks tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.scheduled_tasks USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: security_logs tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.security_logs USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: shift_assignments tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.shift_assignments USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: shift_favorites tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.shift_favorites USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: shift_plans tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.shift_plans USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: shift_rotation_assignments tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.shift_rotation_assignments USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: shift_rotation_history tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.shift_rotation_history USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: shift_rotation_patterns tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.shift_rotation_patterns USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: shift_swap_requests tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.shift_swap_requests USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: shift_templates tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.shift_templates USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: shifts tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.shifts USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: survey_answers tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.survey_answers USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: survey_assignments tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.survey_assignments USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: survey_comments tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.survey_comments USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: survey_participants tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.survey_participants USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: survey_question_options tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.survey_question_options USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: survey_questions tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.survey_questions USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: survey_reminders tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.survey_reminders USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: survey_responses tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.survey_responses USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: survey_templates tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.survey_templates USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: surveys tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.surveys USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: teams tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.teams USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: tenant_addons tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.tenant_addons USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: tenant_data_exports tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.tenant_data_exports USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: tenant_deletion_backups tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.tenant_deletion_backups USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: tenant_deletion_queue tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.tenant_deletion_queue USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: tenant_features tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.tenant_features USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: tenant_plans tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.tenant_plans USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: tenant_settings tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.tenant_settings USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: tenant_subscriptions tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.tenant_subscriptions USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: tenant_webhooks tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.tenant_webhooks USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: usage_quotas tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.usage_quotas USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: user_departments tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.user_departments USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: user_settings tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.user_settings USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: user_teams tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.user_teams USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: users tenant_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_isolation ON public.users USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: tenant_plans; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.tenant_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants tenant_self_isolation; Type: POLICY; Schema: public; Owner: pgloader
--

CREATE POLICY tenant_self_isolation ON public.tenants USING (((current_setting('app.tenant_id'::text, true) IS NULL) OR (id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: tenant_settings; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_subscriptions; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_webhooks; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.tenant_webhooks ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: usage_quotas; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.usage_quotas ENABLE ROW LEVEL SECURITY;

--
-- Name: user_departments; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.user_departments ENABLE ROW LEVEL SECURITY;

--
-- Name: user_settings; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: user_teams; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.user_teams ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: pgloader
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pgloader
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO assixx_user;
GRANT USAGE ON SCHEMA public TO app_user;


--
-- Name: TABLE absences; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.absences TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.absences TO app_user;


--
-- Name: SEQUENCE absences_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.absences_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.absences_id_seq TO app_user;


--
-- Name: TABLE activity_logs; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.activity_logs TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.activity_logs TO app_user;


--
-- Name: SEQUENCE activity_logs_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.activity_logs_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.activity_logs_id_seq TO app_user;


--
-- Name: TABLE admin_area_permissions; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.admin_area_permissions TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.admin_area_permissions TO app_user;


--
-- Name: SEQUENCE admin_area_permissions_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.admin_area_permissions_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.admin_area_permissions_id_seq TO app_user;


--
-- Name: TABLE admin_department_permissions; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.admin_department_permissions TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.admin_department_permissions TO app_user;


--
-- Name: SEQUENCE admin_department_permissions_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.admin_department_permissions_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.admin_department_permissions_id_seq TO app_user;


--
-- Name: TABLE admin_logs; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.admin_logs TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.admin_logs TO app_user;


--
-- Name: SEQUENCE admin_logs_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.admin_logs_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.admin_logs_id_seq TO app_user;


--
-- Name: TABLE admin_permission_logs; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.admin_permission_logs TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.admin_permission_logs TO app_user;


--
-- Name: SEQUENCE admin_permission_logs_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.admin_permission_logs_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.admin_permission_logs_id_seq TO app_user;


--
-- Name: TABLE api_keys; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.api_keys TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.api_keys TO app_user;


--
-- Name: SEQUENCE api_keys_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.api_keys_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.api_keys_id_seq TO app_user;


--
-- Name: TABLE api_logs; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.api_logs TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.api_logs TO app_user;


--
-- Name: SEQUENCE api_logs_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.api_logs_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.api_logs_id_seq TO app_user;


--
-- Name: TABLE archived_tenant_invoices; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.archived_tenant_invoices TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.archived_tenant_invoices TO app_user;


--
-- Name: SEQUENCE archived_tenant_invoices_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.archived_tenant_invoices_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.archived_tenant_invoices_id_seq TO app_user;


--
-- Name: TABLE areas; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.areas TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.areas TO app_user;


--
-- Name: SEQUENCE areas_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.areas_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.areas_id_seq TO app_user;


--
-- Name: TABLE audit_trail; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.audit_trail TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.audit_trail TO app_user;


--
-- Name: SEQUENCE audit_trail_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.audit_trail_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.audit_trail_id_seq TO app_user;


--
-- Name: TABLE backup_retention_policy; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.backup_retention_policy TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.backup_retention_policy TO app_user;


--
-- Name: SEQUENCE backup_retention_policy_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.backup_retention_policy_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.backup_retention_policy_id_seq TO app_user;


--
-- Name: TABLE blackboard_comments; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.blackboard_comments TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.blackboard_comments TO app_user;


--
-- Name: SEQUENCE blackboard_comments_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.blackboard_comments_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.blackboard_comments_id_seq TO app_user;


--
-- Name: TABLE blackboard_confirmations; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.blackboard_confirmations TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.blackboard_confirmations TO app_user;


--
-- Name: SEQUENCE blackboard_confirmations_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.blackboard_confirmations_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.blackboard_confirmations_id_seq TO app_user;


--
-- Name: TABLE blackboard_entries; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.blackboard_entries TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.blackboard_entries TO app_user;


--
-- Name: SEQUENCE blackboard_entries_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.blackboard_entries_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.blackboard_entries_id_seq TO app_user;


--
-- Name: TABLE blackboard_entry_organizations; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.blackboard_entry_organizations TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.blackboard_entry_organizations TO app_user;


--
-- Name: SEQUENCE blackboard_entry_organizations_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.blackboard_entry_organizations_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.blackboard_entry_organizations_id_seq TO app_user;


--
-- Name: TABLE calendar_attendees; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.calendar_attendees TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.calendar_attendees TO app_user;


--
-- Name: SEQUENCE calendar_attendees_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.calendar_attendees_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.calendar_attendees_id_seq TO app_user;


--
-- Name: TABLE calendar_events; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.calendar_events TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.calendar_events TO app_user;


--
-- Name: SEQUENCE calendar_events_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.calendar_events_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.calendar_events_id_seq TO app_user;


--
-- Name: TABLE calendar_events_organizations; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.calendar_events_organizations TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.calendar_events_organizations TO app_user;


--
-- Name: SEQUENCE calendar_events_organizations_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.calendar_events_organizations_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.calendar_events_organizations_id_seq TO app_user;


--
-- Name: TABLE calendar_recurring_patterns; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.calendar_recurring_patterns TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.calendar_recurring_patterns TO app_user;


--
-- Name: SEQUENCE calendar_recurring_patterns_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.calendar_recurring_patterns_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.calendar_recurring_patterns_id_seq TO app_user;


--
-- Name: TABLE chat_channel_members; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.chat_channel_members TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.chat_channel_members TO app_user;


--
-- Name: SEQUENCE chat_channel_members_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.chat_channel_members_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.chat_channel_members_id_seq TO app_user;


--
-- Name: TABLE chat_channels; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.chat_channels TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.chat_channels TO app_user;


--
-- Name: SEQUENCE chat_channels_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.chat_channels_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.chat_channels_id_seq TO app_user;


--
-- Name: TABLE chat_message_edits; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.chat_message_edits TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.chat_message_edits TO app_user;


--
-- Name: SEQUENCE chat_message_edits_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.chat_message_edits_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.chat_message_edits_id_seq TO app_user;


--
-- Name: TABLE chat_message_reactions; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.chat_message_reactions TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.chat_message_reactions TO app_user;


--
-- Name: SEQUENCE chat_message_reactions_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.chat_message_reactions_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.chat_message_reactions_id_seq TO app_user;


--
-- Name: TABLE chat_message_read_receipts; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.chat_message_read_receipts TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.chat_message_read_receipts TO app_user;


--
-- Name: SEQUENCE chat_message_read_receipts_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.chat_message_read_receipts_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.chat_message_read_receipts_id_seq TO app_user;


--
-- Name: TABLE chat_messages; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.chat_messages TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.chat_messages TO app_user;


--
-- Name: SEQUENCE chat_messages_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.chat_messages_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.chat_messages_id_seq TO app_user;


--
-- Name: TABLE conversation_participants; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.conversation_participants TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.conversation_participants TO app_user;


--
-- Name: SEQUENCE conversation_participants_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.conversation_participants_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.conversation_participants_id_seq TO app_user;


--
-- Name: TABLE conversations; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.conversations TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.conversations TO app_user;


--
-- Name: SEQUENCE conversations_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.conversations_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.conversations_id_seq TO app_user;


--
-- Name: TABLE deletion_alerts; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.deletion_alerts TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.deletion_alerts TO app_user;


--
-- Name: SEQUENCE deletion_alerts_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.deletion_alerts_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.deletion_alerts_id_seq TO app_user;


--
-- Name: TABLE deletion_audit_trail; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.deletion_audit_trail TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.deletion_audit_trail TO app_user;


--
-- Name: SEQUENCE deletion_audit_trail_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.deletion_audit_trail_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.deletion_audit_trail_id_seq TO app_user;


--
-- Name: TABLE deletion_dry_run_reports; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.deletion_dry_run_reports TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.deletion_dry_run_reports TO app_user;


--
-- Name: SEQUENCE deletion_dry_run_reports_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.deletion_dry_run_reports_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.deletion_dry_run_reports_id_seq TO app_user;


--
-- Name: TABLE deletion_partial_options; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.deletion_partial_options TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.deletion_partial_options TO app_user;


--
-- Name: SEQUENCE deletion_partial_options_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.deletion_partial_options_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.deletion_partial_options_id_seq TO app_user;


--
-- Name: TABLE departments; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.departments TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.departments TO app_user;


--
-- Name: SEQUENCE departments_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.departments_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.departments_id_seq TO app_user;


--
-- Name: TABLE document_permissions; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.document_permissions TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.document_permissions TO app_user;


--
-- Name: SEQUENCE document_permissions_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.document_permissions_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.document_permissions_id_seq TO app_user;


--
-- Name: TABLE document_read_status; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.document_read_status TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.document_read_status TO app_user;


--
-- Name: SEQUENCE document_read_status_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.document_read_status_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.document_read_status_id_seq TO app_user;


--
-- Name: TABLE document_shares; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.document_shares TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.document_shares TO app_user;


--
-- Name: SEQUENCE document_shares_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.document_shares_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.document_shares_id_seq TO app_user;


--
-- Name: TABLE documents; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.documents TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.documents TO app_user;


--
-- Name: SEQUENCE documents_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.documents_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.documents_id_seq TO app_user;


--
-- Name: TABLE email_queue; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.email_queue TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.email_queue TO app_user;


--
-- Name: SEQUENCE email_queue_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.email_queue_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.email_queue_id_seq TO app_user;


--
-- Name: TABLE email_templates; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.email_templates TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.email_templates TO app_user;


--
-- Name: SEQUENCE email_templates_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.email_templates_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.email_templates_id_seq TO app_user;


--
-- Name: TABLE employee_availability; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.employee_availability TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.employee_availability TO app_user;


--
-- Name: SEQUENCE employee_availability_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.employee_availability_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.employee_availability_id_seq TO app_user;


--
-- Name: TABLE failed_file_deletions; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.failed_file_deletions TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.failed_file_deletions TO app_user;


--
-- Name: SEQUENCE failed_file_deletions_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.failed_file_deletions_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.failed_file_deletions_id_seq TO app_user;


--
-- Name: TABLE feature_usage_logs; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.feature_usage_logs TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.feature_usage_logs TO app_user;


--
-- Name: SEQUENCE feature_usage_logs_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.feature_usage_logs_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.feature_usage_logs_id_seq TO app_user;


--
-- Name: TABLE features; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.features TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.features TO app_user;


--
-- Name: SEQUENCE features_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.features_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.features_id_seq TO app_user;


--
-- Name: TABLE kvp_attachments; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.kvp_attachments TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.kvp_attachments TO app_user;


--
-- Name: SEQUENCE kvp_attachments_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.kvp_attachments_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.kvp_attachments_id_seq TO app_user;


--
-- Name: TABLE kvp_categories; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.kvp_categories TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.kvp_categories TO app_user;


--
-- Name: SEQUENCE kvp_categories_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.kvp_categories_id_seq TO app_user;


--
-- Name: TABLE kvp_comments; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.kvp_comments TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.kvp_comments TO app_user;


--
-- Name: SEQUENCE kvp_comments_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.kvp_comments_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.kvp_comments_id_seq TO app_user;


--
-- Name: TABLE kvp_points; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.kvp_points TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.kvp_points TO app_user;


--
-- Name: SEQUENCE kvp_points_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.kvp_points_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.kvp_points_id_seq TO app_user;


--
-- Name: TABLE kvp_ratings; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.kvp_ratings TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.kvp_ratings TO app_user;


--
-- Name: SEQUENCE kvp_ratings_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.kvp_ratings_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.kvp_ratings_id_seq TO app_user;


--
-- Name: TABLE kvp_status_history; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.kvp_status_history TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.kvp_status_history TO app_user;


--
-- Name: SEQUENCE kvp_status_history_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.kvp_status_history_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.kvp_status_history_id_seq TO app_user;


--
-- Name: TABLE kvp_suggestions; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.kvp_suggestions TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.kvp_suggestions TO app_user;


--
-- Name: SEQUENCE kvp_suggestions_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.kvp_suggestions_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.kvp_suggestions_id_seq TO app_user;


--
-- Name: TABLE kvp_votes; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.kvp_votes TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.kvp_votes TO app_user;


--
-- Name: SEQUENCE kvp_votes_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.kvp_votes_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.kvp_votes_id_seq TO app_user;


--
-- Name: TABLE legal_holds; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.legal_holds TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.legal_holds TO app_user;


--
-- Name: SEQUENCE legal_holds_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.legal_holds_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.legal_holds_id_seq TO app_user;


--
-- Name: TABLE login_attempts; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.login_attempts TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.login_attempts TO app_user;


--
-- Name: SEQUENCE login_attempts_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.login_attempts_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.login_attempts_id_seq TO app_user;


--
-- Name: TABLE machine_categories; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.machine_categories TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.machine_categories TO app_user;


--
-- Name: SEQUENCE machine_categories_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.machine_categories_id_seq TO app_user;


--
-- Name: TABLE machine_documents; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.machine_documents TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.machine_documents TO app_user;


--
-- Name: SEQUENCE machine_documents_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.machine_documents_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.machine_documents_id_seq TO app_user;


--
-- Name: TABLE machine_maintenance_history; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.machine_maintenance_history TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.machine_maintenance_history TO app_user;


--
-- Name: SEQUENCE machine_maintenance_history_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.machine_maintenance_history_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.machine_maintenance_history_id_seq TO app_user;


--
-- Name: TABLE machine_metrics; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.machine_metrics TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.machine_metrics TO app_user;


--
-- Name: SEQUENCE machine_metrics_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.machine_metrics_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.machine_metrics_id_seq TO app_user;


--
-- Name: TABLE machine_teams; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.machine_teams TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.machine_teams TO app_user;


--
-- Name: SEQUENCE machine_teams_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.machine_teams_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.machine_teams_id_seq TO app_user;


--
-- Name: TABLE machines; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.machines TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.machines TO app_user;


--
-- Name: SEQUENCE machines_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.machines_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.machines_id_seq TO app_user;


--
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.messages TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.messages TO app_user;


--
-- Name: SEQUENCE messages_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.messages_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.messages_id_seq TO app_user;


--
-- Name: TABLE migration_log; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.migration_log TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.migration_log TO app_user;


--
-- Name: SEQUENCE migration_log_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.migration_log_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.migration_log_id_seq TO app_user;


--
-- Name: TABLE notification_preferences; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.notification_preferences TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.notification_preferences TO app_user;


--
-- Name: SEQUENCE notification_preferences_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.notification_preferences_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.notification_preferences_id_seq TO app_user;


--
-- Name: TABLE notification_read_status; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.notification_read_status TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.notification_read_status TO app_user;


--
-- Name: SEQUENCE notification_read_status_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.notification_read_status_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.notification_read_status_id_seq TO app_user;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.notifications TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.notifications TO app_user;


--
-- Name: SEQUENCE notifications_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.notifications_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.notifications_id_seq TO app_user;


--
-- Name: TABLE oauth_tokens; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.oauth_tokens TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.oauth_tokens TO app_user;


--
-- Name: SEQUENCE oauth_tokens_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.oauth_tokens_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.oauth_tokens_id_seq TO app_user;


--
-- Name: TABLE password_reset_tokens; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.password_reset_tokens TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.password_reset_tokens TO app_user;


--
-- Name: SEQUENCE password_reset_tokens_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.password_reset_tokens_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.password_reset_tokens_id_seq TO app_user;


--
-- Name: TABLE payment_history; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.payment_history TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.payment_history TO app_user;


--
-- Name: SEQUENCE payment_history_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.payment_history_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.payment_history_id_seq TO app_user;


--
-- Name: TABLE plan_features; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.plan_features TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.plan_features TO app_user;


--
-- Name: SEQUENCE plan_features_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.plan_features_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.plan_features_id_seq TO app_user;


--
-- Name: TABLE plans; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.plans TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.plans TO app_user;


--
-- Name: SEQUENCE plans_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.plans_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.plans_id_seq TO app_user;


--
-- Name: TABLE recurring_jobs; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.recurring_jobs TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.recurring_jobs TO app_user;


--
-- Name: SEQUENCE recurring_jobs_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.recurring_jobs_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.recurring_jobs_id_seq TO app_user;


--
-- Name: TABLE refresh_tokens; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.refresh_tokens TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.refresh_tokens TO app_user;


--
-- Name: SEQUENCE refresh_tokens_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.refresh_tokens_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.refresh_tokens_id_seq TO app_user;


--
-- Name: TABLE released_subdomains; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.released_subdomains TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.released_subdomains TO app_user;


--
-- Name: SEQUENCE released_subdomains_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.released_subdomains_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.released_subdomains_id_seq TO app_user;


--
-- Name: TABLE root_logs; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.root_logs TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.root_logs TO app_user;


--
-- Name: SEQUENCE root_logs_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.root_logs_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.root_logs_id_seq TO app_user;


--
-- Name: TABLE scheduled_tasks; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.scheduled_tasks TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.scheduled_tasks TO app_user;


--
-- Name: SEQUENCE scheduled_tasks_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.scheduled_tasks_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.scheduled_tasks_id_seq TO app_user;


--
-- Name: TABLE security_logs; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.security_logs TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.security_logs TO app_user;


--
-- Name: SEQUENCE security_logs_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.security_logs_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.security_logs_id_seq TO app_user;


--
-- Name: TABLE shift_assignments; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.shift_assignments TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shift_assignments TO app_user;


--
-- Name: SEQUENCE shift_assignments_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.shift_assignments_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.shift_assignments_id_seq TO app_user;


--
-- Name: TABLE shift_favorites; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.shift_favorites TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shift_favorites TO app_user;


--
-- Name: SEQUENCE shift_favorites_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.shift_favorites_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.shift_favorites_id_seq TO app_user;


--
-- Name: TABLE shift_plans; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.shift_plans TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shift_plans TO app_user;


--
-- Name: SEQUENCE shift_plans_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.shift_plans_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.shift_plans_id_seq TO app_user;


--
-- Name: TABLE shift_rotation_assignments; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.shift_rotation_assignments TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shift_rotation_assignments TO app_user;


--
-- Name: SEQUENCE shift_rotation_assignments_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.shift_rotation_assignments_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.shift_rotation_assignments_id_seq TO app_user;


--
-- Name: TABLE shift_rotation_history; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.shift_rotation_history TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shift_rotation_history TO app_user;


--
-- Name: SEQUENCE shift_rotation_history_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.shift_rotation_history_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.shift_rotation_history_id_seq TO app_user;


--
-- Name: TABLE shift_rotation_patterns; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.shift_rotation_patterns TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shift_rotation_patterns TO app_user;


--
-- Name: SEQUENCE shift_rotation_patterns_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.shift_rotation_patterns_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.shift_rotation_patterns_id_seq TO app_user;


--
-- Name: TABLE shift_swap_requests; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.shift_swap_requests TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shift_swap_requests TO app_user;


--
-- Name: SEQUENCE shift_swap_requests_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.shift_swap_requests_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.shift_swap_requests_id_seq TO app_user;


--
-- Name: TABLE shift_templates; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.shift_templates TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shift_templates TO app_user;


--
-- Name: SEQUENCE shift_templates_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.shift_templates_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.shift_templates_id_seq TO app_user;


--
-- Name: TABLE shifts; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.shifts TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts TO app_user;


--
-- Name: SEQUENCE shifts_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.shifts_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.shifts_id_seq TO app_user;


--
-- Name: TABLE subscription_plans; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.subscription_plans TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.subscription_plans TO app_user;


--
-- Name: SEQUENCE subscription_plans_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.subscription_plans_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.subscription_plans_id_seq TO app_user;


--
-- Name: TABLE survey_answers; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.survey_answers TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.survey_answers TO app_user;


--
-- Name: SEQUENCE survey_answers_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.survey_answers_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.survey_answers_id_seq TO app_user;


--
-- Name: TABLE survey_assignments; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.survey_assignments TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.survey_assignments TO app_user;


--
-- Name: SEQUENCE survey_assignments_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.survey_assignments_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.survey_assignments_id_seq TO app_user;


--
-- Name: TABLE survey_comments; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.survey_comments TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.survey_comments TO app_user;


--
-- Name: SEQUENCE survey_comments_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.survey_comments_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.survey_comments_id_seq TO app_user;


--
-- Name: TABLE survey_participants; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.survey_participants TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.survey_participants TO app_user;


--
-- Name: SEQUENCE survey_participants_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.survey_participants_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.survey_participants_id_seq TO app_user;


--
-- Name: TABLE survey_question_options; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.survey_question_options TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.survey_question_options TO app_user;


--
-- Name: SEQUENCE survey_question_options_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.survey_question_options_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.survey_question_options_id_seq TO app_user;


--
-- Name: TABLE survey_questions; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.survey_questions TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.survey_questions TO app_user;


--
-- Name: SEQUENCE survey_questions_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.survey_questions_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.survey_questions_id_seq TO app_user;


--
-- Name: TABLE survey_reminders; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.survey_reminders TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.survey_reminders TO app_user;


--
-- Name: SEQUENCE survey_reminders_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.survey_reminders_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.survey_reminders_id_seq TO app_user;


--
-- Name: TABLE survey_responses; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.survey_responses TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.survey_responses TO app_user;


--
-- Name: SEQUENCE survey_responses_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.survey_responses_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.survey_responses_id_seq TO app_user;


--
-- Name: TABLE survey_templates; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.survey_templates TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.survey_templates TO app_user;


--
-- Name: SEQUENCE survey_templates_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.survey_templates_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.survey_templates_id_seq TO app_user;


--
-- Name: TABLE surveys; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.surveys TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.surveys TO app_user;


--
-- Name: SEQUENCE surveys_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.surveys_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.surveys_id_seq TO app_user;


--
-- Name: TABLE system_logs; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.system_logs TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.system_logs TO app_user;


--
-- Name: SEQUENCE system_logs_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.system_logs_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.system_logs_id_seq TO app_user;


--
-- Name: TABLE system_settings; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.system_settings TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.system_settings TO app_user;


--
-- Name: SEQUENCE system_settings_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.system_settings_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.system_settings_id_seq TO app_user;


--
-- Name: TABLE teams; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.teams TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.teams TO app_user;


--
-- Name: SEQUENCE teams_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.teams_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.teams_id_seq TO app_user;


--
-- Name: TABLE tenant_addons; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.tenant_addons TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tenant_addons TO app_user;


--
-- Name: SEQUENCE tenant_addons_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.tenant_addons_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.tenant_addons_id_seq TO app_user;


--
-- Name: TABLE tenant_data_exports; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.tenant_data_exports TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tenant_data_exports TO app_user;


--
-- Name: SEQUENCE tenant_data_exports_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.tenant_data_exports_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.tenant_data_exports_id_seq TO app_user;


--
-- Name: TABLE tenant_deletion_approvals; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.tenant_deletion_approvals TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tenant_deletion_approvals TO app_user;


--
-- Name: SEQUENCE tenant_deletion_approvals_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.tenant_deletion_approvals_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.tenant_deletion_approvals_id_seq TO app_user;


--
-- Name: TABLE tenant_deletion_backups; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.tenant_deletion_backups TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tenant_deletion_backups TO app_user;


--
-- Name: SEQUENCE tenant_deletion_backups_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.tenant_deletion_backups_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.tenant_deletion_backups_id_seq TO app_user;


--
-- Name: TABLE tenant_deletion_log; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.tenant_deletion_log TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tenant_deletion_log TO app_user;


--
-- Name: SEQUENCE tenant_deletion_log_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.tenant_deletion_log_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.tenant_deletion_log_id_seq TO app_user;


--
-- Name: TABLE tenant_deletion_queue; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.tenant_deletion_queue TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tenant_deletion_queue TO app_user;


--
-- Name: SEQUENCE tenant_deletion_queue_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.tenant_deletion_queue_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.tenant_deletion_queue_id_seq TO app_user;


--
-- Name: TABLE tenant_deletion_rollback; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.tenant_deletion_rollback TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tenant_deletion_rollback TO app_user;


--
-- Name: SEQUENCE tenant_deletion_rollback_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.tenant_deletion_rollback_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.tenant_deletion_rollback_id_seq TO app_user;


--
-- Name: TABLE tenant_features; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.tenant_features TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tenant_features TO app_user;


--
-- Name: SEQUENCE tenant_features_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.tenant_features_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.tenant_features_id_seq TO app_user;


--
-- Name: TABLE tenant_plans; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.tenant_plans TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tenant_plans TO app_user;


--
-- Name: SEQUENCE tenant_plans_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.tenant_plans_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.tenant_plans_id_seq TO app_user;


--
-- Name: TABLE tenant_settings; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.tenant_settings TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tenant_settings TO app_user;


--
-- Name: SEQUENCE tenant_settings_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.tenant_settings_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.tenant_settings_id_seq TO app_user;


--
-- Name: TABLE tenant_subscriptions; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.tenant_subscriptions TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tenant_subscriptions TO app_user;


--
-- Name: SEQUENCE tenant_subscriptions_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.tenant_subscriptions_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.tenant_subscriptions_id_seq TO app_user;


--
-- Name: TABLE tenant_webhooks; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.tenant_webhooks TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tenant_webhooks TO app_user;


--
-- Name: SEQUENCE tenant_webhooks_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.tenant_webhooks_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.tenant_webhooks_id_seq TO app_user;


--
-- Name: TABLE tenants; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.tenants TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tenants TO app_user;


--
-- Name: SEQUENCE tenants_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.tenants_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.tenants_id_seq TO app_user;


--
-- Name: TABLE usage_quotas; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.usage_quotas TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.usage_quotas TO app_user;


--
-- Name: SEQUENCE usage_quotas_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.usage_quotas_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.usage_quotas_id_seq TO app_user;


--
-- Name: TABLE user_2fa_backup_codes; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.user_2fa_backup_codes TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_2fa_backup_codes TO app_user;


--
-- Name: SEQUENCE user_2fa_backup_codes_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.user_2fa_backup_codes_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.user_2fa_backup_codes_id_seq TO app_user;


--
-- Name: TABLE user_2fa_secrets; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.user_2fa_secrets TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_2fa_secrets TO app_user;


--
-- Name: SEQUENCE user_2fa_secrets_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.user_2fa_secrets_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.user_2fa_secrets_id_seq TO app_user;


--
-- Name: TABLE user_departments; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.user_departments TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_departments TO app_user;


--
-- Name: SEQUENCE user_departments_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.user_departments_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.user_departments_id_seq TO app_user;


--
-- Name: TABLE user_sessions; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.user_sessions TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_sessions TO app_user;


--
-- Name: SEQUENCE user_sessions_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.user_sessions_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.user_sessions_id_seq TO app_user;


--
-- Name: TABLE user_settings; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.user_settings TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_settings TO app_user;


--
-- Name: SEQUENCE user_settings_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.user_settings_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.user_settings_id_seq TO app_user;


--
-- Name: TABLE user_teams; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.user_teams TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_teams TO app_user;


--
-- Name: SEQUENCE user_teams_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.user_teams_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.user_teams_id_seq TO app_user;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: pgloader
--

GRANT ALL ON TABLE public.users TO assixx_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.users TO app_user;


--
-- Name: SEQUENCE users_id_seq; Type: ACL; Schema: public; Owner: pgloader
--

GRANT SELECT,USAGE ON SEQUENCE public.users_id_seq TO assixx_user;
GRANT SELECT,USAGE ON SEQUENCE public.users_id_seq TO app_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: pgloader
--

ALTER DEFAULT PRIVILEGES FOR ROLE pgloader IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO app_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: pgloader
--

ALTER DEFAULT PRIVILEGES FOR ROLE pgloader IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO app_user;


--
-- PostgreSQL database dump complete
--

\unrestrict YZgyCpmdTdyg6dcWXSL4rjoGb5XeZcaVYRoE9PslyUyQCwvON4icbN2ZXqL06bc


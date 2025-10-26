/**
 * Database Table Row Types - Complete Type Definitions
 *
 * Auto-generated from MySQL schema - represents exact database structure
 *
 * CRITICAL TYPE MAPPING RULES:
 * - `int` � `number`
 * - `varchar(n)`, `text` � `string`
 * - `tinyint(1)` � `number` (MySQL returns 0/1, NOT boolean!)
 * - `enum('a','b')` � `'a' | 'b'`
 * - `json` � `object` or specific typed interface
 * - `timestamp`, `datetime`, `date` � `Date | string` (MySQL2 parsing)
 * - `decimal(n,m)` � `number`
 * - `longblob` � `Buffer`
 * - `NULL` � `| null`
 *
 * USAGE EXAMPLE:
 * ```typescript
 * import { UsersRow } from './database-rows.types';
 *
 * const [rows] = await connection.execute<UsersRow[]>(
 *   'SELECT * FROM users WHERE id = ?',
 *   [userId]
 * );
 * const user = rows[0]; //  Fully typed!
 * console.log(user.username); //  TypeScript knows this is string
 * ```
 *
 * Best Practice 2025: Always specify Row type instead of RowDataPacket
 * This eliminates 99% of implicit any types in our codebase!
 */
import { RowDataPacket } from 'mysql2/promise';

// ============================================================================
// USERS & AUTHENTICATION
// ============================================================================

/**
 * Users table row - Core user entity with multi-tenant support
 */

export interface UsersRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  username: string;
  email: string;
  profile_picture_url: string | null;
  password: string;
  role: 'root' | 'admin' | 'employee';
  first_name: string | null;
  last_name: string | null;
  age: number | null;
  employee_id: string | null;
  employee_number: string;
  iban: string | null;
  company: string | null;
  notes: string | null;
  department_id: number | null;
  position: string | null;
  phone: string | null;
  landline: string | null;
  mobile: string | null;
  profile_picture: string | null;
  address: string | null;
  birthday: Date | string | null;
  date_of_birth: Date | string | null;
  hire_date: Date | string | null;
  emergency_contact: string | null;
  editable_fields: object | null;
  notification_preferences: object | null;
  is_active: number; // tinyint(1) - 0 or 1
  is_archived: number; // tinyint(1) - 0 or 1
  status: 'active' | 'inactive';
  last_login: Date | string | null;
  password_reset_token: string | null;
  password_reset_expires: Date | string | null;
  two_factor_secret: string | null;
  two_factor_enabled: number; // tinyint(1) - 0 or 1
  created_at: Date | string;
  updated_at: Date | string;
  archived_at: Date | string | null;
  created_by: number | null;
  availability_status: 'available' | 'unavailable' | 'vacation' | 'sick';
  availability_start: Date | string | null;
  availability_end: Date | string | null;
  availability_notes: string | null;
}

// ============================================================================
// TENANTS & ORGANIZATIONS
// ============================================================================

/**
 * Tenants table row - Multi-tenant company/organization
 */

export interface TenantsRow extends RowDataPacket {
  id: number;
  company_name: string;
  subdomain: string;
  email: string;
  phone: string | null;
  address: string | null;
  status: 'trial' | 'active' | 'suspended' | 'cancelled';
  trial_ends_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  settings: object | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_plan: 'basic' | 'premium' | 'enterprise';
  billing_email: string | null;
  logo_url: string | null;
  primary_color: string;
  created_by: number | null;
  current_plan_id: number | null;
  deletion_status: 'active' | 'marked_for_deletion' | 'suspended' | 'deleting';
  deletion_requested_at: Date | string | null;
  deletion_requested_by: number | null;
}

/**
 * Departments table row - Organizational departments
 */

export interface DepartmentsRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  name: string;
  description: string | null;
  manager_id: number | null;
  area_id: number | null;
  status: 'active' | 'inactive';
  visibility: 'public' | 'private';
  notes: string | null;
  created_by: number | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * Teams table row - Sub-organizational teams
 */

export interface TeamsRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  department_id: number | null;
  name: string;
  description: string | null;
  team_lead_id: number | null;
  is_active: number; // tinyint(1)
  created_at: Date | string;
  updated_at: Date | string;
  created_by: number | null;
}

/**
 * Department Groups table row - Hierarchical department grouping
 */

export interface DepartmentGroupsRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  name: string;
  description: string | null;
  parent_group_id: number | null;
  created_by: number;
  created_at: Date | string;
  updated_at: Date | string;
}

// ============================================================================
// DOCUMENTS
// ============================================================================

/**
 * Documents table row - File/document management
 */

export interface DocumentsRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  user_id: number;
  recipient_type: 'user' | 'team' | 'department' | 'company';
  team_id: number | null;
  department_id: number | null;
  category: 'personal' | 'work' | 'training' | 'general' | 'salary';
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  file_content: Buffer | null;
  mime_type: string | null;
  description: string | null;
  year: number | null;
  month: string | null;
  tags: object | null;
  is_public: number; // tinyint(1)
  is_archived: number; // tinyint(1)
  uploaded_at: Date | string;
  archived_at: Date | string | null;
  expires_at: Date | string | null;
  created_by: number | null;
}

/**
 * Document Permissions table row
 */

export interface DocumentPermissionsRow extends RowDataPacket {
  id: number;
  document_id: number;
  user_id: number | null;
  department_id: number | null;
  team_id: number | null;
  permission_type: 'view' | 'download' | 'edit' | 'delete';
  tenant_id: number;
  created_at: Date | string;
}

/**
 * Document Shares table row - Cross-tenant document sharing
 */

export interface DocumentSharesRow extends RowDataPacket {
  id: number;
  document_id: number;
  owner_tenant_id: number;
  shared_with_tenant_id: number;
  permissions: object | null;
  created_at: Date | string;
  expires_at: Date | string | null;
}

// ============================================================================
// KVP SYSTEM (Continuous Improvement)
// ============================================================================

/**
 * KVP Suggestions table row - Improvement suggestions
 */

export interface KvpSuggestionsRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  title: string;
  description: string;
  category_id: number | null;
  department_id: number | null;
  org_level: 'company' | 'department' | 'team';
  org_id: number;
  submitted_by: number;
  team_id: number | null;
  assigned_to: number | null;
  status: 'new' | 'in_review' | 'approved' | 'implemented' | 'rejected' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  expected_benefit: string | null;
  estimated_cost: string | null;
  actual_savings: number | null; // decimal(10,2)
  implementation_date: Date | string | null;
  rejection_reason: string | null;
  shared_by: number | null;
  shared_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * KVP Comments table row
 */

export interface KvpCommentsRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  suggestion_id: number;
  user_id: number;
  comment: string;
  is_internal: number; // tinyint(1)
  created_at: Date | string;
}

/**
 * KVP Attachments table row
 */

export interface KvpAttachmentsRow extends RowDataPacket {
  id: number;
  suggestion_id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: number;
  uploaded_at: Date | string;
}

/**
 * KVP Categories table row
 */

export interface KvpCategoriesRow extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  created_at: Date | string;
}

/**
 * KVP Votes table row - Voting on suggestions
 */

export interface KvpVotesRow extends RowDataPacket {
  id: number;
  suggestion_id: number;
  user_id: number;
  vote_type: 'up' | 'down';
  tenant_id: number;
  created_at: Date | string;
}

// ============================================================================
// SURVEYS
// ============================================================================

/**
 * Surveys table row - Survey/poll management
 */

export interface SurveysRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  title: string;
  description: string | null;
  type: 'feedback' | 'satisfaction' | 'poll' | 'assessment' | 'other';
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  is_anonymous: number; // tinyint(1)
  is_mandatory: number; // tinyint(1)
  allow_multiple_responses: number; // tinyint(1)
  start_date: Date | string | null;
  end_date: Date | string | null;
  created_by: number;
  notification_sent: number; // tinyint(1)
  reminder_sent: number; // tinyint(1)
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * Survey Questions table row
 */

export interface SurveyQuestionsRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  survey_id: number;
  question_text: string;
  question_type:
    | 'single_choice'
    | 'multiple_choice'
    | 'text'
    | 'rating'
    | 'scale'
    | 'yes_no'
    | 'date'
    | 'number';
  is_required: number; // tinyint(1)
  options: object | null;
  validation_rules: object | null;
  order_index: number;
  help_text: string | null;
  created_at: Date | string;
}

/**
 * Survey Responses table row - User responses to surveys
 */

export interface SurveyResponsesRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  survey_id: number;
  user_id: number | null;
  session_id: string | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  started_at: Date | string;
  completed_at: Date | string | null;
  ip_address: string | null;
  user_agent: string | null;
}

/**
 * Survey Answers table row - Individual question answers
 */

export interface SurveyAnswersRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  response_id: number;
  question_id: number;
  answer_text: string | null;
  answer_options: object | null;
  answer_number: number | null; // decimal(10,2)
  answer_date: Date | string | null;
  created_at: Date | string;
}

/**
 * Survey Participants table row - Survey invitations
 */

export interface SurveyParticipantsRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  survey_id: number;
  user_id: number;
  invited_at: Date | string;
  reminder_sent_at: Date | string | null;
  completed: number; // tinyint(1)
}

// ============================================================================
// CALENDAR
// ============================================================================

/**
 * Calendar Events table row - Event/meeting management
 */

export interface CalendarEventsRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  user_id: number;
  title: string;
  description: string | null;
  location: string | null;
  start_date: Date | string;
  end_date: Date | string;
  type: 'meeting' | 'training' | 'other';
  status: 'confirmed' | 'tentative' | 'cancelled';
  is_private: number; // tinyint(1)
  all_day: number; // tinyint(1)
  org_level: 'company' | 'department' | 'team' | 'personal';
  department_id: number | null;
  team_id: number | null;
  org_id: number | null;
  reminder_minutes: number | null;
  color: string;
  recurrence_rule: string | null;
  parent_event_id: number | null;
  created_at: Date | string;
  updated_at: Date | string;
  allow_attendees: number; // tinyint(1)
  requires_response: number; // tinyint(1)
  created_by_role: 'admin' | 'lead' | 'user';
}

/**
 * Calendar Attendees table row - Event participants
 */

export interface CalendarAttendeesRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  event_id: number;
  user_id: number;
  response_status: 'pending' | 'accepted' | 'declined' | 'tentative';
  responded_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * Calendar Recurring Patterns table row - Recurring event rules
 */

export interface CalendarRecurringPatternsRow extends RowDataPacket {
  id: number;
  event_id: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval_value: number;
  days_of_week: string | null;
  end_date: Date | string | null;
  tenant_id: number;
}

// ============================================================================
// MESSAGING & CHAT
// ============================================================================

/**
 * Conversations table row - Chat conversations (legacy)
 */

export interface ConversationsRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  name: string | null;
  is_group: number; // tinyint(1)
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * Conversation Participants table row
 */

export interface ConversationParticipantsRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  conversation_id: number;
  user_id: number;
  joined_at: Date | string;
  is_admin: number; // tinyint(1)
  last_read_message_id: number | null;
  last_read_at: Date | string | null;
}

/**
 * Messages table row - Chat messages (legacy)
 */

export interface MessagesRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  is_system: number; // tinyint(1)
  created_at: Date | string;
  deleted_at: Date | string | null;
}

/**
 * Chat Channels table row - Modern chat channels
 */

export interface ChatChannelsRow extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  type: 'public' | 'private' | 'direct';
  visibility_scope: 'company' | 'department' | 'team';
  target_id: number | null;
  created_by: number;
  tenant_id: number;
  is_archived: number; // tinyint(1)
  archived_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * Chat Messages table row - Modern chat messages
 */

export interface ChatMessagesRow extends RowDataPacket {
  id: number;
  channel_id: number;
  sender_id: number;
  content: string;
  type: 'text' | 'file' | 'system';
  reply_to_id: number | null;
  is_edited: number; // tinyint(1)
  edited_at: Date | string | null;
  is_deleted: number; // tinyint(1)
  deleted_at: Date | string | null;
  is_pinned: number; // tinyint(1)
  tenant_id: number;
  created_at: Date | string;
}

/**
 * Chat Message Read Receipts table row
 */

export interface ChatMessageReadReceiptsRow extends RowDataPacket {
  id: number;
  message_id: number;
  user_id: number;
  channel_id: number;
  read_at: Date | string;
  tenant_id: number;
}

// ============================================================================
// BLACKBOARD
// ============================================================================

/**
 * Blackboard Entries table row - Company announcements
 */

export interface BlackboardEntriesRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  org_level: 'company' | 'department' | 'team';
  org_id: number | null;
  author_id: number;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  color: string;
  category: string | null;
  valid_from: Date | string | null;
  valid_until: Date | string | null;
  expires_at: Date | string | null;
  is_pinned: number; // tinyint(1)
  views: number;
  is_active: number; // tinyint(1)
  status: 'active' | 'archived';
  requires_confirmation: number; // tinyint(1)
  attachment_count: number;
  attachment_path: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * Blackboard Attachments table row
 */

export interface BlackboardAttachmentsRow extends RowDataPacket {
  id: number;
  entry_id: number;
  filename: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  file_path: string;
  uploaded_by: number;
  uploaded_at: Date | string;
}

/**
 * Blackboard Confirmations table row - User confirmations of announcements
 */

export interface BlackboardConfirmationsRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  entry_id: number;
  user_id: number;
  confirmed_at: Date | string;
}

// ============================================================================
// SHIFTS & SCHEDULING
// ============================================================================

/**
 * Shifts table row - Work shift scheduling
 */

export interface ShiftsRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  area_id: number | null;
  plan_id: number | null;
  user_id: number;
  template_id: number | null;
  date: Date | string;
  start_time: Date | string;
  end_time: Date | string;
  title: string | null;
  required_employees: number;
  actual_start: Date | string | null;
  actual_end: Date | string | null;
  break_minutes: number;
  status: 'planned' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  type:
    | 'regular'
    | 'overtime'
    | 'standby'
    | 'vacation'
    | 'sick'
    | 'holiday'
    | 'early'
    | 'late'
    | 'night'
    | 'day'
    | 'flexible'
    | 'F'
    | 'S'
    | 'N';
  notes: string | null;
  department_id: number;
  team_id: number | null;
  machine_id: number | null;
  created_by: number | null;
  created_at: Date | string;
  updated_at: Date | string;
  metadata: object | null;
}

/**
 * Shift Assignments table row - Assignment of employees to shifts
 */

export interface ShiftAssignmentsRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  shift_id: number;
  user_id: number;
  assignment_type: 'assigned' | 'requested' | 'available' | 'unavailable';
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  assigned_by: number | null;
  assigned_at: Date | string;
  response_at: Date | string | null;
  notes: string | null;
  overtime_hours: number; // decimal(4,2)
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * Shift Templates table row - Reusable shift templates
 */

export interface ShiftTemplatesRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  name: string;
  start_time: string; // time
  end_time: string; // time
  break_minutes: number;
  color: string;
  is_night_shift: number; // tinyint(1)
  is_active: number; // tinyint(1)
  created_at: Date | string;
  updated_at: Date | string;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * Notifications table row - System notifications
 */

export interface NotificationsRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'medium' | 'high' | 'urgent';
  recipient_id: number | null;
  recipient_type: 'user' | 'department' | 'team' | 'all';
  action_url: string | null;
  action_label: string | null;
  metadata: object | null;
  scheduled_for: Date | string | null;
  created_by: number;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * Notification Preferences table row - User notification settings
 */

export interface NotificationPreferencesRow extends RowDataPacket {
  id: number;
  user_id: number;
  tenant_id: number;
  notification_type: string;
  email_notifications: number; // tinyint(1)
  push_notifications: number; // tinyint(1)
  sms_notifications: number; // tinyint(1)
  preferences: object | null;
  email_enabled: number; // tinyint(1)
  push_enabled: number; // tinyint(1)
  in_app_enabled: number; // tinyint(1)
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  quiet_hours_start: string | null; // time
  quiet_hours_end: string | null; // time
  created_at: Date | string;
  updated_at: Date | string;
}

// ============================================================================
// AUDIT & LOGGING
// ============================================================================

/**
 * Audit Trail table row - System-wide audit log
 */

export interface AuditTrailRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  user_id: number;
  user_name: string | null;
  user_role: string | null;
  action: string;
  resource_type: string;
  resource_id: number | null;
  resource_name: string | null;
  changes: object | null;
  ip_address: string | null;
  user_agent: string | null;
  status: 'success' | 'failure';
  error_message: string | null;
  created_at: Date | string;
}

/**
 * Admin Logs table row - Admin activity log
 */

export interface AdminLogsRow extends RowDataPacket {
  id: number;
  tenant_id: number | null;
  user_id: number;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date | string;
}

/**
 * Root Logs table row - Root user activity log
 */

export interface RootLogsRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  user_id: number;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: string | null;
  old_values: object | null;
  new_values: object | null;
  ip_address: string | null;
  user_agent: string | null;
  was_role_switched: number; // tinyint(1)
  created_at: Date | string;
}

// ============================================================================
// PERMISSIONS
// ============================================================================

/**
 * Admin Department Permissions table row
 */

export interface AdminDepartmentPermissionsRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  admin_user_id: number;
  department_id: number;
  can_read: number; // tinyint(1)
  can_write: number; // tinyint(1)
  can_delete: number; // tinyint(1)
  assigned_by: number;
  assigned_at: Date | string;
}

/**
 * Admin Group Permissions table row
 */

export interface AdminGroupPermissionsRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  admin_user_id: number;
  group_id: number;
  can_read: number; // tinyint(1)
  can_write: number; // tinyint(1)
  can_delete: number; // tinyint(1)
  assigned_by: number;
  assigned_at: Date | string;
}

// ============================================================================
// NOTE: This file contains the 50+ most frequently used tables
// Additional tables (75+ more) can be added as needed:
// - areas, machines, machine_*
// - plans, features, tenant_*
// - oauth_tokens, api_keys, user_sessions
// - shift_swap_requests, shift_favorites, etc.
// - email_queue, email_templates
// - And many more...
//
// Add more interfaces following the same pattern as above
// ============================================================================

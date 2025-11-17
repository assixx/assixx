/**
 * Query Result Types - Common SQL Query Result Patterns
 *
 * This file contains type definitions for frequent SQL query patterns like:
 * - COUNT(*) queries
 * - SUM/AVG/MIN/MAX aggregates
 * - Partial SELECT queries (not all columns)
 * - Joined query results
 * - Grouped query results
 *
 * Best Practice 2025: Type ALL query results, even aggregates!
 *
 * USAGE EXAMPLE:
 * ```typescript
 * import { CountResult, UserWithDepartment } from './query-results.types.js';
 *
 * // COUNT query
 * const [rows] = await connection.execute<CountResult[]>(
 *   'SELECT COUNT(*) as count FROM users WHERE tenant_id = ?',
 *   [tenantId]
 * );
 * const userCount = rows[0].count; //  Typed as number!
 *
 * // JOIN query
 * const [users] = await connection.execute<UserWithDepartment[]>(
 *   'SELECT u.*, d.name as department_name FROM users u LEFT JOIN departments d...',
 *   [tenantId]
 * );
 * console.log(users[0].department_name); //  Typed!
 * ```
 */
import { RowDataPacket } from 'mysql2/promise';

// ============================================================================
// COMMON AGGREGATES
// ============================================================================

/**
 * Result of COUNT(*) queries
 * Use when: SELECT COUNT(*) as count FROM table
 */
export interface CountResult extends RowDataPacket {
  count: number;
}

/**
 * Result of COUNT(*) with alias 'total'
 * Use when: SELECT COUNT(*) as total FROM table
 */
export interface TotalCountResult extends RowDataPacket {
  total: number;
}

/**
 * Result of SUM queries
 * Use when: SELECT SUM(column) as total FROM table
 */
export interface SumResult extends RowDataPacket {
  total: number | null; // NULL if no rows
}

/**
 * Result of AVG queries
 * Use when: SELECT AVG(column) as average FROM table
 */
export interface AverageResult extends RowDataPacket {
  average: number | null; // NULL if no rows
}

/**
 * Result of MIN/MAX queries
 * Use when: SELECT MIN(column) as min_value, MAX(column) as max_value FROM table
 */
export interface MinMaxResult extends RowDataPacket {
  min_value: number | null;
  max_value: number | null;
}

/**
 * Result of simple ID query
 * Use when: SELECT id FROM table WHERE...
 */
export interface IdResult extends RowDataPacket {
  id: number;
}

/**
 * Result of EXISTS check
 * Use when: SELECT 1 as exists FROM table WHERE... LIMIT 1
 */
export interface ExistsResult extends RowDataPacket {
  exists: number; // 1 if exists, undefined if not (check length)
}

// ============================================================================
// GROUPED AGGREGATES
// ============================================================================

/**
 * Count grouped by single field
 * Use when: SELECT field, COUNT(*) as count FROM table GROUP BY field
 * Note: For specific fields, use StatusCountResult, TypeCountResult, etc.
 *
 * DEPRECATED: Use specific interfaces like StatusCountResult instead.
 * Generic index signatures are incompatible with RowDataPacket.
 */
export interface GroupedCountResult extends RowDataPacket {
  count: number;
  // Add specific fields as needed - avoid generic index signatures
}

/**
 * Status count result - common pattern
 * Use when: SELECT status, COUNT(*) as count FROM table GROUP BY status
 */
export interface StatusCountResult extends RowDataPacket {
  status: string;
  count: number;
}

/**
 * Type count result - common pattern
 * Use when: SELECT type, COUNT(*) as count FROM table GROUP BY type
 */
export interface TypeCountResult extends RowDataPacket {
  type: string;
  count: number;
}

/**
 * Action count result - for audit trails
 * Use when: SELECT action, COUNT(*) as count FROM audit_trail GROUP BY action
 */
export interface ActionCountResult extends RowDataPacket {
  action: string;
  count: number;
}

/**
 * Priority count result - for grouped priority stats
 * Use when: SELECT priority, COUNT(*) as count FROM table GROUP BY priority
 */
export interface PriorityCountResult extends RowDataPacket {
  priority: string;
  count: number;
}

/**
 * Date count result - for time-based aggregates
 * Use when: SELECT DATE(created_at) as date, COUNT(*) as count FROM table GROUP BY DATE(created_at)
 */
export interface DateCountResult extends RowDataPacket {
  date: Date | string;
  count: number;
}

/**
 * Read rate result - for notification/message statistics
 * Use when: SELECT COUNT(DISTINCT n.id) as total_notifications, COUNT(DISTINCT r.id) as read_notifications
 */
export interface ReadRateResult extends RowDataPacket {
  total_notifications: number;
  read_notifications: number;
}

// ============================================================================
// USER QUERIES
// ============================================================================

/**
 * User with department name (joined query)
 * Use when: SELECT u.*, d.name as department_name FROM users u LEFT JOIN departments d...
 */
export interface UserWithDepartment extends RowDataPacket {
  id: number;
  tenant_id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  department_id: number | null;
  department_name: string | null; // FROM departments
}

/**
 * Minimal user info (partial select)
 * Use when: SELECT id, username, email, role FROM users
 */
export interface UserMinimal extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  role: string;
}

/**
 * User with full name (computed field)
 * Use when: SELECT id, CONCAT(first_name, ' ', last_name) as full_name FROM users
 */
export interface UserWithFullName extends RowDataPacket {
  id: number;
  full_name: string | null;
}

/**
 * User department ID result
 * Use when: SELECT department_id FROM users WHERE id = ?
 */
export interface UserDepartmentIdResult extends RowDataPacket {
  department_id: number | null;
}

// ============================================================================
// PERMISSION QUERIES
// ============================================================================

/**
 * Permission check result
 * Use when: SELECT can_read, can_write, can_delete FROM admin_department_permissions
 */
export interface PermissionCheckResult extends RowDataPacket {
  can_read: number; // tinyint(1) - 0 or 1
  can_write: number; // tinyint(1) - 0 or 1
  can_delete: number; // tinyint(1) - 0 or 1
}

/**
 * Role permission result
 * Use when: SELECT role, can_read, can_write FROM...
 */
export interface RolePermissionResult extends RowDataPacket {
  role: string;
  can_read: number;
  can_write: number;
  can_delete: number;
}

// ============================================================================
// DEPARTMENT & DEPARTMENT GROUP QUERIES
// ============================================================================

/**
 * Department partial result (id, name, description only)
 * Use when: SELECT id, name, description FROM departments
 */
export interface DepartmentPartialResult extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
}

/**
 * Department with permission fields
 * Use when: SELECT d.*, adp.can_read, adp.can_write, adp.can_delete FROM departments d JOIN admin_department_permissions adp...
 */
export interface DepartmentWithPermissionResult extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  can_read: number; // tinyint(1) - 0 or 1
  can_write: number; // tinyint(1) - 0 or 1
  can_delete: number; // tinyint(1) - 0 or 1
}

/**
 * Department count result (alias dept_count)
 * Use when: SELECT COUNT(*) as dept_count FROM departments
 */
export interface DeptCountResult extends RowDataPacket {
  dept_count: number;
}

/**
 * Department group partial result (without full details)
 * Use when: SELECT id, name, description, parent_group_id FROM department_groups
 */
export interface DepartmentGroupPartialResult extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  parent_group_id: number | null;
}

/**
 * Department with group assignment
 * Use when: SELECT dgm.group_id, d.id as dept_id, d.name as dept_name, d.description as dept_desc
 */
export interface DepartmentWithGroupIdResult extends RowDataPacket {
  group_id: number;
  dept_id: number;
  dept_name: string;
  dept_desc: string | null;
}

/**
 * Parent group ID result
 * Use when: SELECT parent_group_id FROM department_groups WHERE...
 */
export interface ParentGroupIdResult extends RowDataPacket {
  parent_group_id: number | null;
}

// ============================================================================
// STATISTICS & METRICS
// ============================================================================

/**
 * Employee metrics result
 * Use when querying employee statistics
 */
export interface EmployeeMetricsResult extends RowDataPacket {
  total_employees: number;
  active_employees: number;
  archived_employees: number;
}

/**
 * Department metrics result
 * Use when: SELECT department_id, COUNT(*) as member_count FROM users GROUP BY department_id
 */
export interface DepartmentMetricsResult extends RowDataPacket {
  department_id: number;
  department_name: string | null;
  member_count: number;
}

/**
 * KVP statistics result
 * Use when querying KVP suggestion statistics
 */
export interface KvpStatsResult extends RowDataPacket {
  status: string;
  priority: string | null;
  count: number;
  total_savings: number | null; // SUM(actual_savings)
}

/**
 * KVP suggestion details (partial)
 * Use when: SELECT tenant_id, department_id, org_level, org_id, submitted_by, status, shared_by FROM kvp_suggestions
 */
export interface KvpSuggestionDetailsResult extends RowDataPacket {
  tenant_id: number;
  department_id: number | null;
  org_level: string; // 'company' | 'department'
  org_id: number | null;
  submitted_by: number;
  status?: string; // Optional - not always selected
  shared_by?: number | null; // Optional - not always selected
}

/**
 * Total savings result
 * Use when: SELECT COALESCE(SUM(actual_savings), 0) as total_savings FROM kvp_suggestions
 */
export interface TotalSavingsResult extends RowDataPacket {
  total_savings: number | string; // Can be string from SUM
}

/**
 * Survey statistics result
 * Use when querying survey response statistics
 */
export interface SurveyStatsResult extends RowDataPacket {
  survey_id: number;
  total_participants: number;
  completed_responses: number;
  in_progress_responses: number;
  completion_rate: number; // Computed field
}

/**
 * Survey flags result (allow_multiple_responses, is_anonymous, allow_edit_responses)
 * Use when: SELECT allow_multiple_responses FROM surveys WHERE id = ?
 */
export interface SurveyFlagsResult extends RowDataPacket {
  allow_multiple_responses?: number; // tinyint(1)
  is_anonymous?: number; // tinyint(1)
  allow_edit_responses?: number; // tinyint(1)
  status?: string; // Optional - not always selected
}

/**
 * Survey answer with question details (joined query)
 * Use when: SELECT sa.*, sq.question_type, sq.question_text FROM survey_answers sa JOIN survey_questions sq
 */
export interface SurveyAnswerWithQuestionResult extends RowDataPacket {
  id: number;
  response_id: number;
  question_id: number;
  answer_text: string | null;
  answer_number: number | null;
  answer_date: Date | string | null;
  answer_options: number[] | null; // JSON type - parsed by mysql2
  question_type?: string; // Optional - from join
  question_text?: string; // Optional - from join
  tenant_id: number;
}

/**
 * Survey response with user info (joined query)
 * Use when: SELECT sr.*, u.first_name, u.last_name, u.username FROM survey_responses sr LEFT JOIN users u
 */
export interface SurveyResponseWithUserResult extends RowDataPacket {
  id: number;
  survey_id: number;
  user_id: number;
  tenant_id: number;
  started_at: Date | string;
  completed_at: Date | string | null;
  status: string; // 'in_progress' | 'completed' | 'abandoned'
  first_name?: string | null; // Optional - from LEFT JOIN
  last_name?: string | null; // Optional - from LEFT JOIN
  username?: string | null; // Optional - from LEFT JOIN
}

/**
 * Survey export result (full data for CSV/Excel)
 * Use when: SELECT sr.id as response_id, u.first_name, u.last_name, u.username, sr.completed_at, sq.question_text, sa.*
 */
export interface SurveyExportResult extends RowDataPacket {
  response_id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  completed_at: Date | string | null;
  question_text: string;
  answer_text: string | null;
  answer_number: number | null;
  answer_date: Date | string | null;
  answer_options: string | null; // JSON string
}

// ============================================================================
// AUDIT & LOGGING
// ============================================================================

/**
 * Audit trail summary result
 * Use when: SELECT user_id, user_name, COUNT(*) as count FROM audit_trail GROUP BY user_id
 */
export interface AuditSummaryResult extends RowDataPacket {
  user_id: number;
  user_name: string | null;
  count: number;
}

/**
 * Resource type count result
 * Use when: SELECT resource_type, COUNT(*) as count FROM audit_trail GROUP BY resource_type
 */
export interface ResourceTypeCountResult extends RowDataPacket {
  resource_type: string;
  count: number;
}

// ============================================================================
// NOTIFICATION QUERIES
// ============================================================================

/**
 * Unread notification count
 * Use when: SELECT COUNT(*) as unread_count FROM notifications n LEFT JOIN notification_read_status r...
 */
export interface UnreadCountResult extends RowDataPacket {
  unread_count: number;
}

/**
 * Notification with read status
 * Use when joining notifications with read_status
 */
export interface NotificationWithReadStatus extends RowDataPacket {
  id: number;
  title: string;
  message: string;
  type: string;
  created_at: Date | string;
  is_read: number; // tinyint(1) from join
  read_at: Date | string | null;
}

// ============================================================================
// DOCUMENT QUERIES
// ============================================================================

/**
 * Document with recipient info
 * Use when: SELECT d.*, u.username as created_by_name FROM documents d LEFT JOIN users u...
 */
export interface DocumentWithCreator extends RowDataPacket {
  id: number;
  filename: string;
  category: string;
  uploaded_at: Date | string;
  created_by: number | null;
  created_by_name: string | null; // FROM users
}

/**
 * Document statistics
 * Use when: SELECT category, COUNT(*) as count, SUM(file_size) as total_size FROM documents GROUP BY category
 */
export interface DocumentStatsResult extends RowDataPacket {
  category: string;
  count: number;
  total_size: number; // SUM(file_size)
}

// ============================================================================
// CALENDAR QUERIES
// ============================================================================

/**
 * Event with attendee count
 * Use when: SELECT e.*, COUNT(a.id) as attendee_count FROM calendar_events e LEFT JOIN calendar_attendees a...
 */
export interface EventWithAttendeeCount extends RowDataPacket {
  id: number;
  title: string;
  start_date: Date | string;
  end_date: Date | string;
  attendee_count: number; // COUNT from join
}

/**
 * Calendar event minimal (for lists)
 * Use when: SELECT id, title, start_date, end_date, type FROM calendar_events
 */
export interface EventMinimal extends RowDataPacket {
  id: number;
  title: string;
  start_date: Date | string;
  end_date: Date | string;
  type: string;
}

// ============================================================================
// SHIFT QUERIES
// ============================================================================

/**
 * Shift with user info
 * Use when: SELECT s.*, u.first_name, u.last_name FROM shifts s LEFT JOIN users u...
 */
export interface ShiftWithUser extends RowDataPacket {
  id: number;
  date: Date | string;
  start_time: Date | string;
  end_time: Date | string;
  user_id: number;
  first_name: string | null; // FROM users
  last_name: string | null; // FROM users
}

/**
 * Shift statistics
 * Use when: SELECT type, COUNT(*) as count FROM shifts GROUP BY type
 */
export interface ShiftStatsResult extends RowDataPacket {
  type: string;
  count: number;
  total_hours: number | null; // Computed field
}

// ============================================================================
// CHAT QUERIES
// ============================================================================

/**
 * Conversation with last message
 * Use when: SELECT c.*, m.content as last_message, m.created_at as last_message_at FROM conversations c LEFT JOIN...
 */
export interface ConversationWithLastMessage extends RowDataPacket {
  id: number;
  name: string | null;
  is_group: number;
  last_message: string | null; // FROM latest message
  last_message_at: Date | string | null;
  unread_count: number | null; // Computed
}

/**
 * Message with sender info
 * Use when: SELECT m.*, u.username as sender_name FROM messages m LEFT JOIN users u...
 */
export interface MessageWithSender extends RowDataPacket {
  id: number;
  content: string;
  sender_id: number;
  sender_name: string | null; // FROM users
  created_at: Date | string;
}

// ============================================================================
// GENERIC PARTIAL TYPES
// ============================================================================

/**
 * Generic ID and Name result
 * Use when: SELECT id, name FROM any_table
 */
export interface IdNameResult extends RowDataPacket {
  id: number;
  name: string;
}

/**
 * Generic timestamped entity
 * Use when: SELECT id, created_at, updated_at FROM any_table
 */
export interface TimestampedEntity extends RowDataPacket {
  id: number;
  created_at: Date | string;
  updated_at: Date | string;
}

// ============================================================================
// HELPER UTILITY TYPES
// ============================================================================

/**
 * Marks all properties of T as potentially coming from SQL (Date | string for dates)
 */
export type SqlResult<T> = {
  [K in keyof T]: T[K] extends Date ? Date | string : T[K];
};

/**
 * Makes specified properties nullable (for LEFT JOIN results)
 */
export type Nullable<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: T[P] | null;
};

/**
 * Picks only specified properties (for partial SELECTs)
 */
export type PartialSelect<T, K extends keyof T> = Pick<T, K>;

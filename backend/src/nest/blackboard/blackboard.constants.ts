/**
 * Blackboard Constants
 *
 * Shared constants for the blackboard module.
 * No runtime dependencies - pure static values.
 */

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

/**
 * Allowed columns for sorting blackboard entries.
 * Used to prevent SQL injection in ORDER BY clauses.
 */
export const ALLOWED_SORT_COLUMNS = new Set([
  'created_at',
  'updated_at',
  'title',
  'priority',
  'expires_at',
  'is_active',
]);

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ERROR_ENTRY_NOT_FOUND = 'Entry not found';

// ============================================================================
// SQL QUERIES
// ============================================================================

/**
 * Base query for fetching blackboard entries with all joins.
 * Parameters: $1 = userId, $2 = tenantId, $3 = isActive
 */
export const FETCH_ENTRIES_BASE_QUERY = `
  SELECT e.id, e.uuid, e.tenant_id, e.title, e.content, e.org_level, e.org_id, e.author_id,
         e.expires_at, e.priority, e.color, e.is_active,
         e.created_at, e.updated_at, e.uuid_created_at,
         u.username as author_name,
         u.first_name as author_first_name,
         u.last_name as author_last_name,
         CONCAT(u.first_name, ' ', u.last_name) as author_full_name,
         COALESCE(c.is_confirmed, false) as is_confirmed,
         c.confirmed_at as confirmed_at,
         c.first_seen_at as first_seen_at,
         (SELECT COUNT(*)::integer FROM documents WHERE blackboard_entry_id = e.id) as attachment_count,
         (SELECT COUNT(*)::integer FROM blackboard_comments WHERE entry_id = e.id) as comment_count
  FROM blackboard_entries e
  LEFT JOIN users u ON e.author_id = u.id AND u.tenant_id = e.tenant_id
  LEFT JOIN blackboard_confirmations c ON e.id = c.entry_id AND c.user_id = $1
  WHERE e.tenant_id = $2 AND e.is_active = $3
`;

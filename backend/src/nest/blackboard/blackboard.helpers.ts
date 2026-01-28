/**
 * Blackboard Helpers
 *
 * Pure functions for data transformation and validation.
 * No dependencies on NestJS or database - stateless utilities.
 */
import { dbToApi } from '../../utils/fieldMapping.js';
import { ALLOWED_SORT_COLUMNS } from './blackboard.constants.js';
import type {
  BlackboardComment,
  DbBlackboardComment,
  DbBlackboardEntry,
  EntryFilters,
  NormalizedFilters,
} from './blackboard.types.js';

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate sort column to prevent SQL injection.
 * Returns 'created_at' if invalid column provided.
 */
export function validateSortColumn(sortBy: string): string {
  if (ALLOWED_SORT_COLUMNS.has(sortBy)) {
    return sortBy;
  }
  return 'created_at';
}

/**
 * Validate sort direction to prevent SQL injection.
 * Returns 'DESC' if invalid direction provided.
 */
export function validateSortDirection(sortDir: string): 'ASC' | 'DESC' {
  const upper = sortDir.toUpperCase();
  if (upper === 'ASC' || upper === 'DESC') {
    return upper;
  }
  return 'DESC';
}

// ============================================================================
// NORMALIZATION HELPERS
// ============================================================================

/**
 * Normalize filter values with defaults applied.
 * Converts optional/undefined values to concrete defaults.
 */
export function normalizeEntryFilters(
  filters: EntryFilters,
): NormalizedFilters {
  return {
    isActive: filters.isActive ?? 1, // Default to active (1)
    filter: filters.filter ?? 'all',
    search: filters.search ?? '',
    page: filters.page ?? 1,
    limit: filters.limit ?? 10,
    sortBy: validateSortColumn(filters.sortBy ?? 'created_at'),
    sortDir: validateSortDirection(filters.sortDir ?? 'DESC'),
    priority: filters.priority,
  };
}

// ============================================================================
// CONTENT PROCESSING
// ============================================================================

/**
 * Process entry content - convert Buffer to string.
 * Handles both Node.js Buffer and JSON-serialized buffer format.
 * Mutates the entry object in place.
 */
export function processEntryContent(entry: DbBlackboardEntry): void {
  if (Buffer.isBuffer(entry.content)) {
    entry.content = entry.content.toString('utf8');
    return;
  }

  const content = entry.content;
  if (
    typeof content === 'object' &&
    'type' in content &&
    Array.isArray(content.data)
  ) {
    entry.content = Buffer.from(content.data).toString('utf8');
  }
}

// ============================================================================
// TRANSFORMATION HELPERS
// ============================================================================

/**
 * Transform database entry to API response format.
 * Converts snake_case to camelCase and formats dates.
 */
export function transformEntry(
  entry: DbBlackboardEntry,
): Record<string, unknown> {
  const transformed = dbToApi(entry as unknown as Record<string, unknown>);

  transformed['isConfirmed'] = Boolean(entry.is_confirmed);
  transformed['confirmedAt'] = entry.confirmed_at?.toISOString() ?? null;
  transformed['firstSeenAt'] = entry.first_seen_at?.toISOString() ?? null;

  if (entry.author_full_name !== undefined && entry.author_full_name !== '') {
    transformed['authorFullName'] = entry.author_full_name;
  }
  if (entry.author_first_name !== undefined && entry.author_first_name !== '') {
    transformed['authorFirstName'] = entry.author_first_name;
  }
  if (entry.author_last_name !== undefined && entry.author_last_name !== '') {
    transformed['authorLastName'] = entry.author_last_name;
  }

  delete transformed['is_confirmed'];
  delete transformed['confirmed_at'];
  delete transformed['first_seen_at'];

  return transformed;
}

/**
 * Transform database comment to API response format.
 */
export function transformComment(
  comment: DbBlackboardComment,
): BlackboardComment {
  const result: BlackboardComment = {
    id: comment.id,
    entryId: comment.entry_id,
    userId: comment.user_id,
    comment: comment.comment,
    isInternal: Boolean(comment.is_internal),
    createdAt: comment.created_at.toISOString(),
  };

  if (comment.user_first_name !== undefined) {
    result.firstName = comment.user_first_name;
  }
  if (comment.user_last_name !== undefined) {
    result.lastName = comment.user_last_name;
  }
  if (comment.user_role !== undefined) {
    result.role = comment.user_role;
  }
  if (comment.user_profile_picture !== undefined) {
    result.profilePicture = comment.user_profile_picture;
  }

  return result;
}

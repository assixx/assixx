/**
 * Calendar Helpers
 *
 * Pure functions for calendar module - no DI dependencies.
 * Includes: mappers, transforms, recurrence calculation, visibility clause builder.
 */
import type { OrganizationalScope } from '../hierarchy-permission/organizational-scope.types.js';
import type {
  CalendarEventResponse,
  CalendarMemberships,
  DbCalendarEvent,
  EventFilters,
} from './calendar.types.js';

// ============================================
// Constants
// ============================================

export const ERROR_EVENT_NOT_FOUND = 'Event not found';

export const ALLOWED_SORT_COLUMNS = new Set([
  'start_date',
  'end_date',
  'title',
  'created_at',
  'updated_at',
]);

export const SORT_BY_MAP: Record<string, string> = {
  startDate: 'start_date',
  endDate: 'end_date',
  title: 'title',
  createdAt: 'created_at',
};

// ============================================
// Visibility Clause Builder (Scope + Memberships)
// ============================================

/**
 * Build SQL visibility clause using OrganizationalScope + CalendarMemberships.
 *
 * Replaces the old 11-EXISTS pattern with pre-resolved arrays via ANY().
 * Calendar Visibility = Management-Scope ∪ Membership-Scope + personal + attendee.
 *
 * @param scope - User's organizational scope (from ScopeService)
 * @param memberships - User's dept/team memberships (from CalendarPermissionService)
 * @param userId - For personal events + attendee check
 * @param startIdx - Next available SQL parameter index ($N)
 * @returns clause (empty string for full scope) + params array
 */
export function buildVisibilityClause(
  scope: OrganizationalScope,
  memberships: CalendarMemberships,
  userId: number,
  startIdx: number,
): { clause: string; params: unknown[] } {
  if (scope.type === 'full') {
    return { clause: '', params: [] };
  }

  // Merge scope + memberships — deduplicated via Set
  const areaIds = scope.areaIds;
  const deptIds = [...new Set([...scope.departmentIds, ...memberships.departmentIds])];
  const teamIds = [...new Set([...scope.teamIds, ...memberships.teamIds])];

  // PostgreSQL ANY() requires non-empty arrays — [0] matches nothing
  const toSafeArray = (ids: number[]): number[] => (ids.length > 0 ? ids : [0]);

  const areaIdx = startIdx;
  const deptIdx = startIdx + 1;
  const teamIdx = startIdx + 2;
  const userIdx = startIdx + 3;

  const params: unknown[] = [
    toSafeArray(areaIds),
    toSafeArray(deptIds),
    toSafeArray(teamIds),
    userId,
  ];

  const clause = `(
    e.org_level = 'company'
    OR (e.org_level = 'area' AND e.area_id = ANY($${areaIdx}))
    OR (e.org_level = 'department' AND e.department_id = ANY($${deptIdx}))
    OR (e.org_level = 'team' AND e.team_id = ANY($${teamIdx}))
    OR (e.org_level = 'personal' AND e.user_id = $${userIdx})
    OR EXISTS (SELECT 1 FROM calendar_attendees ca WHERE ca.event_id = e.id AND ca.user_id = $${userIdx})
  )`;

  return { clause, params };
}

// ============================================
// Mappers & Transforms
// ============================================

/** Convert DB event row to API response format */
export function dbToApiEvent(event: DbCalendarEvent): CalendarEventResponse {
  return {
    id: event.id,
    uuid: event.uuid,
    tenantId: event.tenant_id,
    userId: event.user_id,
    title: event.title,
    description: event.description,
    location: event.location,
    startTime: event.start_date,
    endTime: event.end_date,
    allDay: event.all_day === 1 || event.all_day === true,
    type: event.type,
    status: event.status,
    isPrivate: event.is_private === 1 || event.is_private === true,
    reminderMinutes: event.reminder_minutes,
    color: event.color,
    recurrenceRule: event.recurrence_rule,
    parentEventId: event.parent_event_id,
    createdAt: event.created_at,
    updatedAt: event.updated_at,
    creatorName: event.creator_name,
    orgLevel: event.org_level,
    departmentId: event.department_id,
    teamId: event.team_id,
    areaId: event.area_id,
  };
}

/** Clamp and normalize pagination parameters */
export function normalizePagination(filters: EventFilters): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
  return { page, limit, offset: (page - 1) * limit };
}

/** Validate sort column against ALLOWED_SORT_COLUMNS, defaulting to 'start_date' */
export function validateSortColumn(sortBy: string): string {
  return ALLOWED_SORT_COLUMNS.has(sortBy) ? sortBy : 'start_date';
}

// ============================================
// Recurrence Calculation
// ============================================

/** Calculate all recurrence dates based on recurrence settings */
export function calculateRecurrenceDates(
  startDate: Date,
  recurrence: string | undefined,
  endType: string | undefined,
  count: number | undefined,
  untilDate: string | undefined,
): Date[] {
  const dates: Date[] = [new Date(startDate)];

  // No recurrence - return single date
  if (recurrence === undefined) {
    return dates;
  }

  // Determine max occurrences
  const MAX_OCCURRENCES = 52; // Safety limit (1 year of weekly events)
  let maxCount = MAX_OCCURRENCES;

  if (endType === 'after' && count !== undefined) {
    maxCount = Math.min(count, MAX_OCCURRENCES);
  }

  const untilDateObj = untilDate !== undefined ? new Date(untilDate) : null;

  // Generate dates
  let currentDate = new Date(startDate);
  while (dates.length < maxCount) {
    currentDate = addRecurrenceInterval(currentDate, recurrence);

    // Check if we've passed the until date
    if (endType === 'until' && untilDateObj !== null && currentDate > untilDateObj) {
      break;
    }

    dates.push(new Date(currentDate));
  }

  return dates;
}

/** Add one recurrence interval (daily/weekly/monthly/yearly) to date */
export function addRecurrenceInterval(date: Date, recurrence: string): Date {
  const newDate = new Date(date);

  switch (recurrence) {
    case 'daily':
      newDate.setDate(newDate.getDate() + 1);
      break;
    case 'weekly':
      newDate.setDate(newDate.getDate() + 7);
      break;
    case 'monthly':
      newDate.setMonth(newDate.getMonth() + 1);
      break;
    case 'yearly':
      newDate.setFullYear(newDate.getFullYear() + 1);
      break;
    default:
      throw new Error(`Unknown recurrence type: ${recurrence}`);
  }

  return newDate;
}

// ============================================
// Query Helpers
// ============================================

/** Append date range and search ILIKE filters to an SQL WHERE clause */
export function appendDateSearchFilters(
  filters: EventFilters,
  params: unknown[],
  startIndex: number,
): { clause: string; newIndex: number } {
  let clause = '';
  let paramIndex = startIndex;

  if (filters.startDate !== undefined) {
    clause += ` AND e.start_date >= $${paramIndex}`;
    params.push(filters.startDate);
    paramIndex++;
  }
  if (filters.endDate !== undefined) {
    clause += ` AND e.end_date <= $${paramIndex}`;
    params.push(filters.endDate);
    paramIndex++;
  }
  if (filters.search !== undefined && filters.search !== '') {
    clause += ` AND (e.title ILIKE $${paramIndex} OR e.description ILIKE $${paramIndex})`;
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  return { clause, newIndex: paramIndex };
}

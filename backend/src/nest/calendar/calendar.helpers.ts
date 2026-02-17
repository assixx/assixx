/**
 * Calendar Helpers
 *
 * Pure functions for calendar module - no DI dependencies.
 * Includes: mappers, transforms, recurrence calculation, visibility clause builder.
 */
import type {
  CalendarEventResponse,
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

/** SQL query for permission-based event visibility ($1=tenantId, $2=startOfDay, $3=endOfWeek, $4=lastVisited, $5=userId) */
export const PERMISSION_BASED_COUNT_QUERY = `
  SELECT COUNT(DISTINCT e.id) as count
  FROM calendar_events e
  WHERE e.tenant_id = $1
    AND e.start_date >= $2
    AND e.start_date < $3
    AND e.status != 'cancelled'
    AND e.created_at > $4
    AND e.user_id != $5
    AND (
      -- 1. Company level: everyone sees
      e.org_level = 'company'
      -- 2. Area level: check area permissions
      OR (e.org_level = 'area' AND (
        EXISTS (SELECT 1 FROM admin_area_permissions aap
                WHERE aap.admin_user_id = $5 AND aap.area_id = e.area_id AND aap.tenant_id = $1)
        OR EXISTS (SELECT 1 FROM areas a
                   WHERE a.id = e.area_id AND a.area_lead_id = $5 AND a.tenant_id = $1)
        OR EXISTS (SELECT 1 FROM user_departments ud
                   JOIN departments d ON ud.department_id = d.id
                   WHERE ud.user_id = $5 AND ud.tenant_id = $1 AND d.area_id = e.area_id)
      ))
      -- 3. Department level: check department permissions
      OR (e.org_level = 'department' AND (
        EXISTS (SELECT 1 FROM admin_department_permissions adp
                WHERE adp.admin_user_id = $5 AND adp.department_id = e.department_id AND adp.tenant_id = $1)
        OR EXISTS (SELECT 1 FROM departments d
                   WHERE d.id = e.department_id AND d.department_lead_id = $5 AND d.tenant_id = $1)
        OR EXISTS (SELECT 1 FROM user_departments ud
                   WHERE ud.user_id = $5 AND ud.department_id = e.department_id AND ud.tenant_id = $1)
        OR EXISTS (SELECT 1 FROM departments d
                   JOIN admin_area_permissions aap ON aap.area_id = d.area_id
                   WHERE d.id = e.department_id AND aap.admin_user_id = $5 AND aap.tenant_id = $1)
      ))
      -- 4. Team level: check team membership or lead
      OR (e.org_level = 'team' AND (
        EXISTS (SELECT 1 FROM user_teams ut
                WHERE ut.user_id = $5 AND ut.team_id = e.team_id AND ut.tenant_id = $1)
        OR EXISTS (SELECT 1 FROM teams t
                   WHERE t.id = e.team_id AND t.team_lead_id = $5 AND t.tenant_id = $1)
        OR EXISTS (SELECT 1 FROM teams t
                   JOIN admin_department_permissions adp ON adp.department_id = t.department_id
                   WHERE t.id = e.team_id AND adp.admin_user_id = $5 AND adp.tenant_id = $1)
        OR EXISTS (SELECT 1 FROM teams t
                   JOIN departments d ON t.department_id = d.id
                   JOIN admin_area_permissions aap ON aap.area_id = d.area_id
                   WHERE t.id = e.team_id AND aap.admin_user_id = $5 AND aap.tenant_id = $1)
      ))
    )
`;

// ============================================
// Visibility Clause Builder
// ============================================

/**
 * Build SQL visibility clause for permission-based event access.
 * Checks: admin permissions, lead positions, department/team memberships, personal, attendees.
 * @param userIdx - SQL parameter index ($N) for userId
 * @param tenantIdx - SQL parameter index ($N) for tenantId
 */
export function buildVisibilityClause(
  userIdx: number,
  tenantIdx: number,
): string {
  return `(
    e.org_level = 'company'
    OR (e.org_level = 'area' AND (
      EXISTS (SELECT 1 FROM admin_area_permissions aap
              WHERE aap.admin_user_id = $${userIdx} AND aap.area_id = e.area_id AND aap.tenant_id = $${tenantIdx})
      OR EXISTS (SELECT 1 FROM areas a
                 WHERE a.id = e.area_id AND a.area_lead_id = $${userIdx} AND a.tenant_id = $${tenantIdx})
      OR EXISTS (SELECT 1 FROM user_departments ud
                 JOIN departments d ON ud.department_id = d.id
                 WHERE ud.user_id = $${userIdx} AND ud.tenant_id = $${tenantIdx} AND d.area_id = e.area_id)
    ))
    OR (e.org_level = 'department' AND (
      EXISTS (SELECT 1 FROM admin_department_permissions adp
              WHERE adp.admin_user_id = $${userIdx} AND adp.department_id = e.department_id AND adp.tenant_id = $${tenantIdx})
      OR EXISTS (SELECT 1 FROM departments d
                 WHERE d.id = e.department_id AND d.department_lead_id = $${userIdx} AND d.tenant_id = $${tenantIdx})
      OR EXISTS (SELECT 1 FROM user_departments ud
                 WHERE ud.user_id = $${userIdx} AND ud.department_id = e.department_id AND ud.tenant_id = $${tenantIdx})
      OR EXISTS (SELECT 1 FROM departments d
                 JOIN admin_area_permissions aap ON aap.area_id = d.area_id
                 WHERE d.id = e.department_id AND aap.admin_user_id = $${userIdx} AND aap.tenant_id = $${tenantIdx})
    ))
    OR (e.org_level = 'team' AND (
      EXISTS (SELECT 1 FROM user_teams ut
              WHERE ut.user_id = $${userIdx} AND ut.team_id = e.team_id AND ut.tenant_id = $${tenantIdx})
      OR EXISTS (SELECT 1 FROM teams t
                 WHERE t.id = e.team_id AND t.team_lead_id = $${userIdx} AND t.tenant_id = $${tenantIdx})
      OR EXISTS (SELECT 1 FROM teams t
                 JOIN admin_department_permissions adp ON adp.department_id = t.department_id
                 WHERE t.id = e.team_id AND adp.admin_user_id = $${userIdx} AND adp.tenant_id = $${tenantIdx})
      OR EXISTS (SELECT 1 FROM teams t
                 JOIN departments d ON t.department_id = d.id
                 JOIN admin_area_permissions aap ON aap.area_id = d.area_id
                 WHERE t.id = e.team_id AND aap.admin_user_id = $${userIdx} AND aap.tenant_id = $${tenantIdx})
    ))
    OR (e.org_level = 'personal' AND e.user_id = $${userIdx})
    OR EXISTS (SELECT 1 FROM calendar_attendees ca WHERE ca.event_id = e.id AND ca.user_id = $${userIdx})
  )`;
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
    if (
      endType === 'until' &&
      untilDateObj !== null &&
      currentDate > untilDateObj
    ) {
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

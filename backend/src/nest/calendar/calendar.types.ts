/**
 * Calendar Types
 *
 * Shared type definitions for the calendar module.
 * All sub-services import types from here to avoid circular dependencies.
 */

/**
 * Database representation of a calendar event
 */
export interface DbCalendarEvent {
  id: number;
  uuid: string;
  tenant_id: number;
  user_id: number;
  title: string;
  description: string | null;
  location: string | null;
  start_date: Date;
  end_date: Date;
  all_day: boolean | number;
  type: string | null;
  status: string | null;
  is_private: boolean | number;
  reminder_minutes: number | null;
  color: string | null;
  recurrence_rule: string | null;
  parent_event_id: number | null;
  created_at: Date;
  updated_at: Date;
  creator_name?: string;
  org_level: string | null;
  department_id: number | null;
  team_id: number | null;
  area_id: number | null;
  created_by_role: string | null;
  allow_attendees: boolean | number;
}

/**
 * Database representation of an event attendee
 */
export interface DbEventAttendee {
  user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  profile_picture: string | null;
}

/**
 * API response type for calendar event
 */
export type CalendarEventResponse = Record<string, unknown>;

/**
 * Paginated result type
 */
export interface PaginatedEventsResult {
  events: CalendarEventResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Filter options for listing events
 */
export interface EventFilters {
  status: string | undefined;
  filter: string | undefined;
  search: string | undefined;
  startDate: string | undefined;
  endDate: string | undefined;
  page: number | undefined;
  limit: number | undefined;
  sortBy: string | undefined;
  sortOrder: string | undefined;
}

/**
 * User role info with full access flag
 */
export interface UserRoleInfo {
  role: string | null;
  department_id: number | null;
  team_id: number | null;
  has_full_access: boolean;
}

/**
 * Org target for event visibility
 */
export interface OrgTarget {
  orgLevel: string;
  departmentId: number | null;
  teamId: number | null;
  areaId: number | null;
}

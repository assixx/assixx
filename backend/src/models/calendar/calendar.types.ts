/**
 * Calendar Types & Interfaces
 * Single source of truth for all calendar-related TypeScript types
 */
import { RowDataPacket } from '../../utils/db.js';

/**
 * Database representation of a calendar event
 */
export interface DbCalendarEvent extends RowDataPacket {
  id: number;
  tenant_id: number;
  user_id: number;
  title: string;
  description?: string | Buffer | { type: 'Buffer'; data: number[] };
  location?: string;
  start_date: Date;
  end_date: Date;
  all_day: boolean | number;
  type?: 'meeting' | 'training' | 'vacation' | 'sick_leave' | 'other';
  status?: 'tentative' | 'confirmed' | 'cancelled';
  is_private?: boolean | number;
  reminder_minutes?: number | null;
  color?: string;
  recurrence_rule?: string | null;
  parent_event_id?: number | null;
  created_at: Date;
  updated_at: Date;
  // Extended fields from joins
  creator_name?: string;
  user_response?: string | null;
  // Aliases for API compatibility
  start_time?: Date;
  end_time?: Date;
  org_level?: 'company' | 'department' | 'team' | 'area' | 'personal';
  department_id?: number | null;
  team_id?: number | null;
  area_id?: number | null;
  created_by?: number;
  created_by_role?: 'admin' | 'lead' | 'user';
  allow_attendees?: boolean | number;
  reminder_time?: number | null;
}

/**
 * Database representation of an event attendee
 */
export interface DbEventAttendee extends RowDataPacket {
  user_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  profile_picture?: string;
}

/**
 * Query options for filtering events
 */
export interface EventQueryOptions {
  status?: 'active' | 'cancelled';
  filter?: 'all' | 'company' | 'department' | 'team' | 'area' | 'personal';
  search?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
  userDepartmentId?: number | null;
  userTeamId?: number | null;
}

/**
 * Data required to create a new calendar event
 * Multi-organization support: Event can belong to multiple departments/teams/areas
 */
export interface EventCreateData {
  tenant_id: number;
  title: string;
  description?: string;
  location?: string;
  start_time: string | Date;
  end_time: string | Date;
  all_day?: boolean;
  // Multi-organization support - arrays of IDs
  departmentIds?: number[];
  teamIds?: number[];
  areaIds?: number[];
  // Legacy fields (optional for backwards compatibility)
  org_level?: 'company' | 'department' | 'team' | 'area' | 'personal';
  department_id?: number | null;
  team_id?: number | null;
  area_id?: number | null;
  created_by: number;
  created_by_role?: string;
  allow_attendees?: boolean;
  reminder_time?: number | null;
  color?: string;
  recurrence_rule?: string | null;
  parent_event_id?: number | null;
}

/**
 * Data for updating an existing calendar event
 * Multi-organization support: Event can belong to multiple departments/teams/areas
 */
export interface EventUpdateData {
  title?: string;
  description?: string;
  location?: string;
  start_time?: string | Date;
  end_time?: string | Date;
  all_day?: boolean;
  // Multi-organization support - arrays of IDs
  departmentIds?: number[];
  teamIds?: number[];
  areaIds?: number[];
  // Legacy fields (optional for backwards compatibility)
  org_level?: 'company' | 'department' | 'team' | 'area' | 'personal';
  department_id?: number | null;
  team_id?: number | null;
  area_id?: number | null;
  status?: 'active' | 'cancelled';
  reminder_time?: number | string | null;
  color?: string;
  created_by?: number;
  recurrence_rule?: string | null;
}

/**
 * Database count result
 */
export interface CountResult extends RowDataPacket {
  total: number;
}

/**
 * User information for access control
 */
export interface UserInfo {
  role: string | null;
  departmentId: number | null;
  teamId: number | null;
}

/**
 * Response structure for events list with pagination
 */
export interface EventsListResponse {
  events: DbCalendarEvent[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Type for the createEvent function (used for DI in recurring events)
 */
export type CreateEventFn = (data: EventCreateData) => Promise<DbCalendarEvent | null>;

/**
 * Legacy type aliases for backward compatibility
 */
export type CalendarEvent = DbCalendarEvent;
export type EventAttendee = DbEventAttendee;

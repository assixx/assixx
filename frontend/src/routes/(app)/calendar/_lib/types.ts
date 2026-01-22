// =============================================================================
// CALENDAR - TYPE DEFINITIONS
// 1:1 Copy from frontend/src/scripts/calendar/types.ts
// =============================================================================

/**
 * Organization level for calendar events
 */
export type OrgLevel = 'personal' | 'company' | 'department' | 'team' | 'area';

/**
 * User response status for event invitations
 */
export type ResponseStatus = 'accepted' | 'declined' | 'tentative' | 'pending';

/**
 * Calendar filter levels
 */
export type FilterLevel = 'all' | 'company' | 'department' | 'team' | 'area' | 'personal';

/**
 * Calendar view modes
 */
export type ViewMode = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';

/**
 * Calendar Event (API v2 camelCase)
 */
export interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location?: string;
  orgLevel: OrgLevel;
  orgId?: number;
  departmentId?: number | null;
  teamId?: number | null;
  areaId?: number | null;
  color?: string;
  reminderMinutes?: number;
  userId: number; // Creator ID (backend sends userId, not createdBy)
  createdAt: string;
  updatedAt: string;
  creatorName?: string;
  departmentName?: string;
  teamName?: string;
  userResponse?: ResponseStatus;
  attendees?: EventAttendee[];
}

/**
 * Event Attendee
 */
export interface EventAttendee {
  id: number;
  eventId: number;
  userId: number;
  responseStatus: ResponseStatus;
  respondedAt?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  profilePicture?: string;
}

/**
 * Department
 */
export interface Department {
  id: number;
  name: string;
  areaId?: number;
  areaName?: string;
}

/**
 * Team
 */
export interface Team {
  id: number;
  name: string;
  departmentId?: number;
}

/**
 * Area
 */
export interface Area {
  id: number;
  name: string;
  departmentCount?: number;
}

/**
 * User (for attendee selection)
 */
export interface User {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  profilePicture?: string;
}

/**
 * EventCalendar EventInput format
 */
export interface EventInput {
  id: string;
  title: string;
  start: string | Date;
  end?: string | Date;
  allDay?: boolean;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  classNames?: string[];
  extendedProps?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Recurrence type for repeating events
 */
export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * Recurrence end type
 */
export type RecurrenceEndType = 'never' | 'after' | 'until';

/**
 * Event form data for create/edit
 */
export interface EventFormData {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location: string;
  orgLevel: OrgLevel;
  departmentIds: number[];
  teamIds: number[];
  areaIds: number[];
  attendeeIds?: number[];
  recurrence?: RecurrenceType;
  recurrenceEndType?: RecurrenceEndType;
  recurrenceCount?: number;
  recurrenceUntil?: string;
}

/**
 * Event level info for UI display
 */
export interface EventLevelInfo {
  class: string;
  text: string;
  color: string;
}

/**
 * API pagination response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Event hover info for tooltip handlers
 */
export interface EventHoverInfo {
  el: HTMLElement;
  event: {
    id: string;
    title: string;
    extendedProps?: {
      description?: string;
      location?: string;
    };
  };
  jsEvent: MouseEvent;
}

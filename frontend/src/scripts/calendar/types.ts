/**
 * Calendar Types
 * All TypeScript interfaces and types for the calendar system
 */

import type { User } from '../../types/api.types';

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: {
    data: T[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

/**
 * API v2 Response (camelCase fields)
 */
export interface ApiV2Response<T> {
  success: boolean;
  data: {
    data: T[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Legacy API v1 Response (snake_case fields)
 */
export interface ApiV1Response<T> {
  data?: T[];
  events?: T[];
  success?: boolean;
}

/**
 * Legacy API Response (backward compatibility)
 */
export interface LegacyApiResponse<T = unknown> {
  data: T[];
  events?: T[];
}

// ============================================================================
// Calendar Event Types
// ============================================================================

/**
 * Organization level for calendar events
 */
export type OrgLevel = 'personal' | 'company' | 'department' | 'team' | 'area';

/**
 * User response status for event invitations
 */
export type ResponseStatus = 'accepted' | 'declined' | 'tentative' | 'pending';

/**
 * Calendar Event
 * Supports both v1 (snake_case) and v2 (camelCase) API fields
 */
export interface CalendarEvent {
  id: number;
  title: string;
  description?: string;

  // Time fields (v1 snake_case)
  start_time: string;
  end_time: string;
  all_day: boolean | number | string;

  // Time fields (v2 camelCase)
  startTime?: string;
  endTime?: string;
  allDay?: boolean | number | string;

  // Location
  location?: string;

  // Organization fields (v1 snake_case)
  org_level: OrgLevel;
  org_id?: number | undefined;

  // Organization fields (v2 camelCase)
  orgLevel?: OrgLevel | undefined;
  orgId?: number | undefined;

  // Display color
  color?: string | undefined;

  // Reminder fields (v1 snake_case)
  reminder_time?: number | undefined;

  // Reminder fields (v2 camelCase)
  reminderTime?: number | undefined;
  reminderMinutes?: number | undefined;

  // Creator fields (v1 snake_case)
  created_by: number;
  created_at: string;
  updated_at: string;

  // Creator fields (v2 camelCase)
  createdBy?: number | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;

  // Additional fields from joins (v1 snake_case)
  creator_name?: string | undefined;
  department_name?: string | undefined;
  team_name?: string | undefined;

  // Additional fields from joins (v2 camelCase)
  creatorName?: string | undefined;
  departmentName?: string | undefined;
  teamName?: string | undefined;

  // User-specific fields (v1 snake_case)
  user_response?: ResponseStatus | undefined;

  // User-specific fields (v2 camelCase)
  userResponse?: ResponseStatus | undefined;

  // Attendees
  attendees?: EventAttendee[] | undefined;
}

/**
 * Event Attendee
 * Supports both v1 (snake_case) and v2 (camelCase) API fields
 */
export interface EventAttendee {
  id: number;
  event_id: number;

  // User ID (v1 snake_case)
  user_id?: number;

  // User ID (v2 camelCase)
  userId?: number;

  // Response status (v1 snake_case)
  response?: ResponseStatus;

  // Response status (v2 camelCase)
  responseStatus?: ResponseStatus;

  // Response time (v1 snake_case)
  responded_at?: string;

  // Response time (v2 camelCase)
  respondedAt?: string;

  // User info (v1 snake_case)
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;

  // User info (v2 camelCase)
  firstName?: string;
  lastName?: string;

  // Additional v2 fields
  profilePicture?: string;
}

// ============================================================================
// Organization Types
// ============================================================================

/**
 * Department
 */
export interface Department {
  id: number;
  name: string;
}

/**
 * Team
 * Supports both v1 (snake_case) and v2 (camelCase) API fields
 */
export interface Team {
  id: number;
  name: string;

  // Department ID (v1 snake_case)
  department_id?: number;

  // Department ID (v2 camelCase)
  departmentId?: number;
}

// ============================================================================
// User Types
// ============================================================================

/**
 * User Data with organization context
 * Extends base User type with department/team info
 */
export interface UserData extends User {
  // v1 snake_case
  department_id?: number;
  team_id?: number;

  // v2 camelCase
  departmentId?: number;
  teamId?: number;
}

// ============================================================================
// Filter Types
// ============================================================================

/**
 * Calendar filter levels
 */
export type FilterLevel = 'all' | 'company' | 'department' | 'team' | 'area' | 'personal';

/**
 * Calendar view modes
 */
export type ViewMode = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';

// ============================================================================
// FullCalendar Plugin Types
// ============================================================================

/**
 * FullCalendar plugins bundle
 * Used for lazy loading
 */
export interface CalendarPlugins {
  dayGridPlugin: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  timeGridPlugin: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  interactionPlugin: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  listPlugin: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  deLocale: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// ============================================================================
// Event Handler Types
// ============================================================================

/**
 * Click handler configuration
 * Used for event delegation pattern
 */
export interface ClickHandler {
  selector: string;
  handler: (e: Event, element: HTMLElement) => void;
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Formatted date strings for display
 */
export interface FormattedDates {
  dateStr: string;
  timeStr: string;
}

/**
 * Event level information for UI display
 */
export interface EventLevelInfo {
  class: string;
  text: string;
}

// ============================================================================
// Form Types
// ============================================================================

/**
 * Event form data
 */
export interface EventFormData {
  title: string;
  description?: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
  location?: string;
  orgLevel: OrgLevel;
  orgId?: number;
  reminderMinutes?: number;
  attendees?: number[];
}

/**
 * Event update data
 */
export interface EventUpdateData extends EventFormData {
  id: number;
}

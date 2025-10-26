// Import for default export
import {
  addEventAttendee,
  getEventAttendees,
  removeEventAttendee,
  respondToEvent,
} from './calendar.attendees';
import {
  canManageEvent,
  checkEventExists,
  createEvent,
  deleteEvent,
  getAllEvents,
  getDashboardEvents,
  getEventById,
  updateEvent,
} from './calendar.crud';
import { generateRecurringEvents } from './calendar.recurring';

/**
 * Calendar Module - Barrel Export
 * Provides backward compatibility and clean API for calendar operations
 */

// Export all types
export type {
  DbCalendarEvent,
  CalendarEvent,
  DbEventAttendee,
  EventAttendee,
  EventQueryOptions,
  EventCreateData,
  EventUpdateData,
  CountResult,
  UserInfo,
  EventsListResponse,
  CreateEventFn,
} from './calendar.types';

// Export CRUD operations
export {
  getAllEvents,
  getEventById,
  checkEventExists,
  createEvent,
  updateEvent,
  deleteEvent,
  getDashboardEvents,
  canManageEvent,
} from './calendar.crud';

// Export attendee operations
export {
  addEventAttendee,
  removeEventAttendee,
  respondToEvent,
  getEventAttendees,
} from './calendar.attendees';

// Export recurring event operations
export { generateRecurringEvents } from './calendar.recurring';

// Export utility functions (if needed externally)
export {
  formatDateForMysql,
  processCalendarEvents,
  applyOrgLevelFilter,
  applyDateAndSearchFilters,
  applyEventFilters,
  getEventCount,
} from './calendar.utils';

/**
 * Default export for backward compatibility
 * Allows: import Calendar from './calendar'
 */
const Calendar = {
  getAllEvents,
  getEventById,
  checkEventExists,
  createEvent,
  updateEvent,
  deleteEvent,
  addEventAttendee,
  removeEventAttendee,
  respondToEvent,
  getEventAttendees,
  getDashboardEvents,
  canManageEvent,
  generateRecurringEvents,
};

export default Calendar;

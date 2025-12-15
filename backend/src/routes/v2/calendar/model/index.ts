// Import for default export
import { addEventAttendee, getEventAttendees, removeEventAttendee } from './calendar.attendees.js';
import {
  canManageEvent,
  checkEventExists,
  createEvent,
  deleteEvent,
  getAllEvents,
  getDashboardEvents,
  getEventById,
  updateEvent,
} from './calendar.crud.js';
import { generateRecurringEvents } from './calendar.recurring.js';

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
} from './calendar.types.js';

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
} from './calendar.crud.js';

// Export attendee operations
export { addEventAttendee, removeEventAttendee, getEventAttendees } from './calendar.attendees.js';

// Export recurring event operations
export { generateRecurringEvents } from './calendar.recurring.js';

// Export utility functions (if needed externally)
export {
  formatDateForMysql,
  processCalendarEvents,
  applyOrgLevelFilter,
  applyDateAndSearchFilters,
  applyEventFilters,
  getEventCount,
} from './calendar.utils.js';

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
  getEventAttendees,
  getDashboardEvents,
  canManageEvent,
  generateRecurringEvents,
};

export default Calendar;

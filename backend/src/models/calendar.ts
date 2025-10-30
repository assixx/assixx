/**
 * Calendar Model - Backward Compatibility Re-export
 *
 * This file re-exports everything from the calendar/ module directory.
 * The calendar module has been split into multiple files for better maintainability:
 *
 * - calendar/calendar.types.ts - Type definitions
 * - calendar/calendar.utils.ts - Utility functions
 * - calendar/calendar.crud.ts - CRUD operations
 * - calendar/calendar.attendees.ts - Attendee management
 * - calendar/calendar.recurring.ts - Recurring events
 * - calendar/index.ts - Barrel export
 *
 * This file ensures that existing imports continue to work:
 *   import Calendar from './models/calendar'
 *   import \{ getAllEvents \} from './models/calendar'
 */

// Re-export everything from the calendar module
export * from './calendar/index.js';

// Re-export default export for backward compatibility
export { default } from './calendar/index.js';

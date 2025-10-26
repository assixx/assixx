/**
 * Calendar Recurring Events
 * Handles generation and management of recurring calendar events
 * Uses Dependency Injection to avoid circular dependencies
 */
import { logger } from '../../utils/logger';
import { CreateEventFn, DbCalendarEvent, EventCreateData } from './calendar.types';

/**
 * Parse recurrence rule options
 */
function parseRecurrenceOptions(options: string[]): { count: number; until: Date | null } {
  let count = 52; // Default to 1 year of weekly events
  let until: Date | null = null;

  for (const option of options) {
    if (option.startsWith('COUNT=')) {
      count = Number.parseInt(option.substring(6), 10);
    } else if (option.startsWith('UNTIL=')) {
      until = new Date(option.substring(6));
    }
  }

  return { count, until };
}

/**
 * Get interval days for recurrence pattern
 */
function getIntervalDays(pattern: string): number {
  switch (pattern) {
    case 'daily':
      return 1;
    case 'weekly':
      return 7;
    case 'biweekly':
      return 14;
    case 'monthly':
      return 30; // Approximate
    case 'yearly':
      return 365;
    case 'weekdays':
      return 1; // Special handling needed
    default:
      return 1;
  }
}

/**
 * Skip weekends if pattern is weekdays
 */
function skipWeekends(date: Date): void {
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
}

/**
 * Convert event description to string
 */
function convertDescription(description: unknown): string {
  if (typeof description === 'string') {
    return description;
  }
  if (description == null) {
    return '';
  }
  if (Buffer.isBuffer(description)) {
    return description.toString('utf8');
  }
  return '';
}

/**
 * Move date to next occurrence based on pattern
 */
function moveToNextOccurrence(date: Date, pattern: string, intervalDays: number): void {
  if (pattern === 'monthly') {
    date.setMonth(date.getMonth() + 1);
  } else if (pattern === 'yearly') {
    date.setFullYear(date.getFullYear() + 1);
  } else {
    date.setDate(date.getDate() + intervalDays);
  }
}

/**
 * Create child event data from parent
 */
function createChildEventData(
  parentEvent: DbCalendarEvent,
  newStartDate: Date,
  newEndDate: Date,
): EventCreateData {
  return {
    tenant_id: parentEvent.tenant_id,
    title: parentEvent.title,
    description: convertDescription(parentEvent.description),
    location: parentEvent.location,
    start_time: newStartDate.toISOString(),
    end_time: newEndDate.toISOString(),
    all_day: Boolean(parentEvent.all_day),
    org_level: parentEvent.org_level ?? 'personal',
    department_id: parentEvent.department_id ?? null,
    team_id: parentEvent.team_id ?? null,
    created_by: parentEvent.created_by ?? parentEvent.user_id,
    reminder_time: parentEvent.reminder_time,
    color: parentEvent.color,
    parent_event_id: parentEvent.id,
  };
}

/**
 * Generate recurring events based on recurrence rule
 *
 * @param parentEvent - The parent event to recur
 * @param recurrenceRule - Recurrence rule string (e.g., "weekly;COUNT=10")
 * @param createEventFn - Function to create child events (injected to avoid circular deps)
 *
 * Uses Dependency Injection pattern to break circular dependency between
 * calendar.recurring.ts and calendar.crud.ts
 */
export async function generateRecurringEvents(
  parentEvent: DbCalendarEvent,
  recurrenceRule: string,
  createEventFn: CreateEventFn,
): Promise<void> {
  try {
    // Parse recurrence rule
    const [pattern, ...options] = recurrenceRule.split(';');
    const { count, until } = parseRecurrenceOptions(options);
    const intervalDays = getIntervalDays(pattern);

    // Generate occurrences
    const startDate = new Date(parentEvent.start_time ?? parentEvent.start_date);
    const endDate = new Date(parentEvent.end_time ?? parentEvent.end_date);
    const duration = endDate.getTime() - startDate.getTime();

    let currentDate = new Date(startDate);
    let occurrences = 0;

    while (occurrences < count && (!until || currentDate <= until)) {
      // Skip first occurrence (parent event)
      if (occurrences > 0) {
        // Skip weekends for weekdays pattern
        if (pattern === 'weekdays') {
          skipWeekends(currentDate);
        }

        const newStartDate = new Date(currentDate);
        const newEndDate = new Date(currentDate.getTime() + duration);

        // Create child event using injected function
        const childEventData = createChildEventData(parentEvent, newStartDate, newEndDate);
        await createEventFn(childEventData);
      }

      // Move to next occurrence
      moveToNextOccurrence(currentDate, pattern, intervalDays);
      occurrences++;
    }
  } catch (error: unknown) {
    logger.error('Error generating recurring events:', error);
    throw error;
  }
}

/**
 * EventCalendar Loader
 *
 * Replacement for FullCalendar using @event-calendar/core
 * Much lighter (~35kb vs ~980kb) with native Svelte 5 support
 *
 * MIGRATION: Phase 0 - FullCalendar → @event-calendar/core
 * UPGRADE: v3 → v5 (createCalendar API) - 2025-12-22
 */

// v5 API: All plugins included in @event-calendar/core

import { createCalendar, DayGrid, TimeGrid, List, Interaction } from '@event-calendar/core';

// Import CSS
import '@event-calendar/core/index.css';

// Type for calendar instance returned by createCalendar
type CalendarApi = ReturnType<typeof createCalendar>;

/**
 * Supported view types (same as FullCalendar for compatibility)
 */
export type ViewType = 'month' | 'week' | 'day' | 'list';

/**
 * Calendar initialization result
 */
export interface CalendarInstance {
  calendar: CalendarApi;
  loadedPlugins: Set<string>;
}

/**
 * German locale configuration
 */
const deLocale = {
  code: 'de',
  week: {
    dow: 1, // Monday is first day of week
    doy: 4, // First week contains Jan 4th
  },
  buttonText: {
    today: 'Heute',
    dayGridMonth: 'Monat',
    timeGridWeek: 'Woche',
    timeGridDay: 'Tag',
    listWeek: 'Liste',
    listMonth: 'Liste Monat',
    listDay: 'Liste Tag',
    listYear: 'Liste Jahr',
  },
  weekText: 'KW',
  allDayText: 'Ganztägig',
  moreLinkText: (n: number) => `+${n} mehr`,
  noEventsText: 'Keine Ereignisse',
};

/**
 * Get EventCalendar view name from ViewType
 *
 * @param view - Our simplified view type
 * @returns EventCalendar's internal view name
 */
function getEventCalendarViewName(view: ViewType): string {
  switch (view) {
    case 'month':
      return 'dayGridMonth';
    case 'week':
      return 'timeGridWeek';
    case 'day':
      return 'timeGridDay';
    case 'list':
      return 'listWeek';
    default:
      return 'dayGridMonth';
  }
}

/**
 * EventCalendar options type (partial, for extensibility)
 */
export interface EventCalendarOptions {
  headerToolbar?: {
    start?: string;
    center?: string;
    end?: string;
  };
  buttonText?: Record<string, string>;
  editable?: boolean;
  selectable?: boolean;
  selectMirror?: boolean;
  dayMaxEvents?: boolean | number;
  weekends?: boolean;
  nowIndicator?: boolean;
  height?: string | number;
  events?:
    | unknown[]
    | ((
        info: EventFetchInfo,
        successCallback: (events: unknown[]) => void,
        failureCallback: (error: Error) => void,
      ) => void);
  eventClick?: (info: EventClickInfo) => void;
  dateClick?: (info: DateClickInfo) => void;
  select?: (info: SelectInfo) => void;
  eventMouseEnter?: (info: EventHoverInfo) => void;
  eventMouseLeave?: (info: EventHoverInfo) => void;
  eventDrop?: (info: EventDropInfo) => void;
  eventResize?: (info: EventResizeInfo) => void;
  datesSet?: (info: DatesSetInfo) => void;
}

/**
 * Event fetch info for async event loading
 */
export interface EventFetchInfo {
  start: Date;
  startStr: string;
  end: Date;
  endStr: string;
  timeZone?: string;
}

/**
 * Event click info
 */
export interface EventClickInfo {
  el: HTMLElement;
  event: CalendarEvent;
  jsEvent: MouseEvent;
  view: CalendarView;
}

/**
 * Date click info
 */
export interface DateClickInfo {
  date: Date;
  dateStr: string;
  allDay: boolean;
  dayEl: HTMLElement;
  jsEvent: MouseEvent;
  view: CalendarView;
}

/**
 * Select info (date range selection)
 */
export interface SelectInfo {
  start: Date;
  startStr: string;
  end: Date;
  endStr: string;
  allDay: boolean;
  view: CalendarView;
}

/**
 * Event hover info
 */
export interface EventHoverInfo {
  el: HTMLElement;
  event: CalendarEvent;
  jsEvent: MouseEvent;
  view: CalendarView;
}

/**
 * Event drop info (after drag)
 */
export interface EventDropInfo {
  event: CalendarEvent;
  oldEvent: CalendarEvent;
  delta: { days: number; milliseconds: number };
  revert: () => void;
}

/**
 * Event resize info
 */
export interface EventResizeInfo {
  event: CalendarEvent;
  oldEvent: CalendarEvent;
  endDelta: { days: number; milliseconds: number };
  revert: () => void;
}

/**
 * Dates set info (view change)
 */
export interface DatesSetInfo {
  start: Date;
  end: Date;
  view: CalendarView;
}

/**
 * Calendar event object
 */
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end?: Date;
  allDay?: boolean;
  color?: string;
  backgroundColor?: string;
  textColor?: string;
  extendedProps?: Record<string, unknown>;
}

/**
 * Calendar view object
 */
export interface CalendarView {
  type: string;
  title: string;
  activeStart: Date;
  activeEnd: Date;
  currentStart: Date;
  currentEnd: Date;
}

/**
 * Initialize EventCalendar
 *
 * @param element - DOM element to mount calendar on
 * @param initialView - Initial view type (default: 'month')
 * @param canEdit - Whether user has edit permissions (default: false)
 * @param options - Additional EventCalendar options
 * @returns Calendar instance with tracking info
 */
export function initializeCalendar(
  element: HTMLElement,
  initialView: ViewType = 'month',
  canEdit: boolean = false,
  options: EventCalendarOptions = {},
): CalendarInstance {
  console.info('EventCalendar: Starting initialization...');
  const startTime = performance.now();

  // Build plugins array
  const plugins = [DayGrid, TimeGrid, List];
  const loadedPlugins = new Set<string>(['view-month', 'view-week', 'view-day', 'view-list']);

  // Add interaction plugin if user can edit
  if (canEdit) {
    plugins.push(Interaction);
    loadedPlugins.add('interaction');
    console.info('EventCalendar: Interaction plugin loaded (user has edit permissions)');
  } else {
    console.info('EventCalendar: Interaction plugin skipped (read-only user)');
  }

  // Map headerToolbar from FullCalendar format to EventCalendar format
  const headerToolbar = options.headerToolbar ?? {
    start: 'prev,next today',
    center: 'title',
    end: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
  };

  // Create calendar instance using v5 API: createCalendar(target, plugins, options)
  const calendar = createCalendar(element, plugins, {
    view: getEventCalendarViewName(initialView),
    locale: 'de', // German locale for Intl.DateTimeFormat (weekday names, etc.)
    headerToolbar,
    buttonText: options.buttonText ?? deLocale.buttonText,
    firstDay: 1, // Monday as first day of week
    editable: canEdit && (options.editable ?? true),
    selectable: canEdit && (options.selectable ?? true),
    selectMirror: options.selectMirror ?? true,
    dayMaxEvents: options.dayMaxEvents ?? true,
    nowIndicator: options.nowIndicator ?? true,
    height: options.height ?? 'auto',
    events: Array.isArray(options.events) ? options.events : [],
    eventSources: typeof options.events === 'function' ? [{ events: options.events }] : [],
    eventClick: options.eventClick,
    dateClick: options.dateClick,
    select: options.select,
    eventMouseEnter: options.eventMouseEnter,
    eventMouseLeave: options.eventMouseLeave,
    eventDrop: options.eventDrop,
    eventResize: options.eventResize,
    datesSet: options.datesSet,
  });

  console.info(`EventCalendar Initialization: ${(performance.now() - startTime).toFixed(2)}ms`);
  console.info(`EventCalendar: Initialized with ${plugins.length} plugins:`, Array.from(loadedPlugins));

  return { calendar, loadedPlugins };
}

/**
 * Switch calendar view
 *
 * @param calendar - Calendar instance
 * @param newView - View to switch to
 */
export function switchView(calendar: CalendarApi, newView: ViewType): void {
  console.info(`EventCalendar: Switching to ${newView} view...`);
  const viewName = getEventCalendarViewName(newView);

  calendar.setOption('view', viewName);
}

/**
 * Clear module cache (for testing/memory cleanup - no-op in EventCalendar)
 */
export function clearCache(): void {
  console.info('EventCalendar: clearCache() called (no-op, no caching needed)');
}

/**
 * Get cache statistics (for debugging - returns empty for EventCalendar)
 */
export function getCacheStats(): {
  cachedModules: string[];
  cacheSize: number;
} {
  return {
    cachedModules: [],
    cacheSize: 0,
  };
}

/**
 * Preload plugins (no-op in EventCalendar - all plugins loaded at init)
 */
export function preloadPlugins(_views: ViewType[], _includeInteraction: boolean = false): Promise<void> {
  console.info('EventCalendar: preloadPlugins() called (no-op, all plugins loaded at init)');
  return Promise.resolve();
}

/**
 * Enable interaction (requires re-initialization in EventCalendar)
 */
export function enableInteraction(_calendar: CalendarApi): Promise<void> {
  console.warn('EventCalendar: enableInteraction() requires calendar re-initialization');
  return Promise.resolve();
}

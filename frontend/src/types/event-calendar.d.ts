/**
 * Type declarations for @event-calendar/core v5
 * These packages don't include TypeScript definitions
 *
 * v5 API: createCalendar(target, plugins, options)
 * All plugins are included in @event-calendar/core
 *
 * @see https://github.com/vkurko/calendar
 */

declare module '@event-calendar/core' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External library without official types; callbacks accept various info objects
  type EventCallback = ((info: any) => void) | undefined;

  export interface CalendarOptions {
    view?: string;
    locale?: string | Record<string, unknown>;
    firstDay?: number;
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
    nowIndicator?: boolean;
    height?: string | number;
    events?: unknown[];
    eventSources?: { events: unknown }[];
    eventClick?: EventCallback;
    dateClick?: EventCallback;
    select?: EventCallback;
    eventMouseEnter?: EventCallback;
    eventMouseLeave?: EventCallback;
    eventDrop?: EventCallback;
    eventResize?: EventCallback;
    datesSet?: EventCallback;
    [key: string]: unknown;
  }

  /**
   * Calendar instance returned by createCalendar
   */
  export interface CalendarInstance {
    setOption(name: string, value: unknown): void;
    getOption(name: string): unknown;
    refetchEvents(): void;
    destroy(): void;
  }

  /**
   * Plugin type (opaque, used in plugins array)
   */
  export type Plugin = unknown;

  /**
   * v5 API: Create calendar instance
   * @param target - DOM element to mount calendar
   * @param plugins - Array of plugins [DayGrid, TimeGrid, etc.]
   * @param options - Calendar configuration options
   */
  export function createCalendar(
    target: HTMLElement,
    plugins: Plugin[],
    options: CalendarOptions,
  ): CalendarInstance;

  /**
   * Plugins - all included in @event-calendar/core v5
   */
  export const DayGrid: Plugin;
  export const TimeGrid: Plugin;
  export const List: Plugin;
  export const Interaction: Plugin;
}

/**
 * Legacy module declarations (for backwards compatibility)
 * These separate packages are no longer needed in v5 but kept for migration
 */
declare module '@event-calendar/day-grid' {
  const DayGrid: unknown;
  export default DayGrid;
}

declare module '@event-calendar/time-grid' {
  const TimeGrid: unknown;
  export default TimeGrid;
}

declare module '@event-calendar/list' {
  const List: unknown;
  export default List;
}

declare module '@event-calendar/interaction' {
  const Interaction: unknown;
  export default Interaction;
}

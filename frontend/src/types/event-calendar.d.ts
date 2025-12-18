/**
 * Type declarations for @event-calendar packages
 * These packages don't include TypeScript definitions
 *
 * @see https://github.com/vkurko/calendar
 */

declare module '@event-calendar/core' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External library without official types; callbacks accept various info objects
  type EventCallback = ((info: any) => void) | undefined;

  export interface CalendarOptions {
    view?: string;
    locale?: string | Record<string, unknown>;
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

  export interface CalendarProps {
    plugins: unknown[];
    options: CalendarOptions;
  }

  export default class Calendar {
    constructor(config: { target: HTMLElement; props: CalendarProps });
    setOption(name: string, value: unknown): void;
    getOption(name: string): unknown;
    refetchEvents(): void;
    destroy(): void;
  }
}

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

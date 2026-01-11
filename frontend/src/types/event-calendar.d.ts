// Type declarations for @event-calendar/core v5
declare module '@event-calendar/core' {
  import type { SvelteComponent } from 'svelte';

  // Calendar Svelte component
  export const Calendar: typeof SvelteComponent<{
    plugins: unknown[];
    options: CalendarOptions;
  }>;

  export function createCalendar(
    target: HTMLElement,
    plugins: unknown[],
    options: CalendarOptions,
  ): CalendarInstance;

  export const DayGrid: unknown;
  export const TimeGrid: unknown;
  export const List: unknown;
  export const Interaction: unknown;
  export const Resource: unknown;

  export interface CalendarInstance {
    destroy: () => void;
    setOption: (name: string, value: unknown) => void;
    getOption: (name: string) => unknown;
    refetchEvents: () => void;
    getEvents: () => CalendarEvent[];
    getEventById: (id: string) => CalendarEvent | null;
    addEvent: (event: EventInput) => CalendarEvent;
    updateEvent: (event: EventInput) => void;
    removeEventById: (id: string) => void;
    getView: () => CalendarView;
    next: () => void;
    prev: () => void;
    today: () => void;
    unselect: () => void;
  }

  export interface CalendarOptions {
    view?: string;
    locale?: string;
    headerToolbar?: {
      start?: string;
      center?: string;
      end?: string;
    };
    buttonText?: Record<string, string>;
    firstDay?: number;
    editable?: boolean;
    selectable?: boolean;
    selectMirror?: boolean;
    dayMaxEvents?: boolean | number;
    nowIndicator?: boolean;
    height?: string | number;
    events?: EventInput[] | EventSourceFunc;
    eventSources?: EventSource[];
    eventClick?: (info: EventClickInfo) => void;
    dateClick?: (info: DateClickInfo) => void;
    select?: (info: SelectInfo) => void;
    eventMouseEnter?: (info: EventHoverInfo) => void;
    eventMouseLeave?: (info: EventHoverInfo) => void;
    eventDrop?: (info: EventDropInfo) => void;
    eventResize?: (info: EventResizeInfo) => void;
    datesSet?: (info: DatesSetInfo) => void;
    [key: string]: unknown;
  }

  export interface EventInput {
    id?: string;
    title?: string;
    start?: string | Date;
    end?: string | Date;
    allDay?: boolean;
    color?: string;
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
    classNames?: string[];
    editable?: boolean;
    display?: string;
    extendedProps?: Record<string, unknown>;
    [key: string]: unknown;
  }

  export interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    allDay: boolean;
    color?: string;
    backgroundColor?: string;
    textColor?: string;
    classNames: string[];
    extendedProps: Record<string, unknown>;
  }

  export interface CalendarView {
    type: string;
    title: string;
    activeStart: Date;
    activeEnd: Date;
    currentStart: Date;
    currentEnd: Date;
  }

  export interface EventFetchInfo {
    start: Date;
    startStr: string;
    end: Date;
    endStr: string;
    timeZone?: string;
  }

  export type EventSourceFunc = (
    info: EventFetchInfo,
    successCallback: (events: EventInput[]) => void,
    failureCallback: (error: Error) => void,
  ) => void;

  export interface EventSource {
    events: EventSourceFunc | EventInput[];
    [key: string]: unknown;
  }

  export interface EventClickInfo {
    el: HTMLElement;
    event: CalendarEvent;
    jsEvent: MouseEvent;
    view: CalendarView;
  }

  export interface DateClickInfo {
    date: Date;
    dateStr: string;
    allDay: boolean;
    dayEl: HTMLElement;
    jsEvent: MouseEvent;
    view: CalendarView;
  }

  export interface SelectInfo {
    start: Date;
    startStr: string;
    end: Date;
    endStr: string;
    allDay: boolean;
    view: CalendarView;
  }

  export interface EventHoverInfo {
    el: HTMLElement;
    event: CalendarEvent;
    jsEvent: MouseEvent;
    view: CalendarView;
  }

  export interface EventDropInfo {
    event: CalendarEvent;
    oldEvent: CalendarEvent;
    delta: { days: number; milliseconds: number };
    revert: () => void;
  }

  export interface EventResizeInfo {
    event: CalendarEvent;
    oldEvent: CalendarEvent;
    endDelta: { days: number; milliseconds: number };
    revert: () => void;
  }

  export interface DatesSetInfo {
    start: Date;
    end: Date;
    view: CalendarView;
  }
}

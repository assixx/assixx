<script lang="ts">
  /**
   * CalendarView — Wrapper for @event-calendar/core.
   * Owns all :global CSS overrides for the third-party Calendar library,
   * shift/vacation indicator styles, and fullscreen mode styles.
   */
  import { Calendar } from '@event-calendar/core';

  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('CalendarView');

  interface Props {
    plugins: unknown[];
    options: Record<string, unknown>;
    onNewEvent: () => void;
    onToggleFullscreen: () => void;
  }

  const { plugins, options, onNewEvent, onToggleFullscreen }: Props = $props();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- Calendar component type from @event-calendar/core lacks proper types
  let calendarRef: any = $state();

  /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- @event-calendar/core lacks types */
  /** Trigger a refetch of calendar events from the event source */
  export function refetchEvents(): void {
    if (calendarRef !== undefined) {
      if (typeof calendarRef.refetchEvents === 'function') {
        log.debug({}, 'Refetching events');
        calendarRef.refetchEvents();
      } else {
        log.debug({}, 'refetchEvents not available, calendar may not be ready');
      }
    }
  }
  /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
</script>

<div
  class="card calendar-card mb-6"
  id="calendarContainer"
>
  <div class="card__header">
    <div class="flex items-center justify-between">
      <h3 class="card__title">
        <i class="fas fa-calendar-alt mr-2"></i>
        Kalender
      </h3>
      <div class="flex gap-2">
        <button
          type="button"
          id="fullscreenBtn"
          class="btn btn-icon btn-secondary"
          onclick={onToggleFullscreen}
          title="Vollbild"
        >
          <i class="fas fa-expand"></i>
        </button>
        <button
          type="button"
          id="newEventBtn"
          class="btn btn-primary"
          onclick={onNewEvent}
        >
          <i class="fas fa-plus mr-2"></i>
          Neuer Termin
        </button>
      </div>
    </div>
  </div>
  <div class="card__body p-0">
    <div id="calendar">
      <Calendar
        bind:this={calendarRef}
        {plugins}
        {options}
      />
    </div>
  </div>
</div>

<style>
  /* Calendar container */
  :global(#calendar) {
    width: 100%;
    padding: 10px;
  }

  /*
   * ALL styles below target @event-calendar library components.
   * Using :global since these are third-party elements we cannot scope.
   */
  :global {
    /* EventCalendar CSS Variables */
    :root {
      --ec-border-color: hsl(0deg 0% 83.5% / 35%);
    }

    /* @EVENT-CALENDAR BUTTON OVERRIDES */
    .ec {
      --ec-bg-color: none !important;
      --ec-border-color: unset !important;
      --ec-event-col-gap: 8px;

      color-scheme: none !important;
    }

    .ec-time-grid .ec-body .ec-day {
      background-image: none !important;
    }

    .ec-main {
      overflow: hidden;
      border-radius: var(--radius-xl);
    }

    .ec-button {
      border-radius: 12px !important;
      box-shadow: var(--shadow-sm);
      transition: all 0.2s ease;
    }

    .ec-button:hover {
      color: var(--color-black) !important;
      background-color: var(--color-icon-primary) !important;
    }

    .ec-active {
      color: var(--color-black) !important;
      background-color: var(--color-icon-primary) !important;
    }

    .ec-button-group .ec-button {
      border-radius: 0 !important;
    }

    .ec-button-group .ec-button:first-child {
      border-top-left-radius: 12px !important;
      border-bottom-left-radius: 12px !important;
    }

    .ec-button-group .ec-button:last-child {
      border-top-right-radius: 12px !important;
      border-bottom-right-radius: 12px !important;
    }

    /* TOOLBAR */
    .ec-toolbar {
      display: flex;
      gap: 20px;
      align-items: center;
      margin-bottom: 0.5em;
      padding: 0.5em 1em;
    }

    .ec-title {
      font-size: 1.5em !important;
      font-weight: 500;
      color: var(--text-primary);
    }

    /* DAY CELLS */
    .ec-day-grid .ec-header,
    .ec-day-grid .ec-all-day,
    .ec-day-grid .ec-body,
    .ec-day-grid .ec-days,
    .ec-day-grid .ec-day,
    .ec-day-grid .ec-day-head {
      border-color: hsl(0deg 0% 83.5% / 35%);
    }

    html:not(.dark) .ec-day-grid .ec-header,
    html:not(.dark) .ec-day-grid .ec-all-day,
    html:not(.dark) .ec-day-grid .ec-body,
    html:not(.dark) .ec-day-grid .ec-days,
    html:not(.dark) .ec-day-grid .ec-day,
    html:not(.dark) .ec-day-grid .ec-day-head {
      border-color: hsl(0deg 0% 0% / 40.9%);
    }

    .ec-day {
      position: relative;
      color: var(--text-primary);
      background-color: transparent;
    }

    .ec-day-grid .ec-body .ec-day[role='cell'] {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 6em;
      min-block-size: 6em;
    }

    .calendar-fullscreen-mode .ec-day-grid .ec-body .ec-day[role='cell'] {
      min-height: 11em;
      min-block-size: 11em;
    }

    .ec-day:hover {
      background-color: rgb(var(--primary-rgb), 0.05) !important;
    }

    .ec-today {
      background-color: rgb(92 185 247 / 12%) !important;
    }

    .ec-other-month {
      opacity: 50%;
    }

    /* EVENTS */
    .ec-events {
      margin-right: 0 !important;
    }

    .ec-event {
      cursor: pointer;
      border: none !important;
      border-radius: 4px;
      box-shadow: var(--shadow-sm);
      margin-inline: auto;
    }

    .ec-event:hover {
      box-shadow: var(--shadow-md);
    }

    .ec-event-title {
      padding: 1px 2px;
      font-size: 0.85em !important;
      font-weight: 500 !important;
    }

    .ec-event-time {
      font-size: 0.8em !important;
      font-weight: 400 !important;
      opacity: 80%;
    }

    /* Event colors by organization level */
    .ec-event-company {
      border-color: #3498db !important;
      background-color: #3498db !important;
    }

    .ec-event-department {
      border-color: #e67e22 !important;
      background-color: #e67e22 !important;
    }

    .ec-event-team {
      border-color: #2ecc71 !important;
      background-color: #2ecc71 !important;
    }

    .ec-event-area {
      border-color: #e53935 !important;
      background-color: #e53935 !important;
    }

    .ec-event-personal {
      border-color: #9b59b6 !important;
      background-color: #9b59b6 !important;
    }

    /* Multi-assignment gradient colors */
    .ec-event-area-department {
      border-color: #e53935 !important;
      background: linear-gradient(135deg, #e53935 0%, #e67e22 100%) !important;
    }

    .ec-event-area-team {
      border-color: #e53935 !important;
      background: linear-gradient(135deg, #e53935 0%, #2ecc71 100%) !important;
    }

    .ec-event-department-team {
      border-color: #e67e22 !important;
      background: linear-gradient(135deg, #e67e22 0%, #2ecc71 100%) !important;
    }

    .ec-event-area-department-team {
      border-color: #e53935 !important;
      background: linear-gradient(
        135deg,
        #e53935 0%,
        #e67e22 50%,
        #2ecc71 100%
      ) !important;
    }

    /* Shift Indicators (F, S, N) */
    .shift-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 4px;
      margin-top: 3px;
      font-size: 12px;
      font-weight: 700;
      background: var(--glass-bg-active);
      box-shadow: 0 1px 3px rgb(0 0 0 / 30%);
    }

    .shift-indicator.shift-F {
      color: var(--color-blue-400);
    }

    .shift-indicator.shift-S {
      color: var(--color-yellow-400);
    }

    .shift-indicator.shift-N {
      color: var(--color-purple-400);
    }

    /* Vacation Indicators (U) */
    .vacation-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 4px;
      margin-top: 3px;
      font-size: 12px;
      font-weight: 700;
      color: #26a69a;
      background: var(--glass-bg-active);
      box-shadow: 0 1px 3px rgb(0 0 0 / 30%);
    }

    /* FULLSCREEN MODE */
    .calendar-fullscreen-mode #calendarContainer {
      position: absolute !important;
      z-index: 9999 !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      border: 0;
      border-radius: 0 !important;
    }

    .calendar-fullscreen-mode #calendarContainer .card__header {
      position: fixed !important;
      z-index: 10000 !important;
      top: 0 !important;
      right: 0 !important;
      width: auto !important;
      padding: 1rem !important;
      border: 0 !important;
      background: transparent !important;
    }

    .calendar-fullscreen-mode #calendarContainer .card__title {
      display: none !important;
    }

    .calendar-fullscreen-mode #fullscreenBtn {
      display: none !important;
    }

    .calendar-fullscreen-mode #newEventBtn {
      display: none !important;
    }

    .calendar-fullscreen-mode #calendarContainer .card__header .btn {
      border: 1px solid rgb(255 255 255 / 10%);
      backdrop-filter: blur(10px);
    }

    .calendar-fullscreen-mode #calendarContainer .card__header .btn:hover {
      border-color: rgb(255 255 255 / 20%);
    }

    .calendar-fullscreen-mode #calendarContainer .card__body {
      overflow-y: auto;
      height: 100vh !important;
    }

    .calendar-fullscreen-mode #calendar {
      height: calc(100vh - 60px) !important;
    }

    .calendar-fullscreen-mode .ec td,
    .calendar-fullscreen-mode .ec th {
      padding-bottom: 65px;
      vertical-align: top;
    }

    .calendar-fullscreen-mode .sidebar,
    .calendar-fullscreen-mode .header,
    .calendar-fullscreen-mode .stats-container,
    .calendar-fullscreen-mode .card:not(.calendar-card),
    .calendar-fullscreen-mode #breadcrumb-container {
      display: none !important;
    }

    .calendar-fullscreen-mode .ec-body {
      width: 100% !important;
    }

    .calendar-fullscreen-mode .modal-overlay {
      z-index: 1000001 !important;
    }

    .calendar-fullscreen-mode .ds-modal {
      z-index: 1000002 !important;
    }
  }

  /* Responsive */
  @media (width < 768px) {
    :global(.ec-toolbar) {
      flex-direction: column;
    }
  }
</style>

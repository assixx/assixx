<script lang="ts">
  /**
   * Calendar - Page Component
   * SSR: Data loaded in +page.server.ts
   * Level 3: $derived from SSR data + invalidateAll() after mutations
   */
  import {
    Calendar,
    DayGrid,
    TimeGrid,
    List,
    Interaction,
  } from '@event-calendar/core';
  import { onDestroy } from 'svelte';

  import { browser } from '$app/environment';
  import { invalidateAll } from '$app/navigation';

  import '@event-calendar/core/index.css';

  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import { showSuccessAlert, showErrorAlert } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  import { tooltip } from '$design-system/primitives/tooltip/tooltip.svelte';

  import * as api from './_lib/api';
  import { FILTER_OPTIONS, DE_LOCALE } from './_lib/constants';
  import DeleteConfirmModal from './_lib/DeleteConfirmModal.svelte';
  import EventDetailModal from './_lib/EventDetailModal.svelte';
  import EventFormModal from './_lib/EventFormModal.svelte';
  import EventList from './_lib/EventList.svelte';
  import { shiftIndicators } from './_lib/shift-indicators.svelte';
  import { calendarState } from './_lib/state.svelte';
  import { formatDatetimeLocal } from './_lib/utils';
  import { vacationIndicators } from './_lib/vacation-indicators.svelte';

  import type { PageData } from './$types';
  import type {
    CalendarEvent,
    FilterLevel,
    EventFormData,
    EventInput,
    EventHoverInfo,
  } from './_lib/types';

  const log = createLogger('CalendarPage');

  // Modal components

  // ==========================================================================
  // SSR DATA (single source of truth via $derived)
  // ==========================================================================

  const { data }: { data: PageData } = $props();

  // Derived from SSR data
  const upcomingEvents = $derived(data.upcomingEvents);
  const recentlyAddedEvents = $derived(data.recentlyAddedEvents);
  const departments = $derived(data.departments);
  const teams = $derived(data.teams);
  const areas = $derived(data.areas);
  const users = $derived(data.users);
  const currentUser = $derived(data.currentUser);

  // ==========================================================================
  // UI STATE (local only)
  // ==========================================================================

  let isFullscreen = $state(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- Calendar component type from @event-calendar/core lacks proper types
  let calendarRef: any = $state();

  // Form state
  let formData = $state<EventFormData>({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    allDay: false,
    location: '',
    orgLevel: 'personal',
    departmentIds: [],
    teamIds: [],
    areaIds: [],
    attendeeIds: [],
    recurrence: undefined,
    recurrenceEndType: undefined,
    recurrenceCount: undefined,
    recurrenceUntil: undefined,
  });

  // ==========================================================================
  // CALENDAR OPTIONS
  // ==========================================================================

  /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- @event-calendar/core lacks types */
  function refetchCalendarEvents(): void {
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

  const calendarPlugins = $derived([DayGrid, TimeGrid, List, Interaction]);
  const calendarOptions = $derived({
    view: 'dayGridMonth',
    locale: 'de',
    headerToolbar: {
      start: 'prev,next today',
      center: 'title',
      end: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
    },
    buttonText: DE_LOCALE.buttonText,
    firstDay: 1,
    editable: calendarState.isAdmin,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: true,
    nowIndicator: true,
    height: 'auto',
    eventSources: [{ events: fetchEvents }],
    eventClick: handleCalendarEventClick,
    dateClick: handleCalendarDateClick,
    select: handleCalendarSelect,
    eventMouseEnter: handleEventMouseEnter,
    eventMouseLeave: handleEventMouseLeave,
    eventDragStart: handleEventDragStart,
  });

  // ==========================================================================
  // TOOLTIP HANDLERS (using Design System utility)
  // ==========================================================================

  // Register cleanup on SvelteKit navigation
  tooltip.registerNavigationCleanup();

  function handleEventMouseEnter(info: EventHoverInfo): void {
    const extendedProps = info.event.extendedProps ?? {};
    const description = extendedProps.description ?? '';
    const location = extendedProps.location ?? '';

    tooltip.show(info.el, {
      content: info.event.title,
      description: description !== '' ? description : undefined,
      location: location !== '' ? location : undefined,
      position: 'bottom',
      variant: 'info',
    });
  }

  function handleEventMouseLeave(info: EventHoverInfo): void {
    tooltip.hide(info.el);
  }

  function handleEventDragStart(): void {
    // Remove tooltip when drag starts - prevents orphaned tooltips
    tooltip.hideAll();
  }

  // ==========================================================================
  // SYNC STATE STORE (for child components that use it)
  // ==========================================================================

  $effect(() => {
    // One-time setup
    calendarState.loadSavedFilter();
  });

  // Mark calendar as visited and reset notification badge
  let hasMarkedVisit = $state(false);
  $effect(() => {
    if (!hasMarkedVisit && browser) {
      hasMarkedVisit = true;
      void api.markCalendarVisited();
      notificationStore.resetCount('calendar');
      log.debug('Calendar visit marked, badge reset');
    }
  });

  $effect(() => {
    // Sync SSR data to store for child components
    if (currentUser !== null) {
      calendarState.setUser(currentUser);
    }
    calendarState.setOrganizationData({ departments, teams, areas, users });
    calendarState.setLoading(false);
  });

  onDestroy(() => {
    tooltip.hideAll();
    calendarState.reset();
  });

  // ==========================================================================
  // CALENDAR EVENT HANDLERS
  // ==========================================================================

  async function fetchEvents(fetchInfo: {
    startStr: string;
    endStr: string;
  }): Promise<EventInput[]> {
    try {
      // Fetch shifts + vacations in parallel (for DOM rendering later)
      if (shiftIndicators.showShifts) {
        void shiftIndicators.fetchAndRenderShifts(
          fetchInfo.startStr,
          fetchInfo.endStr,
        );
      }
      if (vacationIndicators.showVacations) {
        void vacationIndicators.fetchAndRenderVacations(
          fetchInfo.startStr,
          fetchInfo.endStr,
        );
      }

      return await api.loadCalendarEvents(
        fetchInfo.startStr,
        fetchInfo.endStr,
        calendarState.currentFilter,
        calendarState.currentSearch,
      );
    } catch (err) {
      log.error({ err }, 'Error loading events');
      return [];
    }
  }

  function handleCalendarEventClick(info: {
    event: { id: string };
    jsEvent: MouseEvent;
  }): void {
    info.jsEvent.preventDefault();
    void handleEventClick(Number.parseInt(info.event.id, 10));
  }

  function handleCalendarDateClick(info: { date: Date; allDay: boolean }) {
    log.debug({ info }, 'Date clicked');
    if (isFullscreen) {
      log.debug({}, 'Date click disabled in fullscreen mode');
      return;
    }
    handleDateClick(info.date, info.allDay);
  }

  function handleCalendarSelect(info: {
    start: Date;
    end: Date;
    allDay: boolean;
  }) {
    if (isFullscreen) return;
    handleDateSelect(info.start, info.end, info.allDay);
  }

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  async function handleEventClick(eventId: number) {
    const event = await api.fetchEventData(eventId);
    if (event !== null) calendarState.openDetailModal(event);
  }

  function handleDateClick(date: Date, allDay: boolean) {
    openEventForm(date, undefined, allDay);
  }

  function handleDateSelect(start: Date, end: Date, allDay: boolean) {
    openEventForm(start, end, allDay);
  }

  function handleFilterChange(filter: FilterLevel) {
    calendarState.setFilter(filter);
    refetchCalendarEvents();
  }

  // ==========================================================================
  // EVENT FORM
  // ==========================================================================

  function openEventForm(
    startDate?: Date,
    endDate?: Date,
    allDay: boolean = false,
  ): void {
    log.debug({ startDate, endDate, allDay }, 'Opening event form');
    const now = startDate ?? new Date();
    const later = endDate ?? new Date(now.getTime() + 60 * 60 * 1000);

    formData = {
      title: '',
      description: '',
      startTime: formatDatetimeLocal(now),
      endTime: formatDatetimeLocal(later),
      allDay,
      location: '',
      orgLevel: 'personal',
      departmentIds: [],
      teamIds: [],
      areaIds: [],
      attendeeIds: [],
      recurrence: undefined,
      recurrenceEndType: undefined,
      recurrenceCount: undefined,
      recurrenceUntil: undefined,
    };

    calendarState.openEventModal(startDate);
    log.debug({ isAdmin: calendarState.isAdmin }, 'Modal configured');
  }

  /** Convert optional single ID to array for multi-select pre-population */
  function toIdArray(id: number | null | undefined): number[] {
    return id !== null && id !== undefined ? [id] : [];
  }

  function openEditForm(event: CalendarEvent) {
    formData = {
      title: event.title,
      description: event.description ?? '',
      startTime: formatDatetimeLocal(new Date(event.startTime)),
      endTime: formatDatetimeLocal(new Date(event.endTime)),
      allDay: event.allDay,
      location: event.location ?? '',
      orgLevel: event.orgLevel,
      departmentIds: toIdArray(event.departmentId),
      teamIds: toIdArray(event.teamId),
      areaIds: toIdArray(event.areaId),
      attendeeIds: event.attendees?.map((a) => a.userId) ?? [],
      recurrence: undefined,
      recurrenceEndType: undefined,
      recurrenceCount: undefined,
      recurrenceUntil: undefined,
    };

    calendarState.closeDetailModal();
    calendarState.openEventModal(undefined, event);
  }

  async function handleSaveEvent() {
    const isEditMode = calendarState.editingEvent !== null;
    const result = await api.saveEvent(
      { ...formData, attendeeIds: calendarState.selectedAttendees },
      calendarState.editingEvent?.id,
    );

    if (result.success) {
      calendarState.closeEventModal();
      refetchCalendarEvents();
      await invalidateAll();
      showSuccessAlert(isEditMode ? 'Termin aktualisiert' : 'Termin erstellt');
    } else {
      log.error({ error: result.error }, 'Save failed');
      showErrorAlert(result.error ?? 'Fehler beim Speichern des Termins');
    }
  }

  // ==========================================================================
  // DELETE EVENT
  // ==========================================================================

  function handleDeleteClick(eventId: number) {
    calendarState.closeDetailModal();
    calendarState.openDeleteModal(eventId);
  }

  async function handleConfirmDelete() {
    if (calendarState.eventToDelete === null) return;

    const result = await api.deleteEvent(calendarState.eventToDelete);

    if (result.success) {
      calendarState.closeDeleteModal();
      refetchCalendarEvents();
      await invalidateAll();
      showSuccessAlert('Termin wurde gelöscht');
    } else {
      log.error({ error: result.error }, 'Delete failed');
      showErrorAlert(result.error ?? 'Fehler beim Löschen des Termins');
    }
  }

  // ==========================================================================
  // FULLSCREEN
  // ==========================================================================

  async function toggleFullscreen(): Promise<void> {
    // Note: isFullscreen is synced via fullscreenchange event in $effect below
    if (!isFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        log.error({ err }, 'Fullscreen error');
      }
    } else {
      await document.exitFullscreen();
    }
  }

  $effect(() => {
    function handleFullscreenChange() {
      isFullscreen = document.fullscreenElement !== null;
      document.body.classList.toggle('calendar-fullscreen-mode', isFullscreen);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.body.classList.remove('calendar-fullscreen-mode');
    };
  });
</script>

<!-- ========================================================================
     MAIN CONTENT
     ======================================================================== -->

<div class="container">
  <!-- Filter Card -->
  <div class="card mb-6">
    <div class="card__header">
      <h3 class="card__title">
        <i class="fas fa-filter mr-2"></i>
        Filter & Anzeige
      </h3>
      <div class="mt-6 flex flex-wrap items-end justify-between gap-6">
        <!-- Level Filter -->
        <div class="form-field">
          <span class="form-field__label">Organisationsebene</span>
          <div
            class="toggle-group mt-2"
            id="levelFilter"
          >
            {#each FILTER_OPTIONS as option (option.value)}
              <button
                type="button"
                class="toggle-group__btn"
                class:active={calendarState.currentFilter === option.value}
                data-value={option.value}
                onclick={() => {
                  handleFilterChange(option.value as FilterLevel);
                }}
                title={option.title}
              >
                <i class="fas {option.icon}"></i>
                {option.label}
              </button>
            {/each}
            <!-- Schichten Toggle -->
            <button
              type="button"
              class="toggle-group__btn"
              class:active={shiftIndicators.showShifts}
              id="showShiftsToggle"
              title="Schichten anzeigen/ausblenden"
              data-action="toggle-shifts"
              onclick={() => {
                const isNowActive = shiftIndicators.toggle();
                if (isNowActive) {
                  refetchCalendarEvents();
                }
              }}
            >
              <i class="fas fa-clock"></i>
              Schichten
            </button>
            <!-- Urlaub Toggle -->
            <button
              type="button"
              class="toggle-group__btn"
              class:active={vacationIndicators.showVacations}
              id="showVacationsToggle"
              title="Urlaub anzeigen/ausblenden"
              data-action="toggle-vacations"
              onclick={() => {
                const isNowActive = vacationIndicators.toggle();
                if (isNowActive) {
                  refetchCalendarEvents();
                }
              }}
            >
              <i class="fas fa-umbrella-beach"></i>
              Urlaub
            </button>
          </div>
        </div>

        <!-- Legend -->
        <div class="form-field">
          <span class="form-field__label">Legende</span>
          <div class="legend-container mt-2">
            <div class="legend-item">
              <span class="legend-color legend-company"></span>
              <span class="legend-label">Firma</span>
            </div>
            <div class="legend-item">
              <span class="legend-color legend-area"></span>
              <span class="legend-label">Bereich</span>
            </div>
            <div class="legend-item">
              <span class="legend-color legend-department"></span>
              <span class="legend-label">Abteilung</span>
            </div>
            <div class="legend-item">
              <span class="legend-color legend-team"></span>
              <span class="legend-label">Team</span>
            </div>
            <div class="legend-item">
              <span class="legend-color legend-personal"></span>
              <span class="legend-label">Persoenlich</span>
            </div>
            <div class="legend-item">
              <span class="legend-color legend-vacation"></span>
              <span class="legend-label">Urlaub</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Calendar Card -->
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
            onclick={toggleFullscreen}
            title="Vollbild"
          >
            <i class="fas fa-expand"></i>
          </button>
          <button
            type="button"
            id="newEventBtn"
            class="btn btn-primary"
            onclick={() => {
              openEventForm();
            }}
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
          plugins={calendarPlugins}
          options={calendarOptions}
        />
      </div>
    </div>
  </div>

  <!-- Two-column layout for events -->
  <div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
    <EventList
      title="Anstehende Termine"
      icon="fa-clock"
      subtitle="(Aktueller Monat)"
      emptyStateMessage="Keine anstehenden Termine in diesem Monat."
      events={upcomingEvents}
      onEventClick={handleEventClick}
    />
    <EventList
      title="Neueste Termine"
      icon="fa-plus-circle"
      emptyStateMessage="Keine neuen Termine hinzugefuegt."
      events={recentlyAddedEvents}
      onEventClick={handleEventClick}
    />
  </div>
</div>

<!-- ========================================================================
     MODALS
     ======================================================================== -->

{#if calendarState.showDetailModal && calendarState.viewingEvent}
  <EventDetailModal
    event={calendarState.viewingEvent}
    canEdit={calendarState.canEditEvent(calendarState.viewingEvent)}
    canDelete={calendarState.canDeleteEvent(calendarState.viewingEvent)}
    isPast={calendarState.isEventPast(calendarState.viewingEvent)}
    {areas}
    {departments}
    {teams}
    onclose={() => {
      calendarState.closeDetailModal();
    }}
    onedit={openEditForm}
    ondelete={handleDeleteClick}
  />
{/if}

{#if calendarState.showEventModal}
  <EventFormModal
    bind:formData
    editingEvent={calendarState.editingEvent}
    isAdmin={calendarState.isAdmin}
    departments={calendarState.departments}
    teams={calendarState.teams}
    areas={calendarState.areas}
    onclose={() => {
      calendarState.closeEventModal();
    }}
    onsave={handleSaveEvent}
  />
{/if}

{#if calendarState.showDeleteModal}
  <DeleteConfirmModal
    onclose={() => {
      calendarState.closeDeleteModal();
    }}
    onconfirm={handleConfirmDelete}
  />
{/if}

<!-- ========================================================================
     STYLES
     ======================================================================== -->

<style>
  /* Calendar container (in template) */
  :global(#calendar) {
    width: 100%;
    padding: 10px;
  }

  /*
   * ALL styles below target @event-calendar library components,
   * child components (EventList, EventDetailModal), or body-level classes.
   * Using :global block since this page is an orchestrator.
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

    /* Upcoming Events */
    .upcoming-events {
      overflow-y: auto;
      max-height: 300px;
    }

    .event-item {
      display: flex;
      padding: 10px;
      border-bottom: 1px solid var(--border-color);
    }

    .event-item:last-child {
      border-bottom: none;
    }

    .event-item:hover {
      background-color: rgb(var(--primary-rgb), 0.05);
    }

    .event-date {
      display: flex;
      flex: 0 0 90px;
      flex-direction: column;
      justify-content: center;
      margin-right: 15px;
      padding: 10px;
      border-radius: var(--radius-xl);
      text-align: center;
      background-color: var(--background-dark);
    }

    .event-day {
      font-size: 1.5rem;
      font-weight: 700;
      line-height: 1;
      color: var(--primary-color);
    }

    .event-month {
      font-size: 0.8rem;
      color: var(--text-secondary);
      text-transform: uppercase;
    }

    .event-time {
      margin-top: 5px;
      font-size: 0.8rem;
      color: var(--text-secondary);
    }

    .event-time--created {
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--color-primary);
      font-weight: 500;
    }

    .event-time--created i {
      font-size: 0.75rem;
    }

    .event-details {
      flex: 1;
    }

    .event-title {
      margin-bottom: 5px;
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .event-location {
      display: flex;
      align-items: center;
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    .event-location i {
      margin-right: 5px;
    }

    .event-level {
      display: inline-block;
      width: fit-content;
      margin-top: 5px;
      padding: 2px 8px;
      border-radius: var(--radius-xl);
      font-size: 0.7rem;
      color: #fff;
    }

    .event-level-company {
      background-color: #3498db;
    }

    .event-level-department {
      background-color: #e67e22;
    }

    .event-level-team {
      background-color: #2ecc71;
    }

    .event-level-area {
      background-color: #e53935;
    }

    .event-level-personal {
      background-color: #9b59b6;
    }

    .event-badges {
      display: grid;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 5px;
    }

    .event-badges .event-level {
      margin-top: 0;
    }
  }

  /* Legend (in template) */
  .legend-container {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    margin-top: 5px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    font-size: 0.85rem;
  }

  .legend-color {
    width: 14px;
    height: 14px;
    margin-right: 5px;
    border-radius: 3px;
  }

  .legend-company {
    background-color: #3498db;
  }

  .legend-department {
    background-color: #e67e22;
  }

  .legend-team {
    background-color: #2ecc71;
  }

  .legend-area {
    background-color: #e53935;
  }

  .legend-personal {
    background-color: #9b59b6;
  }

  .legend-vacation {
    background-color: #26a69a;
  }

  /* Event Detail Modal Content (child component) */
  :global {
    #eventDetailContent h3 {
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid rgb(255 255 255 / 10%);
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--primary-color);
    }

    #eventDetailContent p {
      margin-bottom: 20px;
      padding: 15px;
      border-radius: var(--radius-xl);
      border: 1px solid var(--color-glass-border);
      font-size: 1rem;
      line-height: 1.6;
      color: var(--text-secondary);
      background: var(--glass-bg);
    }

    .event-details-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 15px;
      margin: 20px 0;
      padding: 24px;
      border: 1px solid var(--color-glass-border);
      border-radius: var(--radius-xl);
      background: var(--glass-bg);
    }

    .detail-item {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid var(--color-glass-border);
    }

    .detail-item:last-child {
      border-bottom: none;
    }

    .detail-item:hover {
      margin: 0 -10px;
      padding-right: 10px;
      padding-left: 10px;
      border-radius: var(--radius-xl);
      background: var(--glass-bg);
    }

    .detail-item i {
      flex-shrink: 0;
      width: 20px;
      font-size: 1rem;
      color: var(--primary-color);
      text-align: center;
    }

    .detail-item span {
      flex: 1;
      font-size: 0.95rem;
      color: var(--text-primary);
    }

    #eventDetailContent h4 {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-top: 30px;
      margin-bottom: 15px;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    #eventDetailContent h4::before {
      content: '';
      width: 4px;
      height: 20px;
      border-radius: 2px;
      background: var(--primary-color);
    }

    .attendee-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 10px;
      margin-bottom: 20px;
    }

    .attendee-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 15px;
      border: 1px solid var(--color-glass-border);
      border-radius: var(--radius-xl);
      background: rgb(255 255 255 / 3%);
    }

    .attendee-item:hover {
      border-color: rgb(255 255 255 / 12%);
      background: rgb(255 255 255 / 5%);
    }

    .modal-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid rgb(255 255 255 / 10%);
    }

    .modal-actions .btn {
      justify-content: center;
      min-width: 120px;
    }

    .modal-actions .btn-primary,
    .modal-actions .btn-danger {
      flex: 0 1 auto;
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
    :global(.event-date) {
      flex: 0 0 70px;
    }

    :global(.ec-toolbar) {
      flex-direction: column;
    }
  }
</style>

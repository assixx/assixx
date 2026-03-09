<script lang="ts">
  /**
   * Calendar - Page Component
   * SSR: Data loaded in +page.server.ts
   * Level 3: $derived from SSR data + invalidateAll() after mutations
   */
  import { DayGrid, TimeGrid, List, Interaction } from '@event-calendar/core';
  import { onDestroy } from 'svelte';

  import { browser } from '$app/environment';
  import { goto, invalidateAll } from '$app/navigation';

  import '@event-calendar/core/index.css';

  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import { showSuccessAlert, showErrorAlert } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  import { tooltip } from '$design-system/primitives/tooltip/tooltip.svelte';

  import * as api from './_lib/api';
  import CalendarView from './_lib/CalendarView.svelte';
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

  // ==========================================================================
  // SSR DATA (single source of truth via $derived)
  // ==========================================================================

  const { data }: { data: PageData } = $props();

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
  let showWorkOrders = $state(
    browser ?
      localStorage.getItem('showWorkOrdersInCalendar') === 'true'
    : false,
  );

  function toggleWorkOrders(): boolean {
    showWorkOrders = !showWorkOrders;
    if (browser) {
      localStorage.setItem('showWorkOrdersInCalendar', String(showWorkOrders));
    }
    return showWorkOrders;
  }

  let showTpmAssignments = $state(
    browser ? localStorage.getItem('showTpmInCalendar') === 'true' : false,
  );

  function toggleTpmAssignments(): boolean {
    showTpmAssignments = !showTpmAssignments;
    if (browser) {
      localStorage.setItem('showTpmInCalendar', String(showTpmAssignments));
    }
    return showTpmAssignments;
  }

  interface CalendarViewRef {
    refetchEvents(): void;
  }
  let calendarViewRef = $state<CalendarViewRef | null>(null);

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

  function refetchCalendarEvents(): void {
    calendarViewRef?.refetchEvents();
  }

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

      // Fetch calendar events + work orders + TPM assignments in parallel
      const [calendarEvents, workOrderEvents, tpmEvents] = await Promise.all([
        api.loadCalendarEvents(
          fetchInfo.startStr,
          fetchInfo.endStr,
          calendarState.currentFilter,
          calendarState.currentSearch,
        ),
        showWorkOrders ?
          api.loadWorkOrdersForCalendar(fetchInfo.startStr, fetchInfo.endStr)
        : Promise.resolve([]),
        showTpmAssignments ?
          api.loadTpmAssignmentsForCalendar(
            fetchInfo.startStr,
            fetchInfo.endStr,
          )
        : Promise.resolve([]),
      ]);

      return [...calendarEvents, ...workOrderEvents, ...tpmEvents];
    } catch (err: unknown) {
      log.error({ err }, 'Error loading events');
      return [];
    }
  }

  function handleCalendarEventClick(info: {
    event: { id: string };
    jsEvent: MouseEvent;
  }): void {
    info.jsEvent.preventDefault();

    // Work order events: navigate to detail page
    if (info.event.id.startsWith('wo:')) {
      const uuid = info.event.id.slice(3);
      void goto(`/work-orders/${uuid}`);
      return;
    }

    // TPM assignment events: navigate to TPM board
    if (info.event.id.startsWith('tpm:')) {
      const planUuid = info.event.id.split(':')[1];
      void goto(`/lean-management/tpm/board/${planUuid}`);
      return;
    }

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
      } catch (err: unknown) {
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
            <!-- Arbeitsaufträge Toggle -->
            <button
              type="button"
              class="toggle-group__btn"
              class:active={showWorkOrders}
              id="showWorkOrdersToggle"
              title="Arbeitsaufträge anzeigen/ausblenden"
              data-action="toggle-work-orders"
              onclick={() => {
                toggleWorkOrders();
                refetchCalendarEvents();
              }}
            >
              <i class="fas fa-wrench"></i>
              Aufträge
            </button>
            <!-- TPM Toggle -->
            <button
              type="button"
              class="toggle-group__btn"
              class:active={showTpmAssignments}
              id="showTpmToggle"
              title="TPM-Wartungstermine anzeigen/ausblenden"
              data-action="toggle-tpm"
              onclick={() => {
                toggleTpmAssignments();
                refetchCalendarEvents();
              }}
            >
              <i class="fas fa-tools"></i>
              TPM
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
            <div class="legend-item">
              <span class="legend-color legend-work-order"></span>
              <span class="legend-label">Aufträge</span>
            </div>
            <div class="legend-item">
              <span class="legend-color legend-tpm"></span>
              <span class="legend-label">TPM</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Calendar Card (extracted into CalendarView) -->
  <CalendarView
    bind:this={calendarViewRef}
    plugins={calendarPlugins}
    options={calendarOptions}
    onNewEvent={() => {
      openEventForm();
    }}
    onToggleFullscreen={toggleFullscreen}
  />

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

<style>
  /* ─── Legend ──────── */

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
    background-color: var(--color-sky);
  }

  .legend-department {
    background-color: var(--color-carrot);
  }

  .legend-team {
    background-color: var(--color-emerald);
  }

  .legend-area {
    background-color: var(--color-danger-hover);
  }

  .legend-personal {
    background-color: var(--color-purple);
  }

  .legend-vacation {
    background-color: var(--color-teal-400);
  }

  .legend-work-order {
    background-color: var(--color-slate);
  }

  .legend-tpm {
    background-color: #5bb5f5;
  }
</style>

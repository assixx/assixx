<script lang="ts">
  /**
   * Calendar - Page Component
   * SSR: Data loaded in +page.server.ts
   * Level 3: $derived from SSR data + invalidateAll() after mutations
   */
  import { Calendar, DayGrid, TimeGrid, List, Interaction } from '@event-calendar/core';
  import { onDestroy } from 'svelte';

  import { browser } from '$app/environment';
  import { invalidateAll } from '$app/navigation';

  import '@event-calendar/core/index.css';
  // Global calendar styles - MUST be imported for legend-*, event-level-*, etc. classes
  import '$styles/calendar.css';

  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import { showSuccessAlert, showErrorAlert } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  import { tooltip } from '$design-system/primitives/tooltip/tooltip.svelte';

  import * as api from './_lib/api';
  import { FILTER_OPTIONS, DE_LOCALE } from './_lib/constants';
  import DeleteConfirmModal from './_lib/DeleteConfirmModal.svelte';
  import EventDetailModal from './_lib/EventDetailModal.svelte';
  import EventFormModal from './_lib/EventFormModal.svelte';
  import { calendarState } from './_lib/state.svelte';
  import { getUpcomingEventTimeStr, getEventLevelInfo, formatDatetimeLocal } from './_lib/utils';

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
  // Load showShifts from localStorage (only in browser)
  let showShifts = $state(
    browser ? localStorage.getItem('showShiftsInCalendar') === 'true' : false,
  );
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

  // ==========================================================================
  // SHIFT INDICATORS (Legacy DOM-based approach)
  // ==========================================================================

  // Cache for shift data (dateKey -> shift) - not reactive, just storage for DOM rendering

  const shiftsCache = $state<Map<string, { type: 'F' | 'S' | 'N' }>>(new Map());

  /**
   * Render shift indicators in calendar cells (Legacy approach)
   * EventCalendar uses: .ec-day > .ec-day-head > time[datetime="YYYY-MM-DD"]
   * Indicator goes INSIDE .ec-day-head, next to the day number
   */
  function renderShiftIndicators(): void {
    // Remove existing indicators first
    document.querySelectorAll('.shift-indicator').forEach((el) => {
      el.remove();
    });

    if (!showShifts || shiftsCache.size === 0) return;

    // Find all day head containers (EventCalendar structure)
    const dayHeads = document.querySelectorAll('.ec-day .ec-day-head');

    let renderedCount = 0;
    dayHeads.forEach((dayHead) => {
      const timeEl = dayHead.querySelector('time[datetime]');
      if (!timeEl) return;

      const dateAttr = timeEl.getAttribute('datetime');
      if (dateAttr === null) return;

      const shift = shiftsCache.get(dateAttr);
      if (!shift) return;

      // Create shift indicator
      const indicator = document.createElement('div');
      indicator.className = `shift-indicator shift-${shift.type}`;
      indicator.textContent = shift.type;
      indicator.setAttribute(
        'aria-label',
        `Schicht: ${shift.type === 'F' ? 'Frühschicht' : shift.type === 'S' ? 'Spätschicht' : 'Nachtschicht'}`,
      );

      // Insert AFTER time - library uses row-reverse, so visually indicator appears LEFT
      dayHead.appendChild(indicator);
      renderedCount++;
    });

    log.debug({ renderedCount, cachedCount: shiftsCache.size }, 'Rendered shift indicators');
  }

  /**
   * Fetch and cache shifts, then render indicators
   */
  async function fetchAndRenderShifts(startStr: string, endStr: string): Promise<void> {
    if (!showShifts) {
      shiftsCache.clear();
      return;
    }

    log.debug({ startStr, endStr }, 'Fetching shifts');
    const shifts = await api.loadUserShifts(startStr, endStr);

    // Build cache
    shiftsCache.clear();
    for (const shift of shifts) {
      // Extract date part (YYYY-MM-DD)
      const dateOnly = shift.date.split('T')[0] ?? '';
      shiftsCache.set(dateOnly, { type: shift.type });
    }

    log.debug({ size: shiftsCache.size }, 'Cached shifts');

    // Small delay to ensure DOM is rendered, then add indicators
    setTimeout(renderShiftIndicators, 100);
  }

  async function fetchEvents(fetchInfo: {
    startStr: string;
    endStr: string;
  }): Promise<EventInput[]> {
    try {
      // Fetch shifts in parallel (for DOM rendering later)
      if (showShifts) {
        void fetchAndRenderShifts(fetchInfo.startStr, fetchInfo.endStr);
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

  function handleCalendarEventClick(info: { event: { id: string }; jsEvent: MouseEvent }): void {
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

  function handleCalendarSelect(info: { start: Date; end: Date; allDay: boolean }) {
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

  function openEventForm(startDate?: Date, endDate?: Date, allDay: boolean = false): void {
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
      <div class="flex gap-6 flex-wrap items-end justify-between mt-6">
        <!-- Level Filter -->
        <div class="form-field">
          <span class="form-field__label">Organisationsebene</span>
          <div class="toggle-group mt-2" id="levelFilter">
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
              class:active={showShifts}
              id="showShiftsToggle"
              title="Schichten anzeigen/ausblenden"
              data-action="toggle-shifts"
              onclick={() => {
                showShifts = !showShifts;
                log.debug({ showShifts }, 'Shifts toggle');
                // Persist to localStorage
                if (browser) {
                  localStorage.setItem('showShiftsInCalendar', String(showShifts));
                }
                // Render or remove shift indicators
                if (showShifts) {
                  refetchCalendarEvents(); // This triggers fetchAndRenderShifts
                } else {
                  // Remove all shift indicators
                  document.querySelectorAll('.shift-indicator').forEach((el) => {
                    el.remove();
                  });
                  shiftsCache.clear();
                }
              }}
            >
              <i class="fas fa-clock"></i>
              Schichten
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
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Calendar Card -->
  <div class="card calendar-card mb-6" id="calendarContainer">
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
        <Calendar bind:this={calendarRef} plugins={calendarPlugins} options={calendarOptions} />
      </div>
    </div>
  </div>

  <!-- Two-column layout for events -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
    <!-- Upcoming Events (Current Month) -->
    <div class="card">
      <div class="card__header">
        <h3 class="card__title">
          <i class="fas fa-clock mr-2"></i>
          Anstehende Termine
          <span class="text-sm font-normal text-[var(--color-text-secondary)] ml-2">
            (Aktueller Monat)
          </span>
        </h3>
      </div>
      <div class="card__body">
        <div class="upcoming-events">
          {#if upcomingEvents.length === 0}
            <p class="text-center text-[var(--color-text-secondary)]">
              Keine anstehenden Termine in diesem Monat.
            </p>
          {:else}
            {#each upcomingEvents as event (event.id)}
              {@const levelInfo = getEventLevelInfo(event.orgLevel)}
              {@const hasArea = event.areaId !== null && event.areaId !== undefined}
              {@const hasDept = event.departmentId !== null && event.departmentId !== undefined}
              {@const hasTeam = event.teamId !== null && event.teamId !== undefined}
              <button
                type="button"
                class="event-item w-full text-left"
                onclick={() => handleEventClick(event.id)}
              >
                <div class="event-date">
                  <span class="event-day">{new Date(event.startTime).getDate()}</span>
                  <span class="event-month">
                    {new Date(event.startTime).toLocaleDateString('de-DE', { month: 'short' })}
                  </span>
                  <span class="event-time">{getUpcomingEventTimeStr(event)}</span>
                </div>
                <div class="event-details">
                  <div class="event-title">{event.title}</div>
                  {#if event.location}
                    <div class="event-location">
                      <i class="fas fa-map-marker-alt"></i>
                      {event.location}
                    </div>
                  {/if}
                  <div class="event-badges">
                    {#if hasArea}
                      <span class="event-level event-level-area">Bereich</span>
                    {/if}
                    {#if hasDept}
                      <span class="event-level event-level-department">Abteilung</span>
                    {/if}
                    {#if hasTeam}
                      <span class="event-level event-level-team">Team</span>
                    {/if}
                    {#if !hasArea && !hasDept && !hasTeam}
                      <span class="event-level {levelInfo.class}">{levelInfo.text}</span>
                    {/if}
                  </div>
                </div>
              </button>
            {/each}
          {/if}
        </div>
      </div>
    </div>

    <!-- Recently Added Events -->
    <div class="card">
      <div class="card__header">
        <h3 class="card__title">
          <i class="fas fa-plus-circle mr-2"></i>
          Neueste Termine
        </h3>
      </div>
      <div class="card__body">
        <div class="upcoming-events">
          {#if recentlyAddedEvents.length === 0}
            <p class="text-center text-[var(--color-text-secondary)]">
              Keine neuen Termine hinzugefuegt.
            </p>
          {:else}
            {#each recentlyAddedEvents as event (event.id)}
              {@const levelInfo = getEventLevelInfo(event.orgLevel)}
              {@const hasArea = event.areaId !== null && event.areaId !== undefined}
              {@const hasDept = event.departmentId !== null && event.departmentId !== undefined}
              {@const hasTeam = event.teamId !== null && event.teamId !== undefined}
              <button
                type="button"
                class="event-item w-full text-left"
                onclick={() => handleEventClick(event.id)}
              >
                <div class="event-date">
                  <span class="event-day">{new Date(event.startTime).getDate()}</span>
                  <span class="event-month">
                    {new Date(event.startTime).toLocaleDateString('de-DE', { month: 'short' })}
                  </span>
                  <span class="event-time">{getUpcomingEventTimeStr(event)}</span>
                </div>
                <div class="event-details">
                  <div class="event-title">{event.title}</div>
                  {#if event.location}
                    <div class="event-location">
                      <i class="fas fa-map-marker-alt"></i>
                      {event.location}
                    </div>
                  {/if}
                  <div class="event-badges">
                    {#if hasArea}
                      <span class="event-level event-level-area">Bereich</span>
                    {/if}
                    {#if hasDept}
                      <span class="event-level event-level-department">Abteilung</span>
                    {/if}
                    {#if hasTeam}
                      <span class="event-level event-level-team">Team</span>
                    {/if}
                    {#if !hasArea && !hasDept && !hasTeam}
                      <span class="event-level {levelInfo.class}">{levelInfo.text}</span>
                    {/if}
                  </div>
                </div>
              </button>
            {/each}
          {/if}
        </div>
      </div>
    </div>
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
  /* EventCalendar CSS variables */
  :root {
    --ec-border-color: hsl(0deg 0% 83.5% / 35%);
  }

  /* Calendar container */
  #calendar {
    width: 100%;
    padding: 10px;
  }

  /* ==========================================================================
     ALL LEGEND, UPCOMING EVENTS, EVENT-LEVEL STYLES ARE IN:
     $styles/calendar.css (imported at top of file)

     DO NOT DUPLICATE HERE - use global CSS only!
     ========================================================================== */
</style>

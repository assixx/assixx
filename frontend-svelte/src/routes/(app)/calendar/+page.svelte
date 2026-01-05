<script lang="ts">
  /**
   * Calendar - Page Component
   * SSR: Data loaded in +page.server.ts
   * Level 3: $derived from SSR data + invalidateAll() after mutations
   */
  import { onDestroy } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { Calendar, DayGrid, TimeGrid, List, Interaction } from '@event-calendar/core';
  import '@event-calendar/core/index.css';
  // Global calendar styles - MUST be imported for legend-*, event-level-*, etc. classes
  import '$styles/calendar.css';
  import type { PageData } from './$types';
  import { calendarState } from './_lib/state.svelte';
  import * as api from './_lib/api';
  import { browser } from '$app/environment';
  import { FILTER_OPTIONS, DE_LOCALE } from './_lib/constants';
  import { getUpcomingEventTimeStr, getEventLevelInfo, formatDatetimeLocal } from './_lib/utils';
  import type {
    CalendarEvent,
    FilterLevel,
    EventFormData,
    EventInput,
    EventHoverInfo,
  } from './_lib/types';
  // Modal components
  import EventDetailModal from './_lib/EventDetailModal.svelte';
  import EventFormModal from './_lib/EventFormModal.svelte';
  import DeleteConfirmModal from './_lib/DeleteConfirmModal.svelte';

  // ==========================================================================
  // SSR DATA (single source of truth via $derived)
  // ==========================================================================

  const { data }: { data: PageData } = $props();

  // Derived from SSR data
  const upcomingEvents = $derived(data?.upcomingEvents ?? []);
  const departments = $derived(data?.departments ?? []);
  const teams = $derived(data?.teams ?? []);
  const areas = $derived(data?.areas ?? []);
  const users = $derived(data?.users ?? []);
  const currentUser = $derived(data?.currentUser ?? null);

  // ==========================================================================
  // UI STATE (local only)
  // ==========================================================================

  let isFullscreen = $state(false);
  // Load showShifts from localStorage (only in browser)
  let showShifts = $state(
    browser ? localStorage.getItem('showShiftsInCalendar') === 'true' : false,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Calendar component type from @event-calendar/core
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
    departmentId: undefined,
    teamId: undefined,
    areaId: undefined,
    reminderMinutes: undefined,
    attendeeIds: [],
    recurrence: undefined,
    recurrenceEndType: undefined,
    recurrenceCount: undefined,
    recurrenceUntil: undefined,
  });

  // ==========================================================================
  // CALENDAR OPTIONS
  // ==========================================================================

  function refetchCalendarEvents() {
    if (calendarRef) {
      if (typeof calendarRef.refetchEvents === 'function') {
        console.info('[CALENDAR] Refetching events...');
        calendarRef.refetchEvents();
      } else {
        console.warn('[CALENDAR] refetchEvents not available, calendar may not be ready');
      }
    }
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
  });

  // ==========================================================================
  // TOOLTIP HANDLERS
  // ==========================================================================

  function handleEventMouseEnter(info: EventHoverInfo): void {
    const extendedProps = info.event.extendedProps ?? {};
    const description = extendedProps.description ?? '';
    const location = extendedProps.location;

    let content = `<strong>${info.event.title}</strong>`;
    if (description !== '') content += `<br>${description}`;
    if (location !== undefined && location !== '') {
      content += `<br><i class="fas fa-map-marker-alt"></i> ${location}`;
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip__content tooltip__content--info tooltip__content--bottom show';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.innerHTML = content;
    document.body.append(tooltip);

    const rect = info.el.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.bottom + 8}px`;
    tooltip.style.transform = 'translateX(-50%)';
    tooltip.style.zIndex = '9999';

    (info.el as HTMLElement & { _tooltip?: HTMLElement })._tooltip = tooltip;
  }

  function handleEventMouseLeave(info: EventHoverInfo): void {
    const el = info.el as HTMLElement & { _tooltip?: HTMLElement };
    if (el._tooltip) {
      el._tooltip.remove();
      delete el._tooltip;
    }
  }

  // ==========================================================================
  // SYNC STATE STORE (for child components that use it)
  // ==========================================================================

  $effect(() => {
    // One-time setup
    calendarState.loadSavedFilter();
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
    document.querySelectorAll('.shift-indicator').forEach((el) => el.remove());

    if (!showShifts || shiftsCache.size === 0) return;

    // Find all day head containers (EventCalendar structure)
    const dayHeads = document.querySelectorAll('.ec-day .ec-day-head');

    let renderedCount = 0;
    dayHeads.forEach((dayHead) => {
      const timeEl = dayHead.querySelector('time[datetime]');
      if (!timeEl) return;

      const dateAttr = timeEl.getAttribute('datetime');
      if (!dateAttr) return;

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

    console.info(
      '[CALENDAR] Rendered shift indicators:',
      renderedCount,
      'of',
      shiftsCache.size,
      'cached',
    );
  }

  /**
   * Fetch and cache shifts, then render indicators
   */
  async function fetchAndRenderShifts(startStr: string, endStr: string): Promise<void> {
    if (!showShifts) {
      shiftsCache.clear();
      return;
    }

    console.info('[CALENDAR] Fetching shifts for:', startStr, '-', endStr);
    const shifts = await api.loadUserShifts(startStr, endStr);

    // Build cache
    shiftsCache.clear();
    for (const shift of shifts) {
      // Extract date part (YYYY-MM-DD)
      const dateOnly = shift.date.split('T')[0] ?? '';
      shiftsCache.set(dateOnly, { type: shift.type });
    }

    console.info('[CALENDAR] Cached shifts:', shiftsCache.size);

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
      console.error('[CALENDAR] Error loading events:', err);
      return [];
    }
  }

  function handleCalendarEventClick(info: { event: { id: string }; jsEvent: MouseEvent }) {
    info.jsEvent.preventDefault();
    handleEventClick(Number.parseInt(info.event.id, 10));
  }

  function handleCalendarDateClick(info: { date: Date; allDay: boolean }) {
    console.info('[CALENDAR] Date clicked:', info);
    if (isFullscreen) {
      console.info('[CALENDAR] Date click disabled in fullscreen mode');
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

  function openEventForm(startDate?: Date, endDate?: Date, allDay = false) {
    console.info('[CALENDAR] Opening event form:', { startDate, endDate, allDay });
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
      departmentId: undefined,
      teamId: undefined,
      areaId: undefined,
      reminderMinutes: undefined,
      attendeeIds: [],
      recurrence: undefined,
      recurrenceEndType: undefined,
      recurrenceCount: undefined,
      recurrenceUntil: undefined,
    };

    calendarState.openEventModal(startDate);
    console.info(
      `[CALENDAR] Modal configured for ${calendarState.isAdmin ? 'admin (all event types)' : 'employee (personal only)'}`,
    );
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
      departmentId: undefined,
      teamId: undefined,
      areaId: undefined,
      reminderMinutes: event.reminderMinutes,
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
    const result = await api.saveEvent(
      { ...formData, attendeeIds: calendarState.selectedAttendees },
      calendarState.editingEvent?.id,
    );

    if (result.success) {
      calendarState.closeEventModal();
      refetchCalendarEvents();
      await invalidateAll();
    } else {
      console.error('[CALENDAR] Save failed:', result.error);
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
    } else {
      console.error('[CALENDAR] Delete failed:', result.error);
    }
  }

  // ==========================================================================
  // FULLSCREEN
  // ==========================================================================

  async function toggleFullscreen() {
    if (!isFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
        isFullscreen = true;
      } catch (err) {
        console.error('[CALENDAR] Fullscreen error:', err);
      }
    } else {
      await document.exitFullscreen();
      isFullscreen = false;
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
                onclick={() => handleFilterChange(option.value as FilterLevel)}
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
                console.info('[CALENDAR] Shifts toggle:', showShifts);
                // Persist to localStorage
                if (browser) {
                  localStorage.setItem('showShiftsInCalendar', String(showShifts));
                }
                // Render or remove shift indicators
                if (showShifts) {
                  refetchCalendarEvents(); // This triggers fetchAndRenderShifts
                } else {
                  // Remove all shift indicators
                  document.querySelectorAll('.shift-indicator').forEach((el) => el.remove());
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
              <span class="legend-color legend-department"></span>
              <span class="legend-label">Abteilung</span>
            </div>
            <div class="legend-item">
              <span class="legend-color legend-team"></span>
              <span class="legend-label">Team</span>
            </div>
            <div class="legend-item">
              <span class="legend-color legend-area"></span>
              <span class="legend-label">Bereich</span>
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
            onclick={() => openEventForm()}
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

  <!-- Upcoming Events -->
  <div class="card mb-6">
    <div class="card__header">
      <h3 class="card__title">
        <i class="fas fa-clock mr-2"></i>
        Anstehende Termine
      </h3>
    </div>
    <div class="card__body">
      <div class="upcoming-events">
        {#if upcomingEvents.length === 0}
          <p class="text-center text-[var(--color-text-secondary)]">
            Keine anstehenden Termine gefunden.
          </p>
        {:else}
          {#each upcomingEvents as event (event.id)}
            {@const levelInfo = getEventLevelInfo(event.orgLevel)}
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
                <span class="event-level {levelInfo.class}">{levelInfo.text}</span>
              </div>
            </button>
          {/each}
        {/if}
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
    onclose={() => calendarState.closeDetailModal()}
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
    onclose={() => calendarState.closeEventModal()}
    onsave={handleSaveEvent}
  />
{/if}

{#if calendarState.showDeleteModal}
  <DeleteConfirmModal
    onclose={() => calendarState.closeDeleteModal()}
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

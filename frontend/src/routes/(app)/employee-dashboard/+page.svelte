<script lang="ts">
  /**
   * Employee Dashboard - Page Component
   * @module employee-dashboard/+page
   *
   * Level 3 SSR: $derived for SSR data.
   * User data comes from parent layout (single /users/me call).
   */
  import { onMount } from 'svelte';

  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import { getApiClient } from '$lib/utils/api-client';

  // Page-specific CSS
  import '../../../styles/employee-dashboard.css';

  // Local modules
  import {
    FLOATING_DOTS_COUNT,
    MESSAGES,
    PLACEHOLDER_TEXT,
    QUICK_ACCESS_ROUTES,
  } from './_lib/constants';
  import {
    formatBlackboardDate,
    formatEventDate,
    getBlackboardOrgLabel,
    getDisplayName,
    getDisplayValue,
    getOrgLevelClass,
    getOrgLevelText,
    getPriorityLabel,
    goToCalendar,
    isAllDay,
    isExpired,
    navigateTo,
    parseContent,
    truncateContent,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type { LayoutUser } from './_lib/types';

  // =============================================================================
  // BLACKBOARD AUTO-CONFIRM
  // =============================================================================

  const apiClient = getApiClient();

  /**
   * Open blackboard entry and auto-confirm if not yet read
   * @param uuid - Entry UUID
   * @param isConfirmed - Whether entry is already confirmed
   */
  function openBlackboardEntry(uuid: string, isConfirmed: boolean): void {
    // Auto-confirm if not yet read (non-blocking)
    if (!isConfirmed) {
      void apiClient.post(`/blackboard/entries/${uuid}/confirm`, {}).then(() => {
        notificationStore.decrementCount('blackboard');
      });
    }
    void goto(`/blackboard/${uuid}`);
  }

  // =============================================================================
  // SSR DATA - Loaded server-side in +page.server.ts
  // =============================================================================

  /** Props from server load function */
  const { data }: { data: PageData } = $props();

  // Destructure SSR data (guaranteed by +page.server.ts)
  const recentDocuments = $derived(data.recentDocuments);
  const upcomingEvents = $derived(data.upcomingEvents);
  const blackboardEntries = $derived(data.blackboardEntries);

  // User data from parent layout (via $page.data)
  // The (app) layout provides user data to all child pages
  const user = $derived($page.data.user as LayoutUser | null);
  const employeeName = $derived(getDisplayName(user?.firstName, user?.lastName));
  const employeeArea = $derived(getDisplayValue(user?.teamAreaName));
  const employeeDepartment = $derived(getDisplayValue(user?.teamDepartmentName));
  // teamNames is array - take first team name
  const employeeTeam = $derived(getDisplayValue(user?.teamNames?.[0]));
  const employeePosition = $derived(getDisplayValue(user?.position, PLACEHOLDER_TEXT.employee));

  // Notification count (placeholder for now)
  const alertCount = $derived(blackboardEntries.filter((e) => e.isConfirmed !== true).length);

  // =============================================================================
  // FLOATING DOTS - Generated client-side for animation
  // =============================================================================

  let floatingDotsCount = $state(0);

  onMount(() => {
    // Generate floating dots after mount
    floatingDotsCount = FLOATING_DOTS_COUNT;

    // Add loaded class for CSS animations
    setTimeout(() => {
      document.body.classList.add('loaded');
    }, 100);
  });
</script>

<svelte:head>
  <title>Employee Dashboard - Assixx</title>
</svelte:head>

<!-- Page Content -->
<div class="container">
  <!-- Welcome Hero Section -->
  <div
    class="welcome-hero-custom relative flex items-center justify-between min-h-[120px]
      overflow-hidden rounded-xl px-8 py-6 mb-8 border border-white/10
      backdrop-blur-[20px] backdrop-saturate-[180%] shadow-sm text-white"
  >
    <!-- Floating sakura petals (generated via floatingDotsCount) -->
    <div class="floating-elements">
      {#each Array(floatingDotsCount) as _, i (i)}
        <div class="floating-dot"></div>
      {/each}
    </div>

    <!-- Welcome content -->
    <div class="relative z-10">
      <h1 class="text-3xl font-bold mb-1">{MESSAGES.welcomeBack}</h1>
      <p class="text-lg text-white/90">
        {MESSAGES.niceToSeeYou}&nbsp;
        <span class="text-[var(--color-primary)] font-semibold">{employeeName}</span>
      </p>
    </div>

    <!-- Stats -->
    <div class="relative z-10 flex gap-6">
      <div class="welcome-stat">
        <div class="welcome-stat-number">{alertCount}</div>
        <div class="welcome-stat-label">{MESSAGES.heroStatLabel}</div>
      </div>
    </div>
  </div>

  <!-- Employee Info Grid - 4 Stat Cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <div class="card-stat">
      <div class="card-stat__icon">
        <i class="fas fa-map-marker-alt"></i>
      </div>
      <div class="card-stat__value">{employeeArea}</div>
      <div class="card-stat__label">Bereich</div>
    </div>
    <div class="card-stat">
      <div class="card-stat__icon">
        <i class="fas fa-building"></i>
      </div>
      <div class="card-stat__value">{employeeDepartment}</div>
      <div class="card-stat__label">Abteilung</div>
    </div>
    <div class="card-stat">
      <div class="card-stat__icon">
        <i class="fas fa-users"></i>
      </div>
      <div class="card-stat__value">{employeeTeam}</div>
      <div class="card-stat__label">Team</div>
    </div>
    <div class="card-stat">
      <div class="card-stat__icon">
        <i class="fas fa-user-tie"></i>
      </div>
      <div class="card-stat__value">{employeePosition}</div>
      <div class="card-stat__label">Position</div>
    </div>
  </div>

  <!-- Blackboard Widget -->
  <div id="blackboard-widget-container" class="mt-8 mb-8">
    <div class="card card--blackboard loaded">
      <div class="card__header">
        <h3 class="card__title">
          <i class="fas fa-thumbtack"></i>
          Schwarzes Brett
        </h3>
        <a href="/blackboard" class="card--blackboard__link">
          Alle anzeigen
          <i class="fas fa-arrow-right"></i>
        </a>
      </div>
      <div id="blackboard-widget-content">
        {#if blackboardEntries.length === 0}
          <div class="empty-state">
            <div class="empty-state__icon"><i class="fas fa-sticky-note"></i></div>
            <h3 class="empty-state__title">{MESSAGES.noBlackboard}</h3>
            <p class="empty-state__description">{MESSAGES.noBlackboardDescription}</p>
          </div>
        {:else}
          <div class="sticky-notes-container">
            {#each blackboardEntries as entry (entry.id)}
              {@const contentText = parseContent(entry.content)}
              {@const isRead = entry.isConfirmed === true}
              {@const isNew = entry.firstSeenAt === null || entry.firstSeenAt === undefined}
              <div
                class="sticky-note sticky-note--{entry.color} sticky-note--large"
                id="sticky-note-{entry.id}"
                onclick={() => {
                  openBlackboardEntry(entry.uuid, isRead);
                }}
                onkeydown={(e) => {
                  if (e.key === 'Enter') openBlackboardEntry(entry.uuid, isRead);
                }}
                role="button"
                tabindex="0"
              >
                <div class="sticky-note__pin"></div>
                <div class="sticky-note__header">
                  <div class="sticky-note__title">
                    {entry.title}
                    {#if isNew}<span class="badge badge--sm badge--success ml-2">Neu</span>{/if}
                  </div>
                  {#if entry.expiresAt}
                    <span
                      class="sticky-note__expires"
                      class:sticky-note__expires--expired={isExpired(entry.expiresAt)}
                      title={isExpired(entry.expiresAt) ? 'Abgelaufen' : 'Gültig bis'}
                    >
                      <i class="fas fa-clock"></i>
                      {formatBlackboardDate(entry.expiresAt)}
                    </span>
                  {/if}
                </div>
                <div class="sticky-note__content">{truncateContent(contentText)}</div>
                <div class="sticky-note__indicators">
                  {#if (entry.attachmentCount ?? 0) > 0}
                    <span class="sticky-note__attachments" title="Anhänge">
                      <i class="fas fa-paperclip"></i>
                      <span>{entry.attachmentCount}</span>
                    </span>
                  {/if}
                  {#if (entry.commentCount ?? 0) > 0}
                    <div class="sticky-note__comments">
                      <i class="fas fa-comments"></i>
                      <span>{entry.commentCount}</span>
                    </div>
                  {/if}
                  <span
                    class="sticky-note__read-status"
                    class:sticky-note__read-status--read={isRead}
                    class:sticky-note__read-status--unread={!isRead}
                    title={isRead ? 'Gelesen' : 'Ungelesen'}
                  >
                    <i class="fas {isRead ? 'fa-eye' : 'fa-eye-slash'}"></i>
                  </span>
                </div>
                <div class="sticky-note__footer">
                  <div class="sticky-note__badges">
                    <span class="sticky-note__badge sticky-note__badge--priority-{entry.priority}">
                      {getPriorityLabel(entry.priority)}
                    </span>
                    <span class="sticky-note__badge sticky-note__badge--org-{entry.orgLevel}">
                      {getBlackboardOrgLabel(entry.orgLevel)}
                    </span>
                  </div>
                  <div class="sticky-note__footer-row">
                    <span class="sticky-note__author">
                      <i class="fas fa-user"></i>
                      {entry.authorFullName ?? entry.authorName ?? MESSAGES.unknownAuthor}
                    </span>
                    <span class="sticky-note__date">
                      <i class="fas fa-calendar"></i>
                      {formatBlackboardDate(entry.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Quick Access Features - 4 Accent Cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <!-- Documents Card -->
    <div class="max-w-[350px]">
      <div class="card-accent card-accent--success card-accent--static">
        <div class="card-accent__header">
          <h3 class="card-accent__title">
            <i class="fas fa-file-alt" style="color: var(--color-icon-primary)"></i>
            {MESSAGES.documentsCardTitle}
          </h3>
        </div>
        <div class="card-accent__content">
          <button
            type="button"
            class="btn btn-manage w-4/5 mb-4"
            onclick={() => {
              navigateTo(QUICK_ACCESS_ROUTES.documents);
            }}
          >
            {MESSAGES.documentsButton}
          </button>
          <div class="space-y-2" id="recent-documents">
            {#if recentDocuments.length === 0}
              <p class="p-2 text-muted">{PLACEHOLDER_TEXT.noDocuments}</p>
            {:else}
              {#each recentDocuments as doc (doc.id)}
                <div class="compact-item">
                  <span class="compact-item-name" title={doc.filename}>{doc.filename}</span>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- Calendar Card -->
    <div class="max-w-[350px]">
      <div class="card-accent card-accent--danger card-accent--static">
        <div class="card-accent__header">
          <h3 class="card-accent__title">
            <i class="fas fa-calendar" style="color: var(--color-icon-primary)"></i>
            {MESSAGES.calendarCardTitle}
          </h3>
        </div>
        <div class="card-accent__content">
          <button
            type="button"
            class="btn btn-manage w-4/5 mb-4"
            onclick={() => {
              navigateTo(QUICK_ACCESS_ROUTES.calendar);
            }}
          >
            {MESSAGES.calendarButton}
          </button>
          <div class="space-y-2" id="calendar-events-list">
            {#if upcomingEvents.length === 0}
              <div class="p-2 rounded text-xs">
                <strong class="block font-semibold">{MESSAGES.upcomingEvents}</strong>
                <p class="text-[var(--color-text-secondary)] mt-1">{PLACEHOLDER_TEXT.noEvents}</p>
              </div>
            {:else}
              {#each upcomingEvents as event (event.id)}
                {@const dateInfo = formatEventDate(event)}
                {@const hasArea = event.areaId !== null && event.areaId !== undefined}
                {@const hasDept = event.departmentId !== null && event.departmentId !== undefined}
                {@const hasTeam = event.teamId !== null && event.teamId !== undefined}
                <div
                  class="event-item"
                  onclick={goToCalendar}
                  role="button"
                  tabindex="0"
                  onkeydown={(e) => {
                    if (e.key === 'Enter') goToCalendar();
                  }}
                >
                  <div class="event-date">
                    <span class="event-day">{dateInfo.day}</span>
                    <span class="event-month">{dateInfo.month}</span>
                    <span class="event-time">
                      {isAllDay(event.allDay) ? MESSAGES.allDay : dateInfo.time}
                    </span>
                  </div>
                  <div class="event-details">
                    <div class="event-title">
                      {event.title !== '' ? event.title : MESSAGES.unknownEvent}
                    </div>
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
                        <span class="event-level {getOrgLevelClass(event.orgLevel ?? 'personal')}">
                          {getOrgLevelText(event.orgLevel ?? 'personal')}
                        </span>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- KVP Card -->
    <div class="max-w-[350px]">
      <div class="card-accent card-accent--warning card-accent--static">
        <div class="card-accent__header">
          <h3 class="card-accent__title">
            <i class="fas fa-lightbulb" style="color: var(--color-icon-primary)"></i>
            {MESSAGES.kvpCardTitle}
          </h3>
        </div>
        <div class="card-accent__content">
          <button
            type="button"
            class="btn btn-manage w-4/5 mb-4"
            onclick={() => {
              navigateTo(QUICK_ACCESS_ROUTES.kvp);
            }}
          >
            {MESSAGES.kvpButton}
          </button>
          <p class="text-sm text-[var(--color-text-secondary)]">{MESSAGES.kvpDescription}</p>
        </div>
      </div>
    </div>

    <!-- Profile Card -->
    <div class="max-w-[350px]">
      <div class="card-accent card-accent--purple card-accent--static">
        <div class="card-accent__header">
          <h3 class="card-accent__title">
            <i class="fas fa-user-circle" style="color: var(--color-icon-primary)"></i>
            {MESSAGES.profileCardTitle}
          </h3>
        </div>
        <div class="card-accent__content">
          <button
            type="button"
            class="btn btn-manage w-4/5 mb-4"
            onclick={() => {
              navigateTo(QUICK_ACCESS_ROUTES.profile);
            }}
          >
            {MESSAGES.profileButton}
          </button>
          <p class="text-sm text-[var(--color-text-secondary)]">{MESSAGES.profileDescription}</p>
        </div>
      </div>
    </div>
  </div>
</div>

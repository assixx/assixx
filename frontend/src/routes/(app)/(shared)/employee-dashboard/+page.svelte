<script lang="ts">
  /**
   * Employee Dashboard - Page Component
   * @module employee-dashboard/+page
   *
   * Level 3 SSR: $derived for SSR data.
   * User data comes from parent layout (single /users/me call).
   */
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import { getApiClient } from '$lib/utils/api-client';

  // Local modules
  import {
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
  import WelcomeHero from './_lib/WelcomeHero.svelte';

  import type { PageData } from './$types';
  import type { LayoutUser } from './_lib/types';

  // =============================================================================
  // BLACKBOARD AUTO-CONFIRM
  // =============================================================================

  const apiClient = getApiClient();

  /** Open blackboard entry and auto-confirm if not yet read */
  function openBlackboardEntry(uuid: string, isConfirmed: boolean): void {
    // Auto-confirm if not yet read (non-blocking)
    if (!isConfirmed) {
      void apiClient
        .post(`/blackboard/entries/${uuid}/confirm`, {})
        .then(() => {
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
  const employeeName = $derived(
    getDisplayName(user?.firstName, user?.lastName),
  );
  const employeeArea = $derived(getDisplayValue(user?.teamAreaName));
  const employeeDepartment = $derived(
    getDisplayValue(user?.teamDepartmentName),
  );
  const employeeTeams = $derived(
    (user?.teamNames?.length ?? 0) > 0 ? (user?.teamNames ?? null) : null,
  );
  const employeePosition = $derived(
    getDisplayValue(user?.position, PLACEHOLDER_TEXT.employee),
  );
</script>

<svelte:head>
  <title>Employee Dashboard - Assixx</title>
</svelte:head>

<!-- Page Content -->
<div class="container">
  <!-- Welcome Hero Section -->
  <WelcomeHero {employeeName} />

  <!-- Employee Info Grid - 4 Stat Cards -->
  <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      <div class="card-stat__value">
        {#if employeeTeams !== null}
          {#each employeeTeams as team (team)}
            <div>{team}</div>
          {/each}
        {:else}
          {PLACEHOLDER_TEXT.notAssigned}
        {/if}
      </div>
      <div class="card-stat__label">
        {employeeTeams !== null && employeeTeams.length > 1 ? 'Teams' : 'Team'}
      </div>
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
  <div
    id="blackboard-widget-container"
    class="mt-8 mb-8"
  >
    <div class="card card--blackboard loaded">
      <div class="card__header">
        <h3 class="card__title">
          <i class="fas fa-thumbtack"></i>
          Schwarzes Brett
        </h3>
        <a
          href="/blackboard"
          class="btn btn-link"
        >
          <i class="fas fa-external-link-alt mr-1.5"></i> Alle anzeigen
        </a>
      </div>
      <div id="blackboard-widget-content">
        {#if blackboardEntries.length === 0}
          <div class="empty-state">
            <div class="empty-state__icon">
              <i class="fas fa-sticky-note"></i>
            </div>
            <h3 class="empty-state__title">{MESSAGES.noBlackboard}</h3>
            <p class="empty-state__description">
              {MESSAGES.noBlackboardDescription}
            </p>
          </div>
        {:else}
          <div class="sticky-notes-container">
            {#each blackboardEntries as entry (entry.id)}
              {@const contentText = parseContent(entry.content)}
              {@const isRead = entry.isConfirmed === true}
              {@const isNew =
                entry.firstSeenAt === null || entry.firstSeenAt === undefined}
              <div
                class="sticky-note sticky-note--{entry.color} sticky-note--large"
                id="sticky-note-{entry.id}"
                onclick={() => {
                  openBlackboardEntry(entry.uuid, isRead);
                }}
                onkeydown={(e) => {
                  if (e.key === 'Enter')
                    openBlackboardEntry(entry.uuid, isRead);
                }}
                role="button"
                tabindex="0"
              >
                <div class="sticky-note__pin"></div>
                <div class="sticky-note__header">
                  <div class="sticky-note__title">
                    {entry.title}
                    {#if isNew}<span class="badge badge--sm badge--success ml-2"
                        >Neu</span
                      >{/if}
                  </div>
                  {#if entry.expiresAt}
                    <span
                      class="sticky-note__expires"
                      class:sticky-note__expires--expired={isExpired(
                        entry.expiresAt,
                      )}
                      title={isExpired(entry.expiresAt) ? 'Abgelaufen' : (
                        'Gültig bis'
                      )}
                    >
                      <i class="fas fa-clock"></i>
                      {formatBlackboardDate(entry.expiresAt)}
                    </span>
                  {/if}
                </div>
                <div class="sticky-note__content">
                  {truncateContent(contentText)}
                </div>
                <div class="sticky-note__indicators">
                  {#if (entry.attachmentCount ?? 0) > 0}
                    <span
                      class="sticky-note__attachments"
                      title="Anhänge"
                    >
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
                    <span
                      class="sticky-note__badge sticky-note__badge--priority-{entry.priority}"
                    >
                      {getPriorityLabel(entry.priority)}
                    </span>
                    <span
                      class="sticky-note__badge sticky-note__badge--org-{entry.orgLevel}"
                    >
                      {getBlackboardOrgLabel(entry.orgLevel)}
                    </span>
                  </div>
                  <div class="sticky-note__footer-row">
                    <span class="sticky-note__author">
                      <i class="fas fa-user"></i>
                      {entry.authorFullName ??
                        entry.authorName ??
                        MESSAGES.unknownAuthor}
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
  <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
    <!-- Documents Card -->
    <div class="max-w-[350px]">
      <div class="card-accent card-accent--success card-accent--static">
        <div class="card-accent__header">
          <h3 class="card-accent__title">
            <i
              class="fas fa-file-alt"
              style="color: var(--color-icon-primary)"
            ></i>
            {MESSAGES.documentsCardTitle}
          </h3>
        </div>
        <div class="card-accent__content">
          <button
            type="button"
            class="btn btn-primary mb-4 w-4/5"
            onclick={() => {
              navigateTo(QUICK_ACCESS_ROUTES.documents);
            }}
          >
            {MESSAGES.documentsButton}
          </button>
          <div
            class="space-y-2"
            id="recent-documents"
          >
            {#if recentDocuments.length === 0}
              <p class="text-muted p-2">{PLACEHOLDER_TEXT.noDocuments}</p>
            {:else}
              {#each recentDocuments as doc (doc.id)}
                <div class="compact-item">
                  <span
                    class="compact-item-name"
                    title={doc.filename}>{doc.filename}</span
                  >
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
            <i
              class="fas fa-calendar"
              style="color: var(--color-icon-primary)"
            ></i>
            {MESSAGES.calendarCardTitle}
          </h3>
        </div>
        <div class="card-accent__content">
          <button
            type="button"
            class="btn btn-primary mb-4 w-4/5"
            onclick={() => {
              navigateTo(QUICK_ACCESS_ROUTES.calendar);
            }}
          >
            {MESSAGES.calendarButton}
          </button>
          <div
            class="space-y-2"
            id="calendar-events-list"
          >
            {#if upcomingEvents.length === 0}
              <div class="rounded p-2 text-xs">
                <strong class="block font-semibold"
                  >{MESSAGES.upcomingEvents}</strong
                >
                <p class="mt-1 text-(--color-text-secondary)">
                  {PLACEHOLDER_TEXT.noEvents}
                </p>
              </div>
            {:else}
              {#each upcomingEvents as event (event.id)}
                {@const dateInfo = formatEventDate(event)}
                {@const hasArea =
                  event.areaId !== null && event.areaId !== undefined}
                {@const hasDept =
                  event.departmentId !== null &&
                  event.departmentId !== undefined}
                {@const hasTeam =
                  event.teamId !== null && event.teamId !== undefined}
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
                        <span class="event-level event-level-area">Bereich</span
                        >
                      {/if}
                      {#if hasDept}
                        <span class="event-level event-level-department"
                          >Abteilung</span
                        >
                      {/if}
                      {#if hasTeam}
                        <span class="event-level event-level-team">Team</span>
                      {/if}
                      {#if !hasArea && !hasDept && !hasTeam}
                        <span
                          class="event-level {getOrgLevelClass(
                            event.orgLevel ?? 'personal',
                          )}"
                        >
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
            <i
              class="fas fa-lightbulb"
              style="color: var(--color-icon-primary)"
            ></i>
            {MESSAGES.kvpCardTitle}
          </h3>
        </div>
        <div class="card-accent__content">
          <button
            type="button"
            class="btn btn-primary mb-4 w-4/5"
            onclick={() => {
              navigateTo(QUICK_ACCESS_ROUTES.kvp);
            }}
          >
            {MESSAGES.kvpButton}
          </button>
          <p class="text-sm text-(--color-text-secondary)">
            {MESSAGES.kvpDescription}
          </p>
        </div>
      </div>
    </div>

    <!-- Profile Card -->
    <div class="max-w-[350px]">
      <div class="card-accent card-accent--purple card-accent--static">
        <div class="card-accent__header">
          <h3 class="card-accent__title">
            <i
              class="fas fa-user-circle"
              style="color: var(--color-icon-primary)"
            ></i>
            {MESSAGES.profileCardTitle}
          </h3>
        </div>
        <div class="card-accent__content">
          <button
            type="button"
            class="btn btn-primary mb-4 w-4/5"
            onclick={() => {
              navigateTo(QUICK_ACCESS_ROUTES.profile);
            }}
          >
            {MESSAGES.profileButton}
          </button>
          <p class="text-sm text-(--color-text-secondary)">
            {MESSAGES.profileDescription}
          </p>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  /* Calendar Event Styles */
  .event-item {
    display: flex;
    transition: background-color 0.2s ease;
    cursor: pointer;
    border-bottom: 1px solid var(--border-color);
    padding: 10px;
  }

  .event-item:last-child {
    border-bottom: none;
  }

  .event-item:hover {
    background-color: color-mix(in oklch, var(--color-primary) 5%, transparent);
  }

  .event-date {
    display: flex;
    flex: 0 0 90px;
    flex-direction: column;
    justify-content: center;
    margin-right: 15px;
    border-radius: var(--radius-xl);
    background-color: var(--background-dark);
    padding: 10px;
    text-align: center;
  }

  .event-day {
    color: var(--primary);
    font-weight: 700;
    font-size: 1.5rem;
  }

  .event-month {
    color: var(--text-secondary);
    font-size: 0.9rem;
    text-transform: uppercase;
  }

  .event-time {
    margin-top: 4px;
    color: var(--text-muted);
    font-size: 0.75rem;
  }

  .event-details {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
  }

  .event-title {
    margin-bottom: 2px;
    color: var(--text-primary);
    font-weight: 600;
    font-size: 1rem;
  }

  .event-location {
    margin-top: 2px;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  .event-location i {
    margin-right: 4px;
    color: var(--text-muted);
  }

  .event-level {
    display: inline-block;
    width: fit-content;
    margin-top: 5px;
    border-radius: var(--radius-xl);
    padding: 2px 8px;
    color: var(--color-white);
    font-size: 0.7rem;
  }

  .event-level-company {
    background-color: var(--color-sky);
  }

  .event-level-department {
    background-color: var(--color-carrot);
  }

  .event-level-team {
    background-color: var(--color-emerald);
  }

  .event-level-area {
    background-color: var(--color-danger-hover);
  }

  .event-level-personal {
    background-color: var(--color-purple);
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

  /* Mobile responsive for events */
  @media (width < 768px) {
    .event-date {
      flex: 0 0 70px;
    }

    .event-day {
      font-size: 1.2rem;
    }

    .event-month {
      font-size: 0.8rem;
    }
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';

  import { goto } from '$app/navigation';

  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import { getApiClient } from '$lib/utils/api-client';

  import { createMessages } from './_lib/constants';
  import {
    getEmployeeName,
    getOrgLevelText,
    getOrgLevelClass,
    getPriorityLabel,
    getBlackboardOrgLabel,
    formatBlackboardDate,
    isExpired,
    parseContent,
    truncateContent,
    formatEventDate,
    isAllDay,
    navigateTo,
    goToCalendar,
  } from './_lib/utils';

  import type { PageData } from './$types';

  // =============================================================================
  // BLACKBOARD AUTO-CONFIRM
  // =============================================================================

  const apiClient = getApiClient();

  /** Open blackboard entry and auto-confirm if not yet read */
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
  // Data is INSTANTLY available - no loading states needed!
  // =============================================================================

  /** Props from server load function */
  const { data }: { data: PageData } = $props();

  // Hierarchy labels from layout data inheritance (A6)
  const labels = $derived(data.hierarchyLabels);
  const messages = $derived(createMessages(labels));

  // Destructure data - PageData guarantees all properties exist from +page.server.ts
  const stats = $derived(data.stats);
  const recentEmployees = $derived(data.recentEmployees);
  const recentDocuments = $derived(data.recentDocuments);
  const departments = $derived(data.departments);
  const teams = $derived(data.teams);
  const upcomingEvents = $derived(data.upcomingEvents);
  const blackboardEntries = $derived(data.blackboardEntries);

  // =============================================================================
  // LIFECYCLE - Only for DOM manipulation, NOT data loading
  // =============================================================================

  onMount(() => {
    // Add loaded class for CSS animations (after hydration)
    setTimeout(() => {
      document.body.classList.add('loaded');
    }, 100);
  });
</script>

<svelte:head>
  <title>Admin Dashboard - Assixx</title>
</svelte:head>

<!-- Page Content -->
<div class="container">
  <!-- Dashboard Section -->
  <section
    id="dashboard-section"
    class="content-section"
  >
    <!-- Dashboard Stats Grid - SSR: Data instantly available, no loading states -->
    <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div class="card-stat">
        <div class="card-stat__icon">
          <i class="fas fa-users"></i>
        </div>
        <div class="card-stat__value">{stats.employeeCount}</div>
        <div class="card-stat__label">Mitarbeiter</div>
      </div>
      <div class="card-stat">
        <div class="card-stat__icon">
          <i class="fas fa-file-alt"></i>
        </div>
        <div class="card-stat__value">{stats.documentCount}</div>
        <div class="card-stat__label">Dokumente</div>
      </div>
      <div class="card-stat">
        <div class="card-stat__icon">
          <i class="fas fa-building"></i>
        </div>
        <div class="card-stat__value">{stats.departmentCount}</div>
        <div class="card-stat__label">{messages.STAT_DEPARTMENTS}</div>
      </div>
      <div class="card-stat">
        <div class="card-stat__icon">
          <i class="fas fa-user-friends"></i>
        </div>
        <div class="card-stat__value">{stats.teamCount}</div>
        <div class="card-stat__label">{messages.STAT_TEAMS}</div>
      </div>
    </div>

    <!-- Blackboard Widget - SSR: Data instantly available -->
    <div
      id="blackboard-widget-container"
      class="mt-8"
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
              <h3 class="empty-state__title">{messages.noBlackboard}</h3>
              <p class="empty-state__description">
                {messages.noBlackboardDescription}
              </p>
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
                      <span class="sticky-note__badge sticky-note__badge--org-{entry.orgLevel}">
                        {getBlackboardOrgLabel(entry.orgLevel, messages.blackboardOrgLabels)}
                      </span>
                    </div>
                    <div class="sticky-note__footer-row">
                      <span class="sticky-note__author">
                        <i class="fas fa-user"></i>
                        {entry.authorFullName ?? entry.authorName ?? messages.unknownAuthor}
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

    <!-- Main Grid Container - Accent Cards -->
    <div class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <!-- Employee Card -->
      <div class="max-w-[350px]">
        <div class="card-accent card-accent--static">
          <div class="card-accent__header">
            <h3 class="card-accent__title">
              <i
                class="fas fa-users"
                style="color: var(--color-icon-primary)"
              ></i>
              Mitarbeiter
            </h3>
          </div>
          <div class="card-accent__content">
            <button
              type="button"
              class="btn btn-primary mb-4 w-4/5"
              onclick={() => {
                navigateTo('/manage-employees');
              }}
            >
              Mitarbeiter verwalten
            </button>
            <div class="space-y-2">
              {#if recentEmployees.length === 0}
                <p class="text-muted p-2">{messages.noEmployees}</p>
              {:else}
                {#each recentEmployees as employee (employee.id)}
                  <div class="compact-item">
                    <span class="compact-item-name">{getEmployeeName(employee)}</span>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- Document Card -->
      <div class="max-w-[350px]">
        <div class="card-accent card-accent--success card-accent--static">
          <div class="card-accent__header">
            <h3 class="card-accent__title">
              <i
                class="fas fa-file-alt"
                style="color: var(--color-icon-primary)"
              ></i>
              Dokumente
            </h3>
          </div>
          <div class="card-accent__content">
            <button
              type="button"
              class="btn btn-primary mb-4 w-4/5"
              onclick={() => {
                navigateTo('/documents-explorer');
              }}
            >
              Dokumenten-Explorer
            </button>
            <div class="space-y-2">
              {#if recentDocuments.length === 0}
                <p class="text-muted p-2">{messages.noDocuments}</p>
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

      <!-- Department Card -->
      <div class="max-w-[350px]">
        <div class="card-accent card-accent--warning card-accent--static">
          <div class="card-accent__header">
            <h3 class="card-accent__title">
              <i
                class="fas fa-building"
                style="color: var(--color-icon-primary)"
              ></i>
              {messages.CARD_DEPARTMENTS}
            </h3>
          </div>
          <div class="card-accent__content">
            <button
              type="button"
              class="btn btn-primary mb-4 w-4/5"
              onclick={() => {
                navigateTo('/manage-departments');
              }}
            >
              {messages.BTN_MANAGE_DEPARTMENTS}
            </button>
            <div class="space-y-2">
              {#if departments.length === 0}
                <p class="text-muted p-2">{messages.noDepartments}</p>
              {:else}
                {#each departments as dept (dept.id)}
                  <div class="compact-item">
                    <span class="compact-item-name">{dept.name}</span>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- Team Card -->
      <div class="max-w-[350px]">
        <div class="card-accent card-accent--purple card-accent--static">
          <div class="card-accent__header">
            <h3 class="card-accent__title">
              <i
                class="fas fa-user-friends"
                style="color: var(--color-icon-primary)"
              ></i>
              {messages.CARD_TEAMS}
            </h3>
          </div>
          <div class="card-accent__content">
            <button
              type="button"
              class="btn btn-primary mb-4 w-4/5"
              onclick={() => {
                navigateTo('/manage-teams');
              }}
            >
              {messages.BTN_MANAGE_TEAMS}
            </button>
            <div class="space-y-2">
              {#if teams.length === 0}
                <p class="text-muted p-2">{messages.noTeams}</p>
              {:else}
                {#each teams as team (team.id)}
                  <div class="compact-item">
                    <span class="compact-item-name">{team.name}</span>
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
              Kalender
            </h3>
          </div>
          <div class="card-accent__content">
            <button
              type="button"
              class="btn btn-primary mb-4 w-4/5"
              onclick={() => {
                navigateTo('/calendar');
              }}
            >
              Kalender öffnen
            </button>
            <div class="space-y-2">
              {#if upcomingEvents.length === 0}
                <div class="rounded p-2 text-xs">
                  <strong class="block font-semibold">{messages.upcomingEvents}</strong>
                  <p class="mt-1 text-(--color-text-secondary)">
                    {messages.noEvents}
                  </p>
                </div>
              {:else}
                {#each upcomingEvents as event (event.id)}
                  {@const dateInfo = formatEventDate(event.startTime)}
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
                        {isAllDay(event.allDay) ? messages.allDay : dateInfo.time}
                      </span>
                    </div>
                    <div class="event-details">
                      <div class="event-title">
                        {event.title !== '' ? event.title : messages.unknownEvent}
                      </div>
                      {#if event.location}
                        <div class="event-location">
                          <i class="fas fa-map-marker-alt"></i>
                          {event.location}
                        </div>
                      {/if}
                      <div class="event-badges">
                        {#if hasArea}
                          <span class="event-level event-level-area">{messages.EVENT_AREA}</span>
                        {/if}
                        {#if hasDept}
                          <span class="event-level event-level-department"
                            >{messages.EVENT_DEPARTMENT}</span
                          >
                        {/if}
                        {#if hasTeam}
                          <span class="event-level event-level-team">{messages.EVENT_TEAM}</span>
                        {/if}
                        {#if !hasArea && !hasDept && !hasTeam}
                          <span
                            class="event-level {getOrgLevelClass(event.orgLevel ?? 'personal')}"
                          >
                            {getOrgLevelText(event.orgLevel ?? 'personal', messages.orgLevelLabels)}
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
    </div>
  </section>
</div>

<style>
  /* Prevent FOUC during page load — body is outside component scope */
  :global(body:not(.loaded)) * {
    transition: none;
  }

  /* Compact Item - List items in accent cards */
  .compact-item {
    display: flex;
    justify-content: space-between;
    align-items: center;

    transition: all 0.2s ease;
    cursor: default;

    margin-bottom: 6px;
    border: var(--glass-border);
    border-radius: 8px;

    background: var(--glass-bg);
    padding: 3px 12px;
  }

  .compact-item:last-child {
    margin-bottom: 0;
  }

  .compact-item:hover {
    transform: translateX(4px);
    border-color: var(--color-glass-border);
    background: var(--glass-bg-hover);
  }

  .compact-item-name {
    flex: 1;

    margin-right: 12px;
    overflow: hidden;
    color: var(--text-primary);
    font-weight: 500;

    font-size: 0.95rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

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

  @media (width < 768px) {
    .compact-item {
      padding: 8px 10px;
    }

    .compact-item-name {
      font-size: 0.9rem;
    }
  }

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

<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  // Page-specific CSS
  import '../../../styles/admin-dashboard.css';

  // Local modules
  import { MESSAGES } from './_lib/constants';
  import {
    getEmployeeName,
    getOrgLevelText,
    getOrgLevelClass,
    getPriorityLabel,
    getBlackboardOrgLabel,
    formatBlackboardDate,
    parseContent,
    truncateContent,
    formatEventDate,
    isAllDay,
    openBlackboardEntry,
    navigateTo,
    goToCalendar,
  } from './_lib/utils';

  // =============================================================================
  // SSR DATA - Loaded server-side in +page.server.ts
  // Data is INSTANTLY available - no loading states needed!
  // =============================================================================

  /** Props from server load function */
  const { data }: { data: PageData } = $props();

  // Destructure with safe fallbacks (handles undefined during hydration edge cases)
  const stats = $derived(
    data?.stats ?? { employeeCount: 0, documentCount: 0, departmentCount: 0, teamCount: 0 },
  );
  const recentEmployees = $derived(data?.recentEmployees ?? []);
  const recentDocuments = $derived(data?.recentDocuments ?? []);
  const departments = $derived(data?.departments ?? []);
  const teams = $derived(data?.teams ?? []);
  const upcomingEvents = $derived(data?.upcomingEvents ?? []);
  const blackboardEntries = $derived(data?.blackboardEntries ?? []);

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
  <section id="dashboard-section" class="content-section">
    <!-- Dashboard Stats Grid - SSR: Data instantly available, no loading states -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
        <div class="card-stat__label">Abteilungen</div>
      </div>
      <div class="card-stat">
        <div class="card-stat__icon">
          <i class="fas fa-user-friends"></i>
        </div>
        <div class="card-stat__value">{stats.teamCount}</div>
        <div class="card-stat__label">Teams</div>
      </div>
    </div>

    <!-- Blackboard Widget - SSR: Data instantly available -->
    <div id="blackboard-widget-container" class="mt-8">
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
                <div
                  class="sticky-note sticky-note--{entry.color ?? 'yellow'} sticky-note--large"
                  id="sticky-note-{entry.id}"
                  onclick={() => openBlackboardEntry(entry.uuid)}
                  onkeydown={(e) => e.key === 'Enter' && openBlackboardEntry(entry.uuid)}
                  role="button"
                  tabindex="0"
                >
                  <div class="sticky-note__pin"></div>
                  <div class="sticky-note__title">{entry.title}</div>
                  <div class="sticky-note__content">{truncateContent(contentText)}</div>
                  <div class="sticky-note__indicators">
                    {#if (entry.commentCount ?? 0) > 0}
                      <div class="sticky-note__comments">
                        <i class="fas fa-comments"></i>
                        <span>{entry.commentCount}</span>
                      </div>
                    {/if}
                    <span
                      class="sticky-note__read-status"
                      class:sticky-note__read-status--read={entry.isConfirmed}
                      class:sticky-note__read-status--unread={!entry.isConfirmed}
                      title={entry.isConfirmed ? 'Gelesen' : 'Ungelesen'}
                    >
                      <i class="fas {entry.isConfirmed ? 'fa-eye' : 'fa-eye-slash'}"></i>
                    </span>
                  </div>
                  <div class="sticky-note__footer">
                    <div class="sticky-note__badges">
                      <span
                        class="sticky-note__badge sticky-note__badge--priority-{entry.priority ??
                          'medium'}"
                      >
                        {getPriorityLabel(entry.priority ?? 'medium')}
                      </span>
                      <span
                        class="sticky-note__badge sticky-note__badge--org-{entry.orgLevel ??
                          'company'}"
                      >
                        {getBlackboardOrgLabel(entry.orgLevel ?? 'company')}
                      </span>
                    </div>
                    <div class="sticky-note__footer-row">
                      <span class="sticky-note__author">
                        <i class="fas fa-user"></i>
                        {entry.authorFullName ?? entry.authorName ?? MESSAGES.unknownAuthor}
                      </span>
                      <span class="sticky-note__date">
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
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
      <!-- Employee Card -->
      <div class="max-w-[350px]">
        <div class="card-accent card-accent--static">
          <div class="card-accent__header">
            <h3 class="card-accent__title">
              <i class="fas fa-users" style="color: var(--color-icon-primary)"></i>
              Mitarbeiter
            </h3>
          </div>
          <div class="card-accent__content">
            <button
              class="btn btn-manage w-4/5 mb-4"
              onclick={() => navigateTo('/manage-employees')}
            >
              Mitarbeiter verwalten
            </button>
            <div class="space-y-2">
              {#if recentEmployees.length === 0}
                <p class="p-2 text-muted">{MESSAGES.noEmployees}</p>
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
              <i class="fas fa-file-alt" style="color: var(--color-icon-primary)"></i>
              Dokumente
            </h3>
          </div>
          <div class="card-accent__content">
            <button
              class="btn btn-manage w-4/5 mb-4"
              onclick={() => navigateTo('/document-upload')}
            >
              Dokument hochladen
            </button>
            <div class="space-y-2">
              {#if recentDocuments.length === 0}
                <p class="p-2 text-muted">{MESSAGES.noDocuments}</p>
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

      <!-- Department Card -->
      <div class="max-w-[350px]">
        <div class="card-accent card-accent--warning card-accent--static">
          <div class="card-accent__header">
            <h3 class="card-accent__title">
              <i class="fas fa-building" style="color: var(--color-icon-primary)"></i>
              Abteilungen
            </h3>
          </div>
          <div class="card-accent__content">
            <button
              class="btn btn-manage w-4/5 mb-4"
              onclick={() => navigateTo('/manage-departments')}
            >
              Abteilungen verwalten
            </button>
            <div class="space-y-2">
              {#if departments.length === 0}
                <p class="p-2 text-muted">{MESSAGES.noDepartments}</p>
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
              <i class="fas fa-user-friends" style="color: var(--color-icon-primary)"></i>
              Teams
            </h3>
          </div>
          <div class="card-accent__content">
            <button class="btn btn-manage w-4/5 mb-4" onclick={() => navigateTo('/manage-teams')}>
              Teams verwalten
            </button>
            <div class="space-y-2">
              {#if teams.length === 0}
                <p class="p-2 text-muted">{MESSAGES.noTeams}</p>
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
              <i class="fas fa-calendar" style="color: var(--color-icon-primary)"></i>
              Kalender
            </h3>
          </div>
          <div class="card-accent__content">
            <button class="btn btn-manage w-4/5 mb-4" onclick={() => navigateTo('/calendar')}>
              Kalender öffnen
            </button>
            <div class="space-y-2">
              {#if upcomingEvents.length === 0}
                <div class="p-2 rounded text-xs">
                  <strong class="block font-semibold">{MESSAGES.upcomingEvents}</strong>
                  <p class="text-[var(--color-text-secondary)] mt-1">{MESSAGES.noEvents}</p>
                </div>
              {:else}
                {#each upcomingEvents as event (event.id)}
                  {@const dateInfo = formatEventDate(event.startTime)}
                  <div
                    class="event-item"
                    onclick={goToCalendar}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => e.key === 'Enter' && goToCalendar()}
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
                      <span class="event-level {getOrgLevelClass(event.orgLevel ?? 'personal')}">
                        {getOrgLevelText(event.orgLevel ?? 'personal')}
                      </span>
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

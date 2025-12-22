<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  // Page-specific CSS
  import '../../../styles/admin-dashboard.css';

  // Local modules
  import { DEFAULT_STATS, MESSAGES } from './_lib/constants';
  import {
    getAuthToken,
    loadEmployees,
    loadDocuments,
    loadDepartments,
    loadTeams,
    loadUpcomingEvents,
    loadBlackboard,
  } from './_lib/api';
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

  /** @typedef {import('./_lib/types').DashboardStats} DashboardStats */
  /** @typedef {import('./_lib/types').User} User */
  /** @typedef {import('./_lib/types').Document} Document */
  /** @typedef {import('./_lib/types').Department} Department */
  /** @typedef {import('./_lib/types').Team} Team */
  /** @typedef {import('./_lib/types').CalendarEvent} CalendarEvent */
  /** @typedef {import('./_lib/types').BlackboardEntry} BlackboardEntry */

  // =============================================================================
  // STATE
  // =============================================================================

  let statsLoading = $state(true);

  /** @type {DashboardStats} */
  const stats = $state({ ...DEFAULT_STATS });

  /** @type {User[]} */
  let recentEmployees = $state([]);
  /** @type {Document[]} */
  let recentDocuments = $state([]);
  /** @type {Department[]} */
  let departments = $state([]);
  /** @type {Team[]} */
  let teams = $state([]);
  /** @type {CalendarEvent[]} */
  let upcomingEvents = $state([]);
  /** @type {BlackboardEntry[]} */
  let blackboardEntries = $state([]);
  let blackboardLoading = $state(true);

  // =============================================================================
  // DATA LOADING
  // =============================================================================

  async function loadInitialData() {
    statsLoading = true;

    try {
      // Load blackboard first (most visible)
      blackboardEntries = await loadBlackboard();
      blackboardLoading = false;

      // Load all other data in parallel
      const [employeeData, documentData, departmentData, teamData, events] = await Promise.all([
        loadEmployees(),
        loadDocuments(),
        loadDepartments(),
        loadTeams(),
        loadUpcomingEvents(),
      ]);

      recentEmployees = employeeData.recent;
      stats.employeeCount = employeeData.count;

      recentDocuments = documentData.recent;
      stats.documentCount = documentData.count;

      departments = departmentData.list;
      stats.departmentCount = departmentData.count;

      teams = teamData.list;
      stats.teamCount = teamData.count;

      upcomingEvents = events;
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      statsLoading = false;
    }
  }

  // =============================================================================
  // LIFECYCLE
  // =============================================================================

  onMount(() => {
    const token = getAuthToken();
    if (!token) {
      goto(resolve('/login'));
      return;
    }

    setTimeout(() => {
      document.body.classList.add('loaded');
    }, 100);

    loadInitialData();
  });
</script>

<svelte:head>
  <title>Admin Dashboard - Assixx</title>
</svelte:head>

<!-- Page Content -->
<div class="container">
  <!-- Dashboard Section -->
  <section id="dashboard-section" class="content-section">
    <!-- Dashboard Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="card-stat">
        <div class="card-stat__icon">
          <i class="fas fa-users"></i>
        </div>
        <div class="card-stat__value">
          {statsLoading ? '--' : stats.employeeCount}
        </div>
        <div class="card-stat__label">Mitarbeiter</div>
      </div>
      <div class="card-stat">
        <div class="card-stat__icon">
          <i class="fas fa-file-alt"></i>
        </div>
        <div class="card-stat__value">
          {statsLoading ? '--' : stats.documentCount}
        </div>
        <div class="card-stat__label">Dokumente</div>
      </div>
      <div class="card-stat">
        <div class="card-stat__icon">
          <i class="fas fa-building"></i>
        </div>
        <div class="card-stat__value">
          {statsLoading ? '--' : stats.departmentCount}
        </div>
        <div class="card-stat__label">Abteilungen</div>
      </div>
      <div class="card-stat">
        <div class="card-stat__icon">
          <i class="fas fa-user-friends"></i>
        </div>
        <div class="card-stat__value">
          {statsLoading ? '--' : stats.teamCount}
        </div>
        <div class="card-stat__label">Teams</div>
      </div>
    </div>

    <!-- Blackboard Widget -->
    <div id="blackboard-widget-container" class="mt-8">
      <div class="card card--blackboard" class:loaded={!blackboardLoading}>
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
          {#if blackboardLoading}
            <div class="card--blackboard__loading">
              <div class="spinner-ring spinner-ring--md"></div>
              <p>{MESSAGES.loadingEntries}</p>
            </div>
          {:else if blackboardEntries.length === 0}
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
                  {#if (entry.commentCount ?? 0) > 0}
                    <div class="sticky-note__indicators">
                      <div class="sticky-note__comments">
                        <i class="fas fa-comments"></i>
                        <span>{entry.commentCount}</span>
                      </div>
                    </div>
                  {/if}
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

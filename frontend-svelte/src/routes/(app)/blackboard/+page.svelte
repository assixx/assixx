<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { SvelteURLSearchParams } from 'svelte/reactivity';

  // API Client (proactive token refresh on activity < 10 min)
  import { getApiClient } from '$lib/utils/api-client';
  import { showErrorAlert } from '$lib/stores/toast.js';

  // Page-specific CSS
  import '../../../styles/blackboard.css';

  // _lib/ imports (Refactored Pattern)
  import type {
    BlackboardEntry,
    Department,
    Team,
    Area,
    Priority,
    EntryColor,
    FormMode,
  } from './_lib/types';
  import {
    ZOOM_CONFIG,
    ENTRIES_PER_PAGE,
    COLOR_OPTIONS,
    SORT_OPTIONS,
    MESSAGES,
  } from './_lib/constants';
  import {
    formatDateShort,
    truncateText,
    getPriorityLabel,
    getPriorityClass,
    getOrgLevelLabel,
    getOrgLevelClass,
    getSortLabel,
  } from './_lib/utils';

  const apiClient = getApiClient();

  // =============================================================================
  // SVELTE 5 RUNES - State
  // =============================================================================

  // Filter State
  let searchQuery = $state('');
  let levelFilter = $state<'all' | 'company' | 'department' | 'team' | 'area'>('all');
  let sortBy = $state('created_at');
  let sortDir = $state<'ASC' | 'DESC'>('DESC');
  let filterExpanded = $state(false);

  // Zoom State
  let zoomLevel = $state(ZOOM_CONFIG.DEFAULT);

  // Entries State
  let entries = $state<BlackboardEntry[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Pagination State
  let currentPage = $state(1);
  let totalPages = $state(1);

  // Modal State
  let showEntryModal = $state(false);
  let showDeleteModal = $state(false);
  let showDeleteConfirmModal = $state(false);
  let entryModalMode = $state<FormMode>('create');
  let editingEntryId = $state<number | null>(null);
  let deletingEntryId = $state<number | null>(null);

  // Form State
  let formTitle = $state('');
  let formContent = $state('');
  let formPriority = $state<Priority>('medium');
  let formColor = $state<EntryColor>('yellow');
  let formExpiresAt = $state('');
  let formCompanyWide = $state(false);
  let formDepartmentIds = $state<number[]>([]);
  let formTeamIds = $state<number[]>([]);
  let formAreaIds = $state<number[]>([]);
  let attachmentFiles = $state<FileList | null>(null);

  // Organization Data (for dropdowns)
  let departments = $state<Department[]>([]);
  let teams = $state<Team[]>([]);
  let areas = $state<Area[]>([]);

  // User State
  let userRole = $state<string | null>(null);

  // Dropdown State
  let sortDropdownOpen = $state(false);
  let priorityDropdownOpen = $state(false);

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const isAdmin = $derived(userRole === 'admin' || userRole === 'root');
  const sortLabel = $derived(getSortLabel(`${sortBy}|${sortDir}`));
  const priorityLabel = $derived(getPriorityLabel(formPriority));

  // =============================================================================
  // HELPER: Extract OrgItem array from API response
  // =============================================================================

  function extractOrgItems<T>(result: unknown): T[] {
    if (Array.isArray(result)) return result;
    if (
      result &&
      typeof result === 'object' &&
      'data' in result &&
      Array.isArray((result as { data: T[] }).data)
    ) {
      return (result as { data: T[] }).data;
    }
    return [];
  }

  // =============================================================================
  // API FUNCTIONS
  // =============================================================================

  async function fetchEntries(): Promise<void> {
    loading = true;
    error = null;

    try {
      const params = new SvelteURLSearchParams();
      params.append('status', 'active');
      params.append('page', currentPage.toString());
      params.append('limit', ENTRIES_PER_PAGE.toString());
      params.append('sortBy', sortBy);
      params.append('sortDir', sortDir);

      if (levelFilter !== 'all') params.append('filter', levelFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const result = await apiClient.get<
        | {
            entries?: BlackboardEntry[];
            data?: BlackboardEntry[];
            meta?: { pagination?: { totalPages: number; total: number } };
          }
        | BlackboardEntry[]
      >(`/blackboard/entries?${params.toString()}`);

      if (Array.isArray(result)) {
        entries = result;
      } else {
        entries = result.entries ?? result.data ?? [];
        if (result.meta?.pagination) {
          totalPages = result.meta.pagination.totalPages;
        }
      }
    } catch (err) {
      console.error('[Blackboard] Error fetching entries:', err);
      error = err instanceof Error ? err.message : MESSAGES.ERROR_LOADING;
    } finally {
      loading = false;
    }
  }

  async function fetchOrganizations(): Promise<void> {
    try {
      const [deptResult, teamResult, areaResult] = await Promise.all([
        apiClient.get('/departments'),
        apiClient.get('/teams'),
        apiClient.get('/areas'),
      ]);
      departments = extractOrgItems<Department>(deptResult);
      teams = extractOrgItems<Team>(teamResult);
      areas = extractOrgItems<Area>(areaResult);
    } catch (err) {
      console.error('[Blackboard] Error fetching organizations:', err);
    }
  }

  async function saveEntry(): Promise<void> {
    try {
      const payload = {
        title: formTitle,
        content: formContent,
        priority: formPriority,
        color: formColor,
        expiresAt: formExpiresAt || null,
        departmentIds: formCompanyWide ? [] : formDepartmentIds,
        teamIds: formCompanyWide ? [] : formTeamIds,
        areaIds: formCompanyWide ? [] : formAreaIds,
      };

      if (entryModalMode === 'edit') {
        await apiClient.put(`/blackboard/entries/${editingEntryId}`, payload);
      } else {
        await apiClient.post('/blackboard/entries', payload);
      }

      closeEntryModal();
      await fetchEntries();
    } catch (err) {
      console.error('[Blackboard] Error saving entry:', err);
      showErrorAlert(err instanceof Error ? err.message : MESSAGES.SAVE_ERROR);
    }
  }

  async function deleteEntry(): Promise<void> {
    if (!deletingEntryId) return;

    try {
      await apiClient.delete(`/blackboard/entries/${deletingEntryId}`);
      showDeleteConfirmModal = false;
      showDeleteModal = false;
      deletingEntryId = null;
      await fetchEntries();
    } catch (err) {
      console.error('[Blackboard] Error deleting entry:', err);
      showErrorAlert(err instanceof Error ? err.message : MESSAGES.DELETE_ERROR);
    }
  }

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  function toggleFilter(): void {
    filterExpanded = !filterExpanded;
  }

  function setLevelFilter(level: typeof levelFilter): void {
    levelFilter = level;
    currentPage = 1;
    fetchEntries();
  }

  function setSort(value: string): void {
    const [by, dir] = value.split('|');
    sortBy = by ?? 'created_at';
    sortDir = (dir as 'ASC' | 'DESC') ?? 'DESC';
    sortDropdownOpen = false;
    fetchEntries();
  }

  function handleSearch(): void {
    currentPage = 1;
    fetchEntries();
  }

  function goToPage(page: number): void {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
      fetchEntries();
    }
  }

  // Zoom handlers
  function zoomIn(): void {
    if (zoomLevel < ZOOM_CONFIG.MAX) zoomLevel += ZOOM_CONFIG.STEP;
  }
  function zoomOut(): void {
    if (zoomLevel > ZOOM_CONFIG.MIN) zoomLevel -= ZOOM_CONFIG.STEP;
  }

  async function toggleFullscreen(): Promise<void> {
    try {
      document.body.classList.add('fullscreen-mode');
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.error('[Blackboard] Error entering fullscreen:', err);
      document.body.classList.remove('fullscreen-mode');
    }
  }

  function handleFullscreenChange(): void {
    if (!document.fullscreenElement) {
      document.body.classList.remove('fullscreen-mode');
    }
  }

  // Modal handlers
  function openCreateModal(): void {
    entryModalMode = 'create';
    editingEntryId = null;
    formTitle = '';
    formContent = '';
    formPriority = 'medium';
    formColor = 'yellow';
    formExpiresAt = '';
    formCompanyWide = false;
    formDepartmentIds = [];
    formTeamIds = [];
    formAreaIds = [];
    attachmentFiles = null;
    showEntryModal = true;
  }

  function closeEntryModal(): void {
    showEntryModal = false;
    editingEntryId = null;
  }
  function proceedDelete(): void {
    showDeleteModal = false;
    showDeleteConfirmModal = true;
  }

  function handleEntrySubmit(e: Event): void {
    e.preventDefault();
    saveEntry();
  }
  function goToDetail(uuid: string): void {
    goto(`${base}/blackboard/${uuid}`);
  }
  function setColor(color: EntryColor): void {
    formColor = color;
  }
  function setPriority(priority: Priority): void {
    formPriority = priority;
    priorityDropdownOpen = false;
  }

  function removeAttachment(index: number): void {
    if (!attachmentFiles) return;
    const dt = new DataTransfer();
    for (let i = 0; i < attachmentFiles.length; i++) {
      if (i !== index) dt.items.add(attachmentFiles[i]);
    }
    attachmentFiles = dt.files;
  }

  // =============================================================================
  // LIFECYCLE
  // =============================================================================

  let mounted = false;
  $effect(() => {
    if (!mounted) {
      mounted = true;
      userRole = localStorage.getItem('activeRole') ?? localStorage.getItem('userRole');
      fetchEntries();
      fetchOrganizations();
    }
  });

  function handleClickOutside(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('#sort-dropdown')) sortDropdownOpen = false;
    if (!target.closest('#entry-priority-dropdown')) priorityDropdownOpen = false;
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (showDeleteConfirmModal) showDeleteConfirmModal = false;
      else if (showDeleteModal) showDeleteModal = false;
      else if (showEntryModal) closeEntryModal();
      sortDropdownOpen = false;
      priorityDropdownOpen = false;
    }
  }
</script>

<svelte:head>
  <title>Schwarzes Brett - Assixx</title>
</svelte:head>

<svelte:window onclick={handleClickOutside} onkeydown={handleKeyDown} />
<svelte:document onfullscreenchange={handleFullscreenChange} />

<div class="container">
  <!-- Filter Card -->
  <div class="card mb-6">
    <div
      class="card__header cursor-pointer"
      onclick={toggleFilter}
      role="button"
      tabindex="0"
      onkeydown={(e) => e.key === 'Enter' && toggleFilter()}
    >
      <div class="flex items-center justify-between">
        <h3 class="card__title m-0"><i class="fas fa-filter mr-2"></i>Filter & Suche</h3>
        <i
          class="fas fa-chevron-down transition-transform duration-200"
          class:rotate-180={filterExpanded}
        ></i>
      </div>
    </div>
    {#if filterExpanded}
      <div class="card__body">
        <div class="flex flex-wrap gap-4 items-end">
          <!-- Search Bar -->
          <div class="form-field">
            <label class="form-field__label" for="searchInput">Suche</label>
            <div class="relative">
              <input
                type="text"
                id="searchInput"
                class="form-field__control pl-10"
                placeholder="Blackboard durchsuchen..."
                bind:value={searchQuery}
                onkeydown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            </div>
          </div>

          <!-- Level Filter -->
          <div class="form-field">
            <span class="form-field__label" id="levelFilterLabel">Organisationsebene</span>
            <div class="toggle-group mt-2" role="group" aria-labelledby="levelFilterLabel">
              {#each [{ value: 'all', label: 'Alle', icon: 'fa-globe' }, { value: 'company', label: 'Firma', icon: 'fa-building' }, { value: 'department', label: 'Abteilung', icon: 'fa-sitemap' }, { value: 'team', label: 'Team', icon: 'fa-users' }, { value: 'area', label: 'Bereich', icon: 'fa-map-marked-alt' }] as opt (opt.value)}
                <button
                  class="toggle-group__btn"
                  class:active={levelFilter === opt.value}
                  onclick={() => setLevelFilter(opt.value as typeof levelFilter)}
                >
                  <i class="fas {opt.icon}" aria-hidden="true"></i>
                  {opt.label}
                </button>
              {/each}
            </div>
          </div>

          <!-- Sort Filter -->
          <div class="form-field">
            <label class="form-field__label" for="sortFilter">Sortierung</label>
            <div class="dropdown" id="sort-dropdown" role="listbox">
              <div
                class="dropdown__trigger"
                onclick={() => (sortDropdownOpen = !sortDropdownOpen)}
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === 'Enter' && (sortDropdownOpen = !sortDropdownOpen)}
              >
                <span>{sortLabel}</span>
                <i class="fas fa-chevron-down"></i>
              </div>
              {#if sortDropdownOpen}
                <div class="dropdown__menu active">
                  {#each SORT_OPTIONS as opt (opt.value)}
                    <div
                      class="dropdown__option"
                      onclick={() => setSort(opt.value)}
                      onkeydown={(e) => e.key === 'Enter' && setSort(opt.value)}
                      role="option"
                      tabindex="0"
                      aria-selected={sortBy === opt.value}
                    >
                      {opt.label}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Controls -->
  <div class="flex justify-between mb-6">
    <div class="controls-flex">
      <div class="zoom-controls zoom-controls-inline">
        <button class="btn btn-icon btn-secondary" title="Vergrößern" onclick={zoomIn}
          ><i class="fas fa-plus"></i></button
        >
        <span class="zoom-level">{zoomLevel}%</span>
        <button class="btn btn-icon btn-secondary" title="Verkleinern" onclick={zoomOut}
          ><i class="fas fa-minus"></i></button
        >
        <button class="btn btn-icon btn-secondary ml-2" title="Vollbild" onclick={toggleFullscreen}
          ><i class="fas fa-expand"></i></button
        >
      </div>
      {#if isAdmin}
        <button class="btn btn-primary" onclick={openCreateModal}
          ><i class="fas fa-plus mr-2"></i>Neuer Eintrag</button
        >
      {/if}
    </div>
  </div>

  <!-- Blackboard Container -->
  <div class="blackboard-container" id="blackboardContainer">
    {#if loading}
      <div class="text-center p-5">
        <div class="spinner-ring spinner-ring--md"></div>
        <p class="mt-4 text-[var(--color-text-secondary)]">{MESSAGES.LOADING}</p>
      </div>
    {:else if error}
      <div class="text-center p-5">
        <i class="fas fa-exclamation-triangle text-4xl text-[var(--color-danger)] mb-4"></i>
        <p class="text-[var(--color-text-secondary)]">{error}</p>
        <button class="btn btn-primary mt-4" onclick={fetchEntries}>{MESSAGES.RETRY}</button>
      </div>
    {:else if entries.length === 0}
      <div class="text-center p-5">
        <i class="fas fa-clipboard-list text-4xl text-[var(--color-text-secondary)] mb-4 opacity-50"
        ></i>
        <p class="text-[var(--color-text-secondary)]">{MESSAGES.NO_ENTRIES}</p>
        {#if isAdmin}
          <button class="btn btn-primary mt-4" onclick={openCreateModal}
            ><i class="fas fa-plus mr-2"></i>{MESSAGES.CREATE_FIRST}</button
          >
        {/if}
      </div>
    {:else}
      <div class="pinboard-grid" style="--zoom-level: {zoomLevel / 100};">
        {#each entries as entry (entry.id)}
          <div
            class="pinboard-item"
            onclick={() => goToDetail(entry.uuid)}
            style="transform: scale(var(--zoom-level, 1));"
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && goToDetail(entry.uuid)}
          >
            <div class="sticky-note sticky-note--{entry.color} sticky-note--large">
              <div class="sticky-note__pin"></div>
              <div class="sticky-note__title">{entry.title}</div>
              <div class="sticky-note__content">{truncateText(entry.content)}</div>
              <div class="sticky-note__indicators">
                {#if entry.commentCount && entry.commentCount > 0}
                  <span class="sticky-note__comments" title="Kommentare"
                    ><i class="fas fa-comments"></i> {entry.commentCount}</span
                  >
                {/if}
                {#if entry.attachmentCount && entry.attachmentCount > 0}
                  <span class="sticky-note__attachments" title="Anhänge"
                    ><i class="fas fa-paperclip"></i> {entry.attachmentCount}</span
                  >
                {/if}
              </div>
              <div class="sticky-note__footer">
                <div class="sticky-note__badges">
                  <span class="sticky-note__badge {getPriorityClass(entry.priority)}"
                    >{getPriorityLabel(entry.priority)}</span
                  >
                  <span class="sticky-note__badge {getOrgLevelClass(entry.orgLevel)}"
                    >{getOrgLevelLabel(entry.orgLevel)}</span
                  >
                  {#if !entry.isConfirmed}
                    <span class="sticky-note__badge sticky-note__badge--unread" title="Ungelesen"
                      ><i class="fas fa-eye-slash"></i></span
                    >
                  {/if}
                </div>
                <div class="sticky-note__footer-row">
                  <span class="sticky-note__author"
                    ><i class="fas fa-user"></i> {entry.authorName ?? 'Unbekannt'}</span
                  >
                  <span class="sticky-note__date"
                    ><i class="fas fa-calendar"></i> {formatDateShort(entry.createdAt)}</span
                  >
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="flex items-center justify-center mt-6 gap-2">
      <div class="pagination">
        <button
          class="pagination__btn"
          disabled={currentPage === 1}
          onclick={() => goToPage(currentPage - 1)}
          aria-label="Vorherige Seite"><i class="fas fa-chevron-left"></i></button
        >
        {#each Array(totalPages) as _, i (i)}
          <button
            class="pagination__btn"
            class:active={currentPage === i + 1}
            onclick={() => goToPage(i + 1)}>{i + 1}</button
          >
        {/each}
        <button
          class="pagination__btn"
          disabled={currentPage === totalPages}
          onclick={() => goToPage(currentPage + 1)}
          aria-label="Nächste Seite"><i class="fas fa-chevron-right"></i></button
        >
      </div>
    </div>
  {/if}
</div>

<!-- Entry Form Modal -->
{#if showEntryModal}
  <div
    class="modal-overlay modal-overlay--active"
    onclick={closeEntryModal}
    onkeydown={(e) => e.key === 'Escape' && closeEntryModal()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <form
      class="ds-modal ds-modal--lg"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      onsubmit={handleEntrySubmit}
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          {entryModalMode === 'edit' ? MESSAGES.MODAL_TITLE_EDIT : MESSAGES.MODAL_TITLE_CREATE}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          onclick={closeEntryModal}
          aria-label="Schließen"><i class="fas fa-times"></i></button
        >
      </div>
      <div class="ds-modal__body">
        <div class="form-field">
          <label for="entryTitle" class="form-field__label">Titel</label>
          <input
            type="text"
            class="form-field__control"
            id="entryTitle"
            required
            placeholder="Was ist das Thema?"
            bind:value={formTitle}
          />
        </div>
        <div class="form-field">
          <label for="entryContent" class="form-field__label">Inhalt</label>
          <textarea
            class="form-field__control"
            id="entryContent"
            rows="6"
            required
            placeholder="Ihre Nachricht hier..."
            bind:value={formContent}
          ></textarea>
        </div>

        <!-- Visibility -->
        <div class="form-field">
          <span class="form-field__label">Wer soll den Eintrag sehen?</span>
          <p class="mb-2 text-[var(--color-text-secondary)] text-sm">
            Wählen Sie keine Organisation für firmenweite Einträge.
          </p>
        </div>
        <div class="form-field">
          <label class="toggle-switch toggle-switch--danger">
            <input type="checkbox" class="toggle-switch__input" bind:checked={formCompanyWide} />
            <span class="toggle-switch__slider"></span>
            <span class="toggle-switch__label"><i class="fas fa-building mr-2"></i>Ganze Firma</span
            >
          </label>
          <span class="form-field__message text-[var(--color-danger)]"
            ><i class="fas fa-exclamation-triangle mr-1"></i>{MESSAGES.COMPANY_WIDE_WARNING}</span
          >
        </div>

        {#if !formCompanyWide}
          <div class="form-field">
            <label for="entry-area-select" class="form-field__label"
              ><i class="fas fa-map-marked-alt mr-1"></i>Bereiche</label
            >
            <select
              id="entry-area-select"
              multiple
              class="form-field__control min-h-[120px]"
              bind:value={formAreaIds}
            >
              {#each areas as area (area.id)}<option value={area.id}>{area.name}</option>{/each}
            </select>
            <span class="form-field__message text-[var(--color-text-secondary)]"
              >{MESSAGES.MULTI_SELECT_HINT}</span
            >
          </div>
          <div class="form-field">
            <label for="entry-department-select" class="form-field__label"
              ><i class="fas fa-sitemap mr-1"></i>Abteilungen</label
            >
            <select
              id="entry-department-select"
              multiple
              class="form-field__control min-h-[120px]"
              bind:value={formDepartmentIds}
            >
              {#each departments as dept (dept.id)}<option value={dept.id}>{dept.name}</option
                >{/each}
            </select>
          </div>
          <div class="form-field">
            <label for="entry-team-select" class="form-field__label"
              ><i class="fas fa-users mr-1"></i>Teams</label
            >
            <select
              id="entry-team-select"
              multiple
              class="form-field__control min-h-[120px]"
              bind:value={formTeamIds}
            >
              {#each teams as team (team.id)}<option value={team.id}>{team.name}</option>{/each}
            </select>
          </div>
        {/if}

        <!-- Priority -->
        <div class="form-field">
          <span class="form-field__label">Priorität</span>
          <div class="dropdown" id="entry-priority-dropdown" role="listbox">
            <div
              class="dropdown__trigger"
              onclick={() => (priorityDropdownOpen = !priorityDropdownOpen)}
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && (priorityDropdownOpen = !priorityDropdownOpen)}
            >
              <span>{priorityLabel}</span><i class="fas fa-chevron-down"></i>
            </div>
            {#if priorityDropdownOpen}
              <div class="dropdown__menu active">
                <div
                  class="dropdown__option"
                  onclick={() => setPriority('low')}
                  onkeydown={(e) => e.key === 'Enter' && setPriority('low')}
                  role="option"
                  tabindex="0"
                  aria-selected={formPriority === 'low'}
                >
                  Niedrig
                </div>
                <div
                  class="dropdown__option"
                  onclick={() => setPriority('medium')}
                  onkeydown={(e) => e.key === 'Enter' && setPriority('medium')}
                  role="option"
                  tabindex="0"
                  aria-selected={formPriority === 'medium'}
                >
                  Normal
                </div>
                <div
                  class="dropdown__option"
                  onclick={() => setPriority('high')}
                  onkeydown={(e) => e.key === 'Enter' && setPriority('high')}
                  role="option"
                  tabindex="0"
                  aria-selected={formPriority === 'high'}
                >
                  Hoch
                </div>
                <div
                  class="dropdown__option"
                  onclick={() => setPriority('urgent')}
                  onkeydown={(e) => e.key === 'Enter' && setPriority('urgent')}
                  role="option"
                  tabindex="0"
                  aria-selected={formPriority === 'urgent'}
                >
                  Dringend
                </div>
              </div>
            {/if}
          </div>
        </div>

        <!-- Expires -->
        <div class="form-field">
          <label for="entryExpiresAt" class="form-field__label">Gültig bis (optional)</label>
          <input
            type="date"
            class="form-field__control"
            id="entryExpiresAt"
            bind:value={formExpiresAt}
          />
        </div>

        <!-- Color Picker -->
        <div class="form-field">
          <span class="form-field__label"><i class="fas fa-palette mr-2"></i>Farbe</span>
          <div class="color-picker" role="radiogroup">
            {#each COLOR_OPTIONS as opt (opt.value)}
              <button
                type="button"
                class="color-option"
                class:active={formColor === opt.value}
                data-color={opt.value}
                onclick={() => setColor(opt.value)}
                role="radio"
                aria-checked={formColor === opt.value}
              >
                <span class="color-option__swatch"></span>
                <span class="color-option__label">{opt.label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- File Upload -->
        <div class="form-field">
          <span class="form-field__label">Anhänge (optional)</span>
          <div class="file-upload-zone file-upload-zone--compact">
            <input
              type="file"
              class="file-upload-zone__input"
              id="attachmentInput"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.gif"
              bind:files={attachmentFiles}
            />
            <label for="attachmentInput" class="file-upload-zone__label">
              <div class="file-upload-zone__icon"><i class="fas fa-cloud-upload-alt"></i></div>
              <div class="file-upload-zone__text">
                <p class="file-upload-zone__title">Dateien hierher ziehen</p>
              </div>
            </label>
          </div>
          {#if attachmentFiles && attachmentFiles.length > 0}
            <div class="file-upload-list file-upload-list--compact">
              {#each Array.from(attachmentFiles) as file, i (i)}
                <div class="file-upload-list__item">
                  <i class="fas fa-file file-upload-list__icon"></i>
                  <span class="file-upload-list__name">{file.name}</span>
                  <span class="file-upload-list__size"
                    >{(file.size / 1024 / 1024).toFixed(2)} MB</span
                  >
                  <button
                    type="button"
                    class="file-upload-list__remove"
                    onclick={() => removeAttachment(i)}
                    aria-label="Datei entfernen"><i class="fas fa-times"></i></button
                  >
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      <div class="ds-modal__footer ds-modal__footer--right">
        <button type="button" class="btn btn-cancel" onclick={closeEntryModal}>Abbrechen</button>
        <button type="submit" class="btn btn-modal">Speichern</button>
      </div>
    </form>
  </div>
{/if}

<!-- Delete Modal Step 1 -->
{#if showDeleteModal}
  <div
    class="modal-overlay modal-overlay--active"
    onclick={() => (showDeleteModal = false)}
    onkeydown={(e) => e.key === 'Escape' && (showDeleteModal = false)}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="ds-modal ds-modal--sm"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="document"
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          <i class="fas fa-trash-alt text-red-500 mr-2"></i>{MESSAGES.DELETE_CONFIRM_TITLE}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          onclick={() => (showDeleteModal = false)}
          aria-label="Schließen"><i class="fas fa-times"></i></button
        >
      </div>
      <div class="ds-modal__body">
        <p class="text-[var(--color-text-secondary)]">{MESSAGES.DELETE_CONFIRM_MESSAGE}</p>
      </div>
      <div class="ds-modal__footer ds-modal__footer--right">
        <button type="button" class="btn btn-cancel" onclick={() => (showDeleteModal = false)}
          >Abbrechen</button
        >
        <button type="button" class="btn btn-danger" onclick={proceedDelete}
          ><i class="fas fa-trash-alt mr-2"></i>Löschen</button
        >
      </div>
    </div>
  </div>
{/if}

<!-- Delete Modal Step 2 -->
{#if showDeleteConfirmModal}
  <div
    class="modal-overlay modal-overlay--active"
    onclick={() => (showDeleteConfirmModal = false)}
    onkeydown={(e) => e.key === 'Escape' && (showDeleteConfirmModal = false)}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="confirm-modal confirm-modal--danger"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="document"
    >
      <div class="confirm-modal__icon"><i class="fas fa-exclamation-triangle"></i></div>
      <h3 class="confirm-modal__title">{MESSAGES.DELETE_FINAL_TITLE}</h3>
      <p class="confirm-modal__message">
        <strong>ACHTUNG:</strong>
        {MESSAGES.DELETE_FINAL_MESSAGE}
      </p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
          onclick={() => (showDeleteConfirmModal = false)}>Abbrechen</button
        >
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--danger"
          onclick={deleteEntry}>Endgültig löschen</button
        >
      </div>
    </div>
  </div>
{/if}

<style>
  .rotate-180 {
    transform: rotate(180deg);
  }
</style>

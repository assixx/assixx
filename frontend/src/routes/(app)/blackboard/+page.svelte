<script lang="ts">
  /**
   * Blackboard - Page Component (Level 3: SvelteKit-native SSR)
   *
   * Pattern:
   * - All SSR data via $derived (single source of truth)
   * - URL params = filter/sort/page state
   * - Mutations trigger invalidateAll() for server refetch
   * - No client-side data fetching
   */
  import { goto, invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/stores';

  /** Resolve path with base prefix (for dynamic runtime paths) */
  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  // API Client (for mutations only)
  import { showErrorAlert, showSuccessAlert } from '$lib/stores/toast';
  import { getApiClient } from '$lib/utils/api-client';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('BlackboardPage');

  // Page-specific CSS
  import '../../../styles/blackboard.css';

  // _lib/ imports
  import { fetchEntryByUuid, uploadAttachment } from './_lib/api';
  import BlackboardEntryModal from './_lib/BlackboardEntryModal.svelte';
  import { ZOOM_CONFIG, SORT_OPTIONS, MESSAGES } from './_lib/constants';
  import {
    formatDateShort,
    isExpired,
    truncateText,
    getPriorityLabel,
    getPriorityClass,
    getOrgLevelLabel,
    getOrgLevelClass,
    getSortLabel,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type { BlackboardEntry, Priority, EntryColor, FormMode } from './_lib/types';

  // =============================================================================
  // SSR DATA - All via $derived (Level 3: Single Source of Truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // SSR data as derived - updates automatically when data changes
  const entries = $derived(data.entries);
  const totalPages = $derived(data.totalPages);
  const departments = $derived(data.departments);
  const teams = $derived(data.teams);
  const areas = $derived(data.areas);

  // API Client for mutations
  const apiClient = getApiClient();

  // =============================================================================
  // URL-BASED STATE (Level 3: URL is source of truth for filters)
  // =============================================================================

  // Read current filter state from URL
  const currentPage = $derived(Number($page.url.searchParams.get('page') ?? '1'));
  const sortBy = $derived($page.url.searchParams.get('sortBy') ?? 'created_at');
  const sortDir = $derived(($page.url.searchParams.get('sortDir') ?? 'DESC') as 'ASC' | 'DESC');
  const levelFilter = $derived(
    ($page.url.searchParams.get('filter') ?? 'all') as
      | 'all'
      | 'company'
      | 'department'
      | 'team'
      | 'area',
  );
  const searchQuery = $derived($page.url.searchParams.get('search') ?? '');
  const editUuid = $derived($page.url.searchParams.get('edit') ?? '');

  // Derived UI state
  const sortLabel = $derived(getSortLabel(`${sortBy}|${sortDir}`));

  // =============================================================================
  // CLIENT-ONLY STATE (UI state, not from SSR)
  // =============================================================================

  // Zoom State
  let zoomLevel = $state<number>(ZOOM_CONFIG.DEFAULT);
  let filterExpanded = $state(false);

  // Loading state for mutations
  let loading = $state(false);
  const error = $state<string | null>(null);

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
  let attachmentFiles = $state<File[] | null>(null);

  // User State (client-side only - from localStorage)
  let userRole = $state<string | null>(null);

  // Dropdown State
  let sortDropdownOpen = $state(false);

  // Search input - writable $derived (Svelte 5.25+): syncs from URL, can be locally overridden
  let searchInput = $derived(searchQuery);

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const isAdmin = $derived(userRole === 'admin' || userRole === 'root');

  // =============================================================================
  // URL NAVIGATION HELPERS (Level 3: goto() instead of fetchEntries())
  // =============================================================================

  function buildUrl(params: Record<string, string | number | undefined>): string {
    const url = new URL($page.url);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== 'all') {
        url.searchParams.set(key, String(value));
      } else {
        url.searchParams.delete(key);
      }
    });
    return url.pathname + url.search;
  }

  async function navigateWithParams(params: Record<string, string | number | undefined>) {
    await goto(buildUrl(params), { replaceState: true, noScroll: true });
  }

  // =============================================================================
  // FILTER/SORT/PAGE HANDLERS (Level 3: URL-based)
  // =============================================================================

  function toggleFilter(): void {
    filterExpanded = !filterExpanded;
  }

  async function setLevelFilter(level: typeof levelFilter): Promise<void> {
    await navigateWithParams({ filter: level, page: 1 });
  }

  async function setSort(value: string): Promise<void> {
    const [by, dir] = value.split('|');
    sortDropdownOpen = false;
    await navigateWithParams({ sortBy: by, sortDir: dir, page: 1 });
  }

  async function handleSearch(): Promise<void> {
    await navigateWithParams({ search: searchInput.trim(), page: 1 });
  }

  async function goToPage(pageNum: number): Promise<void> {
    if (pageNum >= 1 && pageNum <= totalPages) {
      await navigateWithParams({ page: pageNum });
    }
  }

  // =============================================================================
  // MUTATIONS (Level 3: invalidateAll() after success)
  // =============================================================================

  /**
   * Convert YYYY-MM-DD to ISO 8601 format (end of day UTC)
   * Backend requires: YYYY-MM-DDTHH:mm:ss format
   */
  function toIso8601EndOfDay(dateStr: string): string | null {
    if (dateStr === '' || dateStr.length === 0) return null;
    // Append end-of-day time to make it "expires at end of selected day"
    return `${dateStr}T23:59:59.000Z`;
  }

  /**
   * Convert ISO 8601 date to YYYY-MM-DD for HTML date input
   * Server returns: 2026-01-20T23:59:59.000Z → Input needs: 2026-01-20
   */
  function fromIso8601ToDateInput(isoDate: string | null | undefined): string {
    if (isoDate === null || isoDate === undefined || isoDate === '') return '';
    // Extract YYYY-MM-DD from ISO string
    return isoDate.substring(0, 10);
  }

  function buildEntryPayload(): Record<string, unknown> {
    const orgIds = formCompanyWide
      ? { departmentIds: [], teamIds: [], areaIds: [] }
      : { departmentIds: formDepartmentIds, teamIds: formTeamIds, areaIds: formAreaIds };

    return {
      title: formTitle,
      content: formContent,
      priority: formPriority,
      color: formColor,
      expiresAt: toIso8601EndOfDay(formExpiresAt),
      ...orgIds,
    };
  }

  async function uploadAttachments(entryId: number): Promise<void> {
    if (attachmentFiles === null || attachmentFiles.length === 0) return;

    for (const file of attachmentFiles) {
      try {
        await uploadAttachment(entryId, file);
      } catch (uploadErr) {
        log.error({ err: uploadErr, fileName: file.name }, 'Failed to upload');
        showErrorAlert(`Fehler beim Hochladen von ${file.name}`);
      }
    }
  }

  async function saveEntry(): Promise<void> {
    loading = true;
    try {
      const payload = buildEntryPayload();
      let entryId: number | null = null;

      if (entryModalMode === 'edit') {
        if (editingEntryId === null) {
          throw new Error('Entry ID required for edit mode');
        }
        await apiClient.put(`/blackboard/entries/${editingEntryId}`, payload);
        entryId = editingEntryId;
        showSuccessAlert('Eintrag aktualisiert');
      } else {
        const response = await apiClient.post<{ data?: { id: number }; id?: number }>(
          '/blackboard/entries',
          payload,
        );
        entryId = response.data?.id ?? response.id ?? null;
        showSuccessAlert('Eintrag erstellt');
      }

      if (entryId !== null) {
        await uploadAttachments(entryId);
      }

      closeEntryModal();
      await invalidateAll();
    } catch (err) {
      log.error({ err }, 'Error saving entry');
      showErrorAlert(err instanceof Error ? err.message : MESSAGES.SAVE_ERROR);
    } finally {
      loading = false;
    }
  }

  async function deleteEntry(): Promise<void> {
    const entryIdToDelete = deletingEntryId;
    if (entryIdToDelete === null) return;

    // Clear state immediately to prevent double-submission
    deletingEntryId = null;
    showDeleteConfirmModal = false;
    showDeleteModal = false;
    loading = true;

    try {
      await apiClient.delete(`/blackboard/entries/${entryIdToDelete}`);
      showSuccessAlert('Eintrag gelöscht');
      await invalidateAll(); // Level 3: Server refetches data
    } catch (err) {
      log.error({ err }, 'Error deleting entry');
      showErrorAlert(err instanceof Error ? err.message : MESSAGES.DELETE_ERROR);
    } finally {
      loading = false;
    }
  }

  // =============================================================================
  // UI HANDLERS
  // =============================================================================

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
      log.error({ err }, 'Error entering fullscreen');
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
    // Clear edit parameter from URL when closing
    if (editUuid !== '') {
      const url = new URL($page.url);
      url.searchParams.delete('edit');
      void goto(url.pathname + url.search, { replaceState: true, noScroll: true });
    }
  }

  /**
   * Open edit modal for an existing entry
   */
  function openEditModal(entry: BlackboardEntry): void {
    entryModalMode = 'edit';
    editingEntryId = entry.id;
    formTitle = entry.title;
    formContent = entry.content;
    formPriority = entry.priority;
    formColor = entry.color;
    formExpiresAt = fromIso8601ToDateInput(entry.expiresAt);
    formCompanyWide = entry.orgLevel === 'company';
    formDepartmentIds = entry.departmentIds ?? [];
    formTeamIds = entry.teamIds ?? [];
    formAreaIds = entry.areaIds ?? [];
    attachmentFiles = null;
    showEntryModal = true;
  }

  function proceedDelete(): void {
    showDeleteModal = false;
    showDeleteConfirmModal = true;
  }

  function handleEntrySubmit(e: Event): void {
    e.preventDefault();
    void saveEntry();
  }

  function goToDetail(uuid: string): void {
    void goto(resolvePath(`/blackboard/${uuid}`));
  }

  // =============================================================================
  // LIFECYCLE
  // =============================================================================

  // Set userRole from localStorage (client-side only for isAdmin check)
  let mounted = false;
  $effect(() => {
    if (!mounted) {
      mounted = true;
      userRole = localStorage.getItem('activeRole') ?? localStorage.getItem('userRole');
    }
  });

  // Handle edit URL parameter - load entry and open edit modal
  let lastEditUuid = '';
  $effect(() => {
    if (editUuid !== '' && editUuid !== lastEditUuid) {
      lastEditUuid = editUuid;
      // Load entry by UUID and open edit modal
      fetchEntryByUuid(editUuid)
        .then((entry) => {
          if (entry !== null) {
            openEditModal(entry);
          } else {
            showErrorAlert('Eintrag nicht gefunden');
            // Clear edit parameter
            const url = new URL($page.url);
            url.searchParams.delete('edit');
            void goto(url.pathname + url.search, { replaceState: true, noScroll: true });
          }
        })
        .catch((err: unknown) => {
          log.error({ err }, 'Error loading entry for edit');
          showErrorAlert('Fehler beim Laden des Eintrags');
        });
    } else if (editUuid === '' && lastEditUuid !== '') {
      lastEditUuid = '';
    }
  });

  function handleClickOutside(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('#sort-dropdown')) sortDropdownOpen = false;
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (showDeleteConfirmModal) showDeleteConfirmModal = false;
      else if (showDeleteModal) showDeleteModal = false;
      else if (showEntryModal) closeEntryModal();
      sortDropdownOpen = false;
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
      onkeydown={(e) => {
        if (e.key === 'Enter') toggleFilter();
      }}
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
                bind:value={searchInput}
                onkeydown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            </div>
          </div>

          <!-- Level Filter -->
          <div class="form-field">
            <span class="form-field__label" id="levelFilterLabel">Organisationsebene</span>
            <div class="toggle-group mt-2" role="group" aria-labelledby="levelFilterLabel">
              {#each [{ value: 'all', label: 'Alle', icon: 'fa-globe' }, { value: 'company', label: 'Firma', icon: 'fa-building' }, { value: 'area', label: 'Bereich', icon: 'fa-map-marked-alt' }, { value: 'department', label: 'Abteilung', icon: 'fa-sitemap' }, { value: 'team', label: 'Team', icon: 'fa-users' }] as opt (opt.value)}
                <button
                  type="button"
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
                onkeydown={(e) => {
                  if (e.key === 'Enter') sortDropdownOpen = !sortDropdownOpen;
                }}
              >
                <span>{sortLabel}</span>
                <i class="fas fa-chevron-down"></i>
              </div>
              {#if sortDropdownOpen}
                <div class="dropdown__menu active">
                  {#each SORT_OPTIONS as opt (opt.value)}
                    <div
                      class="dropdown__option"
                      onclick={() => void setSort(opt.value)}
                      onkeydown={(e) => {
                        if (e.key === 'Enter') void setSort(opt.value);
                      }}
                      role="option"
                      tabindex="0"
                      aria-selected={`${sortBy}|${sortDir}` === opt.value}
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
        <button type="button" class="btn btn-icon btn-secondary" title="Vergrößern" onclick={zoomIn}
          ><i class="fas fa-plus"></i></button
        >
        <span class="zoom-level">{zoomLevel}%</span>
        <button
          type="button"
          class="btn btn-icon btn-secondary"
          title="Verkleinern"
          onclick={zoomOut}><i class="fas fa-minus"></i></button
        >
        <button
          type="button"
          class="btn btn-icon btn-secondary ml-2"
          title="Vollbild"
          onclick={toggleFullscreen}><i class="fas fa-expand"></i></button
        >
      </div>
      {#if isAdmin}
        <button type="button" class="btn btn-primary" onclick={openCreateModal} disabled={loading}
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
        <button type="button" class="btn btn-primary mt-4" onclick={() => void invalidateAll()}
          >{MESSAGES.RETRY}</button
        >
      </div>
    {:else if entries.length === 0}
      <div class="text-center p-5">
        <i class="fas fa-clipboard-list text-4xl text-[var(--color-text-secondary)] mb-4 opacity-50"
        ></i>
        <p class="text-[var(--color-text-secondary)]">{MESSAGES.NO_ENTRIES}</p>
        {#if isAdmin}
          <button type="button" class="btn btn-primary mt-4" onclick={openCreateModal}
            ><i class="fas fa-plus mr-2"></i>{MESSAGES.CREATE_FIRST}</button
          >
        {/if}
      </div>
    {:else}
      <div class="pinboard-grid" style="--zoom-level: {zoomLevel / 100};">
        {#each entries as entry (entry.id)}
          <div
            class="pinboard-item"
            onclick={() => {
              goToDetail(entry.uuid);
            }}
            role="button"
            tabindex="0"
            onkeydown={(e) => {
              if (e.key === 'Enter') goToDetail(entry.uuid);
            }}
          >
            <div class="sticky-note sticky-note--{entry.color} sticky-note--large">
              <div class="sticky-note__pin"></div>
              <div class="sticky-note__header">
                <div class="sticky-note__title">{entry.title}</div>
                {#if entry.expiresAt}
                  <span
                    class="sticky-note__expires"
                    class:sticky-note__expires--expired={isExpired(entry.expiresAt)}
                    title={isExpired(entry.expiresAt) ? 'Abgelaufen' : 'Gültig bis'}
                  >
                    <i class="fas fa-clock"></i>
                    {formatDateShort(entry.expiresAt)}
                  </span>
                {/if}
              </div>
              <div class="sticky-note__content">{truncateText(entry.content)}</div>
              <div class="sticky-note__indicators">
                {#if (entry.commentCount ?? 0) > 0}
                  <span class="sticky-note__comments" title="Kommentare"
                    ><i class="fas fa-comments"></i> {entry.commentCount}</span
                  >
                {/if}
                {#if (entry.attachmentCount ?? 0) > 0}
                  <span class="sticky-note__attachments" title="Anhänge"
                    ><i class="fas fa-paperclip"></i> {entry.attachmentCount}</span
                  >
                {/if}
                <span
                  class="sticky-note__read-status"
                  class:sticky-note__read-status--read={entry.isConfirmed === true}
                  class:sticky-note__read-status--unread={entry.isConfirmed !== true}
                  title={entry.isConfirmed === true ? 'Gelesen' : 'Ungelesen'}
                >
                  <i class="fas {entry.isConfirmed === true ? 'fa-eye' : 'fa-eye-slash'}"></i>
                </span>
              </div>
              <div class="sticky-note__footer">
                <div class="sticky-note__badges">
                  <span class="sticky-note__badge {getPriorityClass(entry.priority)}"
                    >{getPriorityLabel(entry.priority)}</span
                  >
                  <span class="sticky-note__badge {getOrgLevelClass(entry.orgLevel)}"
                    >{getOrgLevelLabel(entry.orgLevel)}</span
                  >
                </div>
                <div class="sticky-note__footer-row">
                  <span class="sticky-note__author"
                    ><i class="fas fa-user"></i>
                    {entry.authorFullName ?? entry.authorName ?? 'Unbekannt'}</span
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
          type="button"
          class="pagination__btn"
          disabled={currentPage === 1}
          onclick={() => goToPage(currentPage - 1)}
          aria-label="Vorherige Seite"><i class="fas fa-chevron-left"></i></button
        >
        {#each Array(totalPages) as _, i (i)}
          <button
            type="button"
            class="pagination__btn"
            class:active={currentPage === i + 1}
            onclick={() => goToPage(i + 1)}>{i + 1}</button
          >
        {/each}
        <button
          type="button"
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
  <BlackboardEntryModal
    mode={entryModalMode}
    title={formTitle}
    content={formContent}
    priority={formPriority}
    color={formColor}
    expiresAt={formExpiresAt}
    companyWide={formCompanyWide}
    departmentIds={formDepartmentIds}
    teamIds={formTeamIds}
    areaIds={formAreaIds}
    {attachmentFiles}
    {departments}
    {teams}
    {areas}
    onclose={closeEntryModal}
    onsubmit={handleEntrySubmit}
    ontitlechange={(v: string) => (formTitle = v)}
    oncontentchange={(v: string) => (formContent = v)}
    onprioritychange={(v: Priority) => (formPriority = v)}
    oncolorchange={(v: EntryColor) => (formColor = v)}
    onexpireschange={(v: string) => (formExpiresAt = v)}
    oncompanywidechange={(v: boolean) => (formCompanyWide = v)}
    ondepartmentschange={(v: number[]) => (formDepartmentIds = v)}
    onteamschange={(v: number[]) => (formTeamIds = v)}
    onareaschange={(v: number[]) => (formAreaIds = v)}
    onfileschange={(v: File[] | null) => (attachmentFiles = v)}
  />
{/if}

<!-- Delete Modal Step 1 -->
{#if showDeleteModal}
  <div
    class="modal-overlay modal-overlay--active"
    onclick={() => (showDeleteModal = false)}
    onkeydown={(e) => {
      if (e.key === 'Escape') showDeleteModal = false;
    }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="ds-modal ds-modal--sm"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onkeydown={(e) => {
        e.stopPropagation();
      }}
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
    onkeydown={(e) => {
      if (e.key === 'Escape') showDeleteConfirmModal = false;
    }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="confirm-modal confirm-modal--danger"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onkeydown={(e) => {
        e.stopPropagation();
      }}
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
          onclick={() => void deleteEntry()}
          disabled={loading}>Endgültig löschen</button
        >
      </div>
    </div>
  </div>
{/if}

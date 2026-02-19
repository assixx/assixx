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
  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import { showErrorAlert, showSuccessAlert } from '$lib/stores/toast';
  import { getApiClient } from '$lib/utils/api-client';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('BlackboardPage');

  // _lib/ imports
  import { fetchEntryByUuid, uploadAttachment, confirmEntry } from './_lib/api';
  import BlackboardEntryCard from './_lib/BlackboardEntry.svelte';
  import BlackboardEntryModal from './_lib/BlackboardEntryModal.svelte';
  import BlackboardFilterCard from './_lib/BlackboardFilterCard.svelte';
  import { ZOOM_CONFIG, MESSAGES } from './_lib/constants';
  import DeleteConfirmModal from './_lib/DeleteConfirmModal.svelte';
  import { getSortLabel } from './_lib/utils';

  import type { PageData } from './$types';
  import type {
    BlackboardEntry,
    Priority,
    EntryColor,
    FormMode,
  } from './_lib/types';

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
  const currentPage = $derived(
    Number($page.url.searchParams.get('page') ?? '1'),
  );
  const sortBy = $derived($page.url.searchParams.get('sortBy') ?? 'created_at');
  const sortDir = $derived(
    ($page.url.searchParams.get('sortDir') ?? 'DESC') as 'ASC' | 'DESC',
  );
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

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const isAdmin = $derived(userRole === 'admin' || userRole === 'root');

  // =============================================================================
  // URL NAVIGATION HELPERS (Level 3: goto() instead of fetchEntries())
  // =============================================================================

  function buildUrl(
    params: Record<string, string | number | undefined>,
  ): string {
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

  async function navigateWithParams(
    params: Record<string, string | number | undefined>,
  ) {
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
    await navigateWithParams({ sortBy: by, sortDir: dir, page: 1 });
  }

  async function handleSearch(query: string): Promise<void> {
    await navigateWithParams({ search: query.trim(), page: 1 });
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
   * Convert YYYY-MM-DD to ISO 8601 format (end of day in LOCAL timezone)
   * Backend requires: YYYY-MM-DDTHH:mm:ss format
   *
   * IMPORTANT: Creates date at 23:59:59 LOCAL time, then converts to UTC.
   * This ensures "Gültig bis 21.01" expires at 23:59:59 German time,
   * not 23:59:59 UTC (which would be 00:59:59 German time next day).
   */
  function toIso8601EndOfDay(dateStr: string): string | null {
    if (dateStr === '' || dateStr.length === 0) return null;
    // Create date at 23:59:59 LOCAL time (no 'Z' = local timezone)
    // toISOString() then converts to correct UTC equivalent
    const localEndOfDay = new Date(`${dateStr}T23:59:59`);
    return localEndOfDay.toISOString();
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
    const orgIds =
      formCompanyWide ?
        { departmentIds: [], teamIds: [], areaIds: [] }
      : {
          departmentIds: formDepartmentIds,
          teamIds: formTeamIds,
          areaIds: formAreaIds,
        };

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
        const response = await apiClient.post<{
          data?: { id: number };
          id?: number;
        }>('/blackboard/entries', payload);
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
      showErrorAlert(
        err instanceof Error ? err.message : MESSAGES.DELETE_ERROR,
      );
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
      void goto(url.pathname + url.search, {
        replaceState: true,
        noScroll: true,
      });
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

  function closeDeleteModals(): void {
    showDeleteModal = false;
    showDeleteConfirmModal = false;
  }

  function proceedDelete(): void {
    showDeleteModal = false;
    showDeleteConfirmModal = true;
  }

  function handleEntrySubmit(e: Event): void {
    e.preventDefault();
    void saveEntry();
  }

  /**
   * Navigate to entry detail and auto-confirm if not yet read
   */
  function goToDetail(uuid: string, isConfirmed: boolean): void {
    // Auto-confirm if not yet read (non-blocking)
    if (!isConfirmed) {
      void confirmEntry(uuid).then((success) => {
        if (success) {
          notificationStore.decrementCount('blackboard');
        }
      });
    }
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
      userRole =
        localStorage.getItem('activeRole') ?? localStorage.getItem('userRole');
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
            void goto(url.pathname + url.search, {
              replaceState: true,
              noScroll: true,
            });
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

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (showDeleteConfirmModal) showDeleteConfirmModal = false;
      else if (showDeleteModal) showDeleteModal = false;
      else if (showEntryModal) closeEntryModal();
    }
  }
</script>

<svelte:head>
  <title>Schwarzes Brett - Assixx</title>
</svelte:head>

<svelte:window onkeydown={handleKeyDown} />
<svelte:document onfullscreenchange={handleFullscreenChange} />

<div class="container">
  <!-- Filter Card -->
  <BlackboardFilterCard
    {searchQuery}
    {levelFilter}
    {sortBy}
    {sortDir}
    {sortLabel}
    expanded={filterExpanded}
    onsearchchange={handleSearch}
    onlevelchange={setLevelFilter}
    onsortchange={setSort}
    ontoggle={toggleFilter}
  />

  <!-- Controls -->
  <div class="mb-6 flex justify-between">
    <div class="controls-flex">
      <div class="zoom-controls zoom-controls-inline">
        <button
          type="button"
          class="btn btn-icon btn-secondary"
          title="Vergrößern"
          onclick={zoomIn}><i class="fas fa-plus"></i></button
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
        <button
          type="button"
          class="btn btn-primary"
          onclick={openCreateModal}
          disabled={loading}
          ><i class="fas fa-plus mr-2"></i>Neuer Eintrag</button
        >
      {/if}
    </div>
  </div>

  <!-- Blackboard Container -->
  <div
    class="blackboard-container"
    id="blackboardContainer"
  >
    {#if loading}
      <div class="p-5 text-center">
        <div class="spinner-ring spinner-ring--md"></div>
        <p class="mt-4 text-(--color-text-secondary)">
          {MESSAGES.LOADING}
        </p>
      </div>
    {:else if error}
      <div class="p-5 text-center">
        <i
          class="fas fa-exclamation-triangle mb-4 text-4xl text-(--color-danger)"
        ></i>
        <p class="text-(--color-text-secondary)">{error}</p>
        <button
          type="button"
          class="btn btn-primary mt-4"
          onclick={() => void invalidateAll()}>{MESSAGES.RETRY}</button
        >
      </div>
    {:else if entries.length === 0}
      <div class="p-5 text-center">
        <i
          class="fas fa-clipboard-list mb-4 text-4xl text-(--color-text-secondary) opacity-50"
        ></i>
        <p class="text-(--color-text-secondary)">{MESSAGES.NO_ENTRIES}</p>
        {#if isAdmin}
          <button
            type="button"
            class="btn btn-primary mt-4"
            onclick={openCreateModal}
            ><i class="fas fa-plus mr-2"></i>{MESSAGES.CREATE_FIRST}</button
          >
        {/if}
      </div>
    {:else}
      <div
        class="pinboard-grid"
        style="

--zoom-level: {zoomLevel / 100};"
      >
        {#each entries as entry (entry.id)}
          <BlackboardEntryCard
            {entry}
            onclick={goToDetail}
          />
        {/each}
      </div>
    {/if}
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="mt-6 flex items-center justify-center gap-2">
      <div class="pagination">
        <button
          type="button"
          class="pagination__btn"
          disabled={currentPage === 1}
          onclick={() => goToPage(currentPage - 1)}
          aria-label="Vorherige Seite"
          ><i class="fas fa-chevron-left"></i></button
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
          aria-label="Nächste Seite"
          ><i class="fas fa-chevron-right"></i></button
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

<!-- Delete Confirmation Modals (Two-Step) -->
<DeleteConfirmModal
  showStep1={showDeleteModal}
  showStep2={showDeleteConfirmModal}
  {loading}
  oncancel={closeDeleteModals}
  onproceed={proceedDelete}
  onconfirm={deleteEntry}
/>

<style>
  /* ─── Blackboard Container ──────── */

  .blackboard-container {
    position: relative;
    border-radius: 12px;
    padding: 40px;
    width: 100%;
    min-height: calc(100vh - 120px);
    overflow: visible;
  }

  /* Dot pattern — dark mode: white dots, thick center → thin edges */
  .blackboard-container::after {
    position: absolute;
    z-index: 0;
    inset: 0;
    border-radius: 12px;
    background-image: radial-gradient(
      circle,
      rgb(255 255 255 / 25%) 1.5px,
      transparent 1.5px
    );
    background-size: 20px 20px;
    mask-image: radial-gradient(
      ellipse 80% 80% at 50% 50%,
      rgb(0 0 0) 10%,
      transparent 75%
    );
    pointer-events: none;
    content: '';
  }

  /* Dot pattern — light mode: dark dots, thick center → thin edges */
  :global(html:not(.dark)) .blackboard-container::after {
    background-image: radial-gradient(
      circle,
      rgb(0 0 0 / 40%) 1.5px,
      transparent 1.5px
    );
  }

  /* ─── Pinboard Grid ──────── */

  .pinboard-grid {
    display: flex;
    position: relative;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem;
    z-index: 2;
    transform: scale(var(--zoom-level, 1));
    transform-origin: top center;
  }

  /* ─── Controls ──────── */

  .controls-flex {
    display: flex !important;
    align-items: center;
    gap: 1rem;
  }

  .zoom-controls {
    display: flex;
    position: relative;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
    backdrop-filter: blur(10px);
    margin-bottom: 20px;
    margin-left: auto;
    border: var(--glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg);
    padding: 10px;
    width: fit-content;
  }

  .zoom-controls-inline {
    backdrop-filter: none;
    margin: 0;
    background: transparent;
    padding: 0;
  }

  .zoom-level {
    opacity: 80%;
    min-width: 45px;
    color: var(--text-primary);
    font-weight: 500;
    font-size: 14px;
    text-align: center;
  }

  /* ─── Fullscreen Mode ──────── */

  :global(body.fullscreen-mode #blackboardContainer) {
    position: fixed !important;
    z-index: 9999 !important;
    margin: 0 !important;
    inset: 0 !important;
    box-shadow: none !important;
    border: 0 !important;
    border-radius: 0 !important;
    padding: 20px !important;
    width: 100% !important;
    min-height: 100vh !important;
    overflow-y: auto;
  }

  :global(body.fullscreen-mode .pinboard-grid) {
    justify-content: center;
    gap: 1rem;
  }

  :global(body.fullscreen-mode .sidebar),
  :global(body.fullscreen-mode .header),
  :global(body.fullscreen-mode #breadcrumb-container),
  :global(body.fullscreen-mode .card.mb-6),
  :global(body.fullscreen-mode .flex.flex-between.mb-6),
  :global(body.fullscreen-mode .flex.justify-between.mb-6) {
    display: none !important;
  }

  :global(body.fullscreen-mode .zoom-controls) {
    display: none !important;
  }
</style>

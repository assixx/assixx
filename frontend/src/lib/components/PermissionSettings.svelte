<script lang="ts">
  /**
   * Permission Settings - Matrix Layout
   * @module lib/components/PermissionSettings
   *
   * Permission matrix with column headers (Read/Write/Delete) at top,
   * checkboxes in grid cells, vertical + horizontal dividers.
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import { showErrorAlert, showSuccessAlert } from '$lib/utils';

  // =============================================================================
  // TYPES
  // =============================================================================

  type PermType = 'canRead' | 'canWrite' | 'canDelete';

  interface ModulePermission {
    code: string;
    label: string;
    icon: string;
    allowedPermissions: PermType[];
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
  }

  interface PermissionCategory {
    code: string;
    label: string;
    icon: string;
    modules: ModulePermission[];
  }

  interface Employee {
    id: number;
    uuid: string;
    firstName: string;
    lastName: string;
    email: string;
  }

  // =============================================================================
  // PROPS
  // =============================================================================

  interface PermissionTriple {
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
  }

  interface HistoryEntry {
    createdAt: string;
    userName: string;
    firstName: string;
    lastName: string;
    details: string;
    oldValues: Record<string, PermissionTriple>;
    newValues: Record<string, PermissionTriple>;
  }

  interface Props {
    /** Employee/Admin/Root user data */
    employee: Employee | null;
    /** Permission categories from API */
    permissionData: PermissionCategory[];
    /** Error message from SSR load */
    error: string | null;
    /** URL to navigate back to */
    backUrl: string;
    /** Label for the back button */
    backLabel: string;
    /** Permission change history entries */
    history: HistoryEntry[];
    /** Total history entries available */
    historyTotal: number;
    /** Whether more history entries can be loaded */
    historyHasMore: boolean;
  }

  const {
    employee,
    permissionData,
    error,
    backUrl,
    backLabel,
    history: initialHistory,
    historyTotal: initialHistoryTotal,
    historyHasMore: initialHistoryHasMore,
  }: Props = $props();

  // =============================================================================
  // PERMISSION STATE (initialized from SSR data)
  // =============================================================================

  // Intentional one-time clone: user edits this mutable copy, SSR data must NOT reset it
  // svelte-ignore state_referenced_locally
  const categories = $state(structuredClone(permissionData));

  // Snapshot of last-saved state for unsaved-changes detection (avoids mutating props)
  // svelte-ignore state_referenced_locally
  let savedSnapshot = $state(structuredClone(permissionData));

  let isSaving = $state(false);

  // =============================================================================
  // PERMISSION COLUMN DEFINITIONS
  // =============================================================================

  const PERMISSION_COLUMNS: {
    key: PermType;
    label: string;
    icon: string;
    tooltip: string;
  }[] = [
    {
      key: 'canRead',
      label: 'Lesen',
      icon: 'fa-eye',
      tooltip: 'Inhalte anzeigen und lesen',
    },
    {
      key: 'canWrite',
      label: 'Schreiben',
      icon: 'fa-pencil-alt',
      tooltip: 'Inhalte erstellen und bearbeiten',
    },
    {
      key: 'canDelete',
      label: 'Löschen',
      icon: 'fa-trash-alt',
      tooltip: 'Inhalte unwiderruflich entfernen',
    },
  ];

  // =============================================================================
  // UNSAVED CHANGES DETECTION
  // =============================================================================

  interface PermissionChange {
    moduleLabel: string;
    categoryLabel: string;
    permType: 'Lesen' | 'Schreiben' | 'Löschen';
    granted: boolean;
  }

  const PERM_KEY_TO_LABEL: Record<PermType, 'Lesen' | 'Schreiben' | 'Löschen'> = {
    canRead: 'Lesen',
    canWrite: 'Schreiben',
    canDelete: 'Löschen',
  };

  function diffModulePermissions(
    mod: ModulePermission,
    origMod: ModulePermission,
    categoryLabel: string,
  ): PermissionChange[] {
    const result: PermissionChange[] = [];
    for (const col of PERMISSION_COLUMNS) {
      if (mod[col.key] !== origMod[col.key]) {
        result.push({
          moduleLabel: mod.label,
          categoryLabel,
          permType: PERM_KEY_TO_LABEL[col.key],
          granted: mod[col.key],
        });
      }
    }
    return result;
  }

  const unsavedChanges: PermissionChange[] = $derived.by(() => {
    const changes: PermissionChange[] = [];
    for (let catIdx = 0; catIdx < categories.length; catIdx++) {
      const cat = categories[catIdx];
      const origCat = savedSnapshot[catIdx];

      for (let modIdx = 0; modIdx < cat.modules.length; modIdx++) {
        changes.push(
          ...diffModulePermissions(cat.modules[modIdx], origCat.modules[modIdx], cat.label),
        );
      }
    }
    return changes;
  });

  const hasUnsavedChanges: boolean = $derived(unsavedChanges.length > 0);

  // =============================================================================
  // PERMISSION HISTORY
  // =============================================================================

  // Intentional one-time capture: history state managed independently from SSR props
  // svelte-ignore state_referenced_locally
  let historyEntries = $state(structuredClone(initialHistory));
  // svelte-ignore state_referenced_locally
  let historyTotal = $state(initialHistoryTotal);
  // svelte-ignore state_referenced_locally
  let historyHasMore = $state(initialHistoryHasMore);
  let isLoadingMore = $state(false);
  let historyOpen = $state(false);

  function getAuthToken(): string {
    return (
      document.cookie
        .split('; ')
        .find((row: string) => row.startsWith('accessToken='))
        ?.split('=')[1] ?? ''
    );
  }

  async function fetchHistoryPage(
    uuid: string,
    offset: number,
  ): Promise<{ entries: HistoryEntry[]; total: number; hasMore: boolean } | null> {
    const response = await fetch(
      `/api/v2/user-permissions/${uuid}/history?limit=20&offset=${offset}`,
      { headers: { Authorization: `Bearer ${getAuthToken()}` } },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const json = (await response.json()) as {
      success: boolean;
      data: { entries: HistoryEntry[]; total: number; hasMore: boolean };
    };
    return json.data;
  }

  async function loadMoreHistory(): Promise<void> {
    if (employee === null || isLoadingMore) return;

    isLoadingMore = true;
    try {
      const data = await fetchHistoryPage(employee.uuid, historyEntries.length);
      if (data !== null) {
        historyEntries = [...historyEntries, ...data.entries];
        historyTotal = data.total;
        historyHasMore = data.hasMore;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      showErrorAlert(`Fehler beim Laden der Historie: ${msg}`);
    }
    // eslint-disable-next-line require-atomic-updates -- Svelte $state is component-local + single-threaded, no race condition
    isLoadingMore = false;
  }

  async function reloadHistory(): Promise<void> {
    if (employee === null) return;

    try {
      const response = await fetch(
        `/api/v2/user-permissions/${employee.uuid}/history?limit=20&offset=0`,
        { headers: { Authorization: `Bearer ${getAuthToken()}` } },
      );
      if (!response.ok) return;

      const json = (await response.json()) as {
        success: boolean;
        data: { entries: HistoryEntry[]; total: number; hasMore: boolean };
      };

      historyEntries = json.data.entries;
      historyTotal = json.data.total;
      historyHasMore = json.data.hasMore;
    } catch {
      // Silent fail — history reload is non-critical
    }
  }

  function formatDate(isoString: string): string {
    return new Date(isoString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function formatTime(isoString: string): string {
    return new Date(isoString).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  interface HistoryDiffEntry {
    moduleKey: string;
    permType: 'Lesen' | 'Schreiben' | 'Löschen';
    granted: boolean;
  }

  function diffHistoryEntry(entry: HistoryEntry): HistoryDiffEntry[] {
    const diffs: HistoryDiffEntry[] = [];
    const allKeys = new Set([...Object.keys(entry.oldValues), ...Object.keys(entry.newValues)]);

    for (const key of allKeys) {
      const oldV = entry.oldValues[key] ?? { canRead: false, canWrite: false, canDelete: false };
      const newV = entry.newValues[key] ?? { canRead: false, canWrite: false, canDelete: false };

      if (oldV.canRead !== newV.canRead) {
        diffs.push({ moduleKey: key, permType: 'Lesen', granted: newV.canRead });
      }
      if (oldV.canWrite !== newV.canWrite) {
        diffs.push({ moduleKey: key, permType: 'Schreiben', granted: newV.canWrite });
      }
      if (oldV.canDelete !== newV.canDelete) {
        diffs.push({ moduleKey: key, permType: 'Löschen', granted: newV.canDelete });
      }
    }
    return diffs;
  }

  function moduleKeyToLabel(key: string): string {
    const parts = key.split(':');
    return parts[1] ?? key;
  }

  // =============================================================================
  // HANDLERS
  // =============================================================================

  /**
   * Save all permission changes to backend via PUT.
   * Collects current state from all categories/modules into flat array.
   */
  async function savePermissions(): Promise<void> {
    if (employee === null) return;

    isSaving = true;
    try {
      const permissions: {
        addonCode: string;
        moduleCode: string;
        canRead: boolean;
        canWrite: boolean;
        canDelete: boolean;
      }[] = [];

      for (const cat of categories) {
        for (const mod of cat.modules) {
          permissions.push({
            addonCode: cat.code,
            moduleCode: mod.code,
            canRead: mod.canRead,
            canWrite: mod.canWrite,
            canDelete: mod.canDelete,
          });
        }
      }

      const response = await fetch(`/api/v2/user-permissions/${employee.uuid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ permissions }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Save failed (${response.status}): ${errorBody}`);
      }

      // Update saved snapshot so unsaved-banner clears
      // $state.snapshot() strips Svelte proxy — structuredClone can't handle proxies
      savedSnapshot = $state.snapshot(categories);

      showSuccessAlert('Berechtigungen gespeichert');

      // Reload history to show the new entry
      void reloadHistory();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler';
      showErrorAlert(`Fehler beim Speichern: ${errorMessage}`);
    } finally {
      isSaving = false;
    }
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  /** Set a single module's permissions to the given value (respecting allowedPermissions) */
  function setModulePermissions(mod: ModulePermission, value: boolean): void {
    mod.canRead = value && mod.allowedPermissions.includes('canRead');
    mod.canWrite = value && mod.allowedPermissions.includes('canWrite');
    mod.canDelete = value && mod.allowedPermissions.includes('canDelete');
  }

  /** Select all allowed permissions across all categories */
  function selectAll(): void {
    for (const cat of categories) {
      for (const mod of cat.modules) {
        setModulePermissions(mod, true);
      }
    }
  }

  /** Deselect all permissions across all categories */
  function deselectAll(): void {
    for (const cat of categories) {
      for (const mod of cat.modules) {
        setModulePermissions(mod, false);
      }
    }
  }

  function goBack(): void {
    void goto(resolve(backUrl));
  }
</script>

<svelte:head>
  <title
    >Berechtigungen - {employee?.firstName ?? ''}
    {employee?.lastName ?? ''} - Assixx</title
  >
</svelte:head>

<div class="container">
  <!-- Back Button -->
  <div class="mb-2">
    <button
      type="button"
      class="btn btn-light"
      onclick={goBack}
    >
      <i class="fas fa-arrow-left mr-1"></i>Zurück zur {backLabel}
    </button>
  </div>

  <div class="card">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-shield-alt mr-2"></i>
        Berechtigungen
      </h2>
      <div class="perm-bulk-actions">
        <button
          type="button"
          class="btn btn-success"
          title="Alle Berechtigungen aktivieren"
          onclick={selectAll}
        >
          <i class="fas fa-check-double mr-1"></i>
          Alle
        </button>
        <button
          type="button"
          class="btn btn-warning"
          title="Alle Berechtigungen deaktivieren"
          onclick={deselectAll}
        >
          <i class="fas fa-times mr-1"></i>
          Keine
        </button>
      </div>
    </div>

    <div class="card__body">
      {#if error}
        <div class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <h3 class="empty-state__title">Fehler</h3>
          <p class="empty-state__description">{error}</p>
          <button
            type="button"
            class="btn btn-primary"
            onclick={goBack}
          >
            <i class="fas fa-arrow-left"></i>
            Zurück
          </button>
        </div>
      {:else if categories.length === 0}
        <div class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-shield-alt"></i>
          </div>
          <h3 class="empty-state__title">Keine Berechtigungen</h3>
          <p class="empty-state__description">Keine Berechtigungs-Kategorien verfügbar.</p>
        </div>
      {:else}
        <!-- Permission Matrix -->
        <div class="perm-matrix">
          <!-- Header Row: User name + bulk actions + column headers -->
          <div class="perm-row perm-row--header">
            <div class="perm-label">
              {#if employee}
                <i class="fas fa-user mr-2 text-(--color-primary)"></i>
                <span class="font-semibold">
                  {employee.firstName}
                  {employee.lastName}
                </span>
              {/if}
            </div>
            <div class="perm-cols">
              {#each PERMISSION_COLUMNS as col, colIdx (col.key)}
                {#if colIdx > 0}
                  <div class="perm-vdivider"></div>
                {/if}
                <div class="perm-col-header">
                  <i class="fas {col.icon}"></i>
                  <span class="perm-col-header__label">{col.label}</span>
                  <span class="tooltip ml-1">
                    <i class="fas fa-info-circle"></i>
                    <span
                      class="tooltip__content tooltip__content--info tooltip__content--bottom"
                      role="tooltip">{col.tooltip}</span
                    >
                  </span>
                </div>
              {/each}
            </div>
          </div>

          <div class="perm-hdivider"></div>

          <!-- Categories + Module Rows -->
          {#each categories as category, catIdx (category.code)}
            <!-- Category Header -->
            <div class="perm-row perm-row--category">
              <div class="perm-label">
                <i class="fas {category.icon} mr-2 text-(--color-primary)"></i>
                {category.label}
              </div>
            </div>

            <!-- Module Rows -->
            {#each category.modules as perm, modIdx (perm.code)}
              <div
                class="perm-row perm-row--module"
                class:perm-row--danger={category.code === 'manage_hierarchy' &&
                  perm.code === 'manage-permissions'}
              >
                <div class="perm-label perm-label--module">
                  {#if category.code === 'manage_hierarchy' && perm.code === 'manage-permissions'}
                    <i class="fas fa-exclamation-triangle mr-2 text-(--color-danger)"></i>
                  {:else}
                    <i class="fas {perm.icon} mr-2 text-(--color-text-secondary)"></i>
                  {/if}
                  {perm.label}
                  {#if category.code === 'manage_hierarchy' && perm.code === 'manage-permissions'}
                    <span class="u-fs-11 ml-2 text-(--color-text-secondary)"
                      >(Eigene Berechtigungen können nicht selbst bearbeitet werden)</span
                    >
                  {/if}
                </div>
                <div class="perm-cols">
                  {#each PERMISSION_COLUMNS as col, colIdx (col.key)}
                    {#if colIdx > 0}
                      <div class="perm-vdivider"></div>
                    {/if}
                    <div class="perm-cell">
                      {#if perm.allowedPermissions.includes(col.key)}
                        <label
                          class="perm-check"
                          title={col.label}
                        >
                          <input
                            type="checkbox"
                            bind:checked={perm[col.key]}
                          />
                          <span class="perm-check__box">
                            <i class="fas fa-check perm-check__icon"></i>
                          </span>
                        </label>
                      {:else}
                        <span
                          class="perm-cell--na"
                          aria-label="Nicht verfügbar">—</span
                        >
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>

              <!-- Row divider between modules -->
              {#if modIdx < category.modules.length - 1}
                <div class="perm-hdivider perm-hdivider--light"></div>
              {/if}
            {/each}

            <!-- Category divider -->
            {#if catIdx < categories.length - 1}
              <div class="perm-hdivider perm-hdivider--space"></div>
            {/if}
          {/each}
        </div>

        <!-- Unsaved Changes Banner -->
        {#if hasUnsavedChanges}
          <div class="alert alert--warning perm-unsaved-banner mt-4">
            <div class="alert__icon">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <div class="alert__content">
              <div class="alert__title">
                {unsavedChanges.length} ungespeicherte Änderung{unsavedChanges.length > 1 ?
                  'en'
                : ''}
              </div>
              <ul class="perm-changes-list">
                {#each unsavedChanges as change (`${change.categoryLabel}:${change.moduleLabel}:${change.permType}`)}
                  <li class="perm-change-item">
                    {#if change.granted}
                      <i class="fas fa-plus-circle perm-change-icon perm-change-icon--grant"></i>
                    {:else}
                      <i class="fas fa-minus-circle perm-change-icon perm-change-icon--revoke"></i>
                    {/if}
                    <span>
                      {change.permType}
                      {change.granted ? 'erteilt' : 'entzogen'} für
                      <strong>{change.moduleLabel}</strong>
                      ({change.categoryLabel})
                    </span>
                  </li>
                {/each}
              </ul>
            </div>
          </div>
        {/if}

        <!-- Save Button -->
        <div class="mt-4 flex justify-end border-t border-(--color-glass-border) pt-3">
          <button
            type="button"
            class="btn btn-primary"
            onclick={savePermissions}
            disabled={isSaving}
          >
            {#if isSaving}
              <span class="spinner-ring spinner-ring--sm mr-2"></span>
              Speichern...
            {:else}
              <i class="fas fa-save mr-2"></i>
              Berechtigungen speichern
            {/if}
          </button>
        </div>

        <!-- Permission History Accordion -->
        {#if historyEntries.length > 0}
          <div class="perm-history mt-6">
            <div class="accordion">
              <div
                class="accordion__item"
                class:accordion__item--active={historyOpen}
              >
                <button
                  type="button"
                  class="accordion__header"
                  onclick={() => {
                    historyOpen = !historyOpen;
                  }}
                  aria-expanded={historyOpen}
                >
                  <span class="accordion__title">
                    <i class="fas fa-history mr-2"></i>
                    Änderungshistorie
                  </span>
                  <span class="accordion__badge">{historyTotal}</span>
                  <i class="fas fa-chevron-down accordion__icon ml-2"></i>
                </button>
                <div class="accordion__content">
                  <div class="accordion__body">
                    {#each historyEntries as entry, idx (`${entry.createdAt}-${idx}`)}
                      <div class="perm-history-entry">
                        <div class="perm-history-meta">
                          <strong>
                            {entry.firstName !== '' ?
                              `${entry.firstName} ${entry.lastName}`
                            : entry.userName}
                          </strong>
                          <span class="perm-history-date">
                            {formatDate(entry.createdAt)} um {formatTime(entry.createdAt)}
                          </span>
                        </div>
                        <ul class="perm-changes-list">
                          {#each diffHistoryEntry(entry) as diff (`${entry.createdAt}-${diff.moduleKey}-${diff.permType}`)}
                            <li class="perm-change-item">
                              {#if diff.granted}
                                <i
                                  class="fas fa-plus-circle perm-change-icon perm-change-icon--grant"
                                ></i>
                              {:else}
                                <i
                                  class="fas fa-minus-circle perm-change-icon perm-change-icon--revoke"
                                ></i>
                              {/if}
                              <span>
                                {diff.permType}
                                {diff.granted ? 'erteilt' : 'entzogen'} für
                                <strong>{moduleKeyToLabel(diff.moduleKey)}</strong>
                              </span>
                            </li>
                          {/each}
                        </ul>
                      </div>
                      {#if idx < historyEntries.length - 1}
                        <div class="perm-hdivider perm-hdivider--light"></div>
                      {/if}
                    {/each}

                    {#if historyHasMore}
                      <div class="mt-3 flex justify-center">
                        <button
                          type="button"
                          class="btn btn-light btn--sm"
                          onclick={loadMoreHistory}
                          disabled={isLoadingMore}
                        >
                          {#if isLoadingMore}
                            <span class="spinner-ring spinner-ring--sm mr-2"></span>
                            Laden...
                          {:else}
                            <i class="fas fa-arrow-down mr-1"></i>
                            Mehr laden
                          {/if}
                        </button>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  /* ================================================================
     Card Header with Actions
     ================================================================ */
  .card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  /* ================================================================
     Permission Matrix Grid Layout
     ================================================================ */
  .perm-matrix {
    display: flex;
    flex-direction: column;
  }

  /* Shared row: label on left, permission columns on right */
  .perm-row {
    display: flex;
    align-items: center;
    min-height: 36px;
  }

  .perm-row--header {
    padding-bottom: 6px;
  }

  /* Bulk action buttons container */
  .perm-bulk-actions {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }

  .perm-row--category {
    padding-top: 10px;
    padding-bottom: 2px;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .perm-row--module {
    padding: 3px 0;
    border-radius: var(--radius-sm);
    transition: background-color 0.15s ease;
  }

  .perm-row--module:hover {
    background: color-mix(in oklch, var(--color-white) 3%, transparent);
  }

  .perm-row--danger {
    background: color-mix(in oklch, var(--color-danger) 8%, transparent);
    border-left: 3px solid var(--color-danger);
    padding-left: 8px;
  }

  .perm-row--danger:hover {
    background: color-mix(in oklch, var(--color-danger) 14%, transparent);
  }

  /* ================================================================
     Labels (left column)
     ================================================================ */
  .perm-label {
    flex: 1;
    display: flex;
    align-items: center;
    color: var(--color-text-primary);
    font-weight: 500;
    min-width: 0;
  }

  .perm-label--module {
    padding-left: 24px;
    font-weight: 400;
    font-size: 0.875rem;
  }

  /* ================================================================
     Permission Columns Container (right side)
     ================================================================ */
  .perm-cols {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  /* ================================================================
     Column Headers
     ================================================================ */
  .perm-col-header {
    width: 80px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1px;
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    letter-spacing: 0.05em;
  }

  /* ================================================================
     Checkbox Cells
     ================================================================ */
  .perm-cell {
    width: 80px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .perm-cell--na {
    color: var(--color-text-secondary);
    opacity: 25%;
    font-size: 0.875rem;
  }

  /* ================================================================
     Dividers - Horizontal
     ================================================================ */
  .perm-hdivider {
    height: 1px;
    background: var(--color-glass-border);
  }

  .perm-hdivider--light {
    opacity: 40%;
    margin-left: 28px;
  }

  .perm-hdivider--space {
    margin-top: 4px;
    margin-bottom: 2px;
  }

  /* ================================================================
     Dividers - Vertical (between permission columns)
     ================================================================ */
  .perm-vdivider {
    width: 1px;
    align-self: stretch;
    background: var(--color-glass-border);
    opacity: 50%;
  }

  /* ================================================================
     Custom Checkbox - Glassmorphism Style
     ================================================================ */
  .perm-check {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .perm-check input {
    position: absolute;
    opacity: 0%;
    width: 0;
    height: 0;
  }

  .perm-check__box {
    width: 18px;
    height: 18px;
    border-radius: var(--radius-md);
    border: 2px solid var(--color-glass-border);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    background: color-mix(in oklch, var(--color-white) 3%, transparent);
  }

  .perm-check__icon {
    font-size: 0.75rem;
    opacity: 0%;
    transform: scale(0.5);
    transition: all 0.2s ease;
    color: var(--color-white);
  }

  /* Checked state */
  .perm-check input:checked + .perm-check__box {
    background: var(--color-primary);
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px color-mix(in oklch, var(--color-primary) 30%, transparent);
    border-radius: var(--radius-md);
  }

  .perm-check input:checked + .perm-check__box .perm-check__icon {
    opacity: 100%;
    transform: scale(1);
  }

  /* Hover state */
  .perm-check:hover .perm-check__box {
    border-color: var(--color-primary);
    background: color-mix(in oklch, var(--color-primary) 8%, transparent);
  }

  /* Focus state (keyboard navigation) */
  .perm-check input:focus-visible + .perm-check__box {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  /* Danger row: red checkboxes */
  .perm-row--danger .perm-check input:checked + .perm-check__box {
    background: var(--color-danger);
    border-color: var(--color-danger);
    box-shadow: 0 2px 8px color-mix(in oklch, var(--color-danger) 30%, transparent);
  }

  .perm-row--danger .perm-check:hover .perm-check__box {
    border-color: var(--color-danger);
    background: color-mix(in oklch, var(--color-danger) 8%, transparent);
  }

  .perm-row--danger .perm-check input:focus-visible + .perm-check__box {
    outline-color: var(--color-danger);
  }

  /* ================================================================
     Unsaved Changes Banner
     ================================================================ */
  .perm-unsaved-banner {
    animation: perm-fade-in 0.3s ease;
  }

  .perm-changes-list {
    list-style: none;
    padding: 0;
    margin: 6px 0 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .perm-change-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8125rem;
    color: var(--color-text-primary);
  }

  .perm-change-icon {
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .perm-change-icon--grant {
    color: var(--color-success);
  }

  .perm-change-icon--revoke {
    color: var(--color-danger);
  }

  @keyframes perm-fade-in {
    from {
      opacity: 0%;
      transform: translateY(-8px);
    }

    to {
      opacity: 100%;
      transform: translateY(0);
    }
  }

  /* ================================================================
     Permission History
     ================================================================ */
  .perm-history-entry {
    padding: 10px 0;
  }

  .perm-history-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8125rem;
    color: var(--color-text-primary);
    margin-bottom: 4px;
  }

  .perm-history-date {
    color: var(--color-text-secondary);
    font-size: 0.75rem;
  }

  /* ================================================================
     Mobile Responsive
     ================================================================ */
  @media (width <= 640px) {
    .perm-col-header {
      width: 56px;
    }

    .perm-col-header__label {
      display: none;
    }

    .perm-cell {
      width: 56px;
    }

    .perm-label--module {
      padding-left: 16px;
      font-size: 0.875rem;
    }

    .perm-check__box {
      width: 32px;
      height: 32px;
    }
  }
</style>

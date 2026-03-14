<!--
  Positionen-Verwaltung — Sub-Seite von Organigramm (Root only)
  Verwaltet Position-Optionen pro Kategorie (Mitarbeiter/Admin/Root)
  die in den jeweiligen Dropdowns der User-Modals angezeigt werden.
-->
<script lang="ts">
  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';
  import {
    isLeadPosition,
    LEAD_POSITION_KEYS,
    resolvePositionDisplay,
  } from '$lib/types/hierarchy-labels';
  import { getApiClient } from '$lib/utils/api-client';

  import type { PageData } from './$types';

  interface PositionOptions {
    employee: string[];
    admin: string[];
    root: string[];
  }

  type Category = 'employee' | 'admin' | 'root';

  const CATEGORY_LABELS: Record<Category, string> = {
    employee: 'Mitarbeiter',
    admin: 'Administratoren',
    root: 'Root-Benutzer',
  };

  const CATEGORIES: Category[] = ['employee', 'admin', 'root'];

  const { data }: { data: PageData } = $props();

  const apiClient = getApiClient();

  /** Hierarchy labels from parent layout (ADR-034) */
  const labels = $derived(data.hierarchyLabels);

  const serverPositions = $derived(data.positions);

  let positions = $state<PositionOptions>({
    employee: [],
    admin: [],
    root: [],
  });

  /** Hierarchie-Reihenfolge: area → department → team (oben nach unten) */
  const LEAD_ORDER: string[] = [
    LEAD_POSITION_KEYS.AREA,
    LEAD_POSITION_KEYS.DEPARTMENT,
    LEAD_POSITION_KEYS.TEAM,
  ];

  /** System positions always first, sorted by hierarchy level */
  function sortSystemFirst(list: string[]): string[] {
    const system = list
      .filter((p: string) => isLeadPosition(p))
      .sort(
        (a: string, b: string) => LEAD_ORDER.indexOf(a) - LEAD_ORDER.indexOf(b),
      );
    const custom = list.filter((p: string) => !isLeadPosition(p));
    return [...system, ...custom];
  }

  /** Inject missing lead keys + sort system first */
  function ensureLeadPositions(list: string[]): string[] {
    const missing = LEAD_ORDER.filter((key: string) => !list.includes(key));
    return sortSystemFirst([...missing, ...list]);
  }

  /** Sync editable copy from server data (mount + after save via data mutation) */
  $effect(() => {
    const src = serverPositions;
    positions = {
      employee: sortSystemFirst([...src.employee]),
      admin: ensureLeadPositions([...src.admin]),
      root: ensureLeadPositions([...src.root]),
    };
  });

  let activeTab = $state<Category>('employee');
  let newPosition = $state('');
  let editingIndex = $state<number | null>(null);
  let editingValue = $state('');
  let saving = $state(false);

  const currentList = $derived(positions[activeTab]);
  /** Compare only custom positions (lead keys are auto-injected) */
  const hasChanges = $derived.by(() => {
    for (const cat of CATEGORIES) {
      const cur = positions[cat].filter((p: string) => !isLeadPosition(p));
      const srv = serverPositions[cat].filter(
        (p: string) => !isLeadPosition(p),
      );
      if (cur.length !== srv.length) return true;
      if (cur.some((p: string, i: number) => p !== srv[i])) return true;
    }
    return false;
  });

  function addPosition(): void {
    const trimmed = newPosition.trim();
    if (trimmed === '') return;

    if (isLeadPosition(trimmed)) {
      showErrorAlert(
        'System-Positionen können nicht manuell hinzugefügt werden.',
      );
      return;
    }

    const list = positions[activeTab];
    const duplicate = list.some(
      (p: string) => p.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      showErrorAlert('Diese Position existiert bereits.');
      return;
    }

    positions[activeTab] = [...list, trimmed];
    newPosition = '';
  }

  function removePosition(index: number): void {
    if (isLeadPosition(positions[activeTab][index])) return;
    positions[activeTab] = positions[activeTab].filter(
      (_: string, i: number) => i !== index,
    );
  }

  function startEdit(index: number): void {
    if (isLeadPosition(positions[activeTab][index])) return;
    editingIndex = index;
    editingValue = positions[activeTab][index] ?? '';
  }

  function cancelEdit(): void {
    editingIndex = null;
    editingValue = '';
  }

  function confirmEdit(): void {
    if (editingIndex === null) return;

    const trimmed = editingValue.trim();
    if (trimmed === '') {
      cancelEdit();
      return;
    }

    const list = positions[activeTab];
    const duplicate = list.some(
      (p: string, i: number) =>
        i !== editingIndex && p.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      showErrorAlert('Diese Position existiert bereits.');
      return;
    }

    const updated = [...list];
    updated[editingIndex] = trimmed;
    positions[activeTab] = updated;
    cancelEdit();
  }

  function moveUp(index: number): void {
    if (index === 0) return;
    const list = [...positions[activeTab]];
    if (isLeadPosition(list[index - 1] ?? '')) return;
    const temp = list[index - 1];
    list[index - 1] = list[index];
    list[index] = temp;
    positions[activeTab] = list;
  }

  function moveDown(index: number): void {
    const list = [...positions[activeTab]];
    if (index >= list.length - 1) return;
    const temp = list[index];
    list[index] = list[index + 1];
    list[index + 1] = temp;
    positions[activeTab] = list;
  }

  function buildPayload(): PositionOptions {
    return {
      employee: [...positions.employee],
      admin: [...positions.admin],
      root: [...positions.root],
    };
  }

  async function saveAll(): Promise<void> {
    saving = true;
    const payload = buildPayload();
    try {
      const result = await apiClient.request<PositionOptions>(
        '/organigram/position-options',
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        },
      );

      data.positions = { ...result };
      positions = {
        employee: [...result.employee],
        admin: [...result.admin],
        root: [...result.root],
      };
      showSuccessAlert('Positionen gespeichert');
    } catch {
      showErrorAlert('Fehler beim Speichern der Positionen');
    } finally {
      saving = false;
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      if (editingIndex !== null) {
        confirmEdit();
      } else {
        addPosition();
      }
    }
    if (event.key === 'Escape' && editingIndex !== null) {
      cancelEdit();
    }
  }
</script>

<svelte:head>
  <title>Positionen | Organigramm | Assixx</title>
</svelte:head>

<div class="container">
  <div class="card">
    <div class="card__header">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="card__title">
            <i class="fas fa-id-badge mr-2"></i>
            Positionen verwalten
          </h2>
          <p class="mt-2 text-(--color-text-secondary)">
            Definiere die verfügbaren Positionen pro Benutzerrolle. Diese
            erscheinen in den Dropdown-Menüs beim Erstellen und Bearbeiten von
            Benutzern.
          </p>
        </div>
        <a
          href="/settings/organigram"
          class="btn btn-secondary btn-sm"
        >
          <i class="fas fa-sitemap"></i>
          Organigramm
        </a>
      </div>

      <!-- Tabs -->
      <div class="tabs mt-6">
        {#each CATEGORIES as category (category)}
          <button
            type="button"
            class="tab"
            class:active={activeTab === category}
            onclick={() => {
              activeTab = category;
              cancelEdit();
              newPosition = '';
            }}
          >
            {CATEGORY_LABELS[category]}
            <span class="tab-count">{positions[category].length}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="card__body">
      <!-- Add new + Save -->
      <div class="add-row">
        <input
          type="text"
          class="form-field__control"
          placeholder="Neue Position hinzufügen..."
          maxlength="100"
          bind:value={newPosition}
          onkeydown={handleKeydown}
        />
        <button
          type="button"
          class="btn btn-primary"
          disabled={newPosition.trim() === ''}
          onclick={addPosition}
        >
          <i class="fas fa-plus"></i>
          Hinzufügen
        </button>
        <button
          type="button"
          class="btn btn-success"
          disabled={!hasChanges || saving}
          onclick={saveAll}
        >
          {#if saving}
            <span class="spinner-ring spinner-ring--sm"></span>
            Speichern...
          {:else}
            <i class="fas fa-save"></i>
            Speichern
          {/if}
        </button>
      </div>

      <!-- List -->
      {#if currentList.length === 0}
        <div class="empty-state">
          <i class="fas fa-inbox"></i>
          <p>Keine Positionen für {CATEGORY_LABELS[activeTab]} definiert.</p>
        </div>
      {:else}
        <ul class="position-list">
          {#each currentList as position, index (activeTab + '-' + String(index))}
            {@const isSystem = isLeadPosition(position)}
            <li
              class="position-item"
              class:position-item--system={isSystem}
            >
              {#if editingIndex === index && !isSystem}
                <input
                  type="text"
                  class="form-field__control edit-input"
                  maxlength="100"
                  bind:value={editingValue}
                  onkeydown={handleKeydown}
                />
                <div class="item-actions">
                  <button
                    type="button"
                    class="btn-icon btn-icon--success"
                    title="Bestätigen"
                    onclick={confirmEdit}
                  >
                    <i class="fas fa-check"></i>
                  </button>
                  <button
                    type="button"
                    class="btn-icon btn-icon--secondary"
                    title="Abbrechen"
                    onclick={cancelEdit}
                  >
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              {:else}
                <span class="position-name">
                  {#if isSystem}
                    <i class="fas fa-lock system-lock-icon"></i>
                  {/if}
                  {isSystem ?
                    resolvePositionDisplay(position, labels)
                  : position}
                  {#if isSystem}
                    <span class="badge badge--primary badge--xs system-badge"
                      >System</span
                    >
                  {/if}
                </span>
                {#if isSystem}
                  <a
                    href="/settings/organigram?editLabels"
                    class="system-hint-link"
                    title="Bezeichnungen bearbeiten"
                  >
                    <i class="fas fa-pen-to-square"></i>
                    Bezeichnung ändern
                  </a>
                {:else}
                  <div class="item-actions">
                    <button
                      type="button"
                      class="btn-icon"
                      title="Nach oben"
                      disabled={index === 0 ||
                        isLeadPosition(currentList[index - 1] ?? '')}
                      onclick={() => {
                        moveUp(index);
                      }}
                    >
                      <i class="fas fa-chevron-up"></i>
                    </button>
                    <button
                      type="button"
                      class="btn-icon"
                      title="Nach unten"
                      disabled={index === currentList.length - 1}
                      onclick={() => {
                        moveDown(index);
                      }}
                    >
                      <i class="fas fa-chevron-down"></i>
                    </button>
                    <button
                      type="button"
                      class="btn-icon"
                      title="Bearbeiten"
                      onclick={() => {
                        startEdit(index);
                      }}
                    >
                      <i class="fas fa-pen"></i>
                    </button>
                    <button
                      type="button"
                      class="btn-icon btn-icon--danger"
                      title="Löschen"
                      onclick={() => {
                        removePosition(index);
                      }}
                    >
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                {/if}
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  <!-- Unsaved indicator -->
  {#if hasChanges}
    <div class="unsaved-hint">
      <i class="fas fa-exclamation-circle"></i>
      Ungespeicherte Änderungen
    </div>
  {/if}
</div>

<style>
  /* Tabs */
  .tabs {
    display: flex;
    gap: 0.25rem;
    border-bottom: 1px solid var(--color-border, rgb(255 255 255 / 10%));
    padding-bottom: 0;
  }

  .tab {
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 150ms ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .tab:hover {
    color: var(--color-text-primary);
  }

  .tab.active {
    color: var(--color-primary, #3b82f6);
    border-bottom-color: var(--color-primary, #3b82f6);
  }

  .tab-count {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    background: var(--color-surface-secondary, rgb(255 255 255 / 5%));
  }

  .tab.active .tab-count {
    background: color-mix(
      in oklch,
      var(--color-primary, #3b82f6) 20%,
      transparent
    );
    color: var(--color-primary, #3b82f6);
  }

  /* Add Row */
  .add-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .add-row .form-field__control {
    flex: 1;
  }

  /* Position List */
  .position-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .position-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md, 8px);
    background: var(--color-surface-secondary, rgb(255 255 255 / 3%));
    transition: background 150ms ease;
  }

  .position-item:hover {
    background: var(--color-surface-hover, rgb(255 255 255 / 6%));
  }

  .position-item--system {
    background: color-mix(
      in oklch,
      var(--color-primary, #3b82f6) 8%,
      transparent
    );
    border: 1px solid
      color-mix(in oklch, var(--color-primary, #3b82f6) 20%, transparent);
    cursor: default;
  }

  .position-item--system:hover {
    background: color-mix(
      in oklch,
      var(--color-primary, #3b82f6) 12%,
      transparent
    );
  }

  .system-lock-icon {
    font-size: 0.75rem;
    color: var(--color-primary, #3b82f6);
    margin-right: 0.375rem;
    opacity: 70%;
  }

  .system-badge {
    font-size: 0.625rem;
    margin-left: 0.5rem;
    vertical-align: middle;
    padding: 0.0625rem 0.375rem;
  }

  .system-hint-link {
    font-size: 0.75rem;
    color: var(--color-primary, #3b82f6);
    opacity: 70%;
    flex-shrink: 0;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    transition: opacity 150ms ease;
  }

  .system-hint-link:hover {
    opacity: 100%;
  }

  .position-name {
    flex: 1;
    font-size: 0.9rem;
    color: var(--color-text-primary);
  }

  .edit-input {
    flex: 1;
  }

  .item-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  /* Icon Buttons */
  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: var(--radius-sm, 6px);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 150ms ease;
  }

  .btn-icon:hover:not(:disabled) {
    background: var(--color-surface-hover, rgb(255 255 255 / 8%));
    color: var(--color-text-primary);
  }

  .btn-icon:disabled {
    opacity: 25%;
    cursor: not-allowed;
  }

  .btn-icon--danger:hover:not(:disabled) {
    background: color-mix(
      in oklch,
      var(--color-error, #ef4444) 15%,
      transparent
    );
    color: var(--color-error, #ef4444);
  }

  .btn-icon--success:hover:not(:disabled) {
    background: color-mix(
      in oklch,
      var(--color-success, #22c55e) 15%,
      transparent
    );
    color: var(--color-success, #22c55e);
  }

  .btn-icon--secondary:hover:not(:disabled) {
    background: var(--color-surface-hover, rgb(255 255 255 / 8%));
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem;
    color: var(--color-text-secondary);
    opacity: 60%;
  }

  .empty-state i {
    font-size: 2rem;
  }

  /* Unsaved Hint */
  .unsaved-hint {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
    color: var(--color-warning, #f59e0b);
    border-radius: var(--radius-md, 8px);
    background: color-mix(
      in oklch,
      var(--color-warning, #f59e0b) 10%,
      transparent
    );
  }
</style>

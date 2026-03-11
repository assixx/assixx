<!--
  Positionen-Verwaltung — Sub-Seite von Organigramm (Root only)
  Verwaltet Position-Optionen pro Kategorie (Mitarbeiter/Admin/Root)
  die in den jeweiligen Dropdowns der User-Modals angezeigt werden.
-->
<script lang="ts">
  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';
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

  const serverPositions = $derived(data.positions);

  const positions = $derived<PositionOptions>({
    employee: [...serverPositions.employee],
    admin: [...serverPositions.admin],
    root: [...serverPositions.root],
  });

  let activeTab = $state<Category>('employee');
  let newPosition = $state('');
  let editingIndex = $state<number | null>(null);
  let editingValue = $state('');
  let saving = $state(false);

  const currentList = $derived(positions[activeTab]);
  const hasChanges = $derived(
    JSON.stringify(positions) !== JSON.stringify(serverPositions),
  );

  function addPosition(): void {
    const trimmed = newPosition.trim();
    if (trimmed === '') return;

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
    positions[activeTab] = positions[activeTab].filter(
      (_: string, i: number) => i !== index,
    );
  }

  function startEdit(index: number): void {
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
        <div class="flex shrink-0 items-center gap-2">
          <a
            href="/settings/organigram"
            class="btn btn--secondary btn--sm"
          >
            <i class="fas fa-sitemap"></i>
            Organigramm
          </a>
          <button
            type="button"
            class="btn btn-primary"
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
      <!-- Add new -->
      <div class="add-row">
        <input
          type="text"
          class="input"
          placeholder="Neue Position hinzufügen..."
          maxlength="100"
          bind:value={newPosition}
          onkeydown={handleKeydown}
        />
        <button
          type="button"
          class="btn btn--primary btn--sm"
          disabled={newPosition.trim() === ''}
          onclick={addPosition}
        >
          <i class="fas fa-plus"></i>
          Hinzufügen
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
            <li class="position-item">
              {#if editingIndex === index}
                <input
                  type="text"
                  class="input edit-input"
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
                <span class="position-name">{position}</span>
                <div class="item-actions">
                  <button
                    type="button"
                    class="btn-icon"
                    title="Nach oben"
                    disabled={index === 0}
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

  .add-row .input {
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

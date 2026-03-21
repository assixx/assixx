<!--
  Positionen-Verwaltung — Sub-Seite von Organigramm (Root only)
  Verwaltet Position-Katalog-Einträge pro Kategorie (Mitarbeiter/Admin/Root).
  Jede Aktion (Erstellen/Bearbeiten/Löschen) wird sofort per API persistiert (ADR-038).
-->
<script lang="ts">
  import { invalidateAll } from '$app/navigation';

  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';
  import { isLeadPosition, resolvePositionDisplay } from '$lib/types/hierarchy-labels';
  import { getApiClient } from '$lib/utils/api-client';

  import type { PageData } from './$types';

  interface PositionEntry {
    id: string;
    name: string;
    roleCategory: 'employee' | 'admin' | 'root';
    sortOrder: number;
    isSystem: boolean;
  }

  type Category = 'employee' | 'admin' | 'root';

  type Tab = Category | 'leads';

  const CATEGORIES: Category[] = ['employee', 'admin', 'root'];

  const TAB_LABELS: Record<Tab, string> = {
    employee: 'Mitarbeiter',
    admin: 'Administratoren',
    root: 'Root-Benutzer',
    leads: 'Leitende Positionen',
  };

  const { data }: { data: PageData } = $props();

  const apiClient = getApiClient();

  const labels = $derived(data.hierarchyLabels);

  let positions = $derived<PositionEntry[]>([...(data.positions as PositionEntry[])]);

  let activeTab = $state<Tab>('employee');
  let newPosition = $state('');
  let editingId = $state<string | null>(null);
  let editingValue = $state('');
  let busy = $state(false);

  const LEAD_ORDER = ['area_lead', 'department_lead', 'team_lead', 'deputy_lead'];

  const systemPositions = $derived(
    positions
      .filter((p: PositionEntry) => p.isSystem)
      .sort(
        (a: PositionEntry, b: PositionEntry) =>
          LEAD_ORDER.indexOf(a.name) - LEAD_ORDER.indexOf(b.name),
      ),
  );

  const currentList = $derived(
    positions.filter((p: PositionEntry) => p.roleCategory === activeTab && !p.isSystem),
  );

  function countByCategory(cat: Category): number {
    return positions.filter((p: PositionEntry) => p.roleCategory === cat && !p.isSystem).length;
  }

  function displayName(p: PositionEntry): string {
    if (p.isSystem && isLeadPosition(p.name)) {
      return resolvePositionDisplay(p.name, labels);
    }
    return p.name;
  }

  async function addPosition(): Promise<void> {
    const trimmed = newPosition.trim();
    if (trimmed === '' || busy) return;

    busy = true;
    try {
      const created = await apiClient.request<PositionEntry>('/organigram/positions', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmed,
          roleCategory: activeTab,
          sortOrder: currentList.length,
        }),
      });
      positions = [...positions, created];
      newPosition = ''; // eslint-disable-line require-atomic-updates -- Svelte single-threaded
      showSuccessAlert(`Position "${trimmed}" erstellt`);
    } catch {
      showErrorAlert('Fehler beim Erstellen der Position');
    } finally {
      busy = false; // eslint-disable-line require-atomic-updates -- Svelte single-threaded
    }
  }

  async function deletePosition(p: PositionEntry): Promise<void> {
    if (p.isSystem || busy) return;

    busy = true;
    try {
      await apiClient.request(`/organigram/positions/${p.id}`, {
        method: 'DELETE',
      });
      positions = positions.filter((x: PositionEntry) => x.id !== p.id);
      showSuccessAlert(`Position "${p.name}" gelöscht`);
    } catch {
      showErrorAlert('Fehler beim Löschen');
    } finally {
      busy = false; // eslint-disable-line require-atomic-updates -- Svelte single-threaded
    }
  }

  function startEdit(p: PositionEntry): void {
    if (p.isSystem) return;
    editingId = p.id;
    editingValue = p.name;
  }

  function cancelEdit(): void {
    editingId = null;
    editingValue = '';
  }

  async function confirmEdit(): Promise<void> {
    if (editingId === null || busy) return;

    const trimmed = editingValue.trim();
    if (trimmed === '') {
      cancelEdit();
      return;
    }

    busy = true;
    try {
      const updated = await apiClient.request<PositionEntry>(`/organigram/positions/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: trimmed }),
      });
      positions = positions.map((p: PositionEntry) => (p.id === editingId ? updated : p));
      cancelEdit();
      showSuccessAlert('Position umbenannt');
    } catch {
      showErrorAlert('Fehler beim Umbenennen');
    } finally {
      busy = false; // eslint-disable-line require-atomic-updates -- Svelte single-threaded
    }
  }

  async function movePosition(p: PositionEntry, direction: 'up' | 'down'): Promise<void> {
    if (p.isSystem || busy) return;

    const list = currentList;
    const idx = list.findIndex((x: PositionEntry) => x.id === p.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;

    if (swapIdx < 0 || swapIdx >= list.length) return;
    const neighbor = list[swapIdx];
    if (neighbor.isSystem) return;

    busy = true;
    try {
      await apiClient.request<PositionEntry>(`/organigram/positions/${p.id}`, {
        method: 'PUT',
        body: JSON.stringify({ sortOrder: neighbor.sortOrder }),
      });
      await apiClient.request<PositionEntry>(`/organigram/positions/${neighbor.id}`, {
        method: 'PUT',
        body: JSON.stringify({ sortOrder: p.sortOrder }),
      });
      await invalidateAll();
    } catch {
      showErrorAlert('Fehler beim Verschieben');
    } finally {
      busy = false; // eslint-disable-line require-atomic-updates -- Svelte single-threaded
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      if (editingId !== null) {
        void confirmEdit();
      } else {
        void addPosition();
      }
    }
    if (event.key === 'Escape' && editingId !== null) {
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
            Definiere die verfügbaren Positionen pro Benutzerrolle. Diese erscheinen in den
            Dropdown-Menüs beim Erstellen und Bearbeiten von Benutzern.
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
            {TAB_LABELS[category]}
            <span class="tab-count">{countByCategory(category)}</span>
          </button>
        {/each}
        <button
          type="button"
          class="tab"
          class:active={activeTab === 'leads'}
          onclick={() => {
            activeTab = 'leads';
            cancelEdit();
            newPosition = '';
          }}
        >
          <i class="fas fa-shield-halved mr-1"></i>
          {TAB_LABELS.leads}
          <span class="tab-count">{systemPositions.length}</span>
        </button>
      </div>
    </div>

    <div class="card__body">
      {#if activeTab === 'leads'}
        <!-- Leitende Positionen (System) -->
        <ul class="position-list">
          {#each systemPositions as position (position.id)}
            <li class="position-item position-item--system">
              <span class="position-name">
                <i class="fas fa-lock system-lock-icon"></i>
                {displayName(position)}
                <span class="badge badge--primary badge--xs system-badge">System</span>
              </span>
              <a
                href="/settings/organigram?editLabels"
                class="system-hint-link"
                title="Bezeichnungen bearbeiten"
              >
                <i class="fas fa-pen-to-square"></i>
                Bezeichnung ändern
              </a>
            </li>
          {/each}
        </ul>
        <div class="alert alert--warning alert--sm mt-4">
          <div class="alert__icon"><i class="fas fa-info-circle"></i></div>
          <div class="alert__content">
            <div class="alert__message">
              Leitende Positionen werden automatisch vergeben und können nicht bearbeitet werden.
              Die Bezeichnungen können über die
              <a href="/settings/organigram?editLabels">Hierarchie-Labels</a> angepasst werden.
            </div>
          </div>
        </div>
      {:else}
        <!-- Add new -->
        <div class="add-row">
          <input
            type="text"
            class="form-field__control"
            placeholder="Neue Position hinzufügen..."
            maxlength="100"
            bind:value={newPosition}
            onkeydown={handleKeydown}
            disabled={busy}
          />
          <button
            type="button"
            class="btn btn-primary"
            disabled={newPosition.trim() === '' || busy}
            onclick={() => {
              void addPosition();
            }}
          >
            {#if busy}
              <span class="spinner-ring spinner-ring--sm"></span>
            {:else}
              <i class="fas fa-plus"></i>
            {/if}
            Hinzufügen
          </button>
        </div>

        <!-- List -->
        {#if currentList.length === 0}
          <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>Keine Positionen für {TAB_LABELS[activeTab]} definiert.</p>
          </div>
        {:else}
          <ul class="position-list">
            {#each currentList as position, index (position.id)}
              <li class="position-item">
                {#if editingId === position.id}
                  <input
                    type="text"
                    class="form-field__control edit-input"
                    maxlength="100"
                    bind:value={editingValue}
                    onkeydown={handleKeydown}
                    disabled={busy}
                  />
                  <div class="item-actions">
                    <button
                      type="button"
                      class="btn-icon btn-icon--success"
                      title="Bestätigen"
                      disabled={busy}
                      onclick={() => {
                        void confirmEdit();
                      }}
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
                    {displayName(position)}
                  </span>
                  <div class="item-actions">
                    <button
                      type="button"
                      class="btn-icon"
                      title="Nach oben"
                      disabled={index === 0 || busy}
                      onclick={() => {
                        void movePosition(position, 'up');
                      }}
                    >
                      <i class="fas fa-chevron-up"></i>
                    </button>
                    <button
                      type="button"
                      class="btn-icon"
                      title="Nach unten"
                      disabled={index === currentList.length - 1 || busy}
                      onclick={() => {
                        void movePosition(position, 'down');
                      }}
                    >
                      <i class="fas fa-chevron-down"></i>
                    </button>
                    <button
                      type="button"
                      class="btn-icon"
                      title="Bearbeiten"
                      disabled={busy}
                      onclick={() => {
                        startEdit(position);
                      }}
                    >
                      <i class="fas fa-pen"></i>
                    </button>
                    <button
                      type="button"
                      class="btn-icon btn-icon--danger"
                      title="Löschen"
                      disabled={busy}
                      onclick={() => {
                        void deletePosition(position);
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
      {/if}
    </div>
  </div>
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
    background: color-mix(in oklch, var(--color-primary, #3b82f6) 20%, transparent);
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
    background: color-mix(in oklch, var(--color-primary, #3b82f6) 8%, transparent);
    border: 1px solid color-mix(in oklch, var(--color-primary, #3b82f6) 20%, transparent);
    cursor: default;
  }

  .position-item--system:hover {
    background: color-mix(in oklch, var(--color-primary, #3b82f6) 12%, transparent);
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
    background: color-mix(in oklch, var(--color-error, #ef4444) 15%, transparent);
    color: var(--color-error, #ef4444);
  }

  .btn-icon--success:hover:not(:disabled) {
    background: color-mix(in oklch, var(--color-success, #22c55e) 15%, transparent);
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
</style>

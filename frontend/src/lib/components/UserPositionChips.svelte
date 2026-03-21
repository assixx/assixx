<!--
  UserPositionChips — Shared component for managing user_positions N:M assignments.
  Shows assigned positions as removable chips + add dropdown from position_catalog.
  Only renders in edit mode (when userId is provided).
-->
<script lang="ts">
  import { showErrorAlert, showSuccessAlert } from '$lib/stores/toast';
  import { getApiClient } from '$lib/utils/api-client';

  interface PositionEntry {
    id: string;
    name: string;
    roleCategory: 'employee' | 'admin' | 'root';
    sortOrder: number;
    isSystem: boolean;
  }

  interface UserPosition {
    id: string;
    userId: number;
    positionId: string;
    positionName: string;
    roleCategory: 'employee' | 'admin' | 'root';
  }

  interface Props {
    userId: number;
    roleFilter?: 'employee' | 'admin' | 'root';
  }

  const { userId, roleFilter }: Props = $props();

  const apiClient = getApiClient();

  let assigned = $state<UserPosition[]>([]);
  let catalog = $state<PositionEntry[]>([]);
  let dropdownOpen = $state(false);
  let busy = $state(false);
  let loaded = $state(false);

  const available = $derived(
    catalog.filter(
      (p: PositionEntry) => !assigned.some((a: UserPosition) => a.positionId === p.id),
    ),
  );

  $effect(() => {
    if (userId > 0 && !loaded) {
      void loadData();
    }
  });

  async function loadData(): Promise<void> {
    try {
      const [userPos, allPos] = await Promise.all([
        apiClient.request<UserPosition[]>(`/users/${String(userId)}/positions`),
        apiClient.request<PositionEntry[]>(
          roleFilter !== undefined ?
            `/organigram/positions?roleCategory=${roleFilter}`
          : '/organigram/positions',
        ),
      ]);
      assigned = userPos;
      catalog = allPos;
      loaded = true;
    } catch {
      showErrorAlert('Positionen konnten nicht geladen werden');
    }
  }

  async function assign(positionId: string): Promise<void> {
    if (busy) return;
    busy = true;
    dropdownOpen = false;
    try {
      await apiClient.request(`/users/${String(userId)}/positions`, {
        method: 'POST',
        body: JSON.stringify({ positionId }),
      });
      await loadData();
      showSuccessAlert('Position zugewiesen');
    } catch {
      showErrorAlert('Fehler beim Zuweisen');
    } finally {
      busy = false; // eslint-disable-line require-atomic-updates -- Svelte single-threaded
    }
  }

  async function unassign(positionId: string): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      await apiClient.request(`/users/${String(userId)}/positions/${positionId}`, {
        method: 'DELETE',
      });
      assigned = assigned.filter((a: UserPosition) => a.positionId !== positionId);
      showSuccessAlert('Position entfernt');
    } catch {
      showErrorAlert('Fehler beim Entfernen');
    } finally {
      busy = false; // eslint-disable-line require-atomic-updates -- Svelte single-threaded
    }
  }
</script>

{#if loaded}
  <div class="pos-chips">
    <span class="pos-chips__label">
      <i class="fas fa-id-badge mr-1"></i>
      Katalog-Positionen
    </span>

    <div class="pos-chips__list">
      {#each assigned as ap (ap.id)}
        <span class="pos-chip">
          {ap.positionName}
          <button
            type="button"
            class="pos-chip__remove"
            aria-label="Entfernen"
            disabled={busy}
            onclick={() => {
              void unassign(ap.positionId);
            }}
          >
            <i class="fas fa-times"></i>
          </button>
        </span>
      {/each}

      {#if available.length > 0}
        <div class="pos-add-dropdown">
          <button
            type="button"
            class="pos-add-btn"
            aria-label="Position hinzufügen"
            disabled={busy}
            onclick={(e) => {
              e.stopPropagation();
              dropdownOpen = !dropdownOpen;
            }}
          >
            <i class="fas fa-plus"></i>
          </button>
          {#if dropdownOpen}
            <div class="pos-add-menu">
              {#each available as pos (pos.id)}
                <button
                  type="button"
                  class="pos-add-option"
                  onclick={() => {
                    void assign(pos.id);
                  }}
                >
                  {pos.name}
                  {#if pos.isSystem}
                    <span class="badge badge--primary badge--xs ml-1">System</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    {#if assigned.length === 0}
      <span class="pos-chips__empty">Keine Positionen zugewiesen</span>
    {/if}
  </div>
{/if}

<style>
  .pos-chips {
    margin-top: 0.75rem;
  }

  .pos-chips__label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin-bottom: 0.375rem;
  }

  .pos-chips__list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    align-items: center;
  }

  .pos-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.625rem;
    border-radius: var(--radius-xl, 9999px);
    background: color-mix(in oklch, var(--color-primary, #3b82f6) 15%, transparent);
    color: var(--color-primary, #3b82f6);
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .pos-chip__remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: none;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    color: inherit;
    opacity: 60%;
    font-size: 0.625rem;
    transition: opacity 0.15s;
  }

  .pos-chip__remove:hover:not(:disabled) {
    opacity: 100%;
  }

  .pos-chip__remove:disabled {
    cursor: not-allowed;
  }

  .pos-add-dropdown {
    position: relative;
  }

  .pos-add-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px dashed var(--color-border, rgb(255 255 255 / 15%));
    border-radius: var(--radius-sm, 6px);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 0.15s;
  }

  .pos-add-btn:hover:not(:disabled) {
    border-color: var(--color-primary, #3b82f6);
    color: var(--color-primary, #3b82f6);
  }

  .pos-add-menu {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 50;
    min-width: 200px;
    max-height: 200px;
    overflow-y: auto;
    margin-top: 0.25rem;
    padding: 0.25rem;
    border-radius: var(--radius-md, 8px);
    background: var(--color-surface, #1e293b);
    border: 1px solid var(--color-border, rgb(255 255 255 / 10%));
    box-shadow: 0 4px 12px rgb(0 0 0 / 30%);
  }

  .pos-add-option {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    width: 100%;
    padding: 0.5rem 0.625rem;
    border: none;
    border-radius: var(--radius-sm, 6px);
    background: transparent;
    color: var(--color-text-primary);
    font-size: 0.8125rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }

  .pos-add-option:hover {
    background: var(--color-surface-hover, rgb(255 255 255 / 6%));
  }

  .pos-chips__empty {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-style: italic;
  }
</style>

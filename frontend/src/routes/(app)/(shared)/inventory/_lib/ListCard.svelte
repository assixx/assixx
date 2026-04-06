<script lang="ts">
  /**
   * ListCard — Card component for inventory list overview
   *
   * Shows list title, category, code prefix, item count,
   * and status breakdown badges.
   */
  import { DEFAULT_LIST_ICON, MESSAGES } from './constants';
  import StatusBadge from './StatusBadge.svelte';
  import { getCodePreview, getNonZeroStatusCounts } from './utils';

  import type { InventoryList } from './types';

  interface Props {
    list: InventoryList;
    canEdit: boolean;
    canDelete: boolean;
    onedit: (id: string) => void;
    ondelete: (id: string) => void;
    onopen: (id: string) => void;
  }

  const { list, canEdit, canDelete, onedit, ondelete, onopen }: Props = $props();

  const statusCounts = $derived(getNonZeroStatusCounts(list));
  const codePreview = $derived(
    getCodePreview(list.codePrefix, list.codeSeparator, list.codeDigits),
  );
  const itemLabel = $derived(
    list.totalItems === 1 ? MESSAGES.ITEMS_SINGULAR : MESSAGES.ITEMS_PLURAL,
  );
</script>

<div
  class="card card--clickable inventory-list-card"
  role="article"
>
  <!-- Card Header — clickable to open list -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="card__header inventory-list-card__header"
    onclick={() => {
      onopen(list.id);
    }}
  >
    <div class="flex items-center gap-3">
      <i class="fas {list.icon ?? DEFAULT_LIST_ICON} text-2xl text-(--color-primary)"></i>
      <div>
        <h3 class="card__title m-0 text-lg">{list.title}</h3>
        {#if list.category}
          <span class="text-sm text-(--color-text-secondary)">{list.category}</span>
        {/if}
      </div>
    </div>
    <code class="inventory-list-card__code-preview">{codePreview}</code>
  </div>

  <!-- Card Body -->
  <div class="card__body inventory-list-card__body">
    {#if list.description}
      <p class="mb-3 line-clamp-2 text-sm text-(--color-text-secondary)">{list.description}</p>
    {/if}

    <!-- Item Count -->
    <div class="mb-3 flex items-center gap-2">
      <span class="text-lg font-semibold">{list.totalItems}</span>
      <span class="text-(--color-text-secondary)">{itemLabel}</span>
    </div>

    <!-- Status Breakdown -->
    {#if statusCounts.length > 0}
      <div class="flex flex-wrap gap-1">
        {#each statusCounts as entry (entry.status)}
          <StatusBadge
            status={entry.status}
            count={entry.count}
          />
        {/each}
      </div>
    {:else}
      <p class="text-sm text-(--color-text-secondary) italic">Keine Gegenstände</p>
    {/if}
  </div>

  <!-- Card Footer — Actions -->
  <div class="card__footer inventory-list-card__footer">
    <button
      type="button"
      class="btn btn-primary btn-sm"
      onclick={() => {
        onopen(list.id);
      }}
    >
      <i class="fas fa-list mr-1"></i>
      Öffnen
    </button>
    <div class="flex gap-2">
      {#if canEdit}
        <button
          type="button"
          class="action-icon action-icon--edit"
          title="Bearbeiten"
          aria-label="Liste bearbeiten"
          onclick={() => {
            onedit(list.id);
          }}
        >
          <i class="fas fa-edit"></i>
        </button>
      {/if}
      {#if canDelete}
        <button
          type="button"
          class="action-icon action-icon--delete"
          title="Löschen"
          aria-label="Liste löschen"
          onclick={() => {
            ondelete(list.id);
          }}
        >
          <i class="fas fa-trash"></i>
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .inventory-list-card {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .inventory-list-card__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    cursor: pointer;
  }

  .inventory-list-card__header:hover {
    opacity: 85%;
  }

  .inventory-list-card__code-preview {
    font-size: 0.75rem;
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
    background: var(--color-glass-bg, rgb(255 255 255 / 5%));
    white-space: nowrap;
  }

  .inventory-list-card__body {
    flex: 1;
  }

  .inventory-list-card__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border, rgb(255 255 255 / 10%));
  }
</style>

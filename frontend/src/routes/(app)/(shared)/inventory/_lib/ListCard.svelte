<script lang="ts">
  /**
   * ListCard — Card component for inventory list overview
   *
   * Shows list title, attached tags (chips), code prefix, item count,
   * and status breakdown badges.
   */
  import { DEFAULT_LIST_ICON, DEFAULT_TAG_ICON, MESSAGES } from './constants';
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
  role="button"
  tabindex="0"
  onclick={() => {
    onopen(list.id);
  }}
  onkeydown={(e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onopen(list.id);
    }
  }}
>
  <div class="card__header inventory-list-card__header">
    <div class="flex items-center gap-3">
      <i class="fas {list.icon ?? DEFAULT_LIST_ICON} text-2xl text-(--color-primary)"></i>
      <div>
        <h3 class="inventory-list-card__title">{list.title}</h3>
      </div>
    </div>
    <code class="inventory-list-card__code-preview">{codePreview}</code>
  </div>

  <!-- Card Body -->
  <div class="card__body inventory-list-card__body">
    {#if list.tags.length > 0}
      <div class="inventory-list-card__tags">
        {#each list.tags as tag (tag.id)}
          <span class="inventory-list-card__tag-chip">
            <i class="fas {tag.icon ?? DEFAULT_TAG_ICON}"></i>
            <span>{tag.name}</span>
          </span>
        {/each}
      </div>
    {/if}

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

  <!-- Card Footer — Actions (stopPropagation prevents card-level onclick) -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="card__footer inventory-list-card__footer"
    onclick={(e: MouseEvent) => {
      e.stopPropagation();
    }}
  >
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
    cursor: pointer;
  }

  .inventory-list-card__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .inventory-list-card__title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    line-height: 1.4;
  }

  .inventory-list-card__code-preview {
    font-size: 0.875rem;
    padding: 0.25rem 0.625rem;
    border-radius: 0.375rem;
    background: var(--color-glass-bg, rgb(255 255 255 / 5%));
    white-space: nowrap;
  }

  .inventory-list-card__body {
    flex: 1;
  }

  .inventory-list-card__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border, rgb(255 255 255 / 10%));
  }

  .inventory-list-card__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .inventory-list-card__tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    background: rgb(33 150 243 / 12%);
    border: 1px solid rgb(33 150 243 / 30%);
    border-radius: 0.375rem;
    color: var(--color-primary, #2196f3);
    font-size: 0.6875rem;
    line-height: 1.4;
  }
</style>

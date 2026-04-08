<script lang="ts">
  /**
   * TagFilterDropdown — Multi-select tag filter for the inventory overview.
   *
   * Reads tags from tagsState (cached at SSR load), exposes a checkbox-style
   * dropdown, and emits the selected ID array via onchange. OR semantics
   * (a list matches if it has at least one selected tag) — handled in
   * filters.ts:filterByTags.
   */
  import { onClickOutsideDropdown } from '$lib/actions/click-outside';

  import { DEFAULT_TAG_ICON, MESSAGES } from './constants';
  import { tagsState } from './state.svelte';

  interface Props {
    selectedIds: string[];
    onchange: (ids: string[]) => void;
  }

  const { selectedIds, onchange }: Props = $props();

  let isOpen = $state(false);

  const allTags = $derived(tagsState.tags);
  const selectedCount = $derived(selectedIds.length);

  const buttonLabel = $derived.by((): string => {
    if (selectedCount === 0) return MESSAGES.TAGS_FILTER_ALL;
    if (selectedCount === 1) {
      const tag = tagsState.findById(selectedIds[0] ?? '');
      return tag?.name ?? `${String(selectedCount)} Tags`;
    }
    return `${String(selectedCount)} Tags`;
  });

  function toggleTag(id: string): void {
    if (selectedIds.includes(id)) {
      onchange(selectedIds.filter((existing: string): boolean => existing !== id));
    } else {
      onchange([...selectedIds, id]);
    }
  }

  function clearSelection(): void {
    onchange([]);
  }

  $effect(() =>
    onClickOutsideDropdown(() => {
      isOpen = false;
    }),
  );
</script>

<div class="tag-filter dropdown">
  <button
    type="button"
    class="dropdown__trigger tag-filter__trigger"
    class:active={isOpen}
    onclick={() => {
      isOpen = !isOpen;
    }}
  >
    <i class="fas fa-tags"></i>
    <span>{buttonLabel}</span>
    {#if selectedCount > 0}
      <span class="tag-filter__badge">{selectedCount}</span>
    {/if}
    <i class="fas fa-chevron-down"></i>
  </button>

  {#if isOpen}
    <div class="dropdown__menu active tag-filter__menu">
      {#if allTags.length === 0}
        <div class="tag-filter__empty">{MESSAGES.TAGS_NO_TAGS}</div>
      {:else}
        {#if selectedCount > 0}
          <button
            type="button"
            class="dropdown__option tag-filter__clear"
            onclick={clearSelection}
          >
            <i class="fas fa-times"></i>
            <span>{MESSAGES.TAGS_FILTER_NONE}</span>
          </button>
        {/if}
        {#each allTags as tag (tag.id)}
          {@const checked = selectedIds.includes(tag.id)}
          <button
            type="button"
            class="dropdown__option tag-filter__row"
            class:dropdown__option--selected={checked}
            onclick={() => {
              toggleTag(tag.id);
            }}
          >
            <span
              class="tag-filter__check"
              class:tag-filter__check--checked={checked}
            >
              {#if checked}
                <i class="fas fa-check"></i>
              {/if}
            </span>
            <i class="fas {tag.icon ?? DEFAULT_TAG_ICON}"></i>
            <span class="tag-filter__name">{tag.name}</span>
            {#if tag.usageCount > 0}
              <span class="tag-filter__count">{tag.usageCount}</span>
            {/if}
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .tag-filter {
    position: relative;
  }

  .tag-filter__trigger {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .tag-filter__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 0.375rem;
    border-radius: 999px;
    background: var(--color-primary, #2196f3);
    color: #fff;
    font-size: 0.6875rem;
    font-weight: 600;
  }

  .tag-filter__menu {
    min-width: 16rem;
    max-height: 320px;
    overflow-y: auto;
  }

  .tag-filter__empty {
    padding: 1rem;
    text-align: center;
    color: var(--color-text-secondary, #aaa);
    font-size: 0.875rem;
  }

  .tag-filter__row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .tag-filter__check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    border: 1px solid var(--color-border, rgb(255 255 255 / 25%));
    border-radius: 0.25rem;
    font-size: 0.625rem;
  }

  .tag-filter__check--checked {
    background: var(--color-primary, #2196f3);
    border-color: var(--color-primary, #2196f3);
    color: #fff;
  }

  .tag-filter__name {
    flex: 1;
    text-align: left;
  }

  .tag-filter__count {
    font-size: 0.75rem;
    color: var(--color-text-secondary, #aaa);
  }

  .tag-filter__clear {
    color: var(--color-warning, #ff9800);
    border-bottom: 1px solid var(--color-border, rgb(255 255 255 / 10%));
  }
</style>

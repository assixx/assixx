<script lang="ts">
  /**
   * TagInput — Chip-style tag picker with typeahead and inline create.
   *
   * - Selected tags shown as chips with X-button to remove
   * - Input field filters the cached tag catalog (tagsState)
   * - Click on dropdown row → adds existing tag
   * - Enter on no-match input → creates a new tag (default icon) and selects it
   * - Hard cap on selected tag count (MAX_TAGS_PER_LIST)
   *
   * Used inside ListModal. Reads from / writes to tagsState so other parts
   * of the page (filter dropdown, management modal) see new tags immediately.
   */
  import { showErrorAlert } from '$lib/stores/toast';
  import { createLogger } from '$lib/utils/logger';

  import { createTag, loadTags } from './api';
  import { DEFAULT_TAG_ICON, MAX_TAGS_PER_LIST, MESSAGES } from './constants';
  import { tagsState } from './state.svelte';

  import type { InventoryTagWithUsage } from './types';

  interface Props {
    /** Currently selected tag IDs (controlled prop) */
    selectedIds: string[];
    /** Callback fired whenever the selection changes */
    onchange: (ids: string[]) => void;
  }

  const { selectedIds, onchange }: Props = $props();

  const log = createLogger('TagInput');

  let inputValue = $state('');
  let isOpen = $state(false);
  let inputEl = $state<HTMLInputElement | null>(null);
  let creating = $state(false);
  // Non-reactive re-entry guard so we can set the reactive `creating` flag
  // around the async work without tripping the require-atomic-updates lint.
  let creatingPending = false;

  // Selected tag objects (looked up from cache)
  const selectedTags = $derived(
    selectedIds
      .map((id: string) => tagsState.findById(id))
      .filter((t): t is InventoryTagWithUsage => t !== undefined),
  );

  // Available tags = all minus already selected, filtered by input
  const availableTags = $derived(
    tagsState.tags.filter(
      (t: InventoryTagWithUsage) =>
        !selectedIds.includes(t.id) &&
        (inputValue.trim() === '' ||
          t.name.toLowerCase().includes(inputValue.trim().toLowerCase())),
    ),
  );

  // Show "create new" option when input has text and no exact match exists
  const showCreateOption = $derived(
    inputValue.trim().length > 0 &&
      !tagsState.tags.some(
        (t: InventoryTagWithUsage) => t.name.toLowerCase() === inputValue.trim().toLowerCase(),
      ),
  );

  const isMaxReached = $derived(selectedIds.length >= MAX_TAGS_PER_LIST);

  function addTag(id: string): void {
    if (selectedIds.includes(id) || isMaxReached) return;
    onchange([...selectedIds, id]);
    inputValue = '';
    inputEl?.focus();
  }

  function removeTag(id: string): void {
    onchange(selectedIds.filter((existing: string): boolean => existing !== id));
  }

  /* eslint-disable require-atomic-updates -- Single-threaded JS runtime
     + early return on `creatingPending` is a strict re-entry guard. No
     concurrent caller path can observe a stale flag between the await
     and the reset. */
  async function handleCreateTag(): Promise<void> {
    const name = inputValue.trim();
    if (name === '' || creatingPending || isMaxReached) return;
    creatingPending = true;
    creating = true;
    try {
      const created = await createTag({ name, icon: DEFAULT_TAG_ICON });
      // Refresh cache so the new tag is available everywhere (filter, modal)
      const fresh = await loadTags();
      tagsState.set(fresh);
      addTag(created.id);
    } catch (err: unknown) {
      log.error({ err }, 'Error creating tag');
      const message = err instanceof Error ? err.message : MESSAGES.TAG_ERROR_SAVING;
      showErrorAlert(message);
    }
    creating = false;
    creatingPending = false;
  }
  /* eslint-enable require-atomic-updates */

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Prefer existing match if present
      const exactMatch = tagsState.tags.find(
        (t: InventoryTagWithUsage) => t.name.toLowerCase() === inputValue.trim().toLowerCase(),
      );
      if (exactMatch !== undefined) {
        addTag(exactMatch.id);
        return;
      }
      if (showCreateOption) {
        void handleCreateTag();
      }
    } else if (e.key === 'Backspace' && inputValue === '' && selectedIds.length > 0) {
      // Quick-remove last chip on backspace from empty input
      removeTag(selectedIds[selectedIds.length - 1]);
    } else if (e.key === 'Escape') {
      isOpen = false;
    }
  }

  function handleBlur(): void {
    // Delay so dropdown clicks register before closing
    setTimeout(() => {
      isOpen = false;
    }, 150);
  }
</script>

<div class="tag-input">
  <div
    class="tag-input__chips"
    class:tag-input__chips--max={isMaxReached}
  >
    {#each selectedTags as tag (tag.id)}
      <span class="tag-chip">
        <i class="fas {tag.icon ?? DEFAULT_TAG_ICON}"></i>
        <span class="tag-chip__name">{tag.name}</span>
        <button
          type="button"
          class="tag-chip__remove"
          aria-label="Tag entfernen"
          onclick={() => {
            removeTag(tag.id);
          }}
        >
          <i class="fas fa-times"></i>
        </button>
      </span>
    {/each}

    {#if !isMaxReached}
      <input
        bind:this={inputEl}
        bind:value={inputValue}
        type="text"
        class="tag-input__field"
        placeholder={selectedTags.length === 0 ? MESSAGES.TAGS_PLACEHOLDER : ''}
        onfocus={() => {
          isOpen = true;
        }}
        onblur={handleBlur}
        onkeydown={handleKeydown}
        autocomplete="off"
      />
    {/if}
  </div>

  {#if isMaxReached}
    <p class="tag-input__hint tag-input__hint--warn">{MESSAGES.TAGS_MAX_REACHED}</p>
  {/if}

  {#if isOpen && (availableTags.length > 0 || showCreateOption)}
    <div class="tag-input__dropdown">
      {#each availableTags as tag (tag.id)}
        <button
          type="button"
          class="tag-input__option"
          onmousedown={() => {
            addTag(tag.id);
          }}
        >
          <i class="fas {tag.icon ?? DEFAULT_TAG_ICON}"></i>
          <span>{tag.name}</span>
          {#if tag.usageCount > 0}
            <span class="tag-input__option-count">{tag.usageCount}</span>
          {/if}
        </button>
      {/each}
      {#if showCreateOption}
        <button
          type="button"
          class="tag-input__option tag-input__option--create"
          disabled={creating}
          onmousedown={() => void handleCreateTag()}
        >
          <i class="fas fa-plus"></i>
          <span>"{inputValue.trim()}" erstellen</span>
          <span class="tag-input__option-count">{MESSAGES.TAGS_CREATE_HINT}</span>
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .tag-input {
    position: relative;
  }

  /* Match form-field__control visual contract — same border, radius,
     background, padding tokens, so the chip container looks identical to
     every other input on the page. */
  .tag-input__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    align-items: center;
    width: 100%;
    backdrop-filter: var(--glass-form-backdrop);
    transition: var(--form-field-transition), var(--form-field-transition-shadow);
    border: var(--form-field-border);
    border-radius: var(--form-field-radius);
    background: var(--form-field-bg);
    padding: calc(var(--form-field-padding-y) - 2px) var(--form-field-padding-x);
    min-height: 44px;
    color: var(--form-field-text);
    font-size: var(--form-field-font-size);
    line-height: 1.5;
  }

  .tag-input__chips:hover {
    border: var(--form-field-border-hover);
    background: var(--form-field-bg-hover);
  }

  .tag-input__chips:focus-within {
    border-color: var(--color-primary);
  }

  .tag-input__chips--max {
    border-color: var(--color-warning);
  }

  .tag-input__field {
    flex: 1;
    min-width: 8rem;
    padding: 0.25rem 0.375rem;
    border: none;
    background: transparent;
    color: var(--color-text-primary);
    font-size: 0.875rem;
    outline: none;
  }

  .tag-input__field::placeholder {
    color: var(--color-text-placeholder);
  }

  .tag-input__hint {
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }

  .tag-input__hint--warn {
    color: var(--color-warning);
  }

  /* Dropdown — mirrors design-system `.dropdown__menu` tokens so light/dark
     both work automatically. Background uses --color-white with a dark-mode
     override (same pattern as custom-dropdown.css). */
  .tag-input__dropdown {
    position: absolute;
    top: calc(100% + 5px);
    left: 0;
    right: 0;
    z-index: var(--z-dropdown);
    max-height: 240px;
    overflow-y: auto;
    border: var(--glass-border);
    border-radius: var(--radius-xl);
    background: var(--color-white);
    box-shadow: var(--shadow-md);
  }

  :global(html.dark) .tag-input__dropdown {
    background: oklch(16.842% 0 271.152);
  }

  .tag-input__option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: none;
    background: transparent;
    color: var(--color-text-primary);
    cursor: pointer;
    font-size: 0.875rem;
    text-align: left;
    transition: all 0.15s ease;
  }

  .tag-input__option:hover {
    padding-left: 1rem;
    background: color-mix(in oklch, var(--color-primary) 20%, transparent);
    color: var(--color-text-primary);
  }

  .tag-input__option--create {
    border-top: 1px solid var(--color-glass-border);
    color: var(--color-primary);
  }

  .tag-input__option--create:hover {
    color: var(--color-text-primary);
  }

  .tag-input__option-count {
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid color-mix(in oklch, var(--color-primary) 35%, transparent);
    border-radius: 0.375rem;
    background: color-mix(in oklch, var(--color-primary) 15%, transparent);
    color: var(--color-primary);
    font-size: 0.8125rem;
  }

  .tag-chip__name {
    line-height: 1;
  }

  .tag-chip__remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 0.625rem;
  }

  .tag-chip__remove:hover {
    background: color-mix(in oklch, var(--color-primary) 25%, transparent);
  }
</style>

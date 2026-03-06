<script lang="ts">
  /**
   * BoardFilter — Filter bar for the Kamishibai board.
   * Two filter dimensions:
   *   1. Role: Alle / Bediener / Instandhaltung / Nur Offene
   *   2. Category: Alle / Reinigung / Wartung / Inspektion
   * Uses $bindable for two-way filter state binding.
   */
  import type { CardCategory } from '../../../_lib/types';

  export type FilterType = 'all' | 'operator' | 'maintenance' | 'open_only';
  export type CategoryFilterType = 'all' | CardCategory;

  interface FilterOption<T extends string> {
    value: T;
    label: string;
    icon: string;
  }

  interface Props {
    filter?: FilterType;
    categoryFilter?: CategoryFilterType;
  }

  let {
    filter = $bindable<FilterType>('all'),
    categoryFilter = $bindable<CategoryFilterType>('all'),
  }: Props = $props();

  const ROLE_OPTIONS: FilterOption<FilterType>[] = [
    { value: 'all', label: 'Alle Rollen', icon: 'fa-th' },
    { value: 'operator', label: 'Bediener', icon: 'fa-user' },
    { value: 'maintenance', label: 'Instandhaltung', icon: 'fa-wrench' },
    { value: 'open_only', label: 'Nur Offene', icon: 'fa-exclamation-circle' },
  ];

  const CATEGORY_OPTIONS: FilterOption<CategoryFilterType>[] = [
    { value: 'all', label: 'Alle Kategorien', icon: 'fa-th' },
    { value: 'reinigung', label: 'Reinigung', icon: 'fa-broom' },
    { value: 'inspektion', label: 'Inspektion', icon: 'fa-search' },
    { value: 'wartung', label: 'Wartung', icon: 'fa-tools' },
  ];
</script>

<div class="board-filter">
  <div class="filter-group">
    <span class="filter-group__label">Rolle</span>
    <div
      class="toggle-group"
      role="toolbar"
      aria-label="Rollen-Filter"
    >
      {#each ROLE_OPTIONS as opt (opt.value)}
        <button
          class="toggle-group__btn"
          class:active={filter === opt.value}
          type="button"
          onclick={() => {
            filter = opt.value;
          }}
          aria-pressed={filter === opt.value}
        >
          <i class="fas {opt.icon}"></i>
          <span class="filter-label">{opt.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="filter-group">
    <span class="filter-group__label">Kategorie</span>
    <div
      class="toggle-group"
      role="toolbar"
      aria-label="Kategorie-Filter"
    >
      {#each CATEGORY_OPTIONS as opt (opt.value)}
        <button
          class="toggle-group__btn"
          class:active={categoryFilter === opt.value}
          type="button"
          onclick={() => {
            categoryFilter = opt.value;
          }}
          aria-pressed={categoryFilter === opt.value}
        >
          <i class="fas {opt.icon}"></i>
          <span class="filter-label">{opt.label}</span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .board-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-group__label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  @media (width <= 480px) {
    .filter-label {
      display: none;
    }
  }
</style>

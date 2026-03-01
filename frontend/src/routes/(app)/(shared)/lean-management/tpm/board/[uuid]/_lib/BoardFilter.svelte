<script lang="ts">
  /**
   * BoardFilter — Filter bar for the Kamishibai board.
   * Two filter dimensions:
   *   1. Role: Alle / Bediener / Instandhaltung / Nur Offene
   *   2. Category: Alle / Reinigung / Wartung / Instandhaltung
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
    { value: 'all', label: 'Alle', icon: 'fa-th' },
    { value: 'operator', label: 'Bediener', icon: 'fa-user' },
    { value: 'maintenance', label: 'Instandhaltung', icon: 'fa-wrench' },
    { value: 'open_only', label: 'Nur Offene', icon: 'fa-exclamation-circle' },
  ];

  const CATEGORY_OPTIONS: FilterOption<CategoryFilterType>[] = [
    { value: 'all', label: 'Alle', icon: 'fa-th' },
    { value: 'reinigung', label: 'Reinigung', icon: 'fa-broom' },
    { value: 'wartung', label: 'Wartung', icon: 'fa-tools' },
    { value: 'instandhaltung', label: 'Instandhaltung', icon: 'fa-wrench' },
  ];
</script>

<div class="board-filter">
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

<style>
  .board-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  @media (width <= 480px) {
    .filter-label {
      display: none;
    }
  }
</style>

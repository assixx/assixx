<script lang="ts">
  /**
   * BoardFilter — Filter bar for the Kamishibai board.
   * Options: Alle / Bediener / Instandhaltung / Nur Offene
   * Uses $bindable for two-way filter state binding.
   */

  type FilterType = 'all' | 'operator' | 'maintenance' | 'open_only';

  interface FilterOption {
    value: FilterType;
    label: string;
    icon: string;
  }

  interface Props {
    filter?: FilterType;
  }

  let { filter = $bindable<FilterType>('all') }: Props = $props();

  const OPTIONS: FilterOption[] = [
    { value: 'all', label: 'Alle', icon: 'fa-th' },
    { value: 'operator', label: 'Bediener', icon: 'fa-user' },
    { value: 'maintenance', label: 'Instandhaltung', icon: 'fa-wrench' },
    { value: 'open_only', label: 'Nur Offene', icon: 'fa-exclamation-circle' },
  ];

  function select(opt: FilterType): void {
    filter = opt;
  }
</script>

<div class="board-filter" role="toolbar" aria-label="Board-Filter">
  {#each OPTIONS as opt (opt.value)}
    <button
      class="board-filter__btn"
      class:board-filter__btn--active={filter === opt.value}
      type="button"
      onclick={() => { select(opt.value); }}
      aria-pressed={filter === opt.value}
    >
      <i class="fas {opt.icon}"></i>
      <span>{opt.label}</span>
    </button>
  {/each}
</div>

<style>
  .board-filter {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .board-filter__btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-gray-300, #d1d5db);
    border-radius: var(--radius-md, 8px);
    background: var(--color-white, #fff);
    color: var(--color-gray-600, #4b5563);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s;
    white-space: nowrap;
  }

  .board-filter__btn:hover {
    background: var(--color-gray-50, #f9fafb);
    border-color: var(--color-gray-400, #9ca3af);
  }

  .board-filter__btn--active {
    background: var(--color-primary-600, #2563eb);
    border-color: var(--color-primary-600, #2563eb);
    color: #fff;
  }

  .board-filter__btn--active:hover {
    background: var(--color-primary-700, #1d4ed8);
    border-color: var(--color-primary-700, #1d4ed8);
  }

  @media (width <= 480px) {
    .board-filter__btn span {
      display: none;
    }

    .board-filter__btn {
      padding: 0.5rem 0.75rem;
    }
  }
</style>

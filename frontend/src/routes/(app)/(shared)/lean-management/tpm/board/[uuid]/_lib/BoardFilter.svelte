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

<div
  class="toggle-group"
  role="toolbar"
  aria-label="Board-Filter"
>
  {#each OPTIONS as opt (opt.value)}
    <button
      class="toggle-group__btn"
      class:active={filter === opt.value}
      type="button"
      onclick={() => {
        select(opt.value);
      }}
      aria-pressed={filter === opt.value}
    >
      <i class="fas {opt.icon}"></i>
      <span class="filter-label">{opt.label}</span>
    </button>
  {/each}
</div>

<style>
  @media (width <= 480px) {
    .filter-label {
      display: none;
    }
  }
</style>

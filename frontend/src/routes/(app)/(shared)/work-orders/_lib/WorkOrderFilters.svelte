<script lang="ts">
  /**
   * WorkOrderFilters — Filter bar for work order lists.
   * Two filter dimensions: Status + Priority.
   * Controlled component: parent owns state, receives change callbacks.
   */
  import { STATUS_FILTER_OPTIONS, PRIORITY_FILTER_OPTIONS } from './constants';

  interface Props {
    statusFilter: string;
    priorityFilter: string;
    onstatuschange: (value: string) => void;
    onprioritychange: (value: string) => void;
  }

  const {
    statusFilter,
    priorityFilter,
    onstatuschange,
    onprioritychange,
  }: Props = $props();
</script>

<div class="work-order-filters">
  <div class="filter-group">
    <span class="filter-group__label">Status</span>
    <div
      class="toggle-group"
      role="toolbar"
      aria-label="Status-Filter"
    >
      {#each STATUS_FILTER_OPTIONS as opt (opt.value)}
        <button
          class="toggle-group__btn"
          class:active={statusFilter === opt.value}
          type="button"
          onclick={() => {
            onstatuschange(opt.value);
          }}
          aria-pressed={statusFilter === opt.value}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="filter-group">
    <span class="filter-group__label">Priorität</span>
    <div
      class="toggle-group"
      role="toolbar"
      aria-label="Prioritäts-Filter"
    >
      {#each PRIORITY_FILTER_OPTIONS as opt (opt.value)}
        <button
          class="toggle-group__btn"
          class:active={priorityFilter === opt.value}
          type="button"
          onclick={() => {
            onprioritychange(opt.value);
          }}
          aria-pressed={priorityFilter === opt.value}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .work-order-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
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
</style>

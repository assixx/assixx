<script lang="ts">
  /**
   * MaintenanceStatus — Color-coded status badges for card distribution.
   * Shows green/red/yellow/overdue counts with configurable colors.
   */
  import { DEFAULT_COLORS, CARD_STATUS_LABELS } from './constants';

  import type { StatusCounts, TpmColorConfigEntry, CardStatus } from './types';

  interface Props {
    statusCounts: StatusCounts;
    colors: TpmColorConfigEntry[];
    compact?: boolean;
  }

  const { statusCounts, colors, compact = false }: Props = $props();

  /** Resolve color for a status — tenant config overrides defaults */
  function getColor(status: CardStatus): string {
    const custom = colors.find(
      (c: TpmColorConfigEntry) => c.statusKey === status,
    );
    return custom !== undefined ? custom.colorHex : DEFAULT_COLORS[status];
  }

  /** Status entries to display (skip zero counts in compact mode) */
  const STATUS_KEYS: CardStatus[] = ['green', 'red', 'yellow', 'overdue'];

  const visibleStatuses = $derived(
    compact ?
      STATUS_KEYS.filter((s: CardStatus) => statusCounts[s] > 0)
    : STATUS_KEYS,
  );
</script>

<div
  class="maintenance-status"
  class:maintenance-status--compact={compact}
>
  {#each visibleStatuses as status (status)}
    <span
      class="maintenance-status__badge"
      style="

--badge-color: {getColor(status)}"
      title={CARD_STATUS_LABELS[status]}
    >
      <span
        class="maintenance-status__dot"
        style="background-color: {getColor(status)}"
      ></span>
      <span class="maintenance-status__count">{statusCounts[status]}</span>
      {#if !compact}
        <span class="maintenance-status__label">
          {CARD_STATUS_LABELS[status]}
        </span>
      {/if}
    </span>
  {/each}

  {#if statusCounts.total === 0}
    <span class="maintenance-status__empty">Keine Karten</span>
  {/if}
</div>

<style>
  .maintenance-status {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .maintenance-status--compact {
    gap: 0.375rem;
  }

  .maintenance-status__badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: var(--radius-full, 9999px);
    background: color-mix(in srgb, var(--badge-color) 12%, transparent);
    font-size: 0.813rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .maintenance-status--compact .maintenance-status__badge {
    padding: 0.125rem 0.5rem;
    font-size: 0.75rem;
  }

  .maintenance-status__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .maintenance-status--compact .maintenance-status__dot {
    width: 6px;
    height: 6px;
  }

  .maintenance-status__count {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .maintenance-status__label {
    color: var(--color-text-secondary);
  }

  .maintenance-status__empty {
    font-size: 0.813rem;
    color: var(--color-text-muted);
    font-style: italic;
  }
</style>

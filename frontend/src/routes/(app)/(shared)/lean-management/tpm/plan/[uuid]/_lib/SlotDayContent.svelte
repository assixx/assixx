<script lang="ts">
  import { INTERVAL_LABELS, INTERVAL_SHORT_LABELS } from '../../../_admin/constants';

  import type { ProjectedSlot, IntervalType } from '../../../_admin/types';

  interface Props {
    slots: ProjectedSlot[];
    colorMap: Record<IntervalType, string>;
  }

  const { slots, colorMap }: Props = $props();
</script>

{#each slots as slot (slot.planUuid)}
  <span class="slot-content__asset">{slot.assetName}</span>
  <div class="slot-content__intervals">
    {#each slot.intervalTypes as interval (interval)}
      <span
        class="slot-content__badge"
        style="background: {colorMap[interval]}"
        title={INTERVAL_LABELS[interval]}>{INTERVAL_SHORT_LABELS[interval]}</span
      >
    {/each}
  </div>
  {#if !slot.isFullDay && slot.startTime !== null && slot.endTime !== null}
    <span class="slot-content__time">
      <i class="fas fa-clock"></i>
      {slot.startTime.slice(0, 5)} – {slot.endTime.slice(0, 5)}
    </span>
  {:else if slot.isFullDay}
    <span class="slot-content__time">
      <i class="fas fa-clock"></i>
      Ganztägig
    </span>
  {/if}
{/each}

<style>
  .slot-content__asset {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-align: center;
    line-height: 1.1;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .slot-content__intervals {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 3px;
  }

  .slot-content__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--color-black);
    padding: 2px 4px;
    border-radius: 2px;
    line-height: 1;
    min-width: 14px;
  }

  .slot-content__time {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.688rem;
    color: var(--color-text-muted);
  }
</style>

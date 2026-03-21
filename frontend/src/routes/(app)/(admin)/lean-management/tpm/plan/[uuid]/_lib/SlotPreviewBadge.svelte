<script lang="ts">
  /**
   * Preview badge for SlotAssistant grid cells
   * that match the currently selected weekday + repeat pattern.
   * Shows interval type badges with their original colors.
   */
  import { INTERVAL_LABELS, INTERVAL_SHORT_LABELS } from '../../../_lib/constants';

  import type { IntervalType } from '../../../_lib/types';

  interface Props {
    intervalTypes: IntervalType[];
    colorMap: Record<IntervalType, string>;
  }

  const { intervalTypes, colorMap }: Props = $props();
</script>

{#if intervalTypes.length > 0}
  <div class="slot-preview__intervals">
    {#each intervalTypes as interval (interval)}
      <span
        class="slot-preview__badge"
        style="background: {colorMap[interval]}"
        title={INTERVAL_LABELS[interval]}>{INTERVAL_SHORT_LABELS[interval]}</span
      >
    {/each}
  </div>
{:else}
  <span class="slot-preview__badge slot-preview__badge--fallback">Vorschau</span>
{/if}

<style>
  .slot-preview__intervals {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 3px;
  }

  .slot-preview__badge {
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

  .slot-preview__badge--fallback {
    color: var(--color-white);
    background: var(--color-violet-600);
  }
</style>

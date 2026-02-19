<script lang="ts">
  /**
   * TimeEstimateForm — Read-only display of time estimates for a card's interval.
   * Shows preparation, execution, followup, and total minutes.
   * Data comes from the plan's time estimates, matched by interval type.
   */
  import { MESSAGES, INTERVAL_LABELS } from '../../../_lib/constants';

  import type { TpmTimeEstimate, IntervalType } from '../../../_lib/types';

  interface Props {
    estimates: TpmTimeEstimate[];
    intervalType: IntervalType;
  }

  const { estimates, intervalType }: Props = $props();

  const estimate = $derived(
    estimates.find((e: TpmTimeEstimate) => e.intervalType === intervalType) ??
      null,
  );
</script>

<div class="time-estimate">
  <h4 class="time-estimate__title">
    <i class="fas fa-clock"></i>
    {MESSAGES.TIME_HEADING}
    <span class="time-estimate__interval">
      {INTERVAL_LABELS[intervalType]}
    </span>
  </h4>

  {#if estimate !== null}
    <div class="time-estimate__grid">
      <div class="time-estimate__row">
        <span class="time-estimate__label">{MESSAGES.TIME_STAFF}</span>
        <span class="time-estimate__value">{estimate.staffCount}</span>
      </div>
      <div class="time-estimate__row">
        <span class="time-estimate__label">{MESSAGES.TIME_PREP}</span>
        <span class="time-estimate__value">
          {estimate.preparationMinutes}
          {MESSAGES.TIME_MINUTES}
        </span>
      </div>
      <div class="time-estimate__row">
        <span class="time-estimate__label">{MESSAGES.TIME_EXEC}</span>
        <span class="time-estimate__value">
          {estimate.executionMinutes}
          {MESSAGES.TIME_MINUTES}
        </span>
      </div>
      <div class="time-estimate__row">
        <span class="time-estimate__label">{MESSAGES.TIME_FOLLOW}</span>
        <span class="time-estimate__value">
          {estimate.followupMinutes}
          {MESSAGES.TIME_MINUTES}
        </span>
      </div>
      <div class="time-estimate__row time-estimate__row--total">
        <span class="time-estimate__label">{MESSAGES.TIME_TOTAL}</span>
        <span class="time-estimate__value">
          {estimate.totalMinutes}
          {MESSAGES.TIME_MINUTES}
        </span>
      </div>
    </div>
  {:else}
    <p class="time-estimate__empty">{MESSAGES.TIME_NO_ESTIMATE}</p>
  {/if}
</div>

<style>
  .time-estimate {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .time-estimate__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.813rem;
    font-weight: 600;
    color: var(--color-gray-700);
    margin: 0;
  }

  .time-estimate__interval {
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--color-gray-400);
  }

  .time-estimate__grid {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    background: var(--color-gray-50, #f9fafb);
    border-radius: var(--radius-md, 8px);
    padding: 0.625rem 0.75rem;
  }

  .time-estimate__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.125rem 0;
  }

  .time-estimate__row--total {
    border-top: 1px solid var(--color-gray-200);
    margin-top: 0.25rem;
    padding-top: 0.375rem;
    font-weight: 600;
  }

  .time-estimate__label {
    font-size: 0.75rem;
    color: var(--color-gray-500);
  }

  .time-estimate__value {
    font-size: 0.75rem;
    color: var(--color-gray-800);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  .time-estimate__empty {
    font-size: 0.75rem;
    color: var(--color-gray-400);
    font-style: italic;
    margin: 0;
  }
</style>

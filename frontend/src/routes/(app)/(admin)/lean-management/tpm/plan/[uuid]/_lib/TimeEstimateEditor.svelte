<script lang="ts">
  /**
   * TimeEstimateEditor — Toggle + tabbed editor for per-interval time estimates.
   * Includes the on/off toggle, help text, and per-interval input grid.
   */
  import {
    ESTIMATE_INTERVALS,
    INTERVAL_LABELS,
    MESSAGES,
  } from '../../../_lib/constants';

  import type { IntervalType } from '../../../_lib/types';

  interface EstimateFields {
    staffCount: number;
    preparationMinutes: number;
    executionMinutes: number;
    followupMinutes: number;
  }

  interface Props {
    estimateMap: Record<string, EstimateFields>;
    submitting: boolean;
    isCreateMode: boolean;
    showEstimates: boolean;
    ontoggle: (value: boolean) => void;
  }

  const {
    estimateMap,
    submitting,
    isCreateMode,
    showEstimates,
    ontoggle,
  }: Props = $props();

  let activeTab = $state<IntervalType>('monthly');
  const activeEstimate = $derived(estimateMap[activeTab]);
</script>

<!-- Toggle -->
<div class="form-field">
  <label class="toggle-switch">
    <input
      type="checkbox"
      class="toggle-switch__input"
      checked={showEstimates}
      onchange={() => {
        ontoggle(!showEstimates);
      }}
      disabled={submitting || isCreateMode}
    />
    <span class="toggle-switch__slider"></span>
    <span class="toggle-switch__label">{MESSAGES.LABEL_TIME_ESTIMATES}</span>
  </label>
  <span class="form-field__message">
    {#if isCreateMode}
      {MESSAGES.TIME_EST_CREATE_HINT}
    {:else}
      {MESSAGES.HELP_TIME_ESTIMATES}
    {/if}
  </span>
</div>

{#if showEstimates && !isCreateMode}
  <!-- Interval Tabs -->
  <div
    class="te-tabs"
    role="tablist"
  >
    {#each ESTIMATE_INTERVALS as intv (intv)}
      <button
        type="button"
        class="te-tabs__tab"
        class:te-tabs__tab--active={activeTab === intv}
        role="tab"
        aria-selected={activeTab === intv}
        disabled={submitting}
        onclick={() => {
          activeTab = intv;
        }}
      >
        {INTERVAL_LABELS[intv]}
      </button>
    {/each}
  </div>

  <!-- Active tab inputs -->
  {#key activeTab}
    <div class="te-grid">
      <div class="form-field te-grid__field">
        <label
          class="form-field__label"
          for="teStaff">{MESSAGES.TIME_EST_STAFF}</label
        >
        <div class="form-input-group">
          <input
            id="teStaff"
            type="number"
            class="form-field__control te-grid__input"
            bind:value={activeEstimate.staffCount}
            disabled={submitting}
            min={1}
            max={50}
          />
          <span class="form-input-group__suffix">Pers.</span>
        </div>
      </div>

      <div class="form-field te-grid__field">
        <label
          class="form-field__label"
          for="tePrep">{MESSAGES.TIME_EST_PREP}</label
        >
        <div class="form-input-group">
          <input
            id="tePrep"
            type="number"
            class="form-field__control te-grid__input"
            bind:value={activeEstimate.preparationMinutes}
            disabled={submitting}
            min={0}
            max={480}
          />
          <span class="form-input-group__suffix"
            >{MESSAGES.TIME_EST_MINUTES}</span
          >
        </div>
      </div>

      <div class="form-field te-grid__field">
        <label
          class="form-field__label"
          for="teExec">{MESSAGES.TIME_EST_EXEC}</label
        >
        <div class="form-input-group">
          <input
            id="teExec"
            type="number"
            class="form-field__control te-grid__input"
            bind:value={activeEstimate.executionMinutes}
            disabled={submitting}
            min={0}
            max={480}
          />
          <span class="form-input-group__suffix"
            >{MESSAGES.TIME_EST_MINUTES}</span
          >
        </div>
      </div>

      <div class="form-field te-grid__field">
        <label
          class="form-field__label"
          for="teFollow">{MESSAGES.TIME_EST_FOLLOW}</label
        >
        <div class="form-input-group">
          <input
            id="teFollow"
            type="number"
            class="form-field__control te-grid__input"
            bind:value={activeEstimate.followupMinutes}
            disabled={submitting}
            min={0}
            max={480}
          />
          <span class="form-input-group__suffix"
            >{MESSAGES.TIME_EST_MINUTES}</span
          >
        </div>
      </div>
    </div>
  {/key}
{/if}

<style>
  .te-tabs {
    display: flex;
    gap: 0.25rem;
    border-bottom: 1px solid var(--color-glass-border);
    padding-bottom: 0;
    overflow-x: auto;
  }

  .te-tabs__tab {
    padding: 0.5rem 0.75rem;
    font-size: 0.813rem;
    font-weight: 500;
    color: var(--color-text-muted);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    white-space: nowrap;
    transition:
      color 0.15s,
      border-color 0.15s;
  }

  .te-tabs__tab:hover:not(:disabled) {
    color: var(--color-text-secondary);
  }

  .te-tabs__tab--active {
    color: var(--color-primary, #3b82f6);
    border-bottom-color: var(--color-primary, #3b82f6);
  }

  .te-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  .te-grid__field {
    min-width: 0;
  }

  .te-grid__input {
    max-width: 160px;
  }

  .form-input-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .form-input-group__suffix {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  @media (width <= 640px) {
    .te-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>

<script lang="ts">
  import { DEFAULT_PLAN, PLANS } from './constants';

  import type { Plan } from './types';

  interface Props {
    selectedPlan: string;
  }

  // eslint-disable-next-line @typescript-eslint/no-useless-default-assignment -- $bindable() is a Svelte semantic marker, not a JS default
  let { selectedPlan = $bindable() }: Props = $props();

  let dropdownOpen = $state(false);

  const selectedPlanName = $derived(
    PLANS.find((p: Plan) => p.value === selectedPlan)?.name ??
      DEFAULT_PLAN.name,
  );

  function selectOption(plan: Plan): void {
    selectedPlan = plan.value;
    dropdownOpen = false;
  }

  function toggleDropdown(): void {
    dropdownOpen = !dropdownOpen;
  }

  $effect(() => {
    function handler(event: MouseEvent): void {
      if (!(event.target instanceof HTMLElement)) return;
      if (!event.target.closest('.custom-plan-select')) {
        dropdownOpen = false;
      }
    }
    document.addEventListener('click', handler, true);
    return () => {
      document.removeEventListener('click', handler, true);
    };
  });
</script>

<div class="form-field">
  <label
    class="form-field__label"
    for="planValue">Plan</label
  >
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="custom-plan-select">
    <div
      class="plan-display"
      class:active={dropdownOpen}
      onclick={toggleDropdown}
    >
      <span>{selectedPlanName}</span>
      <svg
        width="10"
        height="6"
        viewBox="0 0 10 6"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M1 1L5 5L9 1"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </div>
    <div
      class="plan-dropdown"
      class:active={dropdownOpen}
    >
      {#each PLANS as plan (plan.value)}
        <div
          class="plan-option"
          onclick={() => {
            selectOption(plan);
          }}
        >
          <span>{plan.name}</span>
          <span class="plan-price">{plan.price}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .custom-plan-select {
    position: relative;
    width: 100%;
  }

  .plan-display {
    display: flex;
    justify-content: space-between;
    align-items: center;
    backdrop-filter: var(--glass-form-backdrop);
    transition:
      var(--form-field-transition), var(--form-field-transition-shadow);
    cursor: pointer;
    border: var(--form-field-border);
    border-radius: var(--form-field-radius);
    background: var(--form-field-bg);
    padding: var(--form-field-padding-y) var(--form-field-padding-x);
    min-height: 44px;
    color: var(--form-field-text);
    font-size: var(--form-field-font-size);
  }

  .plan-display:hover {
    border: var(--form-field-border-hover);
    background: var(--form-field-bg-hover);
  }

  .plan-display svg {
    opacity: 60%;
  }

  .plan-display.active svg {
    transform: rotate(180deg);
  }

  .plan-dropdown {
    position: absolute;
    top: calc(100% + 5px);
    right: 0;
    left: 0;
    transform: translateY(-10px);
    visibility: hidden;
    opacity: 0%;
    z-index: 1000;

    border: 1px solid color-mix(in oklch, var(--color-white) 10%, transparent);
    border-radius: var(--radius-xl);
    background: oklch(18.22% 0 263.28 / 100%);
  }

  .plan-dropdown.active {
    transform: translateY(0);
    visibility: visible;
    opacity: 100%;
  }

  .plan-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    border-bottom: 1px solid
      color-mix(in oklch, var(--color-white) 5%, transparent);
    padding: 10px 16px;
    color: var(--text-primary);
    font-size: 14px;
  }

  .plan-option:last-child {
    border-bottom: none;
  }

  .plan-option:hover {
    background: color-mix(in oklch, var(--color-primary) 20%, transparent);
    padding-left: 20px;
    color: var(--color-white);
  }

  .plan-option:active {
    background: color-mix(in oklch, var(--color-primary) 30%, transparent);
  }

  .plan-price {
    color: var(--primary-color);
    font-weight: 500;
    font-size: 12px;
  }

  .plan-option:hover .plan-price {
    color: var(--color-white);
  }
</style>

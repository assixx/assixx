<!--
  RoleChangeModals.svelte
  Confirm modals for upgrading admin to root and downgrading admin to employee.
-->
<script lang="ts">
  import { MESSAGES } from './constants';

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    showUpgradeModal: boolean;
    showDowngradeModal: boolean;
    upgradeLoading: boolean;
    downgradeLoading: boolean;
    oncloseUpgrade: () => void;
    oncloseDowngrade: () => void;
    onconfirmUpgrade: () => void;
    onconfirmDowngrade: () => void;
  }

  const {
    showUpgradeModal,
    showDowngradeModal,
    upgradeLoading,
    downgradeLoading,
    oncloseUpgrade,
    oncloseDowngrade,
    onconfirmUpgrade,
    onconfirmDowngrade,
  }: Props = $props();
</script>

<!-- Upgrade Confirm Modal (confirm-modal--warning) -->
{#if showUpgradeModal}
  <div
    id="upgrade-confirm-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="upgrade-confirm-title"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget) oncloseUpgrade();
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') oncloseUpgrade();
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="confirm-modal confirm-modal--warning"
      onclick={(e) => {
        e.stopPropagation();
      }}
    >
      <div class="confirm-modal__icon">
        <i class="fas fa-arrow-up"></i>
      </div>
      <h3
        class="confirm-modal__title"
        id="upgrade-confirm-title"
      >
        {MESSAGES.UPGRADE_TITLE}
      </h3>
      <p class="confirm-modal__message">
        <strong>{MESSAGES.UPGRADE_CONFIRM_MESSAGE}</strong>
      </p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
          disabled={upgradeLoading}
          onclick={oncloseUpgrade}>{MESSAGES.BTN_CANCEL}</button
        >
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--warning"
          disabled={upgradeLoading}
          onclick={onconfirmUpgrade}
        >
          {#if upgradeLoading}
            <i class="fas fa-spinner fa-spin mr-2"></i>
          {/if}
          {MESSAGES.UPGRADE_CONFIRM_BUTTON}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Downgrade Confirm Modal (confirm-modal--warning) -->
{#if showDowngradeModal}
  <div
    id="downgrade-confirm-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="downgrade-confirm-title"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget) oncloseDowngrade();
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') oncloseDowngrade();
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="confirm-modal confirm-modal--warning"
      onclick={(e) => {
        e.stopPropagation();
      }}
    >
      <div class="confirm-modal__icon">
        <i class="fas fa-arrow-down"></i>
      </div>
      <h3
        class="confirm-modal__title"
        id="downgrade-confirm-title"
      >
        {MESSAGES.UPGRADE_TITLE}
      </h3>
      <p class="confirm-modal__message">
        <strong>{MESSAGES.DOWNGRADE_CONFIRM_MESSAGE}</strong>
      </p>
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
          disabled={downgradeLoading}
          onclick={oncloseDowngrade}>{MESSAGES.BTN_CANCEL}</button
        >
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--warning"
          disabled={downgradeLoading}
          onclick={onconfirmDowngrade}
        >
          {#if downgradeLoading}
            <i class="fas fa-spinner fa-spin mr-2"></i>
          {/if}
          {MESSAGES.DOWNGRADE_CONFIRM_BUTTON}
        </button>
      </div>
    </div>
  </div>
{/if}

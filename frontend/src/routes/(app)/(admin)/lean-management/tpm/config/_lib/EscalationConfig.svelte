<script lang="ts">
  /**
   * TPM Escalation Configuration Component
   *
   * Form for escalation settings: hours threshold + notification toggles.
   */
  import { invalidateAll } from '$app/navigation';

  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';

  import {
    updateEscalation as apiUpdateEscalation,
    logApiError,
  } from '../../_lib/api';
  import { MESSAGES } from '../../_lib/constants';

  import type { TpmEscalationConfig } from '../../_lib/types';

  // ===========================================================================
  // PROPS
  // ===========================================================================

  const { escalation }: { escalation: TpmEscalationConfig } = $props();

  // ===========================================================================
  // STATE
  // ===========================================================================

  let hours = $state(0);
  let notifyTeam = $state(false);
  let notifyDept = $state(false);
  let saving = $state(false);

  // ===========================================================================
  // DERIVED
  // ===========================================================================

  const isValidHours = $derived(
    Number.isInteger(hours) && hours >= 1 && hours <= 720,
  );

  const hasChanges = $derived(
    hours !== escalation.escalationAfterHours ||
      notifyTeam !== escalation.notifyTeamLead ||
      notifyDept !== escalation.notifyDepartmentLead,
  );

  // ===========================================================================
  // ACTIONS
  // ===========================================================================

  async function handleSave(): Promise<void> {
    if (!isValidHours) {
      showErrorAlert(MESSAGES.ERROR_ESCALATION_HOURS_RANGE);
      return;
    }

    saving = true;
    try {
      await apiUpdateEscalation({
        escalationAfterHours: hours,
        notifyTeamLead: notifyTeam,
        notifyDepartmentLead: notifyDept,
      });
      showSuccessAlert(MESSAGES.SUCCESS_ESCALATION_UPDATED);
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('updateEscalation', err);
      const msg =
        err instanceof Error ? err.message : MESSAGES.ERROR_ESCALATION_UPDATE;
      showErrorAlert(msg);
    } finally {
      saving = false;
    }
  }

  // Sync state when SSR data changes
  $effect(() => {
    hours = escalation.escalationAfterHours;
    notifyTeam = escalation.notifyTeamLead;
    notifyDept = escalation.notifyDepartmentLead;
  });
</script>

<div>
  <div class="mb-6">
    <h3
      class="flex items-center gap-2 text-base font-semibold text-(--color-text-primary)"
    >
      <i class="fas fa-exclamation-triangle"></i>
      {MESSAGES.ESCALATION_TITLE}
    </h3>
    <p class="mt-1 text-sm text-(--color-text-secondary)">
      {MESSAGES.ESCALATION_DESCRIPTION}
    </p>
  </div>

  <form
    class="flex flex-col gap-5"
    onsubmit={(e: SubmitEvent) => {
      e.preventDefault();
      void handleSave();
    }}
  >
    <!-- Hours -->
    <div class="form-field">
      <label
        class="form-field__label"
        for="esc-hours"
      >
        {MESSAGES.ESCALATION_HOURS}
      </label>
      <input
        id="esc-hours"
        type="number"
        class="form-field__control"
        class:is-error={!isValidHours}
        min={1}
        max={720}
        bind:value={hours}
      />
      <p class="form-field__message">{MESSAGES.ESCALATION_HOURS_HELP}</p>
    </div>

    <!-- Notify Team Lead -->
    <div class="form-field">
      <label
        class="toggle-switch"
        for="esc-team"
      >
        <input
          id="esc-team"
          type="checkbox"
          class="toggle-switch__input"
          bind:checked={notifyTeam}
        />
        <span class="toggle-switch__slider"></span>
        <span class="toggle-switch__label"
          >{MESSAGES.ESCALATION_NOTIFY_TEAM}</span
        >
      </label>
    </div>

    <!-- Notify Department Lead -->
    <div class="form-field">
      <label
        class="toggle-switch"
        for="esc-dept"
      >
        <input
          id="esc-dept"
          type="checkbox"
          class="toggle-switch__input"
          bind:checked={notifyDept}
        />
        <span class="toggle-switch__slider"></span>
        <span class="toggle-switch__label"
          >{MESSAGES.ESCALATION_NOTIFY_DEPT}</span
        >
      </label>
    </div>

    <!-- Save -->
    <div class="pt-2">
      <button
        type="submit"
        class="btn btn-primary"
        disabled={saving || !hasChanges || !isValidHours}
      >
        {#if saving}
          <i class="fas fa-spinner fa-spin"></i>
        {/if}
        {MESSAGES.ESCALATION_SAVE}
      </button>
    </div>
  </form>
</div>

<style>
  /* .is-error is provided by the design system form-field component */
</style>

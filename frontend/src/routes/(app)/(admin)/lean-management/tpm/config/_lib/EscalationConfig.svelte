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

<div class="esc-config">
  <div class="esc-config__header">
    <h3 class="esc-config__title">
      <i class="fas fa-exclamation-triangle"></i>
      {MESSAGES.ESCALATION_TITLE}
    </h3>
    <p class="esc-config__desc">{MESSAGES.ESCALATION_DESCRIPTION}</p>
  </div>

  <form
    class="esc-config__form"
    onsubmit={(e: SubmitEvent) => {
      e.preventDefault();
      void handleSave();
    }}
  >
    <!-- Hours -->
    <div class="form-group">
      <label
        class="form-label"
        for="esc-hours"
      >
        {MESSAGES.ESCALATION_HOURS}
      </label>
      <input
        id="esc-hours"
        type="number"
        class="input"
        class:input--error={!isValidHours}
        min={1}
        max={720}
        bind:value={hours}
      />
      <p class="form-help">{MESSAGES.ESCALATION_HOURS_HELP}</p>
    </div>

    <!-- Notify Team Lead -->
    <div class="form-group form-group--toggle">
      <label
        class="toggle-label"
        for="esc-team"
      >
        <input
          id="esc-team"
          type="checkbox"
          class="toggle-input"
          bind:checked={notifyTeam}
        />
        <span class="toggle-text">{MESSAGES.ESCALATION_NOTIFY_TEAM}</span>
      </label>
    </div>

    <!-- Notify Department Lead -->
    <div class="form-group form-group--toggle">
      <label
        class="toggle-label"
        for="esc-dept"
      >
        <input
          id="esc-dept"
          type="checkbox"
          class="toggle-input"
          bind:checked={notifyDept}
        />
        <span class="toggle-text">{MESSAGES.ESCALATION_NOTIFY_DEPT}</span>
      </label>
    </div>

    <!-- Save -->
    <div class="esc-config__actions">
      <button
        type="submit"
        class="btn btn--primary"
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
  .esc-config__header {
    margin-bottom: 1.5rem;
  }

  .esc-config__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-gray-800);
  }

  .esc-config__desc {
    color: var(--color-gray-500);
    font-size: 0.8125rem;
    margin-top: 0.25rem;
  }

  .esc-config__form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .form-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-gray-700);
  }

  .form-help {
    font-size: 0.75rem;
    color: var(--color-gray-400);
  }

  .form-group--toggle {
    flex-direction: row;
    align-items: center;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    user-select: none;
  }

  .toggle-input {
    width: 1.125rem;
    height: 1.125rem;
    accent-color: var(--color-blue-600, #2563eb);
    cursor: pointer;
  }

  .toggle-text {
    font-size: 0.875rem;
    color: var(--color-gray-700);
  }

  .esc-config__actions {
    padding-top: 0.5rem;
  }
</style>

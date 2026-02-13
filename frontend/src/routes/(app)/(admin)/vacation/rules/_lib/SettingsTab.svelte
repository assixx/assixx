<script lang="ts">
  /**
   * SettingsTab — Vacation settings display (read-only) and edit form.
   * All state read from rulesState singleton.
   */
  import { invalidateAll } from '$app/navigation';

  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import { showSuccessAlert, showErrorAlert } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  import * as api from './api';
  import {
    MONTH_LABELS,
    MONTH_DROPDOWN_OPTIONS,
    SETTINGS_LABELS,
  } from './constants';
  import { rulesState } from './state.svelte';

  import type { UpdateSettingsPayload, VacationSettings } from './types';

  const log = createLogger('SettingsTab');

  // ==========================================================================
  // FORM STATE
  // ==========================================================================

  let settingsForm = $state<UpdateSettingsPayload>({});
  let isSaving = $state(false);

  // Dropdown state
  let monthDropdownOpen = $state(false);
  const monthDisplayText = $derived(
    MONTH_LABELS[settingsForm.carryOverDeadlineMonth ?? 3] ?? 'März',
  );

  function handleMonthSelect(value: number): void {
    settingsForm.carryOverDeadlineMonth = value;
    monthDropdownOpen = false;
  }

  /** Populate settings form from current settings */
  $effect(() => {
    const s = rulesState.settings;
    if (s !== null && rulesState.isEditingSettings) {
      settingsForm = {
        defaultAnnualDays: s.defaultAnnualDays,
        maxCarryOverDays: s.maxCarryOverDays,
        carryOverDeadlineMonth: s.carryOverDeadlineMonth,
        carryOverDeadlineDay: s.carryOverDeadlineDay,
        advanceNoticeDays: s.advanceNoticeDays,
        maxConsecutiveDays: s.maxConsecutiveDays,
      };
    }
  });

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  async function performSave(): Promise<void> {
    await api.updateSettings(settingsForm);
    rulesState.stopEditSettings();
    showSuccessAlert('Einstellungen gespeichert');
    await invalidateAll();
  }

  function handleSave() {
    if (isSaving) return;

    isSaving = true;
    performSave()
      .catch((err: unknown) => {
        log.error({ err }, 'Settings save failed');
        showErrorAlert('Fehler beim Speichern der Einstellungen');
      })
      .finally(() => {
        isSaving = false;
      });
  }

  /** Format a settings value for display */
  function formatSettingsValue(
    key: string,
    settings: VacationSettings,
  ): string {
    const value = settings[key as keyof VacationSettings];

    if (key === 'carryOverDeadlineMonth') {
      return MONTH_LABELS[value as number] ?? String(value);
    }
    if (key === 'maxConsecutiveDays' && value === null) {
      return 'Unbegrenzt';
    }
    return String(value);
  }

  // Capture-phase click-outside: works inside modals (bypasses stopPropagation)
  $effect(() => {
    return onClickOutsideDropdown(() => {
      monthDropdownOpen = false;
    });
  });
</script>

<!-- ================================================================
     SETTINGS CARD
     ================================================================ -->

<div class="card mb-6">
  <div class="card__header">
    <div class="flex items-center justify-between">
      <h3 class="card__title">
        <i class="fas fa-cog mr-2"></i>
        Urlaubseinstellungen
      </h3>
      {#if !rulesState.isEditingSettings}
        <button
          type="button"
          class="btn btn-primary"
          onclick={() => {
            rulesState.startEditSettings();
          }}
        >
          <i class="fas fa-edit mr-1"></i>
          Bearbeiten
        </button>
      {/if}
    </div>
  </div>
  <div class="card__body">
    {#if rulesState.settings === null}
      <div class="empty-state empty-state--in-card">
        <div class="empty-state__icon">
          <i class="fas fa-cog"></i>
        </div>
        <h3 class="empty-state__title">Keine Einstellungen vorhanden</h3>
        <p class="empty-state__description">
          Klicken Sie auf "Bearbeiten", um die Standard-Urlaubseinstellungen
          festzulegen.
        </p>
      </div>

      <!-- Read-only display -->
    {:else if !rulesState.isEditingSettings}
      <div class="settings-display">
        {#each Object.entries(SETTINGS_LABELS) as [key, label] (key)}
          <div class="settings-display__row">
            <span class="settings-display__label">{label}</span>
            <span class="settings-display__value">
              {formatSettingsValue(key, rulesState.settings)}
            </span>
          </div>
        {/each}
      </div>

      <!-- Edit form -->
    {:else}
      <form
        class="settings-grid"
        onsubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <div class="form-field">
          <label
            class="form-field__label"
            for="set-annual-days"
          >
            {SETTINGS_LABELS.defaultAnnualDays}
          </label>
          <input
            id="set-annual-days"
            type="number"
            class="form-field__control"
            min="0"
            step="0.5"
            bind:value={settingsForm.defaultAnnualDays}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="set-carry-over"
          >
            {SETTINGS_LABELS.maxCarryOverDays}
          </label>
          <input
            id="set-carry-over"
            type="number"
            class="form-field__control"
            min="0"
            bind:value={settingsForm.maxCarryOverDays}
          />
        </div>

        <div class="form-field">
          <span class="form-field__label">
            {SETTINGS_LABELS.carryOverDeadlineMonth}
          </span>
          <div
            class="dropdown"
            data-dropdown="deadline-month"
          >
            <button
              type="button"
              class="dropdown__trigger"
              class:active={monthDropdownOpen}
              onclick={() => {
                monthDropdownOpen = !monthDropdownOpen;
              }}
            >
              <span>{monthDisplayText}</span>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div
              class="dropdown__menu"
              class:active={monthDropdownOpen}
            >
              {#each MONTH_DROPDOWN_OPTIONS as option (option.value)}
                <button
                  type="button"
                  class="dropdown__option"
                  onclick={() => {
                    handleMonthSelect(option.value);
                  }}
                >
                  {option.label}
                </button>
              {/each}
            </div>
          </div>
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="set-deadline-day"
          >
            {SETTINGS_LABELS.carryOverDeadlineDay}
          </label>
          <input
            id="set-deadline-day"
            type="number"
            class="form-field__control"
            min="1"
            max="31"
            bind:value={settingsForm.carryOverDeadlineDay}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="set-advance-days"
          >
            {SETTINGS_LABELS.advanceNoticeDays}
          </label>
          <input
            id="set-advance-days"
            type="number"
            class="form-field__control"
            min="0"
            bind:value={settingsForm.advanceNoticeDays}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="set-max-consecutive"
          >
            {SETTINGS_LABELS.maxConsecutiveDays}
          </label>
          <input
            id="set-max-consecutive"
            type="number"
            class="form-field__control"
            min="1"
            placeholder="Leer = Unbegrenzt"
            value={settingsForm.maxConsecutiveDays ?? ''}
            oninput={(e) => {
              const val = (e.target as HTMLInputElement).value;
              settingsForm.maxConsecutiveDays = val === '' ? null : Number(val);
            }}
          />
        </div>

        <div
          class="flex items-center gap-3"
          style="grid-column: 1 / -1;"
        >
          <button
            type="submit"
            class="btn btn-primary"
            disabled={isSaving}
          >
            <i class="fas fa-save mr-1"></i>
            Speichern
          </button>
          <button
            type="button"
            class="btn btn-cancel"
            onclick={() => {
              rulesState.stopEditSettings();
            }}
          >
            Abbrechen
          </button>
        </div>
      </form>
    {/if}
  </div>
</div>

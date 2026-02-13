<script lang="ts">
  /**
   * Vacation Holidays — Root Page
   * Manage tenant holidays: CRUD with recurring/one-time distinction.
   * SSR: Holidays loaded in +page.server.ts.
   */
  import { onDestroy } from 'svelte';

  import { invalidateAll } from '$app/navigation';

  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import { showSuccessAlert, showErrorAlert } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  import * as api from './_lib/api';
  import { RECURRING_LABELS } from './_lib/constants';
  import { holidaysState } from './_lib/state.svelte';

  import type { PageData } from './$types';
  import type { CreateHolidayPayload } from './_lib/types';

  const log = createLogger('VacationHolidays');

  // ==========================================================================
  // SSR DATA
  // ==========================================================================

  const { data }: { data: PageData } = $props();

  const ssrHolidays = $derived(data.holidays);

  $effect(() => {
    holidaysState.setHolidays(ssrHolidays);
    holidaysState.setLoading(false);
  });

  onDestroy(() => {
    holidaysState.reset();
  });

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  function formatDate(iso: string): string {
    return new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function yearOptions(): number[] {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }

  // ==========================================================================
  // YEAR CHANGE (client-side refetch)
  // ==========================================================================

  // Dropdown state for year select
  let yearDropdownOpen = $state(false);
  const yearDisplayText = $derived(String(holidaysState.selectedYear));

  async function handleYearSelect(year: number): Promise<void> {
    yearDropdownOpen = false;
    holidaysState.setSelectedYear(year);
    holidaysState.setLoading(true);
    try {
      const holidays = await api.getHolidays(year);
      holidaysState.setHolidays(holidays);
    } catch (err) {
      log.error({ err }, 'Holiday reload failed');
      showErrorAlert('Fehler beim Laden der Feiertage');
    } finally {
      holidaysState.setLoading(false);
    }
  }

  // Capture-phase click-outside: works inside modals (bypasses stopPropagation)
  $effect(() => {
    return onClickOutsideDropdown(() => {
      yearDropdownOpen = false;
    });
  });

  // ==========================================================================
  // FORM STATE
  // ==========================================================================

  let holidayName = $state('');
  let holidayDate = $state('');
  let holidayRecurring = $state(true);
  let isSaving = $state(false);

  /** Populate form when editing */
  $effect(() => {
    const editing = holidaysState.editingHoliday;
    if (editing !== null) {
      holidayName = editing.name;
      holidayDate = editing.holidayDate;
      holidayRecurring = editing.recurring;
    } else if (holidaysState.showHolidayForm) {
      holidayName = '';
      holidayDate = '';
      holidayRecurring = true;
    }
  });

  const canSubmit = $derived(holidayName.trim() !== '' && holidayDate !== '');

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  async function performSave(): Promise<void> {
    const payload: CreateHolidayPayload = {
      name: holidayName.trim(),
      holidayDate,
      recurring: holidayRecurring,
    };

    if (holidaysState.editingHoliday !== null) {
      await api.updateHoliday(holidaysState.editingHoliday.id, payload);
      showSuccessAlert('Feiertag aktualisiert');
    } else {
      await api.createHoliday(payload);
      showSuccessAlert('Feiertag erstellt');
    }

    holidaysState.closeHolidayForm();
    await invalidateAll();
  }

  function handleSubmit() {
    if (!canSubmit || isSaving) return;

    isSaving = true;
    performSave()
      .catch((err: unknown) => {
        log.error({ err }, 'Holiday save failed');
        showErrorAlert('Fehler beim Speichern des Feiertags');
      })
      .finally(() => {
        isSaving = false;
      });
  }

  async function handleDelete(): Promise<void> {
    const holiday = holidaysState.deletingHoliday;
    if (holiday === null) return;

    try {
      await api.deleteHoliday(holiday.id);
      holidaysState.closeDeleteHoliday();
      showSuccessAlert('Feiertag geloescht');
      await invalidateAll();
    } catch (err) {
      log.error({ err }, 'Holiday delete failed');
      showErrorAlert('Fehler beim Loeschen des Feiertags');
    }
  }
</script>

<svelte:head>
  <title>Feiertage - Assixx</title>
</svelte:head>

<div class="container">
  <!-- Header -->
  <div class="card mb-6">
    <div class="card__header">
      <div class="flex items-center justify-between">
        <h2 class="card__title">
          <i class="fas fa-calendar-day mr-2"></i>
          Feiertage verwalten
        </h2>
        <div class="flex items-center gap-3">
          <span class="form-field__label mb-0">Jahr:</span>
          <div
            class="dropdown"
            data-dropdown="hol-year"
          >
            <button
              type="button"
              class="dropdown__trigger"
              class:active={yearDropdownOpen}
              onclick={() => {
                yearDropdownOpen = !yearDropdownOpen;
              }}
            >
              <span>{yearDisplayText}</span>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div
              class="dropdown__menu"
              class:active={yearDropdownOpen}
            >
              {#each yearOptions() as year (year)}
                <button
                  type="button"
                  class="dropdown__option"
                  onclick={() => {
                    void handleYearSelect(year);
                  }}
                >
                  {year}
                </button>
              {/each}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Holiday List -->
  <div class="card">
    <div class="card__header">
      <div class="flex items-center justify-between">
        <h3 class="card__title">
          <i class="fas fa-list mr-2"></i>
          Feiertage
          <span class="text-muted ml-2">
            ({holidaysState.holidays.length} gesamt, {holidaysState.recurringCount}
            jährlich, {holidaysState.oneTimeCount} einmalig)
          </span>
        </h3>
        <button
          type="button"
          class="btn btn-primary"
          onclick={() => {
            holidaysState.openCreateHoliday();
          }}
        >
          <i class="fas fa-plus mr-1"></i>
          Neuer Feiertag
        </button>
      </div>
    </div>
    <div class="card__body">
      {#if holidaysState.isLoading}
        <div
          class="text-center"
          style="padding: var(--spacing-8);"
        >
          <i class="fas fa-spinner fa-spin fa-2x text-muted"></i>
          <p class="text-muted mt-3">Feiertage werden geladen...</p>
        </div>
      {:else if holidaysState.sortedHolidays.length === 0}
        <div class="empty-state empty-state--in-card">
          <div class="empty-state__icon">
            <i class="fas fa-calendar-day"></i>
          </div>
          <h3 class="empty-state__title">Keine Feiertage definiert</h3>
          <p class="empty-state__description">
            Feiertage werden bei der Berechnung von Urlaubstagen
            beruecksichtigt.
          </p>
        </div>
      {:else}
        <div class="holiday-list">
          {#each holidaysState.sortedHolidays as holiday (holiday.id)}
            <div class="holiday-list__item">
              <div class="holiday-list__info">
                <span class="holiday-list__name">{holiday.name}</span>
                <div class="holiday-list__meta">
                  <span>
                    <i class="fas fa-calendar-alt mr-1"></i>
                    {formatDate(holiday.holidayDate)}
                  </span>
                  <span
                    class="badge {holiday.recurring ? 'badge--info' : (
                      'badge--warning'
                    )} badge--sm"
                  >
                    {RECURRING_LABELS[String(holiday.recurring)]}
                  </span>
                </div>
              </div>
              <div class="holiday-list__actions">
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  onclick={() => {
                    holidaysState.openEditHoliday(holiday);
                  }}
                  aria-label="Bearbeiten"
                >
                  <i class="fas fa-edit"></i>
                </button>
                <button
                  type="button"
                  class="btn btn-danger btn-sm"
                  onclick={() => {
                    holidaysState.openDeleteHoliday(holiday);
                  }}
                  aria-label="Loeschen"
                >
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- ================================================================
     FORM MODAL (Create / Edit)
     ================================================================ -->

{#if holidaysState.showHolidayForm}
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={() => {
      holidaysState.closeHolidayForm();
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') holidaysState.closeHolidayForm();
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <form
      class="ds-modal"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onkeydown={(e) => {
        e.stopPropagation();
      }}
      onsubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          <i class="fas fa-calendar-day mr-2"></i>
          {holidaysState.editingHoliday !== null ?
            'Feiertag bearbeiten'
          : 'Neuer Feiertag'}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schliessen"
          onclick={() => {
            holidaysState.closeHolidayForm();
          }}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body">
        <div class="form-field">
          <label
            class="form-field__label"
            for="hol-name">Name</label
          >
          <input
            id="hol-name"
            type="text"
            class="form-field__control"
            placeholder="z.B. Neujahr"
            maxlength="100"
            bind:value={holidayName}
            required
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="hol-date">Datum</label
          >
          <input
            id="hol-date"
            type="date"
            class="form-field__control"
            bind:value={holidayDate}
            required
          />
        </div>

        <div class="form-field">
          <label class="toggle-switch">
            <input
              type="checkbox"
              class="toggle-switch__input"
              bind:checked={holidayRecurring}
            />
            <span class="toggle-switch__slider"></span>
            <span class="toggle-switch__label"> Jaehrlich wiederkehrend </span>
          </label>
          <p class="form-field__hint">
            Wiederkehrende Feiertage werden jedes Jahr am gleichen Tag
            beruecksichtigt (Monat + Tag).
          </p>
        </div>
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={() => {
            holidaysState.closeHolidayForm();
          }}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          class="btn btn-modal"
          disabled={!canSubmit || isSaving}
        >
          <i class="fas fa-save mr-1"></i>
          {holidaysState.editingHoliday !== null ?
            'Aktualisieren'
          : 'Erstellen'}
        </button>
      </div>
    </form>
  </div>
{/if}

<!-- ================================================================
     DELETE CONFIRM MODAL
     ================================================================ -->

{#if holidaysState.showDeleteConfirm && holidaysState.deletingHoliday !== null}
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={() => {
      holidaysState.closeDeleteHoliday();
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') holidaysState.closeDeleteHoliday();
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="ds-modal"
      role="document"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onkeydown={(e) => {
        e.stopPropagation();
      }}
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          <i class="fas fa-exclamation-triangle text-danger mr-2"></i>
          Feiertag loeschen
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schliessen"
          onclick={() => {
            holidaysState.closeDeleteHoliday();
          }}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <p>
          Moechten Sie den Feiertag
          <strong>"{holidaysState.deletingHoliday.name}"</strong>
          ({formatDate(holidaysState.deletingHoliday.holidayDate)}) wirklich
          loeschen?
        </p>
        {#if holidaysState.deletingHoliday.recurring}
          <p
            class="text-warning mt-2"
            style="font-size: 0.875rem;"
          >
            <i class="fas fa-exclamation-circle mr-1"></i>
            Dieser Feiertag ist jährlich wiederkehrend. Er wird in keinem Jahr mehr
            beruecksichtigt.
          </p>
        {/if}
      </div>
      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={() => {
            holidaysState.closeDeleteHoliday();
          }}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="btn btn-danger"
          onclick={() => {
            void handleDelete();
          }}
        >
          <i class="fas fa-trash mr-1"></i>
          Loeschen
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Holiday list items — reuses rules-list pattern with local scoping */
  .holiday-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .holiday-list__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-3) var(--spacing-4);
    border-radius: var(--radius-md);
    background: var(--glass-bg);
    border: 1px solid var(--color-glass-border);
    transition: border-color var(--transition-fast);
  }

  .holiday-list__item:hover {
    border-color: var(--color-primary-400);
  }

  .holiday-list__info {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
    flex: 1;
    min-width: 0;
  }

  .holiday-list__name {
    font-weight: 600;
    font-size: 0.938rem;
    color: var(--text-primary);
  }

  .holiday-list__meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    font-size: 0.813rem;
    color: var(--text-muted);
  }

  .holiday-list__actions {
    display: flex;
    gap: var(--spacing-2);
    flex-shrink: 0;
    margin-left: var(--spacing-3);
  }
</style>

<script lang="ts">
  /**
   * AddDaysModal — Add or subtract vacation days for an employee.
   * Extracted from +page.svelte to stay within max-lines limit.
   */

  interface Props {
    employeeName: string;
    year: number;
    onclose: () => void;
    onsave: (days: number) => Promise<void>;
  }

  const { employeeName, year, onclose, onsave }: Props = $props();

  let addDaysAmount = $state(0);
  let isSaving = $state(false);

  const canAddDays = $derived(addDaysAmount !== 0);

  function handleSubmit() {
    if (isSaving || !canAddDays) return;
    isSaving = true;
    void onsave(addDaysAmount).finally(() => {
      isSaving = false;
    });
  }
</script>

<div
  class="modal-overlay modal-overlay--active"
  role="dialog"
  aria-modal="true"
  tabindex="-1"
  onclick={onclose}
  onkeydown={(e) => {
    if (e.key === 'Escape') onclose();
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
        <i class="fas fa-plus mr-2"></i>
        Urlaubstage hinzufuegen
      </h3>
      <button
        type="button"
        class="ds-modal__close"
        aria-label="Schliessen"
        onclick={onclose}
      >
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="ds-modal__body">
      <p
        class="text-muted mb-4"
        style="font-size: 0.875rem;"
      >
        {employeeName} — {year}
      </p>

      <div class="form-field">
        <label
          class="form-field__label"
          for="add-days"
        >
          Anzahl Tage (negativ zum Abziehen)
        </label>
        <input
          id="add-days"
          type="number"
          class="form-field__input"
          min="-365"
          max="365"
          step="0.5"
          bind:value={addDaysAmount}
          required
        />
        <p class="form-field__hint">
          Positive Zahl = Tage hinzufuegen, negative Zahl = Tage abziehen
        </p>
      </div>
    </div>

    <div class="ds-modal__footer">
      <button
        type="button"
        class="btn btn-cancel"
        onclick={onclose}
      >
        Abbrechen
      </button>
      <button
        type="submit"
        class="btn btn-modal"
        disabled={!canAddDays || isSaving}
      >
        <i class="fas fa-check mr-1"></i>
        Uebernehmen
      </button>
    </div>
  </form>
</div>

<script lang="ts">
  /**
   * Shift-Handover Template — Field-Type Picker Modal.
   *
   * Renders the 8 supported custom-field types (plan §Product Decisions #6) as
   * choice-cards. Selecting a card emits `onSelect(type)` so the parent
   * (`FieldBuilder`) can append a new working field with sensible defaults via
   * `state.addField(type)`.
   *
   * Pure UI: no API calls, no reactive imports — receives type list from
   * `@assixx/shared/shift-handover` so the runtime list stays in sync with the
   * Zod union (R7 mitigation).
   *
   * Modal classes mirror the canonical Session-9 `ShiftHandoverModal.svelte`
   * pattern (`modal-overlay`, `ds-modal`, `ds-modal__*`).
   *
   * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §5.2
   */
  import {
    SHIFT_HANDOVER_FIELD_TYPES,
    type ShiftHandoverFieldType,
  } from '@assixx/shared/shift-handover';

  interface Props {
    onSelect: (type: ShiftHandoverFieldType) => void;
    onClose: () => void;
  }

  const { onSelect, onClose }: Props = $props();

  /** Per-type German UI metadata. Order mirrors `SHIFT_HANDOVER_FIELD_TYPES`. */
  const TYPE_META: Record<ShiftHandoverFieldType, { label: string; hint: string; icon: string }> = {
    text: { label: 'Text', hint: 'Einzeilige Eingabe', icon: 'fa-font' },
    textarea: {
      label: 'Mehrzeiliger Text',
      hint: 'Längere Notiz / Bemerkung',
      icon: 'fa-align-left',
    },
    integer: { label: 'Ganze Zahl', hint: 'z. B. Stückzahl, Anzahl Vorfälle', icon: 'fa-hashtag' },
    decimal: { label: 'Dezimalzahl', hint: 'z. B. Temperatur, Maß', icon: 'fa-calculator' },
    date: { label: 'Datum', hint: 'Tag-genaues Datum (YYYY-MM-DD)', icon: 'fa-calendar-day' },
    time: { label: 'Uhrzeit', hint: 'Stunden:Minuten (HH:MM)', icon: 'fa-clock' },
    boolean: { label: 'Ja / Nein', hint: 'Schalter — wahr oder falsch', icon: 'fa-toggle-on' },
    select: { label: 'Auswahlliste', hint: 'Eine aus mehreren Optionen', icon: 'fa-list-check' },
  };

  function pick(type: ShiftHandoverFieldType): void {
    onSelect(type);
    onClose();
  }

  function handleBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) onClose();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="modal-overlay modal-overlay--active"
  role="dialog"
  aria-modal="true"
  aria-labelledby="field-type-selector-title"
  tabindex="-1"
  onclick={handleBackdrop}
  onkeydown={(e) => {
    if (e.key === 'Escape') onClose();
  }}
>
  <div
    class="ds-modal ds-modal--md"
    role="document"
  >
    <div class="ds-modal__header">
      <h2
        class="ds-modal__title flex items-center gap-3"
        id="field-type-selector-title"
      >
        <i class="fas fa-plus-circle"></i>
        Feldtyp wählen
      </h2>
      <button
        class="ds-modal__close"
        aria-label="Schließen"
        type="button"
        onclick={onClose}
      >
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="ds-modal__body">
      <p class="mb-4 text-sm text-(--color-text-secondary)">
        Wähle den Typ des neuen Feldes. Du kannst Bezeichnung, Schlüssel und Pflicht-Flag im
        nächsten Schritt anpassen.
      </p>
      <div class="type-grid">
        {#each SHIFT_HANDOVER_FIELD_TYPES as type (type)}
          <button
            class="type-card"
            type="button"
            onclick={() => {
              pick(type);
            }}
          >
            <i class="fas {TYPE_META[type].icon} type-card__icon"></i>
            <span class="type-card__label">{TYPE_META[type].label}</span>
            <span class="type-card__hint">{TYPE_META[type].hint}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .type-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  @media (width >= 640px) {
    .type-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  .type-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;

    padding: 1rem;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    background: var(--color-bg-elevated);

    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .type-card:hover {
    border-color: var(--color-primary);
    background: var(--color-bg-hover);
    transform: translateY(-1px);
  }

  .type-card:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .type-card__icon {
    font-size: 1.25rem;
    color: var(--color-primary);
  }

  .type-card__label {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .type-card__hint {
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
    line-height: 1.3;
  }
</style>

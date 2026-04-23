<script lang="ts">
  /**
   * Shift-Handover Template — Field Builder.
   *
   * Renders the working field list with:
   *   - Drag-handle reorder (HTML5 native — no library, desktop-first)
   *   - Inline edit (label / key / required / type / options for select)
   *   - Per-field German validation errors (from `builder.validation.perField`)
   *   - Add via `FieldTypeSelector` modal → `builder.addField(type)`
   *   - Delete via row trash button → `builder.removeField(uid)`
   *
   * Auto-key behaviour: typing the label fills the key only until the user
   * focuses/edits the key field — see `builder.updateLabel` / `builder.updateKey`.
   *
   * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §5.2
   */
  import {
    SHIFT_HANDOVER_FIELD_TYPES,
    type ShiftHandoverFieldType,
  } from '@assixx/shared/shift-handover';

  import FieldTypeSelector from './FieldTypeSelector.svelte';

  import type { TemplateBuilderState } from './state-templates.svelte';

  interface Props {
    builder: TemplateBuilderState;
    disabled?: boolean;
  }

  const { builder, disabled = false }: Props = $props();

  /** German label per type — displayed in the read-only type badge per row. */
  const TYPE_LABEL: Record<ShiftHandoverFieldType, string> = {
    text: 'Text',
    textarea: 'Mehrzeiliger Text',
    integer: 'Ganze Zahl',
    decimal: 'Dezimalzahl',
    date: 'Datum',
    time: 'Uhrzeit',
    boolean: 'Ja / Nein',
    select: 'Auswahlliste',
  };

  let typeSelectorOpen = $state(false);

  // ── Drag-and-drop state ──────────────────────────────────────────────────
  // Native HTML5 DnD: track source + hovered index; commit on drop.
  // Library-free per KISS — see masterplan §5.2 "drag-handle" requirement.
  let dragSourceIdx = $state<number | null>(null);
  let dragHoverIdx = $state<number | null>(null);

  function handleDragStart(event: DragEvent, idx: number): void {
    if (disabled || event.dataTransfer === null) return;
    dragSourceIdx = idx;
    event.dataTransfer.effectAllowed = 'move';
    // Required for Firefox to actually start the drag.
    event.dataTransfer.setData('text/plain', String(idx));
  }

  function handleDragOver(event: DragEvent, idx: number): void {
    if (disabled || dragSourceIdx === null) return;
    event.preventDefault();
    if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move';
    dragHoverIdx = idx;
  }

  function handleDragLeave(idx: number): void {
    if (dragHoverIdx === idx) dragHoverIdx = null;
  }

  function handleDrop(event: DragEvent, targetIdx: number): void {
    event.preventDefault();
    if (dragSourceIdx !== null && dragSourceIdx !== targetIdx) {
      builder.moveField(dragSourceIdx, targetIdx);
    }
    dragSourceIdx = null;
    dragHoverIdx = null;
  }

  function handleDragEnd(): void {
    dragSourceIdx = null;
    dragHoverIdx = null;
  }

  // ── Field-type picker integration ────────────────────────────────────────

  function openTypeSelector(): void {
    if (disabled) return;
    typeSelectorOpen = true;
  }

  function handleTypeSelected(type: ShiftHandoverFieldType): void {
    builder.addField(type);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function errorsFor(uid: string): { key?: string; label?: string; options?: string } {
    return builder.validation.perField.get(uid) ?? {};
  }

  function isAtFieldLimit(): boolean {
    return builder.fields.length >= 30;
  }
</script>

<div class="field-builder">
  <header class="field-builder__header">
    <div>
      <h3 class="text-lg font-semibold">Felder</h3>
      <p class="text-sm text-(--color-text-secondary)">
        {builder.fields.length} von 30 Feldern · zum Sortieren ziehen
      </p>
    </div>
    <button
      class="btn btn-primary"
      type="button"
      disabled={disabled || isAtFieldLimit()}
      onclick={openTypeSelector}
    >
      <i class="fas fa-plus mr-2"></i>
      Feld hinzufügen
    </button>
  </header>

  {#if builder.validation.global !== null}
    <div class="alert alert--danger mt-4">
      <i class="fas fa-exclamation-circle mr-2"></i>{builder.validation.global}
    </div>
  {/if}

  {#if builder.fields.length === 0}
    <!-- Canonical design-system empty-state — matches /inventory, Storybook
         `Design System/Empty States`. Local `.empty-state*` overrides removed. -->
    <div class="empty-state">
      <div class="empty-state__icon">
        <i class="fas fa-clipboard-list"></i>
      </div>
      <h3 class="empty-state__title">Noch keine Felder</h3>
      <p class="empty-state__description">
        Füge das erste Feld hinzu, um die Vorlage für dieses Team zu starten.
      </p>
    </div>
  {:else}
    <ul class="field-list">
      {#each builder.fields as field, idx (field._uid)}
        {@const fieldErrors = errorsFor(field._uid)}
        <li
          class="field-row"
          class:field-row--dragging={dragSourceIdx === idx}
          class:field-row--hover={dragHoverIdx === idx && dragSourceIdx !== idx}
          class:field-row--invalid={Object.keys(fieldErrors).length > 0}
          draggable={!disabled}
          ondragstart={(e) => {
            handleDragStart(e, idx);
          }}
          ondragover={(e) => {
            handleDragOver(e, idx);
          }}
          ondragleave={() => {
            handleDragLeave(idx);
          }}
          ondrop={(e) => {
            handleDrop(e, idx);
          }}
          ondragend={handleDragEnd}
        >
          <div
            class="field-row__handle"
            aria-label="Verschieben"
            title="Ziehen zum Sortieren"
          >
            <i class="fas fa-grip-vertical"></i>
          </div>

          <div class="field-row__body">
            <div class="field-row__grid">
              <!-- Label -->
              <div class="form-field">
                <label
                  class="form-field__label"
                  for="field-{field._uid}-label"
                >
                  Bezeichnung
                </label>
                <input
                  class="form-field__control"
                  class:is-error={fieldErrors.label !== undefined}
                  id="field-{field._uid}-label"
                  type="text"
                  maxlength="100"
                  value={field.label}
                  {disabled}
                  oninput={(e) => {
                    builder.updateLabel(field._uid, e.currentTarget.value);
                  }}
                />
                {#if fieldErrors.label !== undefined}
                  <span class="form-field__message form-field__message--error">
                    {fieldErrors.label}
                  </span>
                {/if}
              </div>

              <!-- Key -->
              <div class="form-field">
                <label
                  class="form-field__label"
                  for="field-{field._uid}-key"
                >
                  Schlüssel
                  {#if !field._keyTouched && field.label !== ''}
                    <span class="text-xs text-(--color-text-tertiary)">(automatisch)</span>
                  {/if}
                </label>
                <input
                  class="form-field__control font-mono text-sm"
                  class:is-error={fieldErrors.key !== undefined}
                  id="field-{field._uid}-key"
                  type="text"
                  maxlength="30"
                  value={field.key}
                  {disabled}
                  oninput={(e) => {
                    builder.updateKey(field._uid, e.currentTarget.value);
                  }}
                />
                {#if fieldErrors.key !== undefined}
                  <span class="form-field__message form-field__message--error">
                    {fieldErrors.key}
                  </span>
                {/if}
              </div>

              <!-- Type -->
              <div class="form-field">
                <label
                  class="form-field__label"
                  for="field-{field._uid}-type"
                >
                  Typ
                </label>
                <select
                  class="form-field__control"
                  id="field-{field._uid}-type"
                  value={field.type}
                  {disabled}
                  onchange={(e) => {
                    builder.updateType(field._uid, e.currentTarget.value as ShiftHandoverFieldType);
                  }}
                >
                  {#each SHIFT_HANDOVER_FIELD_TYPES as type (type)}
                    <option value={type}>{TYPE_LABEL[type]}</option>
                  {/each}
                </select>
              </div>

              <!-- Required — canonical design-system toggle-switch, Storybook
                   `Design System/Toggle Switch` (input.toggle-switch__input +
                   span.toggle-switch__label). -->
              <div class="form-field">
                <span class="form-field__label">Pflichtfeld</span>
                <label class="toggle-switch">
                  <input
                    type="checkbox"
                    class="toggle-switch__input"
                    checked={field.required}
                    {disabled}
                    onchange={(e) => {
                      builder.updateRequired(field._uid, e.currentTarget.checked);
                    }}
                  />
                  <span class="toggle-switch__slider"></span>
                  <span class="toggle-switch__label">{field.required ? 'Ja' : 'Nein'}</span>
                </label>
              </div>
            </div>

            <!-- Select options editor (inlined; was a {#snippet} but the
                 typescript-eslint void-expression rule cannot model
                 {@render snippet(...)} cleanly — KISS: just inline). -->
            {#if field.type === 'select'}
              <div class="options-block">
                <div class="options-block__header">
                  <span class="text-sm font-medium">Optionen</span>
                  <button
                    class="btn btn-secondary btn-sm"
                    type="button"
                    {disabled}
                    onclick={() => {
                      builder.addOption(field._uid);
                    }}
                  >
                    <i class="fas fa-plus mr-1"></i>Option
                  </button>
                </div>
                {#if fieldErrors.options !== undefined}
                  <span class="form-field__message form-field__message--error mb-2">
                    {fieldErrors.options}
                  </span>
                {/if}
                <ul class="options-list">
                  {#each field.options as opt, optIdx (optIdx)}
                    <li class="options-list__row">
                      <input
                        class="form-field__control font-mono text-sm"
                        type="text"
                        placeholder="Wert (z. B. ok)"
                        maxlength="100"
                        value={opt.value}
                        {disabled}
                        oninput={(e) => {
                          builder.updateOption(field._uid, optIdx, {
                            value: e.currentTarget.value,
                          });
                        }}
                      />
                      <input
                        class="form-field__control"
                        type="text"
                        placeholder="Anzeigetext"
                        maxlength="100"
                        value={opt.label}
                        {disabled}
                        oninput={(e) => {
                          builder.updateOption(field._uid, optIdx, {
                            label: e.currentTarget.value,
                          });
                        }}
                      />
                      <button
                        class="options-list__delete"
                        type="button"
                        aria-label="Option entfernen"
                        {disabled}
                        onclick={() => {
                          builder.removeOption(field._uid, optIdx);
                        }}
                      >
                        <i class="fas fa-times"></i>
                      </button>
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
          </div>

          <button
            class="field-row__delete"
            type="button"
            aria-label="Feld entfernen"
            title="Feld entfernen"
            {disabled}
            onclick={() => {
              builder.removeField(field._uid);
            }}
          >
            <i class="fas fa-trash-alt"></i>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#if typeSelectorOpen}
  <FieldTypeSelector
    onSelect={handleTypeSelected}
    onClose={() => (typeSelectorOpen = false)}
  />
{/if}

<style>
  .field-builder {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field-builder__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  /*
   * Local .empty-state* rules removed — design-system globals (Storybook
   * `Design System/Empty States`) own the visual treatment. Drift-check:
   * grep for `.empty-state` in this file should return 0 matches.
   */

  .field-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .field-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.75rem;
    align-items: stretch;

    padding: 1rem;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    background: var(--color-bg-elevated);
    transition:
      transform 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .field-row--invalid {
    border-color: var(--color-danger);
  }

  .field-row--dragging {
    opacity: 50%;
  }

  .field-row--hover {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-soft, rgb(33 150 243 / 20%));
  }

  .field-row__handle {
    display: flex;
    align-items: center;
    justify-content: center;

    width: 1.75rem;
    color: var(--color-text-tertiary);
    cursor: grab;
  }

  .field-row__handle:active {
    cursor: grabbing;
  }

  .field-row__body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .field-row__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  @media (width >= 768px) {
    .field-row__grid {
      grid-template-columns: 2fr 2fr 1.5fr 1fr;
    }
  }

  .field-row__delete {
    display: flex;
    align-items: flex-start;
    justify-content: center;

    padding: 0.5rem;
    border: 0;
    border-radius: 0.375rem;
    background: transparent;

    color: var(--color-danger);
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .field-row__delete:hover:not(:disabled) {
    background: var(--color-danger-soft, rgb(244 67 54 / 10%));
  }

  .field-row__delete:disabled {
    opacity: 40%;
    cursor: not-allowed;
  }

  .options-block {
    padding: 0.75rem;
    border: 1px dashed var(--color-border);
    border-radius: 0.375rem;
    background: var(--color-bg-subtle, transparent);
  }

  .options-block__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .options-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .options-list__row {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 0.5rem;
    align-items: center;
  }

  .options-list__delete {
    padding: 0.375rem 0.5rem;
    border: 0;
    border-radius: 0.25rem;
    background: transparent;

    color: var(--color-danger);
    cursor: pointer;
  }

  .options-list__delete:hover:not(:disabled) {
    background: var(--color-danger-soft, rgb(244 67 54 / 10%));
  }
</style>

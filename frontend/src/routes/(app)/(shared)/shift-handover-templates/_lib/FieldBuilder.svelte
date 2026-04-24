<script lang="ts">
  /**
   * Shift-Handover Template — Field Builder.
   *
   * Renders the working field list with:
   *   - Drag-handle reorder (HTML5 native — no library, desktop-first)
   *   - Inline edit (label / required / type / options for select)
   *   - Per-field German validation errors (from `builder.validation.perField`)
   *   - Add via `FieldTypeSelector` modal → `builder.addField(type)`
   *   - Delete via row trash button → `builder.removeField(uid)`
   *
   * Auto-key behaviour (Session 19): the DB-column identifier (`key`) is fully
   * auto-derived from the label and no longer user-editable. `deriveUniqueKey`
   * in `state-templates` handles label→slug + duplicate disambiguation +
   * `'feld'` fallback for pathological labels. Legacy fields load with
   * `_keyTouched=true` so their manual keys stay canonical.
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

  /**
   * German label per type. Session 20 (2026-04-24): `integer` and `decimal`
   * both map to "Zahl" — end-users don't differentiate. Legacy fields loaded
   * with `type: 'integer'` therefore display "Zahl" in the dropdown trigger
   * without needing separate UI logic. Wire contract unchanged — only the
   * label collapses. See `FieldTypeSelector.svelte` + masterplan §Session 20.
   */
  const TYPE_LABEL: Record<ShiftHandoverFieldType, string> = {
    text: 'Text',
    textarea: 'Mehrzeiliger Text',
    integer: 'Zahl', // legacy alias — shown identically to `decimal`
    decimal: 'Zahl',
    date: 'Datum',
    time: 'Uhrzeit',
    boolean: 'Ja / Nein',
    select: 'Auswahlliste',
  };

  /**
   * Types offered in the type-change dropdown for existing fields.
   * Excludes `integer` (Session 20) so users cannot create NEW integer fields.
   * Legacy fields already typed as `integer` keep their type via the no-op
   * guard in the dropdown onclick below — switching "Zahl → Zahl" is literally
   * a no-op and doesn't mark the template dirty.
   */
  type UiFieldType = Exclude<ShiftHandoverFieldType, 'integer'>;
  const UI_FIELD_TYPES: readonly UiFieldType[] = SHIFT_HANDOVER_FIELD_TYPES.filter(
    (t): t is UiFieldType => t !== 'integer',
  );

  let typeSelectorOpen = $state(false);

  // ── Type-dropdown open-state (Session 19) ────────────────────────────────
  // Only one type-dropdown is open at a time across all rows — opening a new
  // one implicitly closes the previous. Click-outside handler below closes
  // whichever is currently open. Using a single UID (not a Set) because the
  // design-system `.dropdown` pattern assumes single-instance open semantics
  // (see /shift-handover-templates team filter + logs/_lib/FilterDropdown).
  let openTypeDropdownUid = $state<string | null>(null);

  $effect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (openTypeDropdownUid === null) return;
      const container = document.querySelector(`[data-type-dropdown="${openTypeDropdownUid}"]`);
      if (container !== null && !container.contains(event.target as Node)) {
        openTypeDropdownUid = null;
      }
    }
    document.addEventListener('click', handleClickOutside, true);
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  });

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
    <!-- Session 19: btn-secondary instead of btn-primary — the primary CTA
         on the page is "Speichern" in the card footer; an add-more-rows
         action is a secondary/auxiliary affordance. -->
    <button
      class="btn btn-secondary"
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

              <!-- Key (Schlüssel) input intentionally removed in Session 19.
                   End-users were confused by a column-identifier control that
                   has no mental model outside DBA work. The key is now fully
                   auto-derived from the label via `deriveUniqueKey()` in
                   state-templates (label→slug + duplicate disambiguation +
                   `'feld'` fallback for pathological labels). Legacy manual
                   keys are preserved because `inflateField` sets
                   `_keyTouched=true` on load, and `markSaved` freezes keys
                   after first save — schema_snapshot contract (R2) intact.
                   See FEAT_SHIFT_HANDOVER_MASTERPLAN.md §Session 19. -->

              <!-- Type — canonical design-system custom dropdown
                   (Session 19, parity with the team-filter dropdown on the
                   page). Native `<select>` replaced to match the glassmorphism
                   aesthetic used throughout the app. Click-outside + open-UID
                   state live in the <script> block. -->
              <div class="form-field">
                <span
                  class="form-field__label"
                  id="field-{field._uid}-type-label"
                >
                  Typ
                </span>
                <div
                  class="dropdown"
                  data-type-dropdown={field._uid}
                >
                  <button
                    type="button"
                    class="dropdown__trigger"
                    class:active={openTypeDropdownUid === field._uid}
                    aria-labelledby="field-{field._uid}-type-label"
                    aria-expanded={openTypeDropdownUid === field._uid}
                    {disabled}
                    onclick={() => {
                      openTypeDropdownUid = openTypeDropdownUid === field._uid ? null : field._uid;
                    }}
                  >
                    <span>{TYPE_LABEL[field.type]}</span>
                    <i
                      class="fas fa-chevron-down"
                      aria-hidden="true"
                    ></i>
                  </button>
                  <div
                    class="dropdown__menu"
                    class:active={openTypeDropdownUid === field._uid}
                    role="listbox"
                    aria-labelledby="field-{field._uid}-type-label"
                  >
                    {#each UI_FIELD_TYPES as type (type)}
                      {@const isCurrentNumber =
                        type === 'decimal' &&
                        (field.type === 'integer' || field.type === 'decimal')}
                      <button
                        type="button"
                        class="dropdown__option"
                        class:selected={field.type === type || isCurrentNumber}
                        role="option"
                        aria-selected={field.type === type || isCurrentNumber}
                        onclick={() => {
                          // Session 20: selecting "Zahl" when the field is already
                          // integer or decimal is a no-op — prevents surprise
                          // dirty-flag for legacy `integer` templates (same class
                          // of bug Session 19 fixed). For any other source type,
                          // convert to `decimal` (the new unified "Zahl").
                          if (isCurrentNumber) {
                            openTypeDropdownUid = null;
                            return;
                          }
                          builder.updateType(field._uid, type);
                          openTypeDropdownUid = null;
                        }}
                      >
                        {TYPE_LABEL[type]}
                      </button>
                    {/each}
                  </div>
                </div>
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

          <!-- Session 19: canonical design-system action-icon (see
               manage-admins AdminTableRow), defined in
               design-system/primitives/buttons/button.action-icons.css.
               `self-start` pins the icon to the top of the tall grid cell
               since `.field-row` stretches its tracks. -->
          <button
            class="action-icon action-icon--delete self-start"
            type="button"
            aria-label="Feld entfernen"
            title="Feld entfernen"
            {disabled}
            onclick={() => {
              builder.removeField(field._uid);
            }}
          >
            <i class="fas fa-trash"></i>
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
      /* Session 19: 3-column layout (Bezeichnung | Typ | Pflichtfeld) after
         removing the Schlüssel input. Label gets the widest track because
         it is the only free-text control left. */
      grid-template-columns: 3fr 1.5fr 1fr;
    }
  }

  /* .field-row__delete* rules removed in Session 19 — the delete button now
     uses the canonical design-system `.action-icon .action-icon--delete`
     classes (see manage-admins AdminTableRow + button.action-icons.css).
     Grep-check: `.field-row__delete` should match zero rules in this file. */

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

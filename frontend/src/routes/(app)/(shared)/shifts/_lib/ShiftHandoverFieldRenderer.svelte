<!--
  ShiftHandoverFieldRenderer — one component, switch on `field.type`.

  Renders a single custom template field into an input control suitable for
  the handover modal. Covers all 8 types from the shared registry (Plan
  §Product Decisions #6): text, textarea, integer, decimal, date, time,
  boolean, select.

  Contract:
   - `field`: shared-validated `ShiftHandoverFieldDef` — `type` discriminates
     the control; `required` drives the red-asterisk label; for `select`
     the `options[]` array lists the dropdown choices.
   - `value`: current stored value for this field (bound out via `onchange`).
   - `disabled`: forces read-only rendering (submitted entries + non-editors).
   - Parent owns state — renderer is purely presentational (`$props`-only,
     no `$state`). Values round-trip through `onchange(newValue)` so the
     modal can collect them into `custom_values` for PATCH/submit.

  Validation strategy: the renderer enforces only HTML5 input constraints
  (required, min/max). The authoritative validator lives in
  `@assixx/shared/shift-handover#buildEntryValuesSchema` and runs on the
  backend via the UPDATE DTO. Pre-submit UI nagging is a V2 polish, not a
  correctness gate.

  @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §5.1
  @see shared/src/shift-handover/field-types.ts
-->
<script lang="ts">
  import type { ShiftHandoverFieldDef } from '@assixx/shared/shift-handover';

  interface Props {
    field: ShiftHandoverFieldDef;
    value: unknown;
    disabled: boolean;
    onchange: (newValue: unknown) => void;
  }

  const { field, value, disabled, onchange }: Props = $props();

  // Each branch reads `value` defensively — an entry drafted against an
  // older template may carry a string where the current template expects
  // a number. We coerce per-render; the shared validator is the source of
  // truth and will reject on submit if coercion is genuinely impossible.
  const textValue = $derived(typeof value === 'string' ? value : '');
  const numberValue = $derived(typeof value === 'number' ? String(value) : textValue);
  const boolValue = $derived(value === true);

  function handleText(event: Event): void {
    onchange((event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value);
  }

  // Empty/cleared inputs emit `undefined` (NOT `null`). Backend Zod's
  // `z.number().optional()` accepts undefined but rejects null — sending
  // null produces a 400 even on draft saves. The page's
  // `handleFieldChange` strips keys whose value is undefined, so the wire
  // payload omits the field entirely. Session 23 finding 2026-04-25.
  function handleInteger(event: Event): void {
    const raw = (event.currentTarget as HTMLInputElement).value;
    if (raw === '') {
      onchange(undefined);
      return;
    }
    const parsed = Number.parseInt(raw, 10);
    onchange(Number.isNaN(parsed) ? undefined : parsed);
  }

  function handleDecimal(event: Event): void {
    const raw = (event.currentTarget as HTMLInputElement).value;
    if (raw === '') {
      onchange(undefined);
      return;
    }
    const parsed = Number.parseFloat(raw);
    onchange(Number.isNaN(parsed) ? undefined : parsed);
  }

  function handleBoolean(event: Event): void {
    onchange((event.currentTarget as HTMLInputElement).checked);
  }

  function handleSelect(event: Event): void {
    const raw = (event.currentTarget as HTMLSelectElement).value;
    onchange(raw === '' ? undefined : raw);
  }
</script>

<div class="form-field">
  <label
    class="form-field__label"
    class:form-field__label--required={field.required}
    for={`sh-field-${field.key}`}
  >
    {field.label}
  </label>

  {#if field.type === 'text'}
    <input
      id={`sh-field-${field.key}`}
      type="text"
      class="form-field__control"
      value={textValue}
      required={field.required}
      {disabled}
      oninput={handleText}
    />
  {:else if field.type === 'textarea'}
    <textarea
      id={`sh-field-${field.key}`}
      class="form-field__control"
      rows="3"
      required={field.required}
      {disabled}
      value={textValue}
      oninput={handleText}
    ></textarea>
  {:else if field.type === 'integer'}
    <input
      id={`sh-field-${field.key}`}
      type="number"
      step="1"
      class="form-field__control"
      value={numberValue}
      required={field.required}
      {disabled}
      oninput={handleInteger}
    />
  {:else if field.type === 'decimal'}
    <input
      id={`sh-field-${field.key}`}
      type="number"
      step="0.01"
      class="form-field__control"
      value={numberValue}
      required={field.required}
      {disabled}
      oninput={handleDecimal}
    />
  {:else if field.type === 'date'}
    <input
      id={`sh-field-${field.key}`}
      type="date"
      class="form-field__control"
      value={textValue}
      required={field.required}
      {disabled}
      oninput={handleText}
    />
  {:else if field.type === 'time'}
    <input
      id={`sh-field-${field.key}`}
      type="time"
      class="form-field__control"
      value={textValue}
      required={field.required}
      {disabled}
      oninput={handleText}
    />
  {:else if field.type === 'boolean'}
    <!-- Canonical design-system toggle-switch — Storybook `Design System/
         Toggle Switch` (input.toggle-switch__input + span.toggle-switch__label).
         Local CSS block removed; design-system globals own the visual. -->
    <label class="toggle-switch">
      <input
        id={`sh-field-${field.key}`}
        type="checkbox"
        class="toggle-switch__input"
        checked={boolValue}
        {disabled}
        onchange={handleBoolean}
      />
      <span class="toggle-switch__slider"></span>
      <span class="toggle-switch__label">{boolValue ? 'Ja' : 'Nein'}</span>
    </label>
  {:else if field.type === 'select'}
    <select
      id={`sh-field-${field.key}`}
      class="form-field__control"
      value={textValue}
      required={field.required}
      {disabled}
      onchange={handleSelect}
    >
      <option value="">– bitte wählen –</option>
      {#each field.options as opt (opt.value)}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
  {/if}
</div>

<!--
  No local <style> block — `.toggle-switch*` lives in the design-system
  globals (Storybook `Design System/Toggle Switch`, see
  frontend/src/design-system/primitives/toggles/toggle-switch.css).
-->

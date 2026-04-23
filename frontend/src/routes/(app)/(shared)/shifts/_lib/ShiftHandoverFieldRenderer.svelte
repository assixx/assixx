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

  function handleInteger(event: Event): void {
    const raw = (event.currentTarget as HTMLInputElement).value;
    if (raw === '') {
      onchange(null);
      return;
    }
    const parsed = Number.parseInt(raw, 10);
    onchange(Number.isNaN(parsed) ? null : parsed);
  }

  function handleDecimal(event: Event): void {
    const raw = (event.currentTarget as HTMLInputElement).value;
    if (raw === '') {
      onchange(null);
      return;
    }
    const parsed = Number.parseFloat(raw);
    onchange(Number.isNaN(parsed) ? null : parsed);
  }

  function handleBoolean(event: Event): void {
    onchange((event.currentTarget as HTMLInputElement).checked);
  }

  function handleSelect(event: Event): void {
    const raw = (event.currentTarget as HTMLSelectElement).value;
    onchange(raw === '' ? null : raw);
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
    <label class="toggle-switch">
      <input
        id={`sh-field-${field.key}`}
        type="checkbox"
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

<style>
  .toggle-switch {
    display: inline-flex;
    gap: var(--spacing-3);
    align-items: center;
    cursor: pointer;
  }

  .toggle-switch input {
    position: absolute;
    opacity: 0%;
    width: 0;
    height: 0;
  }

  .toggle-switch__slider {
    display: inline-block;
    position: relative;
    transition: background 150ms ease;
    border-radius: 999px;

    background: var(--glass-bg-hover);

    width: 44px;
    height: 24px;
  }

  .toggle-switch__slider::after {
    position: absolute;
    top: 3px;
    left: 3px;

    transition: transform 150ms ease;
    border-radius: 50%;
    background: var(--text-primary);

    width: 18px;
    height: 18px;
    content: '';
  }

  .toggle-switch input:checked + .toggle-switch__slider {
    background: color-mix(in oklch, var(--color-primary) 55%, transparent);
  }

  .toggle-switch input:checked + .toggle-switch__slider::after {
    transform: translateX(20px);
  }

  .toggle-switch input:disabled + .toggle-switch__slider {
    opacity: 50%;
    cursor: not-allowed;
  }

  .toggle-switch__label {
    color: var(--text-secondary);
    font-size: 13px;
  }
</style>

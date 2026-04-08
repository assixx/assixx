<script lang="ts">
  /**
   * ItemEditModal — Edit inventory item with standard + custom fields
   *
   * Renders all standard item fields and dynamic custom fields
   * based on the list's field definitions.
   */
  import { onClickOutsideDropdown } from '$lib/actions/click-outside';

  import { ITEM_STATUS_LABELS } from './constants';

  import type {
    CustomValueInput,
    CustomValueWithField,
    InventoryCustomField,
    InventoryItem,
    InventoryItemStatus,
    UpdateItemPayload,
  } from './types';

  interface Props {
    item: InventoryItem;
    fields: InventoryCustomField[];
    customValues: CustomValueWithField[];
    submitting: boolean;
    onclose: () => void;
    onsubmit: (payload: UpdateItemPayload) => void;
  }

  const { item, fields, customValues, submitting, onclose, onsubmit }: Props = $props();

  // ── Standard Fields ──────────────────────────────────────────
  // Edit form snapshots initial prop values — intentional one-time capture, not reactive
  // svelte-ignore state_referenced_locally
  const initialItem = { ...item };
  let name = $state(initialItem.name);
  let description = $state(initialItem.description ?? '');
  let status = $state<InventoryItemStatus>(initialItem.status);
  let location = $state(initialItem.location ?? '');
  let manufacturer = $state(initialItem.manufacturer ?? '');
  let model = $state(initialItem.model ?? '');
  let serialNumber = $state(initialItem.serial_number ?? '');
  let yearOfManufacture = $state(initialItem.year_of_manufacture?.toString() ?? '');
  let notes = $state(initialItem.notes ?? '');

  // ── Custom Fields State ──────────────────────────────────────
  interface FieldState {
    fieldId: string;
    fieldName: string;
    fieldType: string;
    fieldUnit: string | null;
    fieldOptions: string[] | null;
    isRequired: boolean;
    valueText: string;
    valueNumber: string;
    valueDate: string;
    valueBoolean: boolean;
  }

  // svelte-ignore state_referenced_locally
  const initialFields = [...fields];
  // svelte-ignore state_referenced_locally
  const initialCustomValues = [...customValues];
  const fieldStates = $state<FieldState[]>(
    initialFields.map((f: InventoryCustomField) => {
      const cv = initialCustomValues.find((v: CustomValueWithField) => v.fieldId === f.id);
      return {
        fieldId: f.id,
        fieldName: f.fieldName,
        fieldType: f.fieldType,
        fieldUnit: f.fieldUnit,
        fieldOptions: f.fieldOptions,
        isRequired: f.isRequired,
        valueText: cv?.valueText ?? '',
        valueNumber: cv?.valueNumber?.toString() ?? '',
        valueDate: cv?.valueDate ?? '',
        valueBoolean: cv?.valueBoolean ?? false,
      };
    }),
  );

  const isValid = $derived(name.trim().length > 0);

  // Dropdown state (KVP-style — single source of truth for all dropdowns)
  let activeDropdown = $state<string | null>(null);

  function toggleDropdown(id: string): void {
    activeDropdown = activeDropdown === id ? null : id;
  }

  function closeAllDropdowns(): void {
    activeDropdown = null;
  }

  const statusLabel = $derived(ITEM_STATUS_LABELS[status]);

  $effect(() => onClickOutsideDropdown(closeAllDropdowns));

  function collectCustomValues(states: FieldState[]): CustomValueInput[] {
    const inputs: CustomValueInput[] = [];
    for (const fs of states) {
      const input = buildCustomValueInput(fs);
      if (input !== null) inputs.push(input);
    }
    return inputs;
  }

  const FIELD_TYPE_EXTRACTORS: Record<
    string,
    (fs: FieldState) => Partial<CustomValueInput> | null
  > = {
    text: (fs: FieldState) =>
      fs.valueText.trim() !== '' ? { valueText: fs.valueText.trim() } : null,
    select: (fs: FieldState) =>
      fs.valueText.trim() !== '' ? { valueText: fs.valueText.trim() } : null,
    number: (fs: FieldState) =>
      fs.valueNumber.trim() !== '' ? { valueNumber: Number(fs.valueNumber) } : null,
    date: (fs: FieldState) => (fs.valueDate !== '' ? { valueDate: fs.valueDate } : null),
    boolean: (fs: FieldState) => ({ valueBoolean: fs.valueBoolean }),
  };

  function buildCustomValueInput(fs: FieldState): CustomValueInput | null {
    const extractor = FIELD_TYPE_EXTRACTORS[fs.fieldType] as
      | ((s: FieldState) => Partial<CustomValueInput> | null)
      | undefined;
    if (extractor === undefined) return null;
    const extracted = extractor(fs);
    return extracted !== null ? { fieldId: fs.fieldId, ...extracted } : null;
  }

  /** Compare form value with item value, return undefined if unchanged */
  function diffStr(formVal: string, itemVal: string | null): string | null | undefined {
    const trimmed = formVal.trim();
    return trimmed === (itemVal ?? '') ? undefined : trimmed || null;
  }

  function diffNullableFields(): Partial<UpdateItemPayload> {
    const diffs: Partial<UpdateItemPayload> = {};
    const pairs: [keyof UpdateItemPayload, string, string | null][] = [
      ['description', description, item.description],
      ['location', location, item.location],
      ['manufacturer', manufacturer, item.manufacturer],
      ['model', model, item.model],
      ['serialNumber', serialNumber, item.serial_number],
      ['notes', notes, item.notes],
    ];
    for (const [key, formVal, itemVal] of pairs) {
      const d = diffStr(formVal, itemVal);
      if (d !== undefined) (diffs as Record<string, unknown>)[key] = d;
    }
    return diffs;
  }

  function buildPayload(): UpdateItemPayload {
    const payload: UpdateItemPayload = { ...diffNullableFields() };

    if (name.trim() !== item.name) payload.name = name.trim();
    if (status !== item.status) payload.status = status;

    const yearNum = yearOfManufacture.trim() !== '' ? Number(yearOfManufacture) : null;
    if (yearNum !== item.year_of_manufacture) payload.yearOfManufacture = yearNum;

    const cvInputs = collectCustomValues(fieldStates);
    if (cvInputs.length > 0) payload.customValues = cvInputs;

    return payload;
  }

  function handleSubmit(e: Event): void {
    e.preventDefault();
    if (!isValid) return;
    onsubmit(buildPayload());
  }
</script>

<div
  class="modal-overlay modal-overlay--active"
  role="dialog"
  aria-modal="true"
  aria-labelledby="item-edit-modal-title"
  tabindex="-1"
>
  <form
    class="ds-modal ds-modal--lg"
    onsubmit={handleSubmit}
  >
    <div class="ds-modal__header">
      <h3
        class="ds-modal__title"
        id="item-edit-modal-title"
      >
        Gegenstand bearbeiten
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
      <!-- Standard Fields -->
      <div class="grid gap-4">
        <div class="form-field">
          <label
            class="form-field__label"
            for="edit-name">Name *</label
          >
          <input
            id="edit-name"
            type="text"
            class="form-field__control"
            bind:value={name}
            required
            maxlength="255"
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="edit-desc">Beschreibung</label
          >
          <textarea
            id="edit-desc"
            class="form-field__control"
            rows="2"
            bind:value={description}
          ></textarea>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="form-field">
            <span class="form-field__label">Status</span>
            <div class="dropdown">
              <button
                type="button"
                class="dropdown__trigger"
                class:active={activeDropdown === 'status'}
                onclick={() => {
                  toggleDropdown('status');
                }}
              >
                <span>{statusLabel}</span>
                <i class="fas fa-chevron-down"></i>
              </button>
              <div
                class="dropdown__menu"
                class:active={activeDropdown === 'status'}
              >
                {#each Object.entries(ITEM_STATUS_LABELS) as [value, label] (value)}
                  <button
                    type="button"
                    class="dropdown__option"
                    class:dropdown__option--selected={status === value}
                    onclick={() => {
                      status = value as InventoryItemStatus;
                      closeAllDropdowns();
                    }}
                  >
                    {label}
                  </button>
                {/each}
              </div>
            </div>
          </div>
          <div class="form-field">
            <label
              class="form-field__label"
              for="edit-location">Standort</label
            >
            <input
              id="edit-location"
              type="text"
              class="form-field__control"
              bind:value={location}
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="form-field">
            <label
              class="form-field__label"
              for="edit-manufacturer">Hersteller</label
            >
            <input
              id="edit-manufacturer"
              type="text"
              class="form-field__control"
              bind:value={manufacturer}
            />
          </div>
          <div class="form-field">
            <label
              class="form-field__label"
              for="edit-model">Modell</label
            >
            <input
              id="edit-model"
              type="text"
              class="form-field__control"
              bind:value={model}
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="form-field">
            <label
              class="form-field__label"
              for="edit-serial">Seriennummer</label
            >
            <input
              id="edit-serial"
              type="text"
              class="form-field__control"
              bind:value={serialNumber}
            />
          </div>
          <div class="form-field">
            <label
              class="form-field__label"
              for="edit-year">Baujahr</label
            >
            <input
              id="edit-year"
              type="number"
              class="form-field__control"
              min="1900"
              max="2100"
              bind:value={yearOfManufacture}
            />
          </div>
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="edit-notes">Notizen</label
          >
          <textarea
            id="edit-notes"
            class="form-field__control"
            rows="2"
            bind:value={notes}
          ></textarea>
        </div>
      </div>

      <!-- Custom Fields -->
      {#if fieldStates.length > 0}
        <div class="mt-6 border-t border-[var(--color-border,rgb(255_255_255/10%))] pt-4">
          <h4 class="mb-3 text-sm font-semibold text-[var(--color-text-secondary)]">
            <i class="fas fa-sliders-h mr-1"></i> Custom Fields
          </h4>
          <div class="grid gap-4">
            {#each fieldStates as fs, idx (fs.fieldId)}
              <div class="form-field">
                <label
                  class="form-field__label"
                  for="cf-{fs.fieldId}"
                >
                  {fs.fieldName}
                  {#if fs.fieldUnit}<span class="text-xs font-normal">({fs.fieldUnit})</span>{/if}
                  {#if fs.isRequired}<span class="text-[var(--color-danger)]">*</span>{/if}
                </label>

                {#if fs.fieldType === 'text'}
                  <input
                    id="cf-{fs.fieldId}"
                    type="text"
                    class="form-field__control"
                    bind:value={fieldStates[idx].valueText}
                    required={fs.isRequired}
                  />
                {:else if fs.fieldType === 'number'}
                  <input
                    id="cf-{fs.fieldId}"
                    type="number"
                    class="form-field__control"
                    step="any"
                    bind:value={fieldStates[idx].valueNumber}
                    required={fs.isRequired}
                  />
                {:else if fs.fieldType === 'date'}
                  <input
                    id="cf-{fs.fieldId}"
                    type="date"
                    class="form-field__control"
                    bind:value={fieldStates[idx].valueDate}
                    required={fs.isRequired}
                  />
                {:else if fs.fieldType === 'boolean'}
                  <label class="flex cursor-pointer items-center gap-2">
                    <input
                      id="cf-{fs.fieldId}"
                      type="checkbox"
                      bind:checked={fieldStates[idx].valueBoolean}
                    />
                    <span class="text-sm">{fs.fieldName}</span>
                  </label>
                {:else if fs.fieldType === 'select' && fs.fieldOptions}
                  <div class="dropdown">
                    <button
                      type="button"
                      class="dropdown__trigger"
                      class:active={activeDropdown === `cf-${fs.fieldId}`}
                      onclick={() => {
                        toggleDropdown(`cf-${fs.fieldId}`);
                      }}
                    >
                      <span
                        >{fieldStates[idx].valueText !== '' ?
                          fieldStates[idx].valueText
                        : '-- Auswählen --'}</span
                      >
                      <i class="fas fa-chevron-down"></i>
                    </button>
                    <div
                      class="dropdown__menu"
                      class:active={activeDropdown === `cf-${fs.fieldId}`}
                    >
                      <button
                        type="button"
                        class="dropdown__option"
                        class:dropdown__option--selected={fieldStates[idx].valueText === ''}
                        onclick={() => {
                          fieldStates[idx].valueText = '';
                          closeAllDropdowns();
                        }}
                      >
                        -- Auswählen --
                      </button>
                      {#each fs.fieldOptions as opt (opt)}
                        <button
                          type="button"
                          class="dropdown__option"
                          class:dropdown__option--selected={fieldStates[idx].valueText === opt}
                          onclick={() => {
                            fieldStates[idx].valueText = opt;
                            closeAllDropdowns();
                          }}
                        >
                          {opt}
                        </button>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <div class="ds-modal__footer">
      <button
        type="button"
        class="btn btn-cancel"
        onclick={onclose}>Abbrechen</button
      >
      <button
        type="submit"
        class="btn btn-secondary"
        disabled={submitting || !isValid}
      >
        {#if submitting}
          <span class="spinner-ring spinner-ring--sm mr-2"></span>
        {/if}
        Speichern
      </button>
    </div>
  </form>
</div>

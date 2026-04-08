<script lang="ts">
  /**
   * Inventory Items Table - Page Component
   * @module inventory/lists/[id]/+page
   *
   * Table view of all items in an inventory list.
   * Supports filtering, item creation with custom fields, and navigation to item detail.
   */
  import { SvelteURLSearchParams } from 'svelte/reactivity';

  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/state';

  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { showErrorAlert, showSuccessAlert } from '$lib/stores/toast';
  import { getApiClient } from '$lib/utils/api-client';
  import { createLogger } from '$lib/utils/logger';

  import {
    API_ENDPOINTS,
    ITEM_STATUS_BADGE_CLASSES,
    ITEM_STATUS_LABELS,
  } from '../../_lib/constants';

  import type { PageData } from './$types';
  import type {
    CustomValueInput,
    CustomValueWithField,
    InventoryCustomField,
    InventoryItemStatus,
  } from '../../_lib/types';

  const log = createLogger('InventoryItemsPage');
  const apiClient = getApiClient();

  const { data }: { data: PageData } = $props();

  const list = $derived(data.list);
  const items = $derived(data.items);
  const fields = $derived(data.fields);
  const total = $derived(data.total);
  const customValuesByItem = $derived(data.customValuesByItem);

  // ── UI State ──────────────────────────────────────────────────

  let showCreateModal = $state(false);
  let creating = $state(false);
  let formName = $state('');
  let formDescription = $state('');
  let formStatus = $state<InventoryItemStatus>('operational');
  let formLocation = $state('');
  let formManufacturer = $state('');
  let formModel = $state('');
  let formSerialNumber = $state('');
  let formYearOfManufacture = $state('');
  let formNotes = $state('');
  let filterStatus = $state<InventoryItemStatus | ''>('');
  let searchQuery = $state('');

  // Custom field values for create form
  interface CreateFieldState {
    fieldId: string;
    fieldType: string;
    valueText: string;
    valueNumber: string;
    valueDate: string;
    valueBoolean: boolean;
  }

  let createFieldStates = $state<CreateFieldState[]>([]);

  // Dropdown state (KVP-style — single source of truth for create-modal dropdowns)
  let activeDropdown = $state<string | null>(null);

  function toggleDropdown(id: string): void {
    activeDropdown = activeDropdown === id ? null : id;
  }

  function closeAllDropdowns(): void {
    activeDropdown = null;
  }

  const formStatusLabel = $derived(ITEM_STATUS_LABELS[formStatus]);

  $effect(() => onClickOutsideDropdown(closeAllDropdowns));

  const totalPages = $derived(Math.max(1, Math.ceil(total / 50)));
  const currentPage = $derived(data.currentPage);
  const codeExample = $derived(
    list !== null ?
      `${list.codePrefix}${list.codeSeparator}${'0'.repeat(list.codeDigits).slice(0, -1)}1`
    : '',
  );

  // ── Helpers ───────────────────────────────────────────────────

  function resetForm(): void {
    formName = '';
    formDescription = '';
    formStatus = 'operational';
    formLocation = '';
    formManufacturer = '';
    formModel = '';
    formSerialNumber = '';
    formYearOfManufacture = '';
    formNotes = '';
    createFieldStates = fields.map((f: InventoryCustomField) => ({
      fieldId: f.id,
      fieldType: f.fieldType,
      valueText: '',
      valueNumber: '',
      valueDate: '',
      valueBoolean: false,
    }));
  }

  function openCreateModal(): void {
    resetForm();
    showCreateModal = true;
  }

  function addIfNotEmpty(target: Record<string, unknown>, key: string, value: string): void {
    const trimmed = value.trim();
    if (trimmed !== '') target[key] = trimmed;
  }

  function collectCreateCustomValues(): CustomValueInput[] {
    const cvs: CustomValueInput[] = [];
    for (const fs of createFieldStates) {
      const cv = buildCreateCvInput(fs);
      if (cv !== null) cvs.push(cv);
    }
    return cvs;
  }

  function buildCreateCvInput(fs: CreateFieldState): CustomValueInput | null {
    if (fs.fieldType === 'text' || fs.fieldType === 'select') {
      return fs.valueText.trim() !== '' ?
          { fieldId: fs.fieldId, valueText: fs.valueText.trim() }
        : null;
    }
    if (fs.fieldType === 'number') {
      return fs.valueNumber.trim() !== '' ?
          { fieldId: fs.fieldId, valueNumber: Number(fs.valueNumber) }
        : null;
    }
    if (fs.fieldType === 'date') {
      return fs.valueDate !== '' ? { fieldId: fs.fieldId, valueDate: fs.valueDate } : null;
    }
    if (fs.fieldType === 'boolean') {
      return { fieldId: fs.fieldId, valueBoolean: fs.valueBoolean };
    }
    return null;
  }

  function buildItemPayload(listId: string): Record<string, unknown> {
    const payload: Record<string, unknown> = { listId, name: formName.trim() };

    addIfNotEmpty(payload, 'description', formDescription);
    if (formStatus !== 'operational') payload.status = formStatus;
    addIfNotEmpty(payload, 'location', formLocation);
    addIfNotEmpty(payload, 'manufacturer', formManufacturer);
    addIfNotEmpty(payload, 'model', formModel);
    addIfNotEmpty(payload, 'serialNumber', formSerialNumber);
    if (formYearOfManufacture.trim() !== '')
      payload.yearOfManufacture = Number(formYearOfManufacture);
    addIfNotEmpty(payload, 'notes', formNotes);

    const cvs = collectCreateCustomValues();
    if (cvs.length > 0) payload.customValues = cvs;

    return payload;
  }

  async function createItem(): Promise<void> {
    if (list === null || formName.trim() === '') return;
    creating = true;
    try {
      await apiClient.post(API_ENDPOINTS.ITEMS, buildItemPayload(list.id));
      showSuccessAlert('Gegenstand erfolgreich erstellt');
      showCreateModal = false;
      resetForm();
      await invalidateAll();
    } catch (err: unknown) {
      log.error({ err }, 'Error creating item');
      showErrorAlert('Fehler beim Erstellen des Gegenstands');
    } finally {
      creating = false;
    }
  }

  function applyFilter(): void {
    const params = new SvelteURLSearchParams();
    if (filterStatus !== '') params.set('status', filterStatus);
    if (searchQuery.trim() !== '') params.set('search', searchQuery.trim());
    const qs = params.toString();
    void goto(`${page.url.pathname}${qs !== '' ? `?${qs}` : ''}`, { invalidateAll: true });
  }

  function goToItem(uuid: string): void {
    void goto(`/inventory/items/${uuid}`);
  }

  function goToPage(p: number): void {
    const params = new SvelteURLSearchParams(page.url.searchParams);
    params.set('page', String(p));
    void goto(`${page.url.pathname}?${params.toString()}`, { invalidateAll: true });
  }

  /** Get display value for a custom field from the batch-loaded values */
  function getCustomValue(itemId: string, fieldId: string, fieldType: string): string {
    const valuesMap: Partial<Record<string, CustomValueWithField[]>> = customValuesByItem;
    const values = valuesMap[itemId];
    if (values === undefined) return '—';
    const cv = values.find((v: CustomValueWithField) => v.fieldId === fieldId);
    if (cv === undefined) return '—';
    if (fieldType === 'boolean') return cv.valueBoolean === true ? 'Ja' : 'Nein';
    if (fieldType === 'number' && cv.valueNumber !== null) return cv.valueNumber;
    if (fieldType === 'date' && cv.valueDate !== null)
      return new Date(cv.valueDate).toLocaleDateString('de-DE');
    return cv.valueText ?? '—';
  }
</script>

{#if data.permissionDenied}
  <PermissionDenied />
{:else if list === null}
  <div class="glass-card p-8 text-center">
    <i class="fas fa-exclamation-triangle text-warning mb-4 text-4xl"></i>
    <p class="text-lg">Inventarliste nicht gefunden</p>
    <a
      href="/inventory"
      class="btn btn--primary mt-4">Zurück zur Übersicht</a
    >
  </div>
{:else}
  <!-- Header -->
  <div class="mb-6 flex items-center justify-between">
    <div>
      <div class="flex items-center gap-3">
        <a
          href="/inventory"
          class="text-secondary hover:text-primary"
          aria-label="Zurück zur Übersicht"
        >
          <i class="fas fa-arrow-left"></i>
        </a>
        <h1 class="text-2xl font-bold">
          {#if list.icon}<i class="fas {list.icon} mr-2"></i>{/if}
          {list.title}
        </h1>
      </div>
      {#if list.description}
        <p class="text-secondary mt-1 ml-8">{list.description}</p>
      {/if}
      <p class="text-secondary mt-1 ml-8 text-sm">
        Code-Schema: <code class="font-mono">{codeExample}</code>
        · {total}
        {total === 1 ? 'Gegenstand' : 'Gegenstände'}
        {#if list.tags.length > 0}· {list.tags.map((t) => t.name).join(', ')}{/if}
      </p>
    </div>
    <button
      type="button"
      class="btn btn--primary"
      onclick={openCreateModal}
    >
      <i class="fas fa-plus mr-2"></i>Neuer Gegenstand
    </button>
  </div>

  <!-- Filters -->
  <div class="glass-card mb-4 flex flex-wrap items-center gap-3 p-3">
    <div class="flex-1">
      <input
        type="text"
        class="input input--sm w-full"
        placeholder="Name, Code oder Seriennummer suchen..."
        bind:value={searchQuery}
        onkeydown={(e: KeyboardEvent) => {
          if (e.key === 'Enter') applyFilter();
        }}
      />
    </div>
    <select
      class="input input--sm w-48"
      bind:value={filterStatus}
      onchange={applyFilter}
    >
      <option value="">Alle Status</option>
      {#each Object.entries(ITEM_STATUS_LABELS) as [value, label] (value)}
        <option {value}>{label}</option>
      {/each}
    </select>
    <button
      type="button"
      class="btn btn--secondary btn--sm"
      onclick={applyFilter}
      aria-label="Suche anwenden"
    >
      <i class="fas fa-search"></i>
    </button>
  </div>

  <!-- Items Table -->
  <div class="glass-card overflow-x-auto">
    <table class="w-full">
      <thead>
        <tr class="border-glass-border text-secondary border-b text-left text-sm">
          <th class="px-4 py-3 font-medium">Code</th>
          <th class="px-4 py-3 font-medium">Name</th>
          <th class="px-4 py-3 font-medium">Status</th>
          <th class="px-4 py-3 font-medium">Standort</th>
          <th class="px-4 py-3 font-medium">Hersteller</th>
          <th class="px-4 py-3 font-medium">Seriennr.</th>
          {#each fields as field (field.id)}
            <th class="px-4 py-3 font-medium">
              {field.fieldName}
              {#if field.fieldUnit}<span class="text-xs">({field.fieldUnit})</span>{/if}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each items as item (item.id)}
          <tr
            class="border-glass-border hover:bg-glass-hover cursor-pointer border-b transition-colors"
            role="link"
            tabindex="0"
            onclick={() => {
              goToItem(item.id);
            }}
            onkeydown={(e: KeyboardEvent) => {
              if (e.key === 'Enter') goToItem(item.id);
            }}
          >
            <td class="px-4 py-3 font-mono text-sm font-semibold">{item.code}</td>
            <td class="px-4 py-3">{item.name}</td>
            <td class="px-4 py-3">
              <span class="badge {ITEM_STATUS_BADGE_CLASSES[item.status]} badge--sm">
                {ITEM_STATUS_LABELS[item.status]}
              </span>
            </td>
            <td class="text-secondary px-4 py-3 text-sm">{item.location ?? '—'}</td>
            <td class="text-secondary px-4 py-3 text-sm">{item.manufacturer ?? '—'}</td>
            <td class="px-4 py-3 font-mono text-sm">{item.serial_number ?? '—'}</td>
            {#each fields as field (field.id)}
              <td class="text-secondary px-4 py-3 text-sm">
                {getCustomValue(item.id, field.id, field.fieldType)}
              </td>
            {/each}
          </tr>
        {:else}
          <tr>
            <td
              colspan={6 + fields.length}
              class="text-secondary px-4 py-12 text-center"
            >
              <i class="fas fa-inbox mb-2 text-3xl"></i>
              <p>Keine Gegenstände in dieser Liste</p>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="mt-4 flex items-center justify-center gap-2">
      <button
        type="button"
        class="btn btn--secondary btn--sm"
        disabled={currentPage <= 1}
        onclick={() => {
          goToPage(currentPage - 1);
        }}
        aria-label="Vorherige Seite"
      >
        <i class="fas fa-chevron-left"></i>
      </button>
      <span class="text-secondary text-sm">Seite {currentPage} von {totalPages}</span>
      <button
        type="button"
        class="btn btn--secondary btn--sm"
        disabled={currentPage >= totalPages}
        onclick={() => {
          goToPage(currentPage + 1);
        }}
        aria-label="Nächste Seite"
      >
        <i class="fas fa-chevron-right"></i>
      </button>
    </div>
  {/if}

  <!-- Create Item Modal -->
  {#if showCreateModal}
    <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
    <div
      class="modal-overlay modal-overlay--active"
      onclick={() => (showCreateModal = false)}
    >
      <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
      <div
        class="ds-modal ds-modal--lg"
        onclick={(e: MouseEvent) => {
          e.stopPropagation();
        }}
      >
        <div class="ds-modal__header">
          <h3 class="ds-modal__title">
            <i class="fas fa-plus mr-2"></i>Neuer Gegenstand
          </h3>
          <button
            type="button"
            class="ds-modal__close"
            aria-label="Schliessen"
            onclick={() => (showCreateModal = false)}
          >
            <i class="fas fa-times"></i>
          </button>
        </div>

        <form
          class="ds-modal__body"
          onsubmit={(e: SubmitEvent) => {
            e.preventDefault();
            void createItem();
          }}
        >
          <div class="grid gap-4">
            <div class="form-field">
              <label
                for="item-name"
                class="form-field__label">Name *</label
              >
              <input
                id="item-name"
                type="text"
                class="form-field__control"
                bind:value={formName}
                required
              />
            </div>
            <div class="form-field">
              <label
                for="item-desc"
                class="form-field__label">Beschreibung</label
              >
              <textarea
                id="item-desc"
                class="form-field__control"
                rows="2"
                bind:value={formDescription}
              ></textarea>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="form-field">
                <span class="form-field__label">Status</span>
                <div class="dropdown">
                  <button
                    type="button"
                    class="dropdown__trigger"
                    class:active={activeDropdown === 'item-status'}
                    onclick={() => {
                      toggleDropdown('item-status');
                    }}
                  >
                    <span>{formStatusLabel}</span>
                    <i class="fas fa-chevron-down"></i>
                  </button>
                  <div
                    class="dropdown__menu"
                    class:active={activeDropdown === 'item-status'}
                  >
                    {#each Object.entries(ITEM_STATUS_LABELS) as [value, label] (value)}
                      <button
                        type="button"
                        class="dropdown__option"
                        class:dropdown__option--selected={formStatus === value}
                        onclick={() => {
                          formStatus = value as InventoryItemStatus;
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
                  for="item-location"
                  class="form-field__label">Standort</label
                >
                <input
                  id="item-location"
                  type="text"
                  class="form-field__control"
                  bind:value={formLocation}
                />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="form-field">
                <label
                  for="item-manufacturer"
                  class="form-field__label">Hersteller</label
                >
                <input
                  id="item-manufacturer"
                  type="text"
                  class="form-field__control"
                  bind:value={formManufacturer}
                />
              </div>
              <div class="form-field">
                <label
                  for="item-model"
                  class="form-field__label">Modell</label
                >
                <input
                  id="item-model"
                  type="text"
                  class="form-field__control"
                  bind:value={formModel}
                />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="form-field">
                <label
                  for="item-serial"
                  class="form-field__label">Seriennummer</label
                >
                <input
                  id="item-serial"
                  type="text"
                  class="form-field__control"
                  bind:value={formSerialNumber}
                />
              </div>
              <div class="form-field">
                <label
                  for="item-year"
                  class="form-field__label">Baujahr</label
                >
                <input
                  id="item-year"
                  type="number"
                  class="form-field__control"
                  min="1900"
                  max="2100"
                  bind:value={formYearOfManufacture}
                />
              </div>
            </div>
            <div class="form-field">
              <label
                for="item-notes"
                class="form-field__label">Notizen</label
              >
              <textarea
                id="item-notes"
                class="form-field__control"
                rows="2"
                bind:value={formNotes}
              ></textarea>
            </div>

            <!-- Custom Fields (#3) -->
            {#if createFieldStates.length > 0}
              <div class="border-t border-[var(--color-border,rgb(255_255_255/10%))] pt-4">
                <h4 class="mb-3 text-sm font-semibold text-[var(--color-text-secondary)]">
                  <i class="fas fa-sliders-h mr-1"></i> Custom Fields
                </h4>
                {#each createFieldStates as fs, idx (fs.fieldId)}
                  {@const fieldDef = fields.find((f) => f.id === fs.fieldId)}
                  {#if fieldDef}
                    <div class="form-field mb-3">
                      <label
                        class="form-field__label"
                        for="create-cf-{fs.fieldId}"
                      >
                        {fieldDef.fieldName}
                        {#if fieldDef.fieldUnit}<span class="text-xs font-normal"
                            >({fieldDef.fieldUnit})</span
                          >{/if}
                        {#if fieldDef.isRequired}<span class="text-[var(--color-danger)]">*</span
                          >{/if}
                      </label>
                      {#if fs.fieldType === 'text'}
                        <input
                          id="create-cf-{fs.fieldId}"
                          type="text"
                          class="form-field__control"
                          bind:value={createFieldStates[idx].valueText}
                          required={fieldDef.isRequired}
                        />
                      {:else if fs.fieldType === 'number'}
                        <input
                          id="create-cf-{fs.fieldId}"
                          type="number"
                          class="form-field__control"
                          step="any"
                          bind:value={createFieldStates[idx].valueNumber}
                          required={fieldDef.isRequired}
                        />
                      {:else if fs.fieldType === 'date'}
                        <input
                          id="create-cf-{fs.fieldId}"
                          type="date"
                          class="form-field__control"
                          bind:value={createFieldStates[idx].valueDate}
                          required={fieldDef.isRequired}
                        />
                      {:else if fs.fieldType === 'boolean'}
                        <label class="flex cursor-pointer items-center gap-2">
                          <input
                            id="create-cf-{fs.fieldId}"
                            type="checkbox"
                            bind:checked={createFieldStates[idx].valueBoolean}
                          />
                          <span class="text-sm">{fieldDef.fieldName}</span>
                        </label>
                      {:else if fs.fieldType === 'select' && fieldDef.fieldOptions}
                        <div class="dropdown">
                          <button
                            type="button"
                            class="dropdown__trigger"
                            class:active={activeDropdown === `create-cf-${fs.fieldId}`}
                            onclick={() => {
                              toggleDropdown(`create-cf-${fs.fieldId}`);
                            }}
                          >
                            <span
                              >{createFieldStates[idx].valueText !== '' ?
                                createFieldStates[idx].valueText
                              : '-- Auswählen --'}</span
                            >
                            <i class="fas fa-chevron-down"></i>
                          </button>
                          <div
                            class="dropdown__menu"
                            class:active={activeDropdown === `create-cf-${fs.fieldId}`}
                          >
                            <button
                              type="button"
                              class="dropdown__option"
                              class:dropdown__option--selected={createFieldStates[idx].valueText ===
                                ''}
                              onclick={() => {
                                createFieldStates[idx].valueText = '';
                                closeAllDropdowns();
                              }}
                            >
                              -- Auswählen --
                            </button>
                            {#each fieldDef.fieldOptions as opt (opt)}
                              <button
                                type="button"
                                class="dropdown__option"
                                class:dropdown__option--selected={createFieldStates[idx]
                                  .valueText === opt}
                                onclick={() => {
                                  createFieldStates[idx].valueText = opt;
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
                  {/if}
                {/each}
              </div>
            {/if}
          </div>

          <div class="ds-modal__footer">
            <button
              type="button"
              class="btn btn-cancel"
              onclick={() => (showCreateModal = false)}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              disabled={creating || formName.trim() === ''}
            >
              {#if creating}<span class="spinner-ring spinner-ring--sm mr-2"></span>{/if}
              Erstellen
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
{/if}

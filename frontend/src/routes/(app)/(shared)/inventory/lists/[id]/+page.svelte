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
    InventoryItem,
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
  // Svelte 5 coerces <input type="number"> bind:value to `number | null`,
  // so the form state MUST match that shape — using string here throws
  // `trim is not a function` as soon as the user types a digit.
  let formYearOfManufacture = $state<number | null>(null);
  let formNotes = $state('');
  let filterStatus = $state<InventoryItemStatus | ''>('');
  let searchQuery = $state('');
  let previewItem = $state<InventoryItem | null>(null);

  // Custom field values for create form
  interface CreateFieldState {
    fieldId: string;
    fieldType: string;
    valueText: string;
    /** number | null to match Svelte 5's <input type="number"> bind:value shape */
    valueNumber: number | null;
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
    formYearOfManufacture = null;
    formNotes = '';
    createFieldStates = fields.map((f: InventoryCustomField) => ({
      fieldId: f.id,
      fieldType: f.fieldType,
      valueText: '',
      valueNumber: null,
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
      return fs.valueNumber !== null ? { fieldId: fs.fieldId, valueNumber: fs.valueNumber } : null;
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
    if (formYearOfManufacture !== null) payload.yearOfManufacture = formYearOfManufacture;
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

<svelte:head>
  <title>{list !== null ? `${list.title} · Inventar` : 'Inventar'}</title>
</svelte:head>

{#if data.permissionDenied}
  <PermissionDenied />
{:else if list === null}
  <div class="container">
    <div class="card">
      <div class="card__body">
        <div class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <h3 class="empty-state__title">Inventarliste nicht gefunden</h3>
          <p class="empty-state__description">
            Die angeforderte Liste existiert nicht oder wurde gelöscht.
          </p>
          <a
            href="/inventory"
            class="btn btn-primary"
          >
            <i class="fas fa-arrow-left"></i>
            Zurück zur Übersicht
          </a>
        </div>
      </div>
    </div>
  </div>
{:else}
  <div class="container">
    <button
      type="button"
      class="btn btn-light mb-4"
      onclick={() => {
        void goto('/inventory');
      }}
    >
      <i class="fas fa-arrow-left mr-2"></i>Zurück zur Übersicht
    </button>

    <div class="card">
      <div class="card__header">
        <h2 class="card__title">
          {#if list.icon !== null && list.icon !== ''}<i class="fas {list.icon} mr-2"></i>{/if}
          {list.title}
        </h2>

        {#if list.description !== null && list.description !== ''}
          <p class="mt-2 text-(--color-text-secondary)">{list.description}</p>
        {/if}

        <div class="inventory-detail__meta">
          <span>
            <i class="fas fa-hashtag mr-1"></i>
            Code-Schema: <code class="inventory-detail__code">{codeExample}</code>
          </span>
          <span>
            <i class="fas fa-boxes mr-1"></i>
            {total}
            {total === 1 ? 'Gegenstand' : 'Gegenstände'}
          </span>
          {#if list.tags.length > 0}
            <span class="inventory-detail__tags">
              <i class="fas fa-tags mr-1"></i>
              {#each list.tags as tag (tag.id)}
                <span class="badge badge--info badge--sm">
                  {#if tag.icon !== null && tag.icon !== ''}
                    <i class="fas {tag.icon} mr-1"></i>
                  {/if}
                  {tag.name}
                </span>
              {/each}
            </span>
          {/if}
        </div>

        <div class="mt-6 flex items-center justify-between gap-4">
          <div class="dropdown">
            <button
              type="button"
              class="dropdown__trigger inventory-detail__filter-trigger"
              class:active={activeDropdown === 'filter-status'}
              onclick={() => {
                toggleDropdown('filter-status');
              }}
            >
              <span>
                <i class="fas fa-filter mr-2"></i>
                {filterStatus === '' ? 'Alle Status' : ITEM_STATUS_LABELS[filterStatus]}
              </span>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div
              class="dropdown__menu"
              class:active={activeDropdown === 'filter-status'}
            >
              <button
                type="button"
                class="dropdown__option"
                class:dropdown__option--selected={filterStatus === ''}
                onclick={() => {
                  filterStatus = '';
                  closeAllDropdowns();
                  applyFilter();
                }}
              >
                Alle Status
              </button>
              {#each Object.entries(ITEM_STATUS_LABELS) as [value, label] (value)}
                <button
                  type="button"
                  class="dropdown__option"
                  class:dropdown__option--selected={filterStatus === value}
                  onclick={() => {
                    filterStatus = value as InventoryItemStatus;
                    closeAllDropdowns();
                    applyFilter();
                  }}
                >
                  {label}
                </button>
              {/each}
            </div>
          </div>

          <div class="search-input-wrapper max-w-80">
            <div class="search-input">
              <i class="search-input__icon fas fa-search"></i>
              <input
                type="search"
                class="search-input__field"
                placeholder="Name, Code oder Seriennummer…"
                autocomplete="off"
                bind:value={searchQuery}
                onkeydown={(e: KeyboardEvent) => {
                  if (e.key === 'Enter') applyFilter();
                }}
              />
              <button
                class="search-input__clear"
                class:search-input__clear--visible={searchQuery.length > 0}
                type="button"
                aria-label="Suche löschen"
                onclick={() => {
                  searchQuery = '';
                  applyFilter();
                }}
              >
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="card__body">
        {#if items.length === 0}
          <div class="empty-state">
            <div class="empty-state__icon">
              <i class="fas fa-inbox"></i>
            </div>
            <h3 class="empty-state__title">Keine Gegenstände</h3>
            <p class="empty-state__description">
              {#if searchQuery !== '' || filterStatus !== ''}
                Keine Treffer für die aktuellen Filter. Filter zurücksetzen oder neuen Gegenstand
                anlegen.
              {:else}
                Lege den ersten Gegenstand dieser Liste an — Code
                <code>{codeExample}</code> wird automatisch vergeben.
              {/if}
            </p>
            <button
              type="button"
              class="btn btn-primary"
              onclick={openCreateModal}
            >
              <i class="fas fa-plus"></i>
              Neuer Gegenstand
            </button>
          </div>
        {:else}
          <div class="table-responsive">
            <table class="data-table data-table--hover data-table--striped">
              <thead>
                <tr>
                  <th
                    scope="col"
                    class="inventory-detail__th-photo">Foto</th
                  >
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  <th scope="col">Status</th>
                  <th scope="col">Standort</th>
                  <th scope="col">Hersteller</th>
                  <th scope="col">Seriennr.</th>
                  {#each fields as field (field.id)}
                    <th scope="col">
                      {field.fieldName}
                      {#if field.fieldUnit !== null && field.fieldUnit !== ''}
                        <span class="inventory-detail__unit">({field.fieldUnit})</span>
                      {/if}
                    </th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each items as item (item.id)}
                  <tr
                    class="inventory-detail__row"
                    role="link"
                    tabindex="0"
                    onclick={() => {
                      goToItem(item.id);
                    }}
                    onkeydown={(e: KeyboardEvent) => {
                      if (e.key === 'Enter') goToItem(item.id);
                    }}
                  >
                    <td
                      class="inventory-detail__td-photo"
                      onclick={(e: MouseEvent) => {
                        if (item.thumbnail_path !== null) {
                          e.stopPropagation();
                          previewItem = item;
                        }
                      }}
                    >
                      {#if item.thumbnail_path !== null}
                        <div class="inventory-detail__thumbnail">
                          <img
                            src="/{item.thumbnail_path}"
                            alt={item.name}
                            loading="lazy"
                          />
                        </div>
                      {:else}
                        <div class="inventory-detail__no-photo">
                          <i class="fas fa-image"></i>
                        </div>
                      {/if}
                    </td>
                    <td><code class="inventory-detail__code">{item.code}</code></td>
                    <td class="font-medium">{item.name}</td>
                    <td>
                      <span class="badge {ITEM_STATUS_BADGE_CLASSES[item.status]}">
                        {ITEM_STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td>{item.location ?? '—'}</td>
                    <td>{item.manufacturer ?? '—'}</td>
                    <td
                      ><code class="inventory-detail__serial">{item.serial_number ?? '—'}</code></td
                    >
                    {#each fields as field (field.id)}
                      <td>{getCustomValue(item.id, field.id, field.fieldType)}</td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          {#if totalPages > 1}
            <div class="inventory-detail__pagination">
              <button
                type="button"
                class="btn btn-cancel btn-sm"
                disabled={currentPage <= 1}
                onclick={() => {
                  goToPage(currentPage - 1);
                }}
                aria-label="Vorherige Seite"
              >
                <i class="fas fa-chevron-left"></i>
              </button>
              <span class="text-(--color-text-secondary)">
                Seite {currentPage} von {totalPages}
              </span>
              <button
                type="button"
                class="btn btn-cancel btn-sm"
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
        {/if}
      </div>
    </div>
  </div>

  <!-- Floating Action Button -->
  <button
    type="button"
    class="btn-float"
    onclick={openCreateModal}
    aria-label="Neuer Gegenstand"
  >
    <i class="fas fa-plus"></i>
  </button>

  <!-- Create Item Modal -->
  {#if showCreateModal}
    <div
      id="inventory-create-item-modal"
      class="modal-overlay modal-overlay--active"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-create-item-modal-title"
      tabindex="-1"
    >
      <form
        class="ds-modal ds-modal--lg"
        onsubmit={(e: SubmitEvent) => {
          e.preventDefault();
          void createItem();
        }}
      >
        <div class="ds-modal__header">
          <h3
            class="ds-modal__title"
            id="inventory-create-item-modal-title"
          >
            Neuer Gegenstand
          </h3>
          <button
            type="button"
            class="ds-modal__close"
            aria-label="Schließen"
            onclick={() => {
              showCreateModal = false;
            }}
          >
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="ds-modal__body">
          <div class="alert alert--warning mb-6">
            <div class="alert__icon">
              <i class="fas fa-info-circle"></i>
            </div>
            <div class="alert__content">
              <strong class="alert__title">Hinweis:</strong>
              <p class="alert__message">
                Foto-Upload und QR-Label-Generierung sind erst nach dem Erstellen möglich. Der
                Gegenstand erhält beim Speichern eine eindeutige ID, an die Fotos gebunden werden.
                Öffnen Sie den Gegenstand anschließend aus der Tabelle, um Fotos hinzuzufügen.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div class="form-field md:col-span-2">
              <label
                class="form-field__label"
                for="item-name"
              >
                Name
                <span class="text-red-500">*</span>
                <span class="form-field__hint">(1-255 Zeichen)</span>
              </label>
              <input
                id="item-name"
                name="name"
                type="text"
                class="form-field__control"
                placeholder="Bezeichnung des Gegenstands"
                required
                minlength="1"
                maxlength="255"
                bind:value={formName}
              />
            </div>

            <div class="form-field md:col-span-2">
              <label
                class="form-field__label"
                for="item-desc"
              >
                Beschreibung
                <span class="form-field__hint">(optional)</span>
              </label>
              <textarea
                id="item-desc"
                name="description"
                class="form-field__control"
                placeholder="Optionale Zusatzinformationen"
                rows="3"
                bind:value={formDescription}
              ></textarea>
            </div>

            <div class="form-field">
              <span
                class="form-field__label"
                id="item-status-label"
              >
                Status
              </span>
              <div class="dropdown">
                <button
                  type="button"
                  class="dropdown__trigger"
                  class:active={activeDropdown === 'item-status'}
                  aria-labelledby="item-status-label"
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
                class="form-field__label"
                for="item-location"
              >
                Standort
              </label>
              <input
                id="item-location"
                name="location"
                type="text"
                class="form-field__control"
                placeholder="z.B. Halle 2, Regal B-3"
                bind:value={formLocation}
              />
            </div>

            <div class="form-field">
              <label
                class="form-field__label"
                for="item-manufacturer"
              >
                Hersteller
              </label>
              <input
                id="item-manufacturer"
                name="manufacturer"
                type="text"
                class="form-field__control"
                bind:value={formManufacturer}
              />
            </div>

            <div class="form-field">
              <label
                class="form-field__label"
                for="item-model"
              >
                Modell
              </label>
              <input
                id="item-model"
                name="model"
                type="text"
                class="form-field__control"
                bind:value={formModel}
              />
            </div>

            <div class="form-field">
              <label
                class="form-field__label"
                for="item-serial"
              >
                Seriennummer
              </label>
              <input
                id="item-serial"
                name="serialNumber"
                type="text"
                class="form-field__control"
                bind:value={formSerialNumber}
              />
            </div>

            <div class="form-field">
              <label
                class="form-field__label"
                for="item-year"
              >
                Baujahr
              </label>
              <input
                id="item-year"
                name="yearOfManufacture"
                type="number"
                class="form-field__control"
                min="1900"
                max="2100"
                bind:value={formYearOfManufacture}
              />
            </div>

            <div class="form-field md:col-span-2">
              <label
                class="form-field__label"
                for="item-notes"
              >
                Notizen
                <span class="form-field__hint">(optional)</span>
              </label>
              <textarea
                id="item-notes"
                name="notes"
                class="form-field__control"
                rows="3"
                bind:value={formNotes}
              ></textarea>
            </div>

            {#if createFieldStates.length > 0}
              <div class="inventory-detail__custom-fields md:col-span-2">
                <h4 class="inventory-detail__custom-fields-title">
                  <i class="fas fa-sliders-h mr-1"></i>
                  Benutzerdefinierte Felder
                </h4>
                {#each createFieldStates as fs, idx (fs.fieldId)}
                  {@const fieldDef = fields.find((f) => f.id === fs.fieldId)}
                  {#if fieldDef}
                    <div class="form-field">
                      <label
                        class="form-field__label"
                        for="create-cf-{fs.fieldId}"
                      >
                        {fieldDef.fieldName}
                        {#if fieldDef.fieldUnit !== null && fieldDef.fieldUnit !== ''}
                          <span class="form-field__hint">({fieldDef.fieldUnit})</span>
                        {/if}
                        {#if fieldDef.isRequired}
                          <span class="text-red-500">*</span>
                        {/if}
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
                        <label class="inventory-detail__checkbox">
                          <input
                            id="create-cf-{fs.fieldId}"
                            type="checkbox"
                            bind:checked={createFieldStates[idx].valueBoolean}
                          />
                          <span>{fieldDef.fieldName}</span>
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
                            <span>
                              {createFieldStates[idx].valueText !== '' ?
                                createFieldStates[idx].valueText
                              : '-- Auswählen --'}
                            </span>
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
        </div>

        <div class="ds-modal__footer ds-modal__footer--right">
          <button
            type="button"
            class="btn btn-cancel"
            onclick={() => {
              showCreateModal = false;
            }}
          >
            Abbrechen
          </button>
          <button
            type="submit"
            class="btn btn-secondary"
            disabled={creating || formName.trim() === ''}
          >
            {#if creating}
              <span class="spinner-ring spinner-ring--sm mr-2"></span>
            {:else}
              <i class="fas fa-save mr-2"></i>
            {/if}
            Erstellen
          </button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Photo Preview Modal -->
  {#if previewItem !== null && previewItem.thumbnail_path !== null}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="modal-overlay modal-overlay--active"
      onclick={() => (previewItem = null)}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div
        class="ds-modal ds-modal--lg"
        style="max-height: 95vh;"
        onclick={(e: MouseEvent) => {
          e.stopPropagation();
        }}
      >
        <div class="ds-modal__header">
          <h3 class="ds-modal__title">
            <i class="fas fa-image mr-2 text-blue-400"></i>
            {previewItem.name}
          </h3>
          <button
            type="button"
            class="ds-modal__close"
            aria-label="Schliessen"
            onclick={() => (previewItem = null)}
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="ds-modal__body p-0">
          <div class="preview-image-container">
            <img
              src="/{previewItem.thumbnail_path}"
              alt={previewItem.name}
            />
          </div>
          <div class="preview-meta">
            <span class="flex items-center gap-2">
              <i class="fas fa-cube"></i>
              <span>{previewItem.code}</span>
            </span>
          </div>
        </div>
        <div class="ds-modal__footer">
          <button
            type="button"
            class="btn btn-cancel"
            onclick={() => (previewItem = null)}
          >
            <i class="fas fa-times mr-2"></i> Schließen
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .inventory-detail__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem 1.5rem;
    margin-top: 0.75rem;
    color: var(--color-text-secondary);
    font-size: 0.8125rem;
  }

  .inventory-detail__tags {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
  }

  .inventory-detail__code {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: var(--glass-bg);
    color: var(--color-text-primary);
    font-family: var(--font-mono, ui-monospace, 'SF Mono', monospace);
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .inventory-detail__serial {
    font-family: var(--font-mono, ui-monospace, 'SF Mono', monospace);
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
  }

  .inventory-detail__unit {
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--color-text-secondary);
  }

  .inventory-detail__filter-trigger {
    min-width: 14rem;
  }

  .inventory-detail__row {
    cursor: pointer;
  }

  .inventory-detail__row:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  .inventory-detail__pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-glass-border);
    font-size: 0.875rem;
  }

  .inventory-detail__custom-fields {
    margin-top: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-glass-border);
  }

  .inventory-detail__custom-fields-title {
    margin: 0 0 0.75rem;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .inventory-detail__checkbox {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    color: var(--color-text-primary);
    font-size: 0.875rem;
  }

  /* ── Item Thumbnail ──────────────────────────────────────── */

  .inventory-detail__th-photo {
    width: 7rem;
  }

  .inventory-detail__td-photo {
    width: 7rem;
    padding: 0.375rem !important;
  }

  .inventory-detail__thumbnail {
    cursor: pointer;
    overflow: hidden;
    width: 5.75rem;
    height: 5.75rem;
    border: 2px solid transparent;
    border-radius: var(--radius-lg, 0.5rem);
    background: var(--color-glass-bg, rgb(255 255 255 / 5%));
    transition: transform 0.2s ease;
  }

  .inventory-detail__thumbnail:hover {
    transform: scale(1.05);
    border-color: var(--color-primary, #3b82f6);
  }

  .inventory-detail__thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .inventory-detail__no-photo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 5.75rem;
    height: 5.75rem;
    border-radius: var(--radius-lg, 0.5rem);
    background: var(--color-glass-bg, rgb(255 255 255 / 5%));
    color: var(--color-text-secondary);
    font-size: 0.875rem;
  }

  .preview-image-container {
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    min-height: 400px;
    max-height: 70vh;
    width: 100%;
  }

  .preview-image-container img {
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
  }

  .preview-meta {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    border-top: 1px solid var(--color-glass-border);
    padding: 1rem;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
  }
</style>

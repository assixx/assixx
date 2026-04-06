<script lang="ts">
  /**
   * Inventory Items Table - Page Component
   * @module inventory/lists/[id]/+page
   *
   * Table view of all items in an inventory list.
   * Supports filtering, item creation, and navigation to item detail.
   */
  import { SvelteURLSearchParams } from 'svelte/reactivity';

  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/state';

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
  import type { InventoryItemStatus } from '../../_lib/types';

  const log = createLogger('InventoryItemsPage');
  const apiClient = getApiClient();

  const { data }: { data: PageData } = $props();

  const list = $derived(data.list);
  const items = $derived(data.items);
  const fields = $derived(data.fields);
  const total = $derived(data.total);

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
  }

  function buildItemPayload(listId: string): Record<string, unknown> {
    const payload: Record<string, unknown> = { listId, name: formName.trim() };
    if (formDescription.trim() !== '') payload.description = formDescription.trim();
    if (formStatus !== 'operational') payload.status = formStatus;
    if (formLocation.trim() !== '') payload.location = formLocation.trim();
    if (formManufacturer.trim() !== '') payload.manufacturer = formManufacturer.trim();
    if (formModel.trim() !== '') payload.model = formModel.trim();
    if (formSerialNumber.trim() !== '') payload.serialNumber = formSerialNumber.trim();
    if (formYearOfManufacture.trim() !== '')
      payload.yearOfManufacture = Number(formYearOfManufacture);
    if (formNotes.trim() !== '') payload.notes = formNotes.trim();
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
        {#if list.category}· {list.category}{/if}
      </p>
    </div>
    <button
      type="button"
      class="btn btn--primary"
      onclick={() => (showCreateModal = true)}
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
            {#each fields as _field (_field.id)}
              <td class="text-secondary px-4 py-3 text-sm">—</td>
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
      class="modal-overlay"
      onclick={() => (showCreateModal = false)}
    >
      <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
      <div
        class="modal-content glass-card max-w-lg p-6"
        onclick={(e: MouseEvent) => {
          e.stopPropagation();
        }}
      >
        <h2 class="mb-4 text-xl font-bold">
          <i class="fas fa-plus mr-2"></i>Neuer Gegenstand
        </h2>
        <form
          onsubmit={(e: SubmitEvent) => {
            e.preventDefault();
            void createItem();
          }}
        >
          <div class="grid gap-4">
            <div>
              <label
                for="item-name"
                class="label">Name *</label
              >
              <input
                id="item-name"
                type="text"
                class="input"
                bind:value={formName}
                required
              />
            </div>
            <div>
              <label
                for="item-desc"
                class="label">Beschreibung</label
              >
              <textarea
                id="item-desc"
                class="input"
                rows="2"
                bind:value={formDescription}
              ></textarea>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label
                  for="item-status"
                  class="label">Status</label
                >
                <select
                  id="item-status"
                  class="input"
                  bind:value={formStatus}
                >
                  {#each Object.entries(ITEM_STATUS_LABELS) as [value, label] (value)}
                    <option {value}>{label}</option>
                  {/each}
                </select>
              </div>
              <div>
                <label
                  for="item-location"
                  class="label">Standort</label
                >
                <input
                  id="item-location"
                  type="text"
                  class="input"
                  bind:value={formLocation}
                />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label
                  for="item-manufacturer"
                  class="label">Hersteller</label
                >
                <input
                  id="item-manufacturer"
                  type="text"
                  class="input"
                  bind:value={formManufacturer}
                />
              </div>
              <div>
                <label
                  for="item-model"
                  class="label">Modell</label
                >
                <input
                  id="item-model"
                  type="text"
                  class="input"
                  bind:value={formModel}
                />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label
                  for="item-serial"
                  class="label">Seriennummer</label
                >
                <input
                  id="item-serial"
                  type="text"
                  class="input"
                  bind:value={formSerialNumber}
                />
              </div>
              <div>
                <label
                  for="item-year"
                  class="label">Baujahr</label
                >
                <input
                  id="item-year"
                  type="number"
                  class="input"
                  min="1900"
                  max="2100"
                  bind:value={formYearOfManufacture}
                />
              </div>
            </div>
            <div>
              <label
                for="item-notes"
                class="label">Notizen</label
              >
              <textarea
                id="item-notes"
                class="input"
                rows="2"
                bind:value={formNotes}
              ></textarea>
            </div>
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="btn btn--secondary"
              onclick={() => (showCreateModal = false)}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              class="btn btn--primary"
              disabled={creating || formName.trim() === ''}
            >
              {#if creating}<i class="fas fa-spinner fa-spin mr-2"></i>{/if}
              Erstellen
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
{/if}

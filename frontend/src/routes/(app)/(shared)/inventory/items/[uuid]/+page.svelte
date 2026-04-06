<script lang="ts">
  /**
   * Inventory Item Detail - Page Component
   * @module inventory/items/[uuid]/+page
   *
   * QR code target page. Shows full item details, photos, custom values.
   * Must work well on mobile (scanned from QR label on equipment).
   */
  import PermissionDenied from '$lib/components/PermissionDenied.svelte';

  import { ITEM_STATUS_LABELS, ITEM_STATUS_BADGE_CLASSES } from '../../_lib/constants';

  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  const detail = $derived(data.detail);
  const item = $derived(detail?.item ?? null);
  const photos = $derived(detail?.photos ?? []);
  const customValues = $derived(detail?.customValues ?? []);

  const listUrl = $derived(item !== null ? `/inventory/lists/${item.list_id}` : '/inventory');
</script>

{#if data.permissionDenied}
  <PermissionDenied />
{:else if item === null}
  <div class="glass-card p-8 text-center">
    <i class="fas fa-exclamation-triangle text-warning mb-4 text-4xl"></i>
    <p class="text-lg">Inventargegenstand nicht gefunden</p>
    <a
      href="/inventory"
      class="btn btn--primary mt-4">Zurück zur Übersicht</a
    >
  </div>
{:else}
  <!-- Header -->
  <div class="mb-6">
    <div class="flex items-center gap-3">
      <a
        href={listUrl}
        class="text-secondary hover:text-primary"
        aria-label="Zurück zur Liste"
      >
        <i class="fas fa-arrow-left"></i>
      </a>
      <div>
        <h1 class="text-2xl font-bold">{item.name}</h1>
        <p class="text-secondary text-sm">
          <span class="font-mono font-semibold">{item.code}</span>
          · {item.list_title}
        </p>
      </div>
      <span class="badge {ITEM_STATUS_BADGE_CLASSES[item.status]} ml-auto">
        {ITEM_STATUS_LABELS[item.status]}
      </span>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-3">
    <!-- Main Info -->
    <div class="glass-card p-5 lg:col-span-2">
      <h2 class="mb-4 text-lg font-semibold">
        <i class="fas fa-info-circle mr-2"></i>Stammdaten
      </h2>
      <dl class="grid grid-cols-2 gap-x-6 gap-y-3">
        <div>
          <dt class="text-secondary text-sm">Code</dt>
          <dd class="font-mono font-semibold">{item.code}</dd>
        </div>
        <div>
          <dt class="text-secondary text-sm">Status</dt>
          <dd>
            <span class="badge {ITEM_STATUS_BADGE_CLASSES[item.status]} badge--sm">
              {ITEM_STATUS_LABELS[item.status]}
            </span>
          </dd>
        </div>
        {#if item.location}
          <div>
            <dt class="text-secondary text-sm">Standort</dt>
            <dd>{item.location}</dd>
          </div>
        {/if}
        {#if item.manufacturer}
          <div>
            <dt class="text-secondary text-sm">Hersteller</dt>
            <dd>{item.manufacturer}</dd>
          </div>
        {/if}
        {#if item.model}
          <div>
            <dt class="text-secondary text-sm">Modell</dt>
            <dd>{item.model}</dd>
          </div>
        {/if}
        {#if item.serial_number}
          <div>
            <dt class="text-secondary text-sm">Seriennummer</dt>
            <dd class="font-mono">{item.serial_number}</dd>
          </div>
        {/if}
        {#if item.year_of_manufacture}
          <div>
            <dt class="text-secondary text-sm">Baujahr</dt>
            <dd>{item.year_of_manufacture}</dd>
          </div>
        {/if}
      </dl>
      {#if item.description}
        <div class="border-glass-border mt-4 border-t pt-4">
          <dt class="text-secondary mb-1 text-sm">Beschreibung</dt>
          <dd>{item.description}</dd>
        </div>
      {/if}
      {#if item.notes}
        <div class="border-glass-border mt-3 border-t pt-3">
          <dt class="text-secondary mb-1 text-sm">Notizen</dt>
          <dd class="text-sm">{item.notes}</dd>
        </div>
      {/if}
    </div>

    <!-- Sidebar: QR + Custom Values -->
    <div class="space-y-4">
      <!-- QR Code Placeholder -->
      <div class="glass-card p-5 text-center">
        <h3 class="mb-3 text-sm font-semibold">QR-Code</h3>
        <div
          class="border-glass-border mx-auto flex h-32 w-32 items-center justify-center rounded border-2 border-dashed"
        >
          <span class="text-secondary text-xs">QR V2</span>
        </div>
        <p class="text-secondary mt-2 font-mono text-xs">{item.id}</p>
      </div>

      <!-- Custom Values -->
      {#if customValues.length > 0}
        <div class="glass-card p-5">
          <h3 class="mb-3 text-sm font-semibold">
            <i class="fas fa-sliders-h mr-2"></i>Custom Fields
          </h3>
          <dl class="space-y-2">
            {#each customValues as cv (cv.fieldId)}
              <div>
                <dt class="text-secondary text-xs">
                  {cv.fieldName}
                  {#if cv.fieldUnit}<span>({cv.fieldUnit})</span>{/if}
                </dt>
                <dd class="text-sm">
                  {#if cv.fieldType === 'boolean'}
                    <i
                      class="fas {cv.valueBoolean === true ?
                        'fa-check-circle text-success'
                      : 'fa-times-circle text-error'}"
                    ></i>
                    {cv.valueBoolean === true ? 'Ja' : 'Nein'}
                  {:else if cv.fieldType === 'number' && cv.valueNumber !== null}
                    {cv.valueNumber}{cv.fieldUnit !== null ? ` ${cv.fieldUnit}` : ''}
                  {:else if cv.fieldType === 'date' && cv.valueDate !== null}
                    {new Date(cv.valueDate).toLocaleDateString('de-DE')}
                  {:else}
                    {cv.valueText ?? '—'}
                  {/if}
                </dd>
              </div>
            {/each}
          </dl>
        </div>
      {/if}
    </div>
  </div>

  <!-- Photos -->
  {#if photos.length > 0}
    <div class="glass-card mt-6 p-5">
      <h2 class="mb-4 text-lg font-semibold">
        <i class="fas fa-images mr-2"></i>Fotos ({photos.length})
      </h2>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {#each photos as photo (photo.id)}
          <div class="group relative overflow-hidden rounded-lg">
            <img
              src={photo.filePath}
              alt={photo.caption ?? item.name}
              class="h-40 w-full object-cover"
            />
            {#if photo.caption}
              <div class="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-xs text-white">
                {photo.caption}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
{/if}

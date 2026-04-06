<script lang="ts">
  /**
   * Inventory Item Detail - Page Component
   * @module inventory/items/[uuid]/+page
   *
   * QR code target page. Shows full item details, photos, custom values.
   * Must work well on mobile (scanned from QR label on equipment).
   */
  import { goto, invalidateAll } from '$app/navigation';

  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { showErrorAlert, showSuccessAlert } from '$lib/stores/toast';
  import { createLogger } from '$lib/utils/logger';

  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import {
    deleteItem as apiDeleteItem,
    deletePhoto as apiDeletePhoto,
    updateItem as apiUpdateItem,
    updatePhotoCaption as apiUpdatePhotoCaption,
    uploadItemPhoto as apiUploadPhoto,
  } from '../../_lib/api';
  import { ITEM_STATUS_BADGE_CLASSES, ITEM_STATUS_LABELS } from '../../_lib/constants';
  import ItemEditModal from '../../_lib/ItemEditModal.svelte';

  import type { PageData } from './$types';
  import type {
    InventoryItemPhoto,
    InventoryItemStatus,
    UpdateItemPayload,
  } from '../../_lib/types';

  const log = createLogger('InventoryItemDetail');
  const MAX_PHOTO_SIZE = 5_242_880; // 5 MB

  const { data }: { data: PageData } = $props();

  const detail = $derived(data.detail);
  const item = $derived(detail?.item ?? null);
  const photos = $derived(detail?.photos ?? []);
  const customValues = $derived(detail?.customValues ?? []);
  const fields = $derived(detail?.fields ?? []);

  const listUrl = $derived(item !== null ? `/inventory/lists/${item.list_id}` : '/inventory');

  // ── UI State ─────────────────────────────────────────────────
  let showEditModal = $state(false);
  let submitting = $state(false);
  let showDeletePhotoModal = $state(false);
  let deletePhotoId = $state<string | null>(null);
  let showDeleteItemModal = $state(false);
  let editCaptionId = $state<string | null>(null);
  let editCaptionText = $state('');
  let previewPhoto = $state<InventoryItemPhoto | null>(null);
  let fileInput: HTMLInputElement | undefined = $state();
  let uploading = $state(false);

  // ── Edit Item ────────────────────────────────────────────────
  async function handleEditSubmit(payload: UpdateItemPayload): Promise<void> {
    if (item === null) return;
    submitting = true;
    try {
      await apiUpdateItem(item.id, payload);
      showEditModal = false;
      await invalidateAll();
      showSuccessAlert('Gegenstand erfolgreich aktualisiert');
    } catch (err: unknown) {
      log.error({ err }, 'Error updating item');
      showErrorAlert('Fehler beim Aktualisieren');
    } finally {
      submitting = false;
    }
  }

  // ── Status Change ────────────────────────────────────────────
  async function handleStatusChange(e: Event): Promise<void> {
    if (item === null) return;
    const select = e.target as HTMLSelectElement;
    const newStatus = select.value as InventoryItemStatus;
    if (newStatus === item.status) return;

    try {
      await apiUpdateItem(item.id, { status: newStatus });
      await invalidateAll();
      showSuccessAlert(`Status geändert: ${ITEM_STATUS_LABELS[newStatus]}`);
    } catch (err: unknown) {
      log.error({ err }, 'Error changing status');
      showErrorAlert('Fehler beim Statuswechsel');
    }
  }

  // ── Delete Item ──────────────────────────────────────────────
  async function handleDeleteItem(): Promise<void> {
    if (item === null) return;
    try {
      await apiDeleteItem(item.id);
      showDeleteItemModal = false;
      showSuccessAlert('Gegenstand gelöscht');
      void goto(listUrl);
    } catch (err: unknown) {
      log.error({ err }, 'Error deleting item');
      showErrorAlert('Fehler beim Löschen');
    }
  }

  // ── Photo Upload (TPM pattern) ───────────────────────────────
  function triggerUpload(): void {
    fileInput?.click();
  }

  async function handleFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file === undefined || item === null) return;

    if (file.size > MAX_PHOTO_SIZE) {
      showErrorAlert('Foto darf maximal 5 MB groß sein');
      input.value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      showErrorAlert('Nur Bilddateien (JPEG, PNG, WebP) erlaubt');
      input.value = '';
      return;
    }

    uploading = true;
    try {
      await apiUploadPhoto(item.id, file);
      showSuccessAlert('Foto hochgeladen');
      await invalidateAll();
    } catch (err: unknown) {
      log.error({ err }, 'Error uploading photo');
      showErrorAlert('Fehler beim Hochladen');
    } finally {
      uploading = false;
      input.value = '';
    }
  }

  // ── Photo Management ─────────────────────────────────────────
  async function handleDeletePhoto(): Promise<void> {
    const id = deletePhotoId;
    if (id === null) return;
    try {
      await apiDeletePhoto(id);
      showDeletePhotoModal = false;
      if (deletePhotoId === id) deletePhotoId = null;
      await invalidateAll();
      showSuccessAlert('Foto gelöscht');
    } catch (err: unknown) {
      log.error({ err }, 'Error deleting photo');
      showErrorAlert('Fehler beim Löschen des Fotos');
    }
  }

  function startEditCaption(photoId: string, currentCaption: string | null): void {
    editCaptionId = photoId;
    editCaptionText = currentCaption ?? '';
  }

  async function saveCaption(): Promise<void> {
    const id = editCaptionId;
    if (id === null) return;
    try {
      await apiUpdatePhotoCaption(id, editCaptionText.trim() || null);
      if (editCaptionId === id) editCaptionId = null;
      await invalidateAll();
      showSuccessAlert('Beschriftung aktualisiert');
    } catch (err: unknown) {
      log.error({ err }, 'Error updating caption');
      showErrorAlert('Fehler beim Aktualisieren der Beschriftung');
    }
  }

  function getPhotoUrl(photoPath: string): string {
    return `/${photoPath}`;
  }
</script>

<svelte:head>
  <title>{item?.name ?? 'Gegenstand'} - Inventar - Assixx</title>
</svelte:head>

<!-- Hidden file input (TPM pattern) -->
<input
  bind:this={fileInput}
  type="file"
  accept="image/jpeg,image/png,image/webp"
  class="sr-only"
  onchange={handleFileSelected}
/>

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
      <div class="flex-1">
        <h1 class="text-2xl font-bold">{item.name}</h1>
        <p class="text-secondary text-sm">
          <span class="font-mono font-semibold">{item.code}</span>
          · {item.list_title}
        </p>
      </div>

      <!-- Status Dropdown -->
      <select
        class="badge {ITEM_STATUS_BADGE_CLASSES[
          item.status
        ]} cursor-pointer border-none text-sm font-semibold"
        value={item.status}
        onchange={handleStatusChange}
        aria-label="Status ändern"
      >
        {#each Object.entries(ITEM_STATUS_LABELS) as [value, label] (value)}
          <option {value}>{label}</option>
        {/each}
      </select>

      <!-- Edit Button -->
      <button
        type="button"
        class="btn btn-primary btn-sm"
        onclick={() => (showEditModal = true)}
      >
        <i class="fas fa-edit mr-1"></i>Bearbeiten
      </button>

      <!-- Delete Button -->
      <button
        type="button"
        class="action-icon action-icon--delete"
        title="Gegenstand löschen"
        aria-label="Gegenstand löschen"
        onclick={() => (showDeleteItemModal = true)}
      >
        <i class="fas fa-trash"></i>
      </button>
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

    <!-- Sidebar -->
    <div class="space-y-4">
      <!-- QR Code Placeholder -->
      <div class="glass-card p-5 text-center">
        <h3 class="mb-3 text-sm font-semibold">QR-Code</h3>
        <div
          class="border-glass-border mx-auto flex h-32 w-32 items-center justify-center rounded border-2 border-dashed"
        >
          <span class="text-secondary text-xs">QR V1.1</span>
        </div>
        <p class="text-secondary mt-2 font-mono text-xs">{item.id}</p>
      </div>

      <!-- Custom Values -->
      {#if customValues.length > 0 || fields.length > 0}
        <div class="glass-card p-5">
          <h3 class="mb-3 text-sm font-semibold">
            <i class="fas fa-sliders-h mr-2"></i>Custom Fields
          </h3>
          <dl class="space-y-2">
            {#each fields as field (field.id)}
              {@const cv = customValues.find((v) => v.fieldId === field.id)}
              <div>
                <dt class="text-secondary text-xs">
                  {field.fieldName}
                  {#if field.fieldUnit}<span>({field.fieldUnit})</span>{/if}
                </dt>
                <dd class="text-sm">
                  {#if cv === undefined}
                    <span class="text-secondary italic">—</span>
                  {:else if cv.fieldType === 'boolean'}
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

  <!-- Photos Section -->
  <div class="glass-card mt-6 p-5">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-semibold">
        <i class="fas fa-images mr-2"></i>Fotos ({photos.length})
      </h2>
      <button
        type="button"
        class="btn btn-primary btn-sm"
        onclick={triggerUpload}
        disabled={uploading}
      >
        {#if uploading}
          <span class="spinner-ring spinner-ring--sm mr-1"></span>
        {:else}
          <i class="fas fa-camera mr-1"></i>
        {/if}
        Foto hochladen
      </button>
    </div>

    {#if photos.length > 0}
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {#each photos as photo (photo.id)}
          <div class="group relative overflow-hidden rounded-lg">
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div
              class="photo-thumbnail"
              onclick={() => (previewPhoto = photo)}
            >
              <img
                src={getPhotoUrl(photo.filePath)}
                alt={photo.caption ?? item.name}
                loading="lazy"
              />
            </div>
            <!-- Photo Actions -->
            <div
              class="absolute inset-x-0 top-0 flex justify-end gap-1 p-1 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <button
                type="button"
                class="rounded bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
                title="Beschriftung bearbeiten"
                onclick={() => {
                  startEditCaption(photo.id, photo.caption);
                }}
              >
                <i class="fas fa-pen"></i>
              </button>
              <button
                type="button"
                class="rounded bg-red-600/80 px-2 py-1 text-xs text-white hover:bg-red-600"
                title="Foto löschen"
                onclick={() => {
                  deletePhotoId = photo.id;
                  showDeletePhotoModal = true;
                }}
              >
                <i class="fas fa-trash"></i>
              </button>
            </div>
            <!-- Caption Editing -->
            {#if editCaptionId === photo.id}
              <div class="absolute inset-x-0 bottom-0 bg-black/80 p-2">
                <input
                  type="text"
                  class="w-full rounded bg-white/10 px-2 py-1 text-xs text-white"
                  bind:value={editCaptionText}
                  placeholder="Beschriftung..."
                  onkeydown={(e: KeyboardEvent) => {
                    if (e.key === 'Enter') void saveCaption();
                    if (e.key === 'Escape') editCaptionId = null;
                  }}
                />
                <div class="mt-1 flex justify-end gap-1">
                  <button
                    type="button"
                    class="text-xs text-white/60 hover:text-white"
                    onclick={() => (editCaptionId = null)}>Abbrechen</button
                  >
                  <button
                    type="button"
                    class="text-xs font-semibold text-white hover:text-blue-300"
                    onclick={() => void saveCaption()}>Speichern</button
                  >
                </div>
              </div>
            {:else if photo.caption}
              <div class="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-xs text-white">
                {photo.caption}
              </div>
            {/if}
          </div>
        {/each}

        <!-- Upload Placeholder Card -->
        <button
          type="button"
          class="upload-placeholder"
          onclick={triggerUpload}
          disabled={uploading}
        >
          <i class="fas fa-plus text-2xl"></i>
          <span class="text-xs">Foto hinzufügen</span>
          <span class="text-xs opacity-50">max. 5 MB</span>
        </button>
      </div>
    {:else}
      <!-- Empty State: Upload Button -->
      <button
        type="button"
        class="upload-placeholder upload-placeholder--large"
        onclick={triggerUpload}
        disabled={uploading}
      >
        <i class="fas fa-camera text-3xl"></i>
        <span>Erstes Foto hochladen</span>
        <span class="text-xs opacity-50">JPEG, PNG, WebP · max. 5 MB</span>
      </button>
    {/if}
  </div>

  <!-- Edit Modal -->
  {#if showEditModal && item !== null}
    <ItemEditModal
      {item}
      {fields}
      {customValues}
      {submitting}
      onclose={() => (showEditModal = false)}
      onsubmit={handleEditSubmit}
    />
  {/if}

  <!-- Photo Preview Modal (TPM pattern) -->
  {#if previewPhoto !== null}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="modal-overlay modal-overlay--active"
      onclick={() => (previewPhoto = null)}
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
            {previewPhoto.caption ?? item.name}
          </h3>
          <button
            type="button"
            class="ds-modal__close"
            aria-label="Schliessen"
            onclick={() => (previewPhoto = null)}
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="ds-modal__body p-0">
          <div
            class="flex min-h-[400px] w-full items-center justify-center"
            style="background: var(--color-glass-bg, #111);"
          >
            <img
              src={getPhotoUrl(previewPhoto.filePath)}
              alt={previewPhoto.caption ?? item.name}
              class="max-h-[80vh] max-w-full object-contain"
            />
          </div>
          <div
            class="flex items-center gap-6 p-4 text-sm"
            style="border-top: 1px solid var(--color-border, rgb(255 255 255 / 10%)); color: var(--color-text-secondary);"
          >
            <span class="flex items-center gap-2">
              <i class="fas fa-cube"></i>
              {item.code}
            </span>
            {#if previewPhoto.caption}
              <span class="flex items-center gap-2">
                <i class="fas fa-tag"></i>
                {previewPhoto.caption}
              </span>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Delete Photo Confirm -->
  <ConfirmModal
    show={showDeletePhotoModal}
    id="delete-photo-modal"
    title="Foto löschen?"
    variant="danger"
    icon="fa-exclamation-triangle"
    onconfirm={() => void handleDeletePhoto()}
    oncancel={() => {
      showDeletePhotoModal = false;
      deletePhotoId = null;
    }}
  >
    <p>Das Foto wird unwiderruflich entfernt.</p>
  </ConfirmModal>

  <!-- Delete Item Confirm -->
  <ConfirmModal
    show={showDeleteItemModal}
    id="delete-item-modal"
    title="Gegenstand löschen?"
    variant="danger"
    icon="fa-exclamation-triangle"
    onconfirm={() => void handleDeleteItem()}
    oncancel={() => (showDeleteItemModal = false)}
  >
    <p>
      <strong>{item.name}</strong> ({item.code}) wird gelöscht. Diese Aktion kann nicht rückgängig
      gemacht werden.
    </p>
  </ConfirmModal>
{/if}

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border-width: 0;
  }

  .photo-thumbnail {
    cursor: pointer;
    overflow: hidden;
    aspect-ratio: 1;
    border: 2px solid transparent;
    border-radius: var(--radius-lg, 0.5rem);
    background: var(--color-glass-bg, rgb(255 255 255 / 5%));
    transition: transform 0.2s ease;
  }

  .photo-thumbnail:hover {
    transform: scale(1.02);
    border-color: var(--color-primary, #3b82f6);
  }

  .photo-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    aspect-ratio: 1;
    border: 2px dashed var(--color-border, rgb(255 255 255 / 15%));
    border-radius: var(--radius-lg, 0.5rem);
    background: none;
    color: var(--color-text-secondary, #888);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .upload-placeholder:hover {
    border-color: var(--color-primary, #3b82f6);
    color: var(--color-primary, #3b82f6);
  }

  .upload-placeholder--large {
    aspect-ratio: auto;
    padding: 2rem;
    width: 100%;
  }
</style>

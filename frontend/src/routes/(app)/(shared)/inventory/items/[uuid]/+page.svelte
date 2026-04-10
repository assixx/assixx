<script lang="ts">
  /**
   * Inventory Item Detail - Page Component
   * @module inventory/items/[uuid]/+page
   *
   * QR code target page. Shows full item details, photos, custom values.
   * Must work well on mobile (scanned from QR label on equipment).
   */
  import QRCode from 'qrcode';

  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/state';

  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { showErrorAlert, showSuccessAlert } from '$lib/stores/toast';
  import { createLogger } from '$lib/utils/logger';

  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import {
    deleteItem as apiDeleteItem,
    deletePhoto as apiDeletePhoto,
    reorderPhotos as apiReorderPhotos,
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
  let statusDropdownOpen = $state(false);
  let qrCanvas: HTMLCanvasElement | undefined = $state();

  const statusLabel = $derived(item !== null ? ITEM_STATUS_LABELS[item.status] : '');

  // ── QR Code ─────────────────────────────────────────────────
  const itemUrl = $derived(item !== null ? `${page.url.origin}/inventory/items/${item.id}` : '');

  $effect(() => {
    if (qrCanvas === undefined || itemUrl === '') return;
    void QRCode.toCanvas(qrCanvas, itemUrl, {
      width: 160,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });
  });

  function downloadQr(): void {
    if (qrCanvas === undefined || item === null) return;
    const link = document.createElement('a');
    link.download = `qr-${item.code}.png`;
    link.href = qrCanvas.toDataURL('image/png');
    link.click();
  }

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
  async function handleStatusChange(newStatus: InventoryItemStatus): Promise<void> {
    if (item === null || newStatus === item.status) return;
    statusDropdownOpen = false;
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

  // ── Photo Drag & Drop Reorder ────────────────────────────────
  let dragIdx = $state<number | null>(null);
  let dropIdx = $state<number | null>(null);

  function handleDragStart(idx: number, e: DragEvent): void {
    dragIdx = idx;
    if (e.dataTransfer !== null) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragOver(idx: number, e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer !== null) e.dataTransfer.dropEffect = 'move';
    dropIdx = idx;
  }

  function handleDragEnd(): void {
    dragIdx = null;
    dropIdx = null;
  }

  async function handleDrop(targetIdx: number): Promise<void> {
    if (dragIdx === null || dragIdx === targetIdx || item === null) {
      handleDragEnd();
      return;
    }
    const reordered = [...photos];
    const moved = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, ...moved);
    handleDragEnd();

    try {
      await apiReorderPhotos(
        item.id,
        reordered.map((p) => p.id),
      );
      await invalidateAll();
    } catch (err: unknown) {
      log.error({ err }, 'Error reordering photos');
      showErrorAlert('Fehler beim Sortieren der Fotos');
    }
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
  <div class="card p-8 text-center">
    <i class="fas fa-exclamation-triangle text-warning mb-4 text-4xl"></i>
    <p class="text-lg">Inventargegenstand nicht gefunden</p>
    <a
      href="/inventory"
      class="btn btn-primary mt-4">Zurück zur Übersicht</a
    >
  </div>
{:else}
  <div class="container">
    <!-- Back Button -->
    <a
      href={listUrl}
      class="btn btn-light mb-4"
    >
      <i class="fas fa-arrow-left mr-2"></i>Zurück zur Liste
    </a>

    <!-- Header Card -->
    <div class="card mb-6">
      <div class="card__header detail-header">
        <div class="detail-header__left">
          <h1 class="detail-header__title">{item.name}</h1>
          <div class="detail-header__meta">
            <code class="detail-header__code">{item.code}</code>
            <span class="text-(--color-text-secondary)">·</span>
            <span class="text-(--color-text-secondary)">{item.list_title}</span>
            <span class="badge {ITEM_STATUS_BADGE_CLASSES[item.status]}">
              {ITEM_STATUS_LABELS[item.status]}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="btn btn-primary"
            onclick={() => (showEditModal = true)}
          >
            <i class="fas fa-edit mr-1"></i>Bearbeiten
          </button>
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
    </div>

    <!-- Two-Column Layout -->
    <div class="detail-layout">
      <!-- Main Content -->
      <div class="detail-main">
        <!-- Stammdaten Card -->
        <div class="card">
          <div class="card__header">
            <h2 class="card__title">
              <i class="fas fa-info-circle mr-2"></i>Stammdaten
            </h2>
          </div>
          <div class="card__body">
            <div class="data-list data-list--grid">
              <div class="data-list__item">
                <span class="data-list__label">Code</span>
                <span class="data-list__value font-mono font-semibold">{item.code}</span>
              </div>
              <div class="data-list__item">
                <span class="data-list__label">Status</span>
                <span class="data-list__value">
                  <div class="dropdown">
                    <button
                      type="button"
                      class="dropdown__trigger"
                      class:active={statusDropdownOpen}
                      onclick={() => {
                        statusDropdownOpen = !statusDropdownOpen;
                      }}
                    >
                      <span>{statusLabel}</span>
                      <i class="fas fa-chevron-down"></i>
                    </button>
                    <div
                      class="dropdown__menu"
                      class:active={statusDropdownOpen}
                    >
                      {#each Object.entries(ITEM_STATUS_LABELS) as [value, label] (value)}
                        <button
                          type="button"
                          class="dropdown__option"
                          class:dropdown__option--selected={item.status === value}
                          onclick={() => {
                            void handleStatusChange(value as InventoryItemStatus);
                          }}
                        >
                          {label}
                        </button>
                      {/each}
                    </div>
                  </div>
                </span>
              </div>
              {#if item.location}
                <div class="data-list__item">
                  <span class="data-list__label">Standort</span>
                  <span class="data-list__value">{item.location}</span>
                </div>
              {/if}
              {#if item.manufacturer}
                <div class="data-list__item">
                  <span class="data-list__label">Hersteller</span>
                  <span class="data-list__value">{item.manufacturer}</span>
                </div>
              {/if}
              {#if item.model}
                <div class="data-list__item">
                  <span class="data-list__label">Modell</span>
                  <span class="data-list__value">{item.model}</span>
                </div>
              {/if}
              {#if item.serial_number}
                <div class="data-list__item">
                  <span class="data-list__label">Seriennummer</span>
                  <span class="data-list__value font-mono">{item.serial_number}</span>
                </div>
              {/if}
              {#if item.year_of_manufacture}
                <div class="data-list__item">
                  <span class="data-list__label">Baujahr</span>
                  <span class="data-list__value">{item.year_of_manufacture}</span>
                </div>
              {/if}
            </div>
          </div>
        </div>

        <!-- Description Card -->
        {#if item.description ?? item.notes}
          <div class="card">
            <div class="card__header">
              <h2 class="card__title">
                <i class="fas fa-align-left mr-2"></i>Beschreibung & Notizen
              </h2>
            </div>
            <div class="card__body">
              {#if item.description}
                <p class="mb-3">{item.description}</p>
              {/if}
              {#if item.notes}
                <div class="detail-notes">
                  <span class="detail-notes__label">
                    <i class="fas fa-sticky-note mr-1"></i>Notizen
                  </span>
                  <p class="text-sm">{item.notes}</p>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Photos Card -->
        <div class="card">
          <div class="card__header">
            <h2 class="card__title">
              <i class="fas fa-images mr-2"></i>Fotos ({photos.length})
            </h2>
            <button
              type="button"
              class="btn btn-primary"
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
          <div class="card__body">
            {#if photos.length > 0}
              <div
                class="photo-grid"
                role="list"
              >
                {#each photos as photo, idx (photo.id)}
                  <div
                    class="group relative overflow-hidden rounded-lg"
                    class:photo-drag-over={dropIdx === idx && dragIdx !== idx}
                    class:photo-dragging={dragIdx === idx}
                    role="listitem"
                    draggable="true"
                    ondragstart={(e: DragEvent) => {
                      handleDragStart(idx, e);
                    }}
                    ondragover={(e: DragEvent) => {
                      handleDragOver(idx, e);
                    }}
                    ondragleave={() => {
                      if (dropIdx === idx) dropIdx = null;
                    }}
                    ondrop={() => {
                      void handleDrop(idx);
                    }}
                    ondragend={handleDragEnd}
                  >
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
                    {#if idx === 0}
                      <div class="photo-cover-badge">
                        <i class="fas fa-star"></i>
                      </div>
                    {/if}
                    <div class="photo-drag-handle">
                      <i class="fas fa-grip-vertical"></i>
                    </div>
                    <div
                      class="absolute inset-x-0 top-0 flex justify-end gap-1 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <button
                        type="button"
                        class="photo-action-btn"
                        title="Beschriftung bearbeiten"
                        onclick={() => {
                          startEditCaption(photo.id, photo.caption);
                        }}
                      >
                        <i class="fas fa-pen"></i>
                      </button>
                      <button
                        type="button"
                        class="photo-action-btn photo-action-btn--danger"
                        title="Foto löschen"
                        onclick={() => {
                          deletePhotoId = photo.id;
                          showDeletePhotoModal = true;
                        }}
                      >
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
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
                      <div
                        class="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-xs text-white"
                      >
                        {photo.caption}
                      </div>
                    {/if}
                  </div>
                {/each}

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
        </div>
      </div>

      <!-- Sidebar -->
      <div class="detail-sidebar">
        <!-- QR Code Card -->
        <div class="card">
          <div class="card__header">
            <h3 class="card__title">
              <i class="fas fa-qrcode mr-2"></i>QR-Code
            </h3>
          </div>
          <div class="card__body text-center">
            <div class="qr-container">
              <canvas bind:this={qrCanvas}></canvas>
            </div>
            <p class="mt-2 font-mono text-xs text-(--color-text-secondary)">{item.code}</p>
            <button
              type="button"
              class="btn btn-light mt-3"
              onclick={downloadQr}
            >
              <i class="fas fa-download mr-1"></i>PNG herunterladen
            </button>
          </div>
        </div>

        <!-- Custom Fields Card -->
        {#if customValues.length > 0 || fields.length > 0}
          <div class="card">
            <div class="card__header">
              <h3 class="card__title">
                <i class="fas fa-sliders-h mr-2"></i>Eigene Felder
              </h3>
            </div>
            <div class="card__body">
              <div class="data-list">
                {#each fields as field (field.id)}
                  {@const cv = customValues.find((v) => v.fieldId === field.id)}
                  <div class="data-list__item">
                    <span class="data-list__label">
                      {field.fieldName}
                      {#if field.fieldUnit}<span class="text-(--color-text-secondary)"
                          >({field.fieldUnit})</span
                        >{/if}
                    </span>
                    <span class="data-list__value">
                      {#if cv === undefined}
                        <span class="text-(--color-text-secondary) italic">—</span>
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
                    </span>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
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

  <!-- Photo Preview Modal -->
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
          <div class="photo-preview-meta">
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

  /* ── Layout ──────────────────────────────────────────────── */

  .detail-layout {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 1.5rem;
    align-items: start;
  }

  .detail-main {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .detail-sidebar {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  @media (width <= 1024px) {
    .detail-layout {
      grid-template-columns: 1fr;
    }
  }

  /* ── Header Card ─────────────────────────────────────────── */

  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .detail-header__title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.3;
  }

  .detail-header__meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.25rem;
    flex-wrap: wrap;
  }

  .detail-header__code {
    font-size: 0.875rem;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: var(--color-glass-bg, rgb(255 255 255 / 5%));
    font-weight: 600;
  }

  /* ── Stammdaten data-list overrides ───────────────────────── */

  .detail-main :global(.data-list--grid .data-list__label) {
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.75px;
    opacity: 60%;
  }

  .detail-main :global(.data-list--grid .data-list__label) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .detail-main :global(.data-list--grid .data-list__label::before) {
    flex-shrink: 0;
    width: 3px;
    height: 1em;
    border-radius: 2px;
    background: linear-gradient(180deg, var(--color-primary), var(--color-primary-light, #64b5f6));
    content: '';
  }

  .detail-main :global(.data-list--grid .data-list__value) {
    font-size: 1rem;
    font-weight: 500;
  }

  /* ── Notes ───────────────────────────────────────────────── */

  .detail-notes {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-glass-border, rgb(255 255 255 / 10%));
  }

  .detail-notes__label {
    display: block;
    margin-bottom: 0.25rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  /* ── QR Code ─────────────────────────────────────────────── */

  .qr-container {
    display: inline-block;
    padding: 0.5rem;
    border-radius: 0.5rem;
    background: #fff;
    line-height: 0;
  }

  .qr-container canvas {
    display: block;
    border-radius: 0.25rem;
  }

  /* ── Photo Grid ──────────────────────────────────────────── */

  .photo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 1rem;
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

  .photo-action-btn {
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: 0.25rem;
    background: rgb(0 0 0 / 60%);
    color: rgb(255 255 255);
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .photo-action-btn:hover {
    background: rgb(0 0 0 / 80%);
  }

  .photo-action-btn--danger {
    background: rgb(220 38 38 / 80%);
  }

  .photo-action-btn--danger:hover {
    background: rgb(220 38 38);
  }

  .photo-preview-meta {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 1rem;
    border-top: 1px solid var(--color-border, rgb(255 255 255 / 10%));
    color: var(--color-text-secondary);
    font-size: 0.875rem;
  }

  /* ── Drag & Drop ─────────────────────────────────────────── */

  .photo-drag-handle {
    position: absolute;
    bottom: 0.375rem;
    left: 0.375rem;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.375rem;
    background: rgb(0 0 0 / 60%);
    color: rgb(255 255 255);
    font-size: 0.75rem;
    cursor: grab;
    opacity: 0%;
    transition: opacity 0.15s ease;
  }

  .photo-drag-handle:active {
    cursor: grabbing;
  }

  :global(.group):hover .photo-drag-handle {
    opacity: 100%;
  }

  .photo-dragging {
    opacity: 40%;
    transform: scale(0.95);
    transition:
      opacity 0.15s ease,
      transform 0.15s ease;
  }

  .photo-drag-over {
    outline: 2px dashed var(--color-primary, #3b82f6);
    outline-offset: -2px;
    border-radius: var(--radius-lg, 0.5rem);
  }

  /* ── Cover Badge (first photo = thumbnail) ─────────────── */

  .photo-cover-badge {
    position: absolute;
    top: 0.375rem;
    left: 0.375rem;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background: var(--color-primary, #3b82f6);
    color: rgb(255 255 255);
    font-size: 0.625rem;
    pointer-events: none;
  }

  /* ── Upload Placeholder ──────────────────────────────────── */

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

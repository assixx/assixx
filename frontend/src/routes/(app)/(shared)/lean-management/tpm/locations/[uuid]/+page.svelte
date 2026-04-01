<script lang="ts">
  /**
   * TPM Locations — Page Component
   *
   * Structured location descriptions for a TPM maintenance plan.
   * Design follows card detail page pattern (card__header, card-detail-grid, section-titles).
   */
  import { invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';

  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { showToast } from '$lib/stores/toast';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('TpmLocationsPage');

  import {
    createLocation,
    updateLocation,
    deleteLocation,
    uploadLocationPhoto,
    removeLocationPhoto,
  } from '../../_lib/api';
  import { MESSAGES } from '../../_lib/constants';

  import LocationCard from './_lib/LocationCard.svelte';
  import LocationForm from './_lib/LocationForm.svelte';

  import type { PageData } from './$types';
  import type { TpmLocation } from '../../_lib/types';

  const { data }: { data: PageData } = $props();

  const permissionDenied = $derived(data.permissionDenied);
  const plan = $derived(data.plan);
  const planUuid = $derived(data.planUuid);
  const locations = $derived(data.locations);

  /** Only root/admin can create/edit/delete locations */
  const canWrite = $derived(data.userRole === 'root' || data.userRole === 'admin');

  // =========================================================================
  // STATE
  // =========================================================================

  let showForm = $state(false);
  let editingLocation: TpmLocation | undefined = $state();
  let saving = $state(false);
  let confirmDelete: TpmLocation | null = $state(null);

  /** Hidden file input for photo upload */
  let fileInput: HTMLInputElement | undefined = $state();
  let photoTargetUuid: string | null = $state(null);

  /** Photo preview modal state (blackboard pattern) */
  let showPreviewModal = $state(false);
  let previewLocation: TpmLocation | null = $state(null);

  /** Reset UI state after successful CRUD operations */
  function resetFormState(): void {
    showForm = false;
    editingLocation = undefined;
  }

  const isEditing = $derived(editingLocation !== undefined);

  const nextPosition = $derived(
    locations.length > 0 ? Math.max(...locations.map((l: TpmLocation) => l.positionNumber)) + 1 : 1,
  );

  // =========================================================================
  // CRUD HANDLERS
  // =========================================================================

  async function handleSave(formData: {
    positionNumber: number;
    title: string;
    description: string | null;
  }): Promise<void> {
    saving = true;
    try {
      if (isEditing && editingLocation !== undefined) {
        await updateLocation(editingLocation.uuid, formData);
        showToast({
          title: MESSAGES.LOCATIONS_SUCCESS_UPDATE,
          type: 'success',
        });
      } else {
        await createLocation({ planUuid, ...formData });
        showToast({
          title: MESSAGES.LOCATIONS_SUCCESS_CREATE,
          type: 'success',
        });
      }
      resetFormState();
      await invalidateAll();
    } catch (err: unknown) {
      log.error({ err }, 'Location operation failed');
      showToast({ title: MESSAGES.LOCATIONS_ERROR_SAVE, type: 'error' });
    } finally {
      saving = false;
    }
  }

  function handleCancel(): void {
    showForm = false;
    editingLocation = undefined;
  }

  function handleEdit(location: TpmLocation): void {
    editingLocation = location;
    showForm = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleDeleteRequest(location: TpmLocation): void {
    confirmDelete = location;
  }

  async function handleDeleteConfirm(): Promise<void> {
    const target = confirmDelete;
    if (target === null) return;
    saving = true;
    confirmDelete = null;
    try {
      await deleteLocation(target.uuid);
      showToast({ title: MESSAGES.LOCATIONS_SUCCESS_DELETE, type: 'success' });
      await invalidateAll();
    } catch (err: unknown) {
      log.error({ err }, 'Location operation failed');
      showToast({ title: MESSAGES.LOCATIONS_ERROR_DELETE, type: 'error' });
    } finally {
      saving = false;
    }
  }

  // =========================================================================
  // PHOTO HANDLERS
  // =========================================================================

  function handleUploadPhoto(location: TpmLocation): void {
    photoTargetUuid = location.uuid;
    fileInput?.click();
  }

  async function handleFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const targetUuid = photoTargetUuid;
    photoTargetUuid = null;
    if (file === undefined || targetUuid === null) return;

    if (file.size > 5_242_880) {
      showToast({ title: MESSAGES.PHOTO_TOO_LARGE, type: 'error' });
      input.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast({ title: MESSAGES.PHOTO_INVALID_TYPE, type: 'error' });
      input.value = '';
      return;
    }
    try {
      await uploadLocationPhoto(targetUuid, file);
      showToast({ title: 'Foto hochgeladen', type: 'success' });
      await invalidateAll();
    } catch (err: unknown) {
      log.error({ err }, 'Location operation failed');
      showToast({ title: MESSAGES.PHOTO_ERROR, type: 'error' });
    } finally {
      input.value = '';
    }
  }

  async function handleRemovePhoto(location: TpmLocation): Promise<void> {
    try {
      await removeLocationPhoto(location.uuid);
      showToast({ title: 'Foto entfernt', type: 'success' });
      await invalidateAll();
    } catch (err: unknown) {
      log.error({ err }, 'Location operation failed');
      showToast({ title: MESSAGES.PHOTO_ERROR, type: 'error' });
    }
  }

  // =========================================================================
  // PREVIEW MODAL (blackboard pattern)
  // =========================================================================

  function openPreview(location: TpmLocation): void {
    previewLocation = location;
    showPreviewModal = true;
  }

  function closePreview(): void {
    showPreviewModal = false;
    previewLocation = null;
  }

  function stopPropagation(e: Event): void {
    e.stopPropagation();
  }

  function getPhotoUrl(loc: TpmLocation): string {
    if (loc.photoPath === null) return '';
    return `/${loc.photoPath}`;
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }

  function navigateToBoard(): void {
    window.location.href = resolve(`/lean-management/tpm/board/${planUuid}`);
  }
</script>

<svelte:head>
  <title>
    {plan !== null ? `Standorte: ${plan.name}` : MESSAGES.LOCATIONS_HEADING} — Assixx
  </title>
</svelte:head>

{#if permissionDenied}
  <PermissionDenied addonName="das TPM-System" />
{:else}
  <!-- Hidden file input for photo upload -->
  <input
    bind:this={fileInput}
    type="file"
    accept="image/jpeg,image/png,image/webp"
    class="loc-sr-only"
    onchange={handleFileSelected}
  />

  <div class="container">
    <!-- Back + Actions -->
    <div class="mb-4 flex items-center justify-between">
      <button
        type="button"
        class="btn btn-light"
        onclick={navigateToBoard}
      >
        <i class="fas fa-arrow-left mr-2"></i>
        {MESSAGES.LOCATIONS_BACK}
      </button>
      {#if canWrite && !showForm && plan !== null}
        <button
          type="button"
          class="btn btn-secondary"
          onclick={() => {
            showForm = true;
            editingLocation = undefined;
          }}
        >
          <i class="fas fa-plus mr-2"></i>
          {MESSAGES.LOCATIONS_ADD}
        </button>
      {/if}
    </div>

    {#if data.error !== null || plan === null}
      <div class="empty-state">
        <div class="empty-state__icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3 class="empty-state__title">Wartungsplan nicht gefunden</h3>
        <p class="empty-state__description">
          Der angeforderte Wartungsplan existiert nicht oder wurde gelöscht.
        </p>
      </div>
    {:else}
      <!-- Page Header -->
      <div class="card">
        <div class="card__header">
          <h2 class="card__title m-0">{MESSAGES.LOCATIONS_HEADING}</h2>
          <div class="mt-1 flex items-center gap-2">
            <span class="text-xs font-bold tracking-wider text-(--color-text-muted) uppercase">
              {plan.name}
            </span>
            {#if plan.assetName !== undefined}
              <span class="badge badge--info">{plan.assetName}</span>
            {/if}
            <span class="badge badge--success">
              {locations.length} Standorte
            </span>
          </div>
        </div>
      </div>

      <!-- Detail Grid: Main (locations) + Sidebar (form or info) -->
      <div class="loc-detail-grid mt-4">
        <!-- Main: Location List -->
        <div class="flex flex-col gap-4">
          {#if canWrite && showForm}
            {#if !isEditing}
              <div class="alert alert--info alert--sm mb-6">
                <i class="fas fa-info-circle"></i>
                Bilder können zum Standort erst nach Erstellung des Standorts hinzugefügt werden.
              </div>
            {/if}
            <!-- Create/Edit Form Section -->
            <div class="card">
              <div class="card__body">
                <h3 class="loc-section-title mb-3">
                  <i class="fas fa-edit"></i>
                  {isEditing ? MESSAGES.LOCATIONS_EDIT : MESSAGES.LOCATIONS_ADD}
                </h3>
                <LocationForm
                  location={editingLocation}
                  {nextPosition}
                  {saving}
                  onSave={handleSave}
                  onCancel={handleCancel}
                />
              </div>
            </div>
          {/if}

          {#if locations.length === 0 && !showForm}
            <div class="empty-state">
              <div class="empty-state__icon">
                <i class="fas fa-map-pin"></i>
              </div>
              <h3 class="empty-state__title">
                {MESSAGES.LOCATIONS_EMPTY_TITLE}
              </h3>
              <p class="empty-state__description">
                {MESSAGES.LOCATIONS_EMPTY_DESC}
              </p>
            </div>
          {:else}
            <div class="loc-grid">
              {#each locations as location (location.uuid)}
                <LocationCard
                  {location}
                  {canWrite}
                  onEdit={handleEdit}
                  onDelete={handleDeleteRequest}
                  onUploadPhoto={handleUploadPhoto}
                  onRemovePhoto={handleRemovePhoto}
                  onPreviewPhoto={openPreview}
                />
              {/each}
            </div>
          {/if}
        </div>

        <!-- Sidebar: Plan Info -->
        <div class="flex flex-col gap-4">
          <div class="card">
            <div class="card__body">
              <h3 class="loc-section-title mb-3">
                <i class="fas fa-info-circle"></i>
                Plandetails
              </h3>
              <div class="loc-info">
                <div class="loc-info__row">
                  <span class="loc-info__label">Wartungsplan</span>
                  <span class="loc-info__value">{plan.name}</span>
                </div>
                {#if plan.assetName !== undefined}
                  <div class="loc-info__row">
                    <span class="loc-info__label">Anlage</span>
                    <span class="loc-info__value">{plan.assetName}</span>
                  </div>
                {/if}
                <div class="loc-info__row">
                  <span class="loc-info__label">Standorte</span>
                  <span class="loc-info__value">{locations.length} / 200</span>
                </div>
                <div class="loc-info__row">
                  <span class="loc-info__label">Mit Foto</span>
                  <span class="loc-info__value">
                    {locations.filter((l: TpmLocation) => l.photoPath !== null).length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Hint Card -->
          <div class="card">
            <div class="card__body">
              <h3 class="loc-section-title mb-2">
                <i class="fas fa-lightbulb"></i>
                Hinweis
              </h3>
              <p class="loc-hint">
                Standorte beschreiben Positionen an der Anlage, die bei der Wartung relevant sind.
                Jeder Standort kann mit einem Foto dokumentiert werden, das zeigt, wo sich die
                Stelle befindet.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal (design system pattern) -->
      {#if confirmDelete !== null}
        <div
          id="tpm-location-delete-confirm-modal"
          class="modal-overlay modal-overlay--active"
        >
          <div class="ds-modal ds-modal--sm">
            <div class="ds-modal__header">
              <h3 class="ds-modal__title">
                {MESSAGES.LOCATIONS_DELETE_CONFIRM}
              </h3>
              <button
                type="button"
                class="ds-modal__close"
                onclick={() => {
                  confirmDelete = null;
                }}
                aria-label="Schließen"
              >
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="ds-modal__body">
              <p>
                Standort <strong>#{confirmDelete.positionNumber} {confirmDelete.title}</strong>
                wird unwiderruflich gelöscht.
              </p>
            </div>
            <div class="ds-modal__footer">
              <button
                type="button"
                class="btn btn-cancel"
                onclick={() => {
                  confirmDelete = null;
                }}
                disabled={saving}
              >
                {MESSAGES.LOCATIONS_CANCEL}
              </button>
              <button
                type="button"
                class="btn btn-danger"
                onclick={handleDeleteConfirm}
                disabled={saving}
              >
                {#if saving}
                  <i class="fas fa-spinner fa-spin mr-1"></i>
                {/if}
                {MESSAGES.LOCATIONS_DELETE}
              </button>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>

  <!-- Photo Preview Modal (blackboard AttachmentPreviewModal pattern, image-only) -->
  {#if showPreviewModal && previewLocation !== null && previewLocation.photoPath !== null}
    <div
      id="tpm-location-photo-preview-modal"
      class="modal-overlay modal-overlay--active"
      onclick={closePreview}
      onkeydown={(e: KeyboardEvent) => {
        if (e.key === 'Escape') closePreview();
      }}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div
        class="ds-modal ds-modal--lg"
        style="max-height: 95vh;"
        onclick={stopPropagation}
        onkeydown={stopPropagation}
        role="document"
      >
        <div class="ds-modal__header">
          <h3 class="ds-modal__title">
            <i class="fas fa-image text-success-500 mr-2"></i>
            {previewLocation.photoFileName ?? previewLocation.title}
          </h3>
          <button
            type="button"
            class="ds-modal__close"
            onclick={closePreview}
            aria-label="Schließen"><i class="fas fa-times"></i></button
          >
        </div>
        <div class="ds-modal__body p-0">
          <div
            class="flex h-[80vh] min-h-[600px] w-full items-center justify-center bg-(--surface-1)"
          >
            <img
              src={getPhotoUrl(previewLocation)}
              alt="Standort {previewLocation.title}"
              class="max-h-full max-w-full object-contain"
            />
          </div>
          <div class="border-t border-(--border-subtle) bg-(--surface-2) p-4">
            <div class="flex items-center gap-6 text-sm text-(--color-text-secondary)">
              {#if previewLocation.photoFileSize !== null}
                <span class="flex items-center gap-2">
                  <i class="fas fa-file-archive"></i>
                  {formatFileSize(previewLocation.photoFileSize)}
                </span>
              {/if}
              <span class="flex items-center gap-2">
                <i class="fas fa-map-marker-alt"></i>
                #{previewLocation.positionNumber}
                {previewLocation.title}
              </span>
            </div>
          </div>
        </div>
        <div class="ds-modal__footer">
          <button
            type="button"
            class="btn btn-cancel"
            onclick={closePreview}><i class="fas fa-times mr-2"></i>Schließen</button
          >
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  /* Grid layout matching card detail page (main + sidebar 475px) */
  .loc-detail-grid {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 1rem;
    align-items: start;
  }

  /* Location cards grid */
  .loc-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Section title (matches card-detail__section-title) */
  .loc-section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin: 0;
  }

  /* Info rows (matches card-detail__info pattern) */
  .loc-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .loc-info__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0;
    border-bottom: 1px solid var(--color-glass-border);
  }

  .loc-info__row:last-child {
    border-bottom: none;
  }

  .loc-info__label {
    font-size: 0.813rem;
    color: var(--color-text-muted);
  }

  .loc-info__value {
    font-size: 0.813rem;
    font-weight: 500;
    color: var(--color-text-primary);
    text-align: right;
  }

  /* Hint text */
  .loc-hint {
    font-size: 0.813rem;
    color: var(--color-text-muted);
    line-height: 1.6;
    margin: 0;
  }

  /* Screen reader only (for hidden file input) */
  .loc-sr-only {
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

  @media (width <= 768px) {
    .loc-detail-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

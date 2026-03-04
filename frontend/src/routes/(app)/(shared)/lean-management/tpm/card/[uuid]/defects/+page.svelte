<script lang="ts">
  /**
   * TPM Card Defects (Mängelliste) — Page Component
   *
   * Displays all documented defects for a single Kamishibai card.
   * Expandable rows show defect description, photos + execution context.
   * Admin users can create work orders from defects via "Zuweisen" button.
   * Pattern: mirrors history/+page.svelte structure.
   */
  import { goto, invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';

  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';

  import {
    STATUS_LABELS as WO_STATUS_LABELS,
    STATUS_BADGE_CLASSES as WO_STATUS_BADGE_CLASSES,
  } from '../../../../../work-orders/_lib/constants';
  import {
    fetchDefectPhotos,
    updateDefect,
    logApiError,
  } from '../../../_lib/api';
  import {
    INTERVAL_LABELS,
    CARD_STATUS_LABELS,
    CARD_STATUS_BADGE_CLASSES,
    MESSAGES,
  } from '../../../_lib/constants';

  import CreateWorkOrderFromDefect from './_lib/CreateWorkOrderFromDefect.svelte';

  import type { PageData } from './$types';
  import type { WorkOrderStatus } from '../../../../../work-orders/_lib/types';
  import type { DefectWithContext, TpmDefectPhoto } from '../../../_lib/types';

  // ===========================================================================
  // SSR DATA
  // ===========================================================================

  const { data }: { data: PageData } = $props();

  const card = $derived(data.card);
  const defects = $derived(data.defects);
  const total = $derived(data.total);
  const error = $derived(data.error);
  const userRole = $derived(data.userRole);
  const isAdmin = $derived(userRole === 'admin' || userRole === 'root');
  const colSpan = $derived(isAdmin ? 5 : 4);
  const expandExecutionUuid = $derived(data.expandExecutionUuid);

  // Auto-expand first defect matching the execution UUID from query param
  const initialExpandUuid = $derived.by((): string | null => {
    if (expandExecutionUuid === null) return null;
    const match = defects.find((d) => d.executionUuid === expandExecutionUuid);
    return match?.uuid ?? null;
  });

  // ===========================================================================
  // EXPAND / PHOTO STATE
  // ===========================================================================

  let expandedUuid = $state<string | null>(null);
  let initialExpandApplied = $state(false);
  let loadedPhotos = $state<Partial<Record<string, TpmDefectPhoto[]>>>({});
  let loadingPhotos = $state<Partial<Record<string, boolean>>>({});
  let photoErrors = $state<Partial<Record<string, boolean>>>({});

  // Photo Preview Modal State
  let showPhotoPreview = $state(false);
  let previewPhotoIndex = $state<number | null>(null);
  let previewPhotos = $state<TpmDefectPhoto[]>([]);

  const previewPhoto = $derived.by((): TpmDefectPhoto | null => {
    if (previewPhotoIndex === null) return null;
    return previewPhotos[previewPhotoIndex] ?? null;
  });

  // Auto-expand matching defect on initial load (from history page link)
  $effect(() => {
    if (initialExpandApplied || initialExpandUuid === null) return;
    initialExpandApplied = true;
    toggleExpand(initialExpandUuid);
  });

  // Work Order Modal State (admin only)
  let showWoModal = $state(false);
  let woDefect = $state<DefectWithContext | null>(null);

  // Edit Defect Modal State (admin only)
  let showEditModal = $state(false);
  let editDefect = $state<DefectWithContext | null>(null);
  let editTitle = $state('');
  let editDescription = $state('');
  let editSubmitting = $state(false);
  let editError = $state<string | null>(null);

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  function formatDate(dateStr: string | null): string {
    if (dateStr === null || dateStr === '') return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  // ===========================================================================
  // EXPAND / PHOTO LOADING
  // ===========================================================================

  function toggleExpand(uuid: string): void {
    if (expandedUuid === uuid) {
      expandedUuid = null;
      return;
    }
    expandedUuid = uuid;

    // Load photos if not cached and photoCount > 0
    const defect = defects.find((d) => d.uuid === uuid);
    if (
      defect !== undefined &&
      defect.photoCount > 0 &&
      loadedPhotos[uuid] === undefined &&
      loadingPhotos[uuid] !== true
    ) {
      void loadPhotosForDefect(uuid);
    }
  }

  async function loadPhotosForDefect(defectUuid: string): Promise<void> {
    loadingPhotos = { ...loadingPhotos, [defectUuid]: true };
    try {
      const photos = await fetchDefectPhotos(defectUuid);
      loadedPhotos = { ...loadedPhotos, [defectUuid]: photos };
    } catch (err: unknown) {
      logApiError('fetchDefectPhotos', err);
      photoErrors = { ...photoErrors, [defectUuid]: true };
    } finally {
      loadingPhotos = { ...loadingPhotos, [defectUuid]: false };
    }
  }

  // ===========================================================================
  // PHOTO PREVIEW HANDLERS
  // ===========================================================================

  function openPhotoPreview(photos: TpmDefectPhoto[], index: number): void {
    previewPhotos = photos;
    previewPhotoIndex = index;
    showPhotoPreview = true;
  }

  function closePhotoPreview(): void {
    showPhotoPreview = false;
    previewPhotoIndex = null;
    previewPhotos = [];
  }

  function handlePreviewPrev(): void {
    if (previewPhotoIndex === null || previewPhotos.length <= 1) return;
    previewPhotoIndex =
      previewPhotoIndex === 0 ?
        previewPhotos.length - 1
      : previewPhotoIndex - 1;
  }

  function handlePreviewNext(): void {
    if (previewPhotoIndex === null || previewPhotos.length <= 1) return;
    previewPhotoIndex =
      previewPhotoIndex === previewPhotos.length - 1 ?
        0
      : previewPhotoIndex + 1;
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (!showPhotoPreview) return;
    if (e.key === 'Escape') closePhotoPreview();
    else if (e.key === 'ArrowLeft') handlePreviewPrev();
    else if (e.key === 'ArrowRight') handlePreviewNext();
  }

  // ===========================================================================
  // WORK ORDER MODAL (admin only)
  // ===========================================================================

  function openCreateWoModal(
    defectItem: DefectWithContext,
    event: MouseEvent,
  ): void {
    event.stopPropagation();
    woDefect = defectItem;
    showWoModal = true;
  }

  function closeWoModal(): void {
    showWoModal = false;
    woDefect = null;
  }

  function handleWoSaved(): void {
    showWoModal = false;
    woDefect = null;
    void invalidateAll();
  }

  // ===========================================================================
  // EDIT DEFECT MODAL (admin only)
  // ===========================================================================

  function openEditModal(
    defectItem: DefectWithContext,
    event: MouseEvent,
  ): void {
    event.stopPropagation();
    editDefect = defectItem;
    editTitle = defectItem.title;
    editDescription = defectItem.description ?? '';
    editError = null;
    showEditModal = true;
  }

  function closeEditModal(): void {
    showEditModal = false;
    editDefect = null;
  }

  async function handleEditSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const currentDefect = editDefect;
    if (currentDefect === null) return;

    const trimmedTitle = editTitle.trim();
    if (trimmedTitle === '') return;

    editSubmitting = true;
    editError = null;

    try {
      await updateDefect(currentDefect.uuid, {
        title: trimmedTitle,
        description: editDescription.trim() || null,
      });
      showSuccessAlert(MESSAGES.DEFECTS_EDIT_SUCCESS);
      closeEditModal();
      void invalidateAll();
    } catch (err: unknown) {
      logApiError('updateDefect', err);
      showErrorAlert(MESSAGES.DEFECTS_EDIT_ERROR);
      editError = MESSAGES.DEFECTS_EDIT_ERROR;
    } finally {
      editSubmitting = false;
    }
  }

  // ===========================================================================
  // NAVIGATION
  // ===========================================================================

  const resolvePath = resolve as (p: string) => string;

  function goBack(): void {
    if (card !== null) {
      void goto(resolvePath(`/lean-management/tpm/card/${card.uuid}`));
    } else {
      void goto(resolvePath('/lean-management/tpm/overview'));
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
  <title>
    {card !== null ?
      `${card.cardCode} — ${MESSAGES.DEFECTS_PAGE_TITLE}`
    : MESSAGES.DEFECTS_PAGE_TITLE} - Assixx
  </title>
</svelte:head>

<div class="container">
  <!-- Back Button -->
  <div class="mb-4">
    <button
      type="button"
      class="btn btn-light"
      onclick={goBack}
    >
      <i class="fas fa-arrow-left mr-2"></i>{MESSAGES.DEFECTS_BACK}
    </button>
  </div>

  <div class="card">
    <div
      class="card__header"
      style="display: flex; justify-content: space-between; align-items: flex-start;"
    >
      <div>
        <h2 class="card__title">
          <i class="fas fa-exclamation-triangle mr-2"></i>
          {MESSAGES.DEFECTS_HEADING}
        </h2>
        {#if card !== null}
          <p class="mt-1 text-(--color-text-secondary)">
            <span class="font-semibold">{card.cardCode}</span>
            — {card.title}
            · {INTERVAL_LABELS[card.intervalType]}
            {#if card.machineName !== undefined}
              · {card.machineName}
            {/if}
          </p>
          <div class="mt-2 flex items-center gap-3">
            <span class="badge {CARD_STATUS_BADGE_CLASSES[card.status]}">
              {CARD_STATUS_LABELS[card.status]}
            </span>
            <span class="text-sm text-(--color-text-muted)">
              {total}
              {MESSAGES.DEFECTS_COUNT}
            </span>
          </div>
        {/if}
      </div>
      {#if card !== null}
        <button
          type="button"
          class="btn btn-primary"
          onclick={() => {
            void goto(
              resolvePath(`/lean-management/tpm/card/${card.uuid}/history`),
            );
          }}
        >
          <i class="fas fa-history mr-2"></i>{MESSAGES.HISTORY_HEADING}
        </button>
      {/if}
    </div>

    <div class="card__body">
      {#if error !== null}
        <div class="p-6 text-center">
          <i
            class="fas fa-exclamation-triangle mb-4 text-4xl text-(--color-danger)"
          ></i>
          <p class="text-(--color-text-secondary)">{error}</p>
        </div>
      {:else if defects.length === 0}
        <div class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-check-circle"></i>
          </div>
          <h3 class="empty-state__title">{MESSAGES.DEFECTS_EMPTY_TITLE}</h3>
          <p class="empty-state__description">{MESSAGES.DEFECTS_EMPTY_DESC}</p>
          <button
            type="button"
            class="btn btn-primary mt-4"
            onclick={goBack}
          >
            <i class="fas fa-arrow-left mr-2"></i>
            {MESSAGES.DEFECTS_BACK}
          </button>
        </div>
      {:else}
        <div class="table-responsive">
          <table class="data-table data-table--hover data-table--striped">
            <thead>
              <tr>
                <th scope="col">{MESSAGES.DEFECTS_COL_TITLE}</th>
                <th scope="col">{MESSAGES.DEFECTS_COL_DATE}</th>
                <th scope="col">{MESSAGES.DEFECTS_COL_PERSON}</th>
                <th scope="col">{MESSAGES.DEFECTS_COL_PHOTOS}</th>
                {#if isAdmin}
                  <th scope="col">{MESSAGES.DEFECTS_COL_ACTIONS}</th>
                {/if}
              </tr>
            </thead>
            <tbody>
              {#each defects as defect (defect.uuid)}
                <!-- Row -->
                <tr
                  class="defect-row"
                  class:defect-row--expanded={expandedUuid === defect.uuid}
                  onclick={() => {
                    toggleExpand(defect.uuid);
                  }}
                  role="button"
                  tabindex="0"
                  onkeydown={(e: KeyboardEvent) => {
                    if (e.key === 'Enter') toggleExpand(defect.uuid);
                  }}
                >
                  <td>
                    <div class="font-medium">{defect.title}</div>
                  </td>
                  <td>{formatDate(defect.executionDate)}</td>
                  <td>{defect.executedByName ?? '-'}</td>
                  <td>
                    {#if defect.photoCount > 0}
                      <span class="flex items-center gap-1 text-sm">
                        <i class="fas fa-camera text-(--color-text-muted)"></i>
                        {defect.photoCount}
                      </span>
                    {:else}
                      <span class="text-sm text-(--color-text-muted)">—</span>
                    {/if}
                  </td>
                  {#if isAdmin}
                    <td>
                      <div class="action-group">
                        <button
                          type="button"
                          class="btn btn-sm btn-ghost"
                          onclick={(e: MouseEvent) => {
                            openEditModal(defect, e);
                          }}
                          title="Mangel bearbeiten"
                        >
                          <i class="fas fa-pen"></i>
                        </button>
                        {#if defect.workOrderUuid !== null && defect.workOrderStatus !== null}
                          <div class="wo-info">
                            <span
                              class="badge {WO_STATUS_BADGE_CLASSES[
                                defect.workOrderStatus as WorkOrderStatus
                              ]}"
                            >
                              {WO_STATUS_LABELS[
                                defect.workOrderStatus as WorkOrderStatus
                              ]}
                            </span>
                            {#if defect.workOrderAssigneeNames.length > 0}
                              <span class="wo-info__assignees">
                                <i class="fas fa-user text-(--color-text-muted)"
                                ></i>
                                {defect.workOrderAssigneeNames.join(', ')}
                              </span>
                            {/if}
                            <a
                              href={resolvePath(
                                `/work-orders/${defect.workOrderUuid}`,
                              )}
                              class="btn btn-sm btn-ghost"
                              onclick={(e: MouseEvent) => {
                                e.stopPropagation();
                              }}
                              title="Arbeitsauftrag anzeigen"
                            >
                              <i class="fas fa-external-link-alt"></i>
                            </a>
                          </div>
                        {:else}
                          <button
                            type="button"
                            class="btn btn-sm btn-secondary"
                            onclick={(e: MouseEvent) => {
                              openCreateWoModal(defect, e);
                            }}
                            title={MESSAGES.DEFECTS_BTN_ASSIGN_WO}
                          >
                            <i class="fas fa-clipboard-check mr-1"></i>
                            {MESSAGES.DEFECTS_BTN_ASSIGN_WO}
                          </button>
                        {/if}
                      </div>
                    </td>
                  {/if}
                </tr>

                <!-- Expanded Details -->
                {#if expandedUuid === defect.uuid}
                  <tr class="defect-detail">
                    <td colspan={colSpan}>
                      <div class="defect-detail__content">
                        {#if defect.description !== null && defect.description.trim().length > 0}
                          <div class="defect-detail__section">
                            <h4 class="defect-detail__label">
                              <i class="fas fa-info-circle"></i>
                              {MESSAGES.DEFECT_DESC_LABEL}
                            </h4>
                            <p class="defect-detail__text">
                              {defect.description}
                            </p>
                          </div>
                        {:else}
                          <p
                            class="defect-detail__text defect-detail__text--empty"
                          >
                            {MESSAGES.DEFECTS_NO_DESC}
                          </p>
                        {/if}

                        <!-- Photos -->
                        {#if defect.photoCount > 0}
                          <div class="defect-detail__section">
                            <h4 class="defect-detail__label">
                              <i class="fas fa-camera"></i>
                              {MESSAGES.PHOTO_HEADING}
                              <span
                                class="text-xs font-normal text-(--color-text-muted)"
                              >
                                ({defect.photoCount})
                              </span>
                            </h4>
                            {#if loadingPhotos[defect.uuid]}
                              <span
                                class="flex items-center gap-1.5 text-sm text-(--color-primary)"
                              >
                                <i class="fas fa-spinner fa-spin"></i>
                                {MESSAGES.DEFECTS_PHOTOS_LOADING}
                              </span>
                            {:else if photoErrors[defect.uuid]}
                              <span
                                class="flex items-center gap-1.5 text-sm text-(--color-danger)"
                              >
                                <i class="fas fa-exclamation-circle"></i>
                                {MESSAGES.DEFECTS_PHOTOS_ERROR}
                              </span>
                            {:else if loadedPhotos[defect.uuid] !== undefined}
                              <div class="defect-detail__photos">
                                {#each loadedPhotos[defect.uuid] as photo, photoIdx (photo.uuid)}
                                  <div
                                    class="defect-detail__photo-thumb"
                                    role="button"
                                    tabindex="0"
                                    onclick={() => {
                                      openPhotoPreview(
                                        loadedPhotos[defect.uuid] ?? [],
                                        photoIdx,
                                      );
                                    }}
                                    onkeydown={(e) => {
                                      if (e.key === 'Enter')
                                        openPhotoPreview(
                                          loadedPhotos[defect.uuid] ?? [],
                                          photoIdx,
                                        );
                                    }}
                                  >
                                    <img
                                      src="/{photo.filePath}"
                                      alt={photo.fileName}
                                      class="defect-detail__photo-img"
                                      loading="lazy"
                                    />
                                    {#if photoIdx === 0 && (loadedPhotos[defect.uuid]?.length ?? 0) > 1}
                                      <span class="defect-detail__photo-count">
                                        {loadedPhotos[defect.uuid]?.length} Fotos
                                      </span>
                                    {/if}
                                  </div>
                                {/each}
                              </div>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Work Order from Defect Modal (admin only) -->
{#if isAdmin}
  <CreateWorkOrderFromDefect
    show={showWoModal}
    defect={woDefect}
    {card}
    onclose={closeWoModal}
    onsaved={handleWoSaved}
  />
{/if}

<!-- Edit Defect Modal (admin only) -->
{#if showEditModal && editDefect !== null}
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="edit-defect-modal-title"
    tabindex="-1"
    onclick={(e: MouseEvent) => {
      if (e.target === e.currentTarget) closeEditModal();
    }}
    onkeydown={(e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEditModal();
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
    <form
      class="ds-modal"
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
      }}
      onsubmit={handleEditSubmit}
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="edit-defect-modal-title"
        >
          <i class="fas fa-pen mr-2"></i>
          Mangel bearbeiten
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={closeEditModal}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body">
        {#if editError !== null}
          <div class="alert alert--danger mb-4">
            <i class="fas fa-exclamation-triangle mr-2"></i>
            {editError}
          </div>
        {/if}

        <div class="form-field">
          <label
            class="form-field__label"
            for="edit-defect-title"
          >
            Mängelbezeichnung
            <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="edit-defect-title"
            class="form-field__control"
            placeholder="Kurze Beschreibung des Mangels..."
            required
            bind:value={editTitle}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="edit-defect-desc"
          >
            Beschreibung
          </label>
          <textarea
            id="edit-defect-desc"
            class="form-field__control"
            placeholder="Detaillierte Beschreibung..."
            rows="4"
            bind:value={editDescription}
          ></textarea>
        </div>
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={closeEditModal}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={editSubmitting}
        >
          {#if editSubmitting}
            <span class="spinner-ring spinner-ring--sm mr-2"></span>
            Wird gespeichert...
          {:else}
            <i class="fas fa-check mr-2"></i>
            Speichern
          {/if}
        </button>
      </div>
    </form>
  </div>
{/if}

<!-- Photo Preview Modal -->
{#if showPhotoPreview && previewPhoto !== null}
  <div
    class="modal-overlay modal-overlay--active"
    onclick={closePhotoPreview}
    onkeydown={(e) => {
      if (e.key === 'Escape') closePhotoPreview();
    }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="ds-modal ds-modal--lg"
      style="max-height: 95vh;"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onkeydown={(e) => {
        e.stopPropagation();
      }}
      role="document"
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          <i class="fas fa-image text-success-500 mr-2"></i>
          {previewPhoto.fileName}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          onclick={closePhotoPreview}
          aria-label="Schließen"><i class="fas fa-times"></i></button
        >
      </div>
      <div class="ds-modal__body p-0">
        <div
          class="flex h-[80vh] min-h-[600px] w-full items-center justify-center bg-(--surface-1)"
        >
          <img
            src="/{previewPhoto.filePath}"
            alt={previewPhoto.fileName}
            class="max-h-full max-w-full object-contain"
          />
        </div>
        <div class="border-t border-(--border-subtle) bg-(--surface-2) p-4">
          <div
            class="flex items-center gap-6 text-sm text-(--color-text-secondary)"
          >
            <span class="flex items-center gap-2">
              <i class="fas fa-file-archive"></i>
              {formatFileSize(previewPhoto.fileSize)}
            </span>
          </div>
        </div>
      </div>
      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={closePhotoPreview}
          ><i class="fas fa-times mr-2"></i>Schließen</button
        >
        <button
          type="button"
          class="btn btn-primary"
          onclick={() => {
            window.open(`/${previewPhoto.filePath}`, '_blank');
          }}><i class="fas fa-download mr-2"></i>Herunterladen</button
        >
      </div>
    </div>
    {#if previewPhotos.length > 1}
      <button
        type="button"
        class="absolute top-1/2 left-6 z-10 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-none bg-white/15 text-xl text-white transition-colors hover:bg-white/30"
        onclick={(e) => {
          e.stopPropagation();
          handlePreviewPrev();
        }}
        aria-label="Vorheriges"
      >
        <i class="fas fa-chevron-left"></i>
      </button>
      <button
        type="button"
        class="absolute top-1/2 right-6 z-10 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-none bg-white/15 text-xl text-white transition-colors hover:bg-white/30"
        onclick={(e) => {
          e.stopPropagation();
          handlePreviewNext();
        }}
        aria-label="Nächstes"
      >
        <i class="fas fa-chevron-right"></i>
      </button>
      {#if previewPhotoIndex !== null}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-xl bg-black/50 px-3 py-1 text-sm text-white"
          onclick={(e) => {
            e.stopPropagation();
          }}
        >
          {previewPhotoIndex + 1} / {previewPhotos.length}
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .defect-row {
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .defect-row--expanded {
    background: var(--glass-bg-hover);
  }

  .defect-detail {
    background: var(--glass-bg-hover);
  }

  .defect-detail__content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem 0.5rem;
    border-bottom: 1px solid var(--color-glass-border);
  }

  .defect-detail__section {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .defect-detail__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.813rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .defect-detail__text {
    font-size: 0.813rem;
    color: var(--color-text-primary);
    line-height: 1.5;
    margin: 0;
    white-space: pre-wrap;
  }

  .defect-detail__text--empty {
    color: var(--color-text-muted);
    font-style: italic;
  }

  .defect-detail__photos {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .defect-detail__photo-thumb {
    cursor: pointer;
    position: relative;
    display: block;
    width: 80px;
    height: 80px;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--color-glass-border);
    transition:
      border-color 0.15s ease,
      transform 0.15s ease;
  }

  .defect-detail__photo-thumb:hover {
    border-color: var(--color-primary);
    transform: scale(1.05);
  }

  .defect-detail__photo-count {
    position: absolute;
    top: 4px;
    right: 4px;
    padding: 2px 6px;
    border-radius: 8px;
    font-size: 0.625rem;
    font-weight: 600;
    color: #fff;
    background: rgb(0 0 0 / 70%);
  }

  .defect-detail__photo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .action-group {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .wo-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .wo-info__assignees {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>

<script lang="ts">
  /**
   * TPM Card Execution History — Page Component
   *
   * Displays all past executions for a single Kamishibai card.
   * Click on a row to expand: documentation, photos, approval details.
   * Reference pattern: blackboard/archived/+page.svelte
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import PermissionDenied from '$lib/components/PermissionDenied.svelte';

  import { fetchPhotos, logApiError } from '../../../_lib/api';
  import {
    INTERVAL_LABELS,
    CARD_STATUS_LABELS,
    CARD_STATUS_BADGE_CLASSES,
    MESSAGES,
  } from '../../../_lib/constants';

  import type { PageData } from './$types';
  import type { ApprovalStatus, TpmExecutionPhoto } from '../../../_lib/types';

  // ===========================================================================
  // SSR DATA
  // ===========================================================================

  const { data }: { data: PageData } = $props();

  const permissionDenied = $derived(data.permissionDenied);
  const card = $derived(data.card);
  const executions = $derived(data.executions);
  const total = $derived(data.total);
  const error = $derived(data.error);

  // ===========================================================================
  // EXPAND / PHOTO STATE
  // ===========================================================================

  let expandedUuid = $state<string | null>(null);
  let loadedPhotos = $state<Partial<Record<string, TpmExecutionPhoto[]>>>({});
  let loadingPhotos = $state<Partial<Record<string, boolean>>>({});
  let photoErrors = $state<Partial<Record<string, boolean>>>({});

  // Photo Preview Modal State
  let showPhotoPreview = $state(false);
  let previewPhotoIndex = $state<number | null>(null);
  let previewPhotos = $state<TpmExecutionPhoto[]>([]);

  const previewPhoto = $derived.by((): TpmExecutionPhoto | null => {
    if (previewPhotoIndex === null) return null;
    return previewPhotos[previewPhotoIndex] ?? null;
  });

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

  function formatDateTime(dateStr: string | null): string {
    if (dateStr === null || dateStr === '') return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getApprovalLabel(status: ApprovalStatus): string {
    const map: Record<ApprovalStatus, string> = {
      none: MESSAGES.APPROVAL_STATUS_NONE,
      pending: MESSAGES.APPROVAL_STATUS_PENDING,
      approved: MESSAGES.APPROVAL_STATUS_APPROVED,
      rejected: MESSAGES.APPROVAL_STATUS_REJECTED,
    };
    return map[status];
  }

  function getApprovalBadgeClass(status: ApprovalStatus): string {
    const map: Record<ApprovalStatus, string> = {
      none: 'badge--secondary',
      pending: 'badge--warning',
      approved: 'badge--success',
      rejected: 'badge--danger',
    };
    return map[status];
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
    const execution = executions.find((e) => e.uuid === uuid);
    if (
      execution !== undefined &&
      (execution.photoCount ?? 0) > 0 &&
      loadedPhotos[uuid] === undefined &&
      loadingPhotos[uuid] !== true
    ) {
      void loadPhotosForExecution(uuid);
    }
  }

  async function loadPhotosForExecution(executionUuid: string): Promise<void> {
    loadingPhotos = { ...loadingPhotos, [executionUuid]: true };
    try {
      const photos = await fetchPhotos(executionUuid);
      loadedPhotos = { ...loadedPhotos, [executionUuid]: photos };
    } catch (err: unknown) {
      logApiError('fetchPhotos', err);
      photoErrors = { ...photoErrors, [executionUuid]: true };
    } finally {
      loadingPhotos = { ...loadingPhotos, [executionUuid]: false };
    }
  }

  // ===========================================================================
  // PHOTO PREVIEW HANDLERS
  // ===========================================================================

  function openPhotoPreview(photos: TpmExecutionPhoto[], index: number): void {
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
  // NAVIGATION
  // ===========================================================================

  function goBack(): void {
    if (card !== null) {
      void goto(resolve(`/lean-management/tpm/card/${card.uuid}`));
    } else {
      void goto(resolve('/lean-management/tpm/overview'));
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
  <title>
    {card !== null ?
      `${card.cardCode} — ${MESSAGES.HISTORY_PAGE_TITLE}`
    : MESSAGES.HISTORY_PAGE_TITLE} - Assixx
  </title>
</svelte:head>

{#if permissionDenied}
  <PermissionDenied addonName="das TPM-System" />
{:else}
  <div class="container">
    <!-- Back Button -->
    <div class="mb-4">
      <button
        type="button"
        class="btn btn-light"
        onclick={goBack}
      >
        <i class="fas fa-arrow-left mr-2"></i>{MESSAGES.HISTORY_BACK}
      </button>
    </div>

    <div class="card">
      <div
        class="card__header"
        style="display: flex; justify-content: space-between; align-items: flex-start;"
      >
        <div>
          <h2 class="card__title">
            <i class="fas fa-history mr-2"></i>
            {MESSAGES.HISTORY_HEADING}
          </h2>
          {#if card !== null}
            <p class="mt-1 text-(--color-text-secondary)">
              <span class="font-semibold">{card.cardCode}</span>
              — {card.title}
              · {INTERVAL_LABELS[card.intervalType]}
              {#if card.assetName !== undefined}
                · {card.assetName}
              {/if}
            </p>
            <div class="mt-2 flex items-center gap-3">
              <span class="badge {CARD_STATUS_BADGE_CLASSES[card.status]}">
                {CARD_STATUS_LABELS[card.status]}
              </span>
              <span class="text-sm text-(--color-text-muted)">
                {total}
                {MESSAGES.HISTORY_COUNT}
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
                resolve(`/lean-management/tpm/card/${card.uuid}/defects`),
              );
            }}
          >
            <i class="fas fa-exclamation-triangle mr-2"
            ></i>{MESSAGES.BTN_DEFECTS}
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
        {:else if executions.length === 0}
          <div class="empty-state">
            <div class="empty-state__icon">
              <i class="fas fa-clipboard-check"></i>
            </div>
            <h3 class="empty-state__title">{MESSAGES.HISTORY_EMPTY_TITLE}</h3>
            <p class="empty-state__description">
              {MESSAGES.HISTORY_EMPTY_DESC}
            </p>
            <button
              type="button"
              class="btn btn-primary mt-4"
              onclick={goBack}
            >
              <i class="fas fa-arrow-left mr-2"></i>
              {MESSAGES.HISTORY_BACK}
            </button>
          </div>
        {:else}
          <div class="table-responsive">
            <table class="data-table data-table--hover data-table--striped">
              <thead>
                <tr>
                  <th scope="col">{MESSAGES.HISTORY_COL_DATE}</th>
                  <th scope="col">{MESSAGES.HISTORY_COL_PERSON}</th>
                  <th scope="col">{MESSAGES.HISTORY_COL_STATUS}</th>
                  <th scope="col">{MESSAGES.HISTORY_COL_PHOTOS}</th>
                  <th scope="col">{MESSAGES.HISTORY_COL_DEFECTS}</th>
                </tr>
              </thead>
              <tbody>
                {#each executions as execution (execution.uuid)}
                  <!-- Row -->
                  <tr
                    class="history-row"
                    class:history-row--expanded={expandedUuid ===
                      execution.uuid}
                    onclick={() => {
                      toggleExpand(execution.uuid);
                    }}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => {
                      if (e.key === 'Enter') toggleExpand(execution.uuid);
                    }}
                  >
                    <td>
                      <div class="font-medium">
                        {formatDate(execution.executionDate)}
                      </div>
                      <div class="text-xs text-(--color-text-muted)">
                        {formatDateTime(execution.createdAt)}
                      </div>
                    </td>
                    <td>{execution.executedByName ?? '-'}</td>
                    <td>
                      <span
                        class="badge {getApprovalBadgeClass(
                          execution.approvalStatus,
                        )}"
                      >
                        {getApprovalLabel(execution.approvalStatus)}
                      </span>
                    </td>
                    <td>
                      {#if (execution.photoCount ?? 0) > 0}
                        <span class="flex items-center gap-1 text-sm">
                          <i class="fas fa-camera text-(--color-text-muted)"
                          ></i>
                          {execution.photoCount}
                        </span>
                      {:else}
                        <span class="text-sm text-(--color-text-muted)">—</span>
                      {/if}
                    </td>
                    <td>
                      {#if (execution.defectCount ?? 0) > 0}
                        <button
                          type="button"
                          class="history-defect-link"
                          onclick={(e: MouseEvent) => {
                            e.stopPropagation();
                            void goto(
                              resolve(
                                `/lean-management/tpm/card/${card?.uuid ?? ''}/defects?execution=${execution.uuid}`,
                              ),
                            );
                          }}
                        >
                          <i class="fas fa-exclamation-triangle"></i>
                          {execution.defectCount}
                        </button>
                      {:else}
                        <span class="text-sm text-(--color-text-muted)">—</span>
                      {/if}
                    </td>
                  </tr>

                  <!-- Expanded Details -->
                  {#if expandedUuid === execution.uuid}
                    <tr class="history-detail">
                      <td colspan="5">
                        <div class="history-detail__content">
                          <!-- No Issues Checkbox Result -->
                          {#if execution.noIssuesFound}
                            <div class="history-detail__no-issues">
                              <i class="fas fa-check-circle"></i>
                              {MESSAGES.EXEC_NO_ISSUES}
                            </div>
                          {/if}

                          <!-- Duration + Staff -->
                          {#if execution.actualDurationMinutes !== null || execution.actualStaffCount !== null}
                            <div class="history-detail__meta">
                              {#if execution.actualDurationMinutes !== null}
                                <span class="history-detail__meta-item">
                                  <i class="fas fa-clock"></i>
                                  {execution.actualDurationMinutes}
                                  {MESSAGES.EXEC_DURATION_UNIT}
                                </span>
                              {/if}
                              {#if execution.actualStaffCount !== null}
                                <span class="history-detail__meta-item">
                                  <i class="fas fa-users"></i>
                                  {execution.actualStaffCount}
                                  {MESSAGES.TIME_STAFF}
                                </span>
                              {/if}
                            </div>
                          {/if}

                          <!-- Participants -->
                          {#if execution.participants !== undefined && execution.participants.length > 0}
                            <div class="history-detail__section">
                              <h4 class="history-detail__label">
                                <i class="fas fa-user-friends"></i>
                                Beteiligte Mitarbeiter
                              </h4>
                              <div class="history-detail__participants">
                                {#each execution.participants as participant (participant.uuid)}
                                  <span
                                    class="history-detail__participant-chip"
                                  >
                                    {participant.firstName}
                                    {participant.lastName}
                                  </span>
                                {/each}
                              </div>
                            </div>
                          {/if}

                          <!-- Documentation -->
                          <div class="history-detail__section">
                            <h4 class="history-detail__label">
                              <i class="fas fa-file-alt"></i>
                              {MESSAGES.HISTORY_DOCUMENTATION}
                            </h4>
                            {#if execution.documentation !== null && execution.documentation.trim().length > 0}
                              <p class="history-detail__text">
                                {execution.documentation}
                              </p>
                            {:else}
                              <p
                                class="history-detail__text history-detail__text--empty"
                              >
                                {MESSAGES.HISTORY_NO_DOCUMENTATION}
                              </p>
                            {/if}
                          </div>

                          <!-- Photos -->
                          {#if (execution.photoCount ?? 0) > 0}
                            <div class="history-detail__section">
                              <h4 class="history-detail__label">
                                <i class="fas fa-camera"></i>
                                {MESSAGES.PHOTO_HEADING}
                                <span
                                  class="text-xs font-normal text-(--color-text-muted)"
                                >
                                  ({execution.photoCount})
                                </span>
                              </h4>
                              {#if loadingPhotos[execution.uuid]}
                                <span
                                  class="flex items-center gap-1.5 text-sm text-(--color-primary)"
                                >
                                  <i class="fas fa-spinner fa-spin"></i>
                                  {MESSAGES.HISTORY_PHOTOS_LOADING}
                                </span>
                              {:else if photoErrors[execution.uuid]}
                                <span
                                  class="flex items-center gap-1.5 text-sm text-(--color-danger)"
                                >
                                  <i class="fas fa-exclamation-circle"></i>
                                  {MESSAGES.HISTORY_PHOTOS_ERROR}
                                </span>
                              {:else if loadedPhotos[execution.uuid] !== undefined}
                                <div class="history-detail__photos">
                                  {#each loadedPhotos[execution.uuid] as photo, photoIdx (photo.uuid)}
                                    <div
                                      class="history-detail__photo-thumb"
                                      role="button"
                                      tabindex="0"
                                      onclick={() => {
                                        openPhotoPreview(
                                          loadedPhotos[execution.uuid] ?? [],
                                          photoIdx,
                                        );
                                      }}
                                      onkeydown={(e) => {
                                        if (e.key === 'Enter')
                                          openPhotoPreview(
                                            loadedPhotos[execution.uuid] ?? [],
                                            photoIdx,
                                          );
                                      }}
                                    >
                                      <img
                                        src="/{photo.filePath}"
                                        alt={photo.fileName}
                                        class="history-detail__photo-img"
                                        loading="lazy"
                                      />
                                      {#if photoIdx === 0 && (loadedPhotos[execution.uuid]?.length ?? 0) > 1}
                                        <span
                                          class="history-detail__photo-count"
                                        >
                                          {loadedPhotos[execution.uuid]?.length} Fotos
                                        </span>
                                      {/if}
                                    </div>
                                  {/each}
                                </div>
                              {/if}
                            </div>
                          {/if}

                          <!-- Approval Details -->
                          {#if execution.approvalStatus !== 'none'}
                            <div class="history-detail__section">
                              <h4 class="history-detail__label">
                                <i class="fas fa-check-double"></i>
                                {MESSAGES.APPROVAL_HEADING}
                              </h4>
                              <div class="history-detail__approval">
                                <span
                                  class="badge {getApprovalBadgeClass(
                                    execution.approvalStatus,
                                  )}"
                                >
                                  {getApprovalLabel(execution.approvalStatus)}
                                </span>
                                {#if execution.approvedByName !== undefined}
                                  <span
                                    class="text-sm text-(--color-text-secondary)"
                                  >
                                    {MESSAGES.HISTORY_APPROVAL_BY}
                                    {execution.approvedByName}
                                  </span>
                                {/if}
                                {#if execution.approvedAt !== null}
                                  <span
                                    class="text-sm text-(--color-text-muted)"
                                  >
                                    {formatDateTime(execution.approvedAt)}
                                  </span>
                                {/if}
                              </div>
                              {#if execution.approvalNote !== null && execution.approvalNote.trim().length > 0}
                                <div class="mt-2">
                                  <span
                                    class="text-xs font-semibold text-(--color-text-muted)"
                                  >
                                    {MESSAGES.HISTORY_APPROVAL_NOTE}:
                                  </span>
                                  <p class="history-detail__text">
                                    {execution.approvalNote}
                                  </p>
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

  <!-- Photo Preview Modal -->
  {#if showPhotoPreview && previewPhoto !== null}
    <div
      id="tpm-history-photo-preview-modal"
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
{/if}

<style>
  .history-row {
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .history-row--expanded {
    background: var(--glass-bg-hover);
  }

  .history-detail {
    background: var(--glass-bg-hover);
  }

  .history-detail__content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.75rem 0.5rem;
    border-bottom: 1px solid var(--color-glass-border);
  }

  .history-detail__section {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .history-detail__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.813rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .history-detail__text {
    font-size: 0.813rem;
    color: var(--color-text-primary);
    line-height: 1.5;
    margin: 0;
    white-space: pre-wrap;
  }

  .history-detail__text--empty {
    color: var(--color-text-muted);
    font-style: italic;
  }

  .history-detail__photos {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .history-detail__photo-thumb {
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

  .history-detail__photo-thumb:hover {
    border-color: var(--color-primary);
    transform: scale(1.05);
  }

  .history-detail__photo-count {
    position: absolute;
    top: 4px;
    right: 4px;
    padding: 2px 6px;
    border-radius: 8px;
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--color-white);
    background: color-mix(in oklch, var(--color-black) 70%, transparent);
  }

  .history-detail__photo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .history-detail__no-issues {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.813rem;
    font-weight: 500;
    color: var(--color-success);
    padding: 0.375rem 0.625rem;
    background: color-mix(in srgb, var(--color-success) 8%, transparent);
    border-radius: var(--radius-md);
    width: fit-content;
  }

  .history-detail__meta {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .history-detail__meta-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.813rem;
    color: var(--color-text-secondary);
  }

  .history-detail__approval {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .history-detail__participants {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .history-detail__participant-chip {
    display: inline-flex;
    align-items: center;
    padding: 0.188rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    border-radius: var(--radius-full);
  }

  .history-defect-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0;
    border: none;
    background: none;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-danger);
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .history-defect-link:hover {
    opacity: 75%;
    text-decoration: underline;
  }
</style>

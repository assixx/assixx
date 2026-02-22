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
  // NAVIGATION
  // ===========================================================================

  const resolvePath = resolve as (p: string) => string;

  function goBack(): void {
    if (card?.planUuid !== undefined) {
      void goto(resolvePath(`/lean-management/tpm/board/${card.planUuid}`));
    } else {
      void goto(resolvePath('/lean-management/tpm/overview'));
    }
  }
</script>

<svelte:head>
  <title>
    {card !== null ?
      `${card.cardCode} — ${MESSAGES.HISTORY_PAGE_TITLE}`
    : MESSAGES.HISTORY_PAGE_TITLE} - Assixx
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
      <i class="fas fa-arrow-left mr-2"></i>{MESSAGES.HISTORY_BACK}
    </button>
  </div>

  <div class="card">
    <div class="card__header">
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
              {MESSAGES.HISTORY_COUNT}
            </span>
          </div>
        {/if}
      </div>
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
          <p class="empty-state__description">{MESSAGES.HISTORY_EMPTY_DESC}</p>
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
              </tr>
            </thead>
            <tbody>
              {#each executions as execution (execution.uuid)}
                <!-- Row -->
                <tr
                  class="history-row"
                  class:history-row--expanded={expandedUuid === execution.uuid}
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
                        <i class="fas fa-camera text-(--color-text-muted)"></i>
                        {execution.photoCount}
                      </span>
                    {:else}
                      <span class="text-sm text-(--color-text-muted)">—</span>
                    {/if}
                  </td>
                </tr>

                <!-- Expanded Details -->
                {#if expandedUuid === execution.uuid}
                  <tr class="history-detail">
                    <td colspan="4">
                      <div class="history-detail__content">
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
                                {#each loadedPhotos[execution.uuid] as photo (photo.uuid)}
                                  <a
                                    href="/api/v2/{photo.filePath}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="history-detail__photo-thumb"
                                  >
                                    <img
                                      src="/api/v2/{photo.filePath}"
                                      alt={photo.fileName}
                                      class="history-detail__photo-img"
                                      loading="lazy"
                                    />
                                  </a>
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
                                <span class="text-sm text-(--color-text-muted)">
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
    display: block;
    width: 80px;
    height: 80px;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--color-glass-border);
    transition: border-color 0.15s ease;
  }

  .history-detail__photo-thumb:hover {
    border-color: var(--color-primary);
  }

  .history-detail__photo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .history-detail__approval {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
</style>

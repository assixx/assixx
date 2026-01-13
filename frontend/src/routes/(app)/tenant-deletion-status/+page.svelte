<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  import { invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';

  // Page-specific CSS
  import '../../../styles/tenant-deletion-status.css';

  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('TenantDeletionStatusPage');

  // Local modules
  import {
    rejectDeletion as apiRejectDeletion,
    cancelDeletion as apiCancelDeletion,
    emergencyStop as apiEmergencyStop,
  } from './_lib/api';
  import { REFRESH_INTERVAL_MS, MESSAGES } from './_lib/constants';
  import {
    getStatusText,
    getBadgeClass,
    calculateCoolingOff,
    isCurrentUserCreator,
    getRequesterName,
    formatDate,
    formatDateOnly,
    buildTimeline,
    shouldShowCoolingOff,
    shouldShowGracePeriod,
    shouldShowEmergencyStop,
    showToast,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type { ConfirmModalType } from './_lib/types';

  /** Resolve path with base prefix (for dynamic runtime paths) */
  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  // SSR Data - properly typed from PageData
  const { data }: { data: PageData } = $props();

  // =============================================================================
  // DERIVED STATE (from SSR data - single source of truth)
  // =============================================================================

  const statusData = $derived(data.statusData);
  const currentUserId = $derived(data.currentUserId);
  const hasStatusData = $derived(statusData.length > 0);

  // =============================================================================
  // UI STATE (local only)
  // =============================================================================

  // Use regular variable (not $state) for timer - no reactivity needed
  let refreshTimer: ReturnType<typeof setInterval> | null = null;

  // Confirm Modal State
  let showConfirmModal = $state(false);
  let confirmModalType: ConfirmModalType = $state(null);
  let confirmModalQueueId: number | null = $state(null);
  let confirmModalLoading = $state(false);
  let rejectReason = $state('');

  const isRejectReasonValid = $derived(rejectReason.length >= 3);

  // =============================================================================
  // LIFECYCLE - use onMount for one-time side effects (not $effect!)
  // =============================================================================

  onMount(() => {
    // Start auto-refresh - runs ONCE on mount
    refreshTimer = setInterval(() => void invalidateAll(), REFRESH_INTERVAL_MS);
  });

  onDestroy(() => {
    // Cleanup timer on unmount
    if (refreshTimer !== null) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  });

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function openRejectModal(queueId: number) {
    confirmModalType = 'reject';
    confirmModalQueueId = queueId;
    rejectReason = '';
    showConfirmModal = true;
  }

  function openCancelModal() {
    confirmModalType = 'cancel';
    confirmModalQueueId = null;
    showConfirmModal = true;
  }

  function openEmergencyStopModal(queueId: number) {
    confirmModalType = 'emergency-stop';
    confirmModalQueueId = queueId;
    showConfirmModal = true;
  }

  function closeConfirmModal() {
    showConfirmModal = false;
    confirmModalType = null;
    confirmModalQueueId = null;
    rejectReason = '';
    confirmModalLoading = false;
  }

  async function executeModalAction(): Promise<void> {
    switch (confirmModalType) {
      case 'reject':
        if (confirmModalQueueId !== null && isRejectReasonValid) {
          await apiRejectDeletion(confirmModalQueueId, rejectReason);
          showToast(MESSAGES.rejected, 'success');
        }
        break;
      case 'cancel':
        await apiCancelDeletion();
        showToast(MESSAGES.cancelled, 'success');
        break;
      case 'emergency-stop':
        if (confirmModalQueueId !== null) {
          await apiEmergencyStop(confirmModalQueueId);
          showToast(MESSAGES.emergencyStopped, 'success');
        }
        break;
    }
  }

  async function handleConfirmModalAction() {
    if (confirmModalLoading) return;
    confirmModalLoading = true;

    const resetLoading = () => {
      confirmModalLoading = false;
    };

    try {
      await executeModalAction();
      closeConfirmModal();
      await invalidateAll();
    } catch (err) {
      log.error({ err }, 'Error in modal action');
      const errorMessage = err instanceof Error ? err.message : MESSAGES.genericError;
      showToast(errorMessage, 'error');
      resetLoading();
    }
  }

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && showConfirmModal) {
      closeConfirmModal();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget && showConfirmModal) {
      closeConfirmModal();
    }
  }
</script>

<div class="container">
  <div class="card">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-trash-alt mr-2"></i>
        Tenant Löschstatus
      </h2>
      <p class="text-[var(--color-text-secondary)] mt-2">
        Übersicht aller Löschanfragen und deren Status
      </p>
    </div>

    <div class="card__body">
      <!-- Process Explanation (Compact) -->
      <div class="process-info">
        <h3 class="process-info__title">
          <i class="fas fa-info-circle mr-2"></i>
          Löschprozess (DSGVO-konform)
        </h3>
        <div class="process-info__content">
          <span class="process-info__item">
            <strong>Zwei-Personen-Prinzip:</strong> Root 1 beantragt, Root 2 genehmigt
          </span>
          <span class="process-info__item">
            <strong>24h Cooling-Off</strong> vor Genehmigung
          </span>
          <span class="process-info__item">
            <strong>30 Tage Grace Period</strong> nach Genehmigung
          </span>
          <span class="process-info__item"> <strong>Backup</strong> vor Löschung </span>
          <span class="process-info__item">
            <strong>Emergency Stop</strong> jederzeit möglich
          </span>
        </div>
      </div>

      <!-- Status Content -->
      <div class="status-grid">
        {#if !hasStatusData}
          <!-- Empty State -->
          <div class="empty-state">
            <div class="empty-state__icon">
              <i class="fas fa-inbox"></i>
            </div>
            <h3 class="empty-state__title">{MESSAGES.noRequests}</h3>
            <p class="empty-state__description">{MESSAGES.noRequestsDescription}</p>
          </div>
        {:else}
          <!-- Status Cards -->
          {#each statusData as item (item.queueId)}
            {@const isCreator = isCurrentUserCreator(item, currentUserId)}
            {@const coolingOffRemaining = calculateCoolingOff(item)}
            {@const timeline = buildTimeline(item)}

            <div class="status-card">
              <!-- Header with Status Badge -->
              <div class="status-header">
                <div class="tenant-info">
                  <h3>Tenant {item.tenantId}</h3>
                  <p>Tenant ID: {item.tenantId}</p>
                  <p>Beantragt von: {getRequesterName(item)} (User ID: {item.requestedBy})</p>
                  <p>Beantragt am: {formatDate(new Date(item.requestedAt))}</p>
                  <p><strong>Aktueller User ID:</strong> {currentUserId}</p>
                  <p>
                    <strong>Status Info:</strong> canApprove={item.canApprove}, canCancel={item.canCancel}
                  </p>
                </div>
                <span class="badge badge--uppercase {getBadgeClass(item.status)}">
                  {getStatusText(item.status)}
                </span>
              </div>

              <!-- Permission Info Box -->
              {#if isCreator}
                <div class="info-box info-box--warning">
                  <i class="fas fa-info-circle"></i>
                  <div>
                    <strong>Sie sind der Ersteller dieser Löschanfrage.</strong><br />
                    Das Zwei-Personen-Prinzip erfordert, dass ein anderer Root-Benutzer die Löschung genehmigt.
                  </div>
                </div>
              {:else if item.canApprove}
                <div class="info-box info-box--success">
                  <i class="fas fa-user-shield"></i>
                  <div>
                    <strong>Sie können diese Löschanfrage genehmigen oder ablehnen.</strong><br />
                    Die Anfrage wurde von einem anderen Root-Benutzer erstellt.
                  </div>
                </div>
              {/if}

              <!-- Cooling-Off Warning -->
              {#if shouldShowCoolingOff(item)}
                <div class="cooling-off-warning">
                  <i class="fas fa-clock"></i>
                  <div>
                    <strong>Cooling-off Periode aktiv</strong><br />
                    Noch {Math.ceil(coolingOffRemaining)} Stunden bis zur Genehmigung möglich<br />
                    <small class="text-muted"
                      >Für Entwicklung: Cooling-off kann in der DB auf 0 gesetzt werden</small
                    >
                  </div>
                </div>
              {/if}

              <!-- Grace Period Info -->
              {#if shouldShowGracePeriod(item)}
                <div class="info-box info-box--info">
                  <i class="fas fa-calendar-alt"></i>
                  <div>
                    <strong>30 Tage Grace Period läuft!</strong>
                    <p class="mt-2 mb-2">
                      <strong>Geplante Löschung:</strong>
                      {formatDateOnly(item.scheduledFor)}
                    </p>
                    <p class="mb-2">
                      Der Tenant kann innerhalb von 30 Tagen noch reaktiviert werden.
                    </p>
                    <p class="mb-2">
                      Nach Ablauf der Grace Period erfolgt die automatische, unwiderrufliche
                      Löschung.
                    </p>
                    <small class="text-muted"
                      >Deletion Worker prüft alle 30 Sekunden nach abgelaufenen Grace Periods.</small
                    >
                  </div>
                </div>
              {/if}

              <!-- Timeline -->
              <div class="timeline">
                <h4>Status Timeline</h4>
                {#each timeline as timelineItem (timelineItem.title)}
                  <div class="timeline-item">
                    <div
                      class="timeline-icon {timelineItem.completed
                        ? 'timeline-icon--completed'
                        : 'timeline-icon--pending'}"
                    >
                      <i class="fas {timelineItem.icon}"></i>
                    </div>
                    <div class="timeline-content">
                      <h4>{timelineItem.title}</h4>
                      <p>{formatDate(timelineItem.date)}</p>
                    </div>
                  </div>
                {/each}
              </div>

              <!-- Action Buttons -->
              {#if item.canApprove || item.canCancel}
                <div class="action-buttons">
                  {#if item.canApprove}
                    <button
                      type="button"
                      class="btn btn-danger"
                      onclick={() => {
                        openRejectModal(item.queueId);
                      }}
                    >
                      <i class="fas fa-times mr-2"></i> Ablehnen
                    </button>
                    <a
                      href={resolvePath(`/tenant-deletion-approve?queueId=${item.queueId}`)}
                      class="btn btn-success"
                      data-sveltekit-reload
                    >
                      <i class="fas fa-check mr-2"></i> Genehmigen
                    </a>
                  {/if}
                  {#if item.canCancel}
                    <button type="button" class="btn btn-cancel" onclick={openCancelModal}>
                      <i class="fas fa-ban mr-2"></i> Abbrechen (als Ersteller)
                    </button>
                  {/if}
                </div>
              {/if}

              <!-- Emergency Stop Button -->
              {#if shouldShowEmergencyStop(item)}
                <div class="action-buttons mt-6">
                  <button
                    type="button"
                    class="btn btn-warning"
                    onclick={() => {
                      openEmergencyStopModal(item.queueId);
                    }}
                  >
                    <i class="fas fa-stop-circle mr-2"></i> Emergency Stop
                  </button>
                  <small class="text-muted block mt-2">
                    {item.status === 'processing'
                      ? 'Stoppt den laufenden Löschvorgang'
                      : 'Stoppt die geplante Löschung sofort'}
                  </small>
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
</div>

<svelte:window on:keydown={handleKeydown} />

<!-- Confirm Modal -->
{#if showConfirmModal}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay modal-overlay--active"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
  >
    {#if confirmModalType === 'cancel'}
      <!-- Cancel Confirmation Modal -->
      <div class="confirm-modal">
        <div class="confirm-modal__icon">
          <i class="fas fa-question-circle"></i>
        </div>
        <h3 class="confirm-modal__title">Bestätigung</h3>
        <p class="confirm-modal__message">Möchten Sie Ihre Löschanfrage wirklich abbrechen?</p>
        <div class="confirm-modal__actions">
          <button
            type="button"
            class="confirm-modal__btn confirm-modal__btn--cancel"
            onclick={closeConfirmModal}
            disabled={confirmModalLoading}
          >
            Nein
          </button>
          <button
            type="button"
            class="confirm-modal__btn confirm-modal__btn--confirm"
            onclick={handleConfirmModalAction}
            disabled={confirmModalLoading}
          >
            {#if confirmModalLoading}
              <i class="fas fa-spinner fa-spin mr-2"></i>
            {/if}
            Ja
          </button>
        </div>
      </div>
    {:else if confirmModalType === 'emergency-stop'}
      <!-- Emergency Stop Modal -->
      <div class="confirm-modal confirm-modal--warning">
        <div class="confirm-modal__icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3 class="confirm-modal__title">EMERGENCY STOP</h3>
        <p class="confirm-modal__message">
          Dies stoppt die Tenant-Löschung <strong>SOFORT</strong>!
          <br /><br />
          Der Tenant wird reaktiviert und die Löschung abgebrochen.
          <br /><br />
          Sind Sie sicher?
        </p>
        <div class="confirm-modal__actions">
          <button
            type="button"
            class="confirm-modal__btn confirm-modal__btn--cancel"
            onclick={closeConfirmModal}
            disabled={confirmModalLoading}
          >
            Abbrechen
          </button>
          <button
            type="button"
            class="confirm-modal__btn confirm-modal__btn--warning"
            onclick={handleConfirmModalAction}
            disabled={confirmModalLoading}
          >
            {#if confirmModalLoading}
              <i class="fas fa-spinner fa-spin mr-2"></i>
            {/if}
            Emergency Stop aktivieren
          </button>
        </div>
      </div>
    {:else if confirmModalType === 'reject'}
      <!-- Reject Modal with Reason Input -->
      <div class="confirm-modal confirm-modal--danger">
        <div class="confirm-modal__icon">
          <i class="fas fa-times-circle"></i>
        </div>
        <h3 class="confirm-modal__title">Löschanfrage ablehnen</h3>
        <p class="confirm-modal__message">Bitte geben Sie einen Grund für die Ablehnung an:</p>
        <div class="confirm-modal__input-group">
          <textarea
            class="confirm-modal__input"
            rows="3"
            placeholder="Grund für die Ablehnung (min. 3 Zeichen)..."
            bind:value={rejectReason}
          ></textarea>
        </div>
        <div class="confirm-modal__actions">
          <button
            type="button"
            class="confirm-modal__btn confirm-modal__btn--cancel"
            onclick={closeConfirmModal}
            disabled={confirmModalLoading}
          >
            Abbrechen
          </button>
          <button
            type="button"
            class="confirm-modal__btn confirm-modal__btn--danger"
            onclick={handleConfirmModalAction}
            disabled={confirmModalLoading || !isRejectReasonValid}
          >
            {#if confirmModalLoading}
              <i class="fas fa-spinner fa-spin mr-2"></i>
            {/if}
            Ablehnen
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<script lang="ts">
  /**
   * RootSelfTerminationCard — Peer-approval card for root self-termination.
   *
   * Step 5.3 of FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md.
   *
   * Renders a list of pending self-termination requests filed by OTHER root
   * users in the same tenant. The actor (current root user) can approve
   * each row (→ soft-delete the requester via the §2.4 atomic TX) or
   * reject (→ requester enters 24h cooldown).
   *
   * Behavioral rules (masterplan §5.3):
   *   1. Card visible only when `currentUser.role === 'root'` — gated by
   *      the parent `+page.svelte` (`{#if data.user.role === 'root'}`).
   *   2. Cards filtered to `requester_id !== currentUser.id` — already
   *      enforced by backend `getPendingRequestsForApproval` (SQL
   *      `WHERE requester_id <> $1`). The frontend trusts that filter.
   *   3. Approve button → confirmation modal → POST /approve.
   *   4. Reject button → modal with REQUIRED reason → POST /reject.
   *   5. Real-time SSE update on the 3 events — NOT IMPLEMENTED in this
   *      step. Rationale: the backend EventBus emits internal NestJS events
   *      (Session 6), but `notifications.controller.ts` does not register
   *      SSE handlers for `root.self-termination.*` event keys. Wiring those
   *      handlers crosses the backend boundary and is tracked as a Phase 6
   *      follow-up. In the meantime: `invalidateAll()` after the actor's
   *      own approve/reject keeps the card list current; peer-decision
   *      drift is bounded by the page-revisit refresh window.
   *      ⇒ **Spec Deviation D13** recorded in masterplan changelog.
   *
   * UI conventions:
   *   - Glassmorphism card matching `(root)/root-profile/SelfTerminationCard`
   *     and the existing `manage-approvals` design language (table-row layout
   *     not used — list-of-cards reads better for low-volume, high-stakes
   *     decisions).
   *   - Reuses the design-system `ConfirmModal` component for both modals,
   *     matching the existing approve/reject UX on this same page (the
   *     generic-approvals `ApprovalItem` modals).
   *   - German labels throughout (DoD requirement).
   *
   * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §5.3
   * @see backend/src/nest/root/root-self-termination.controller.ts
   */
  import { invalidateAll } from '$app/navigation';

  import { showErrorAlert, showSuccessAlert } from '$lib/stores/toast';
  import { ApiError } from '$lib/utils/api-client.types';
  import { createLogger } from '$lib/utils/logger';

  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import { approvePeerRequest, rejectPeerRequest } from './_lib/api';
  import {
    ROOT_SELF_TERMINATION_ERROR_CODES,
    ROOT_SELF_TERMINATION_MESSAGES,
    ROOT_SELF_TERMINATION_REASON_MAX,
  } from './_lib/constants';

  import type { RootSelfTerminationRequest, RootUserLookup } from './_lib/types';

  interface Props {
    /** Pending peer requests (already filtered server-side per §5.3 rule 2). */
    requests: readonly RootSelfTerminationRequest[];
    /** Root-user list used to resolve `requesterId` → display name. */
    peerRoots: readonly RootUserLookup[];
  }

  const { requests, peerRoots }: Props = $props();
  const log = createLogger('RootSelfTerminationCard');

  // =============================================================================
  // CLIENT STATE
  // =============================================================================

  let activeRequest = $state<RootSelfTerminationRequest | null>(null);
  let showApproveModal = $state(false);
  let showRejectModal = $state(false);
  let approveComment = $state('');
  let rejectReason = $state('');
  let submitting = $state(false);

  // =============================================================================
  // DERIVED — name lookup map (peerRoots is small: at most ~10 rows per tenant)
  // =============================================================================

  const nameById = $derived(new Map(peerRoots.map((u) => [u.id, formatDisplayName(u)] as const)));

  function formatDisplayName(u: RootUserLookup): string {
    const parts = [u.firstName, u.lastName].filter((p) => p.length > 0);
    return parts.length > 0 ? parts.join(' ') : u.email;
  }

  function resolveRequesterName(id: number): string {
    return nameById.get(id) ?? `Benutzer #${id}`;
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString('de-DE', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  }

  // =============================================================================
  // HANDLERS
  // =============================================================================

  function openApproveModal(req: RootSelfTerminationRequest): void {
    activeRequest = req;
    approveComment = '';
    showApproveModal = true;
  }

  function openRejectModal(req: RootSelfTerminationRequest): void {
    activeRequest = req;
    rejectReason = '';
    showRejectModal = true;
  }

  /**
   * Map ApiError → user-facing toast. Falls through to generic error toast
   * for unrecognised codes. Mirrors the dispatch pattern used by Step 5.1's
   * `state-self-termination.svelte.ts` for consistency between the
   * requester and approver UX.
   */
  function handleApiError(err: unknown): void {
    if (err instanceof ApiError) {
      if (err.code === ROOT_SELF_TERMINATION_ERROR_CODES.LAST_ROOT_PROTECTION) {
        showErrorAlert(ROOT_SELF_TERMINATION_MESSAGES.toastErrorLastRoot);
        return;
      }
      if (err.code === ROOT_SELF_TERMINATION_ERROR_CODES.EXPIRED) {
        showErrorAlert(ROOT_SELF_TERMINATION_MESSAGES.toastErrorExpired);
        return;
      }
      if (err.code === ROOT_SELF_TERMINATION_ERROR_CODES.REJECTION_REASON_REQUIRED) {
        showErrorAlert(ROOT_SELF_TERMINATION_MESSAGES.toastErrorReasonRequired);
        return;
      }
    }
    log.error({ err }, 'Peer-decision failed');
    showErrorAlert(ROOT_SELF_TERMINATION_MESSAGES.toastError);
  }

  async function handleApprove(): Promise<void> {
    if (activeRequest === null) return;
    submitting = true;
    try {
      const trimmed = approveComment.trim();
      await approvePeerRequest(activeRequest.id, trimmed.length > 0 ? trimmed : null);
      showSuccessAlert(ROOT_SELF_TERMINATION_MESSAGES.toastApproved);
      showApproveModal = false;
      // eslint-disable-next-line require-atomic-updates -- Svelte single-threaded
      activeRequest = null;
      await invalidateAll();
    } catch (err: unknown) {
      handleApiError(err);
    } finally {
      submitting = false;
    }
  }

  async function handleReject(): Promise<void> {
    if (activeRequest === null) return;
    const trimmed = rejectReason.trim();
    if (trimmed.length === 0) {
      showErrorAlert(ROOT_SELF_TERMINATION_MESSAGES.rejectModalReasonRequired);
      return;
    }
    submitting = true;
    try {
      await rejectPeerRequest(activeRequest.id, trimmed);
      showSuccessAlert(ROOT_SELF_TERMINATION_MESSAGES.toastRejected);
      showRejectModal = false;
      // eslint-disable-next-line require-atomic-updates -- Svelte single-threaded
      activeRequest = null;
      // eslint-disable-next-line require-atomic-updates -- Svelte single-threaded
      rejectReason = '';
      await invalidateAll();
    } catch (err: unknown) {
      handleApiError(err);
    } finally {
      submitting = false;
    }
  }
</script>

<section class="root-self-termination-card">
  <header class="card-header">
    <i class="fas fa-skull-crossbones"></i>
    <div>
      <h2>{ROOT_SELF_TERMINATION_MESSAGES.sectionTitle}</h2>
      <p>{ROOT_SELF_TERMINATION_MESSAGES.sectionSubtitle}</p>
    </div>
  </header>

  {#if requests.length === 0}
    <div class="empty-row">
      <i class="fas fa-check-circle"></i>
      <span>{ROOT_SELF_TERMINATION_MESSAGES.emptyState}</span>
    </div>
  {:else}
    <ul class="request-list">
      {#each requests as req (req.id)}
        <li class="request-row">
          <div class="request-meta">
            <strong>
              {ROOT_SELF_TERMINATION_MESSAGES.rowRequesterPrefix}
              {resolveRequesterName(req.requesterId)}
            </strong>
            <p class="expires">
              {ROOT_SELF_TERMINATION_MESSAGES.rowExpiresPrefix}
              {formatDate(req.expiresAt)}
            </p>
            <p class="reason">
              <span class="reason-label">{ROOT_SELF_TERMINATION_MESSAGES.rowReasonLabel}:</span>
              {#if req.reason !== null && req.reason.trim() !== ''}
                <em>{req.reason}</em>
              {:else}
                <span class="reason-empty">{ROOT_SELF_TERMINATION_MESSAGES.rowNoReason}</span>
              {/if}
            </p>
          </div>
          <div class="request-actions">
            <button
              type="button"
              class="btn btn-success"
              onclick={() => {
                openApproveModal(req);
              }}
              disabled={submitting}
            >
              <i class="fas fa-check"></i>
              {ROOT_SELF_TERMINATION_MESSAGES.rowApproveBtn}
            </button>
            <button
              type="button"
              class="btn btn-danger"
              onclick={() => {
                openRejectModal(req);
              }}
              disabled={submitting}
            >
              <i class="fas fa-times"></i>
              {ROOT_SELF_TERMINATION_MESSAGES.rowRejectBtn}
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<!-- Approve Modal -->
<ConfirmModal
  show={showApproveModal && activeRequest !== null}
  id="root-self-term-approve-modal"
  wide
  title={ROOT_SELF_TERMINATION_MESSAGES.approveModalTitle}
  variant="danger"
  icon="fa-skull-crossbones"
  confirmLabel={ROOT_SELF_TERMINATION_MESSAGES.approveModalSubmit}
  cancelLabel={ROOT_SELF_TERMINATION_MESSAGES.approveModalCancel}
  {submitting}
  onconfirm={() => void handleApprove()}
  oncancel={() => {
    showApproveModal = false;
    activeRequest = null;
  }}
>
  {#if activeRequest !== null}
    <div class="warning-banner">
      <i class="fas fa-shield-halved"></i>
      <p>{ROOT_SELF_TERMINATION_MESSAGES.approveModalWarning}</p>
    </div>
    <p>
      <strong>
        {ROOT_SELF_TERMINATION_MESSAGES.rowRequesterPrefix}
        {resolveRequesterName(activeRequest.requesterId)}
      </strong>
    </p>
    {#if activeRequest.reason !== null && activeRequest.reason.trim() !== ''}
      <p class="reason-quote">
        <em>{activeRequest.reason}</em>
      </p>
    {/if}
    <div class="confirm-modal__input-group">
      <label
        class="modal-input-label"
        for="root-self-term-approve-comment"
      >
        {ROOT_SELF_TERMINATION_MESSAGES.approveModalCommentLabel}
      </label>
      <textarea
        id="root-self-term-approve-comment"
        class="confirm-modal__input"
        rows="3"
        maxlength={ROOT_SELF_TERMINATION_REASON_MAX}
        bind:value={approveComment}
        placeholder={ROOT_SELF_TERMINATION_MESSAGES.approveModalCommentPlaceholder}
        disabled={submitting}
      ></textarea>
    </div>
  {/if}
</ConfirmModal>

<!-- Reject Modal -->
<ConfirmModal
  show={showRejectModal && activeRequest !== null}
  id="root-self-term-reject-modal"
  wide
  title={ROOT_SELF_TERMINATION_MESSAGES.rejectModalTitle}
  variant="danger"
  icon="fa-times"
  confirmLabel={ROOT_SELF_TERMINATION_MESSAGES.rejectModalSubmit}
  cancelLabel={ROOT_SELF_TERMINATION_MESSAGES.rejectModalCancel}
  {submitting}
  onconfirm={() => void handleReject()}
  oncancel={() => {
    showRejectModal = false;
    activeRequest = null;
    rejectReason = '';
  }}
>
  {#if activeRequest !== null}
    <div class="warning-banner warning-banner--info">
      <i class="fas fa-info-circle"></i>
      <p>{ROOT_SELF_TERMINATION_MESSAGES.rejectModalWarning}</p>
    </div>
    <p>
      <strong>
        {ROOT_SELF_TERMINATION_MESSAGES.rowRequesterPrefix}
        {resolveRequesterName(activeRequest.requesterId)}
      </strong>
    </p>
    <div class="confirm-modal__input-group">
      <label
        class="modal-input-label"
        for="root-self-term-reject-reason"
      >
        {ROOT_SELF_TERMINATION_MESSAGES.rejectModalReasonLabel}
      </label>
      <textarea
        id="root-self-term-reject-reason"
        class="confirm-modal__input"
        rows="3"
        maxlength={ROOT_SELF_TERMINATION_REASON_MAX}
        bind:value={rejectReason}
        placeholder={ROOT_SELF_TERMINATION_MESSAGES.rejectModalReasonPlaceholder}
        disabled={submitting}
        required
      ></textarea>
      <span class="confirm-modal__counter">
        {rejectReason.length} / {ROOT_SELF_TERMINATION_REASON_MAX}
      </span>
    </div>
  {/if}
</ConfirmModal>

<style>
  .root-self-termination-card {
    margin-bottom: var(--spacing-6);
    border: 1px solid color-mix(in oklch, var(--color-danger) 30%, transparent);
    border-radius: var(--radius-xl);
    background: color-mix(in oklch, var(--color-danger) 5%, transparent);
    padding: var(--spacing-6);
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-4);
    margin-bottom: var(--spacing-5);
  }

  .card-header i {
    color: var(--color-danger);
    font-size: 24px;
  }

  .card-header h2 {
    margin: 0 0 var(--spacing-1) 0;
    color: var(--color-danger);
    font-size: 18px;
    font-weight: 600;
  }

  .card-header p {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 14px;
    line-height: 1.5;
  }

  .empty-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-4);
    color: var(--color-text-secondary);
    font-size: 14px;
  }

  .empty-row i {
    color: var(--color-success);
    font-size: 18px;
  }

  .request-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .request-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-4);
    border: 1px solid color-mix(in oklch, var(--color-warning) 25%, transparent);
    border-radius: var(--radius-xl);
    background: color-mix(in oklch, var(--color-warning) 8%, transparent);
    padding: var(--spacing-4);
  }

  .request-meta {
    flex: 1;
    min-width: 0;
  }

  .request-meta strong {
    display: block;
    margin-bottom: var(--spacing-2);
    color: var(--color-text-primary);
  }

  .expires,
  .reason {
    margin: 0 0 var(--spacing-1) 0;
    color: var(--color-text-secondary);
    font-size: 14px;
  }

  .reason-label {
    font-weight: 600;
  }

  .reason-empty {
    color: var(--color-text-secondary);
    opacity: 70%;
    font-style: italic;
  }

  .request-actions {
    display: flex;
    flex-shrink: 0;
    gap: var(--spacing-2);
  }

  .warning-banner {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-3);
    margin-bottom: var(--spacing-4);
    border: 1px solid color-mix(in oklch, var(--color-danger) 30%, transparent);
    border-radius: var(--radius-xl);
    background: color-mix(in oklch, var(--color-danger) 8%, transparent);
    padding: var(--spacing-3);
  }

  .warning-banner--info {
    border-color: color-mix(in oklch, var(--color-warning) 30%, transparent);
    background: color-mix(in oklch, var(--color-warning) 8%, transparent);
  }

  .warning-banner i {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--color-danger);
    font-size: 18px;
  }

  .warning-banner--info i {
    color: var(--color-warning);
  }

  .warning-banner p {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 14px;
    line-height: 1.5;
  }

  .reason-quote {
    margin: var(--spacing-2) 0;
    color: var(--color-text-secondary);
    font-size: 14px;
  }

  .modal-input-label {
    display: block;
    margin-bottom: var(--spacing-2);
    color: var(--color-text-secondary);
    font-size: 13px;
    font-weight: 600;
  }

  @media (width < 768px) {
    .request-row {
      flex-direction: column;
      align-items: stretch;
    }

    .request-actions {
      flex-direction: column;
    }
  }
</style>

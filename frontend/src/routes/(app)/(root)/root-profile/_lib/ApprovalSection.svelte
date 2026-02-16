<script lang="ts">
  /**
   * ApprovalSection — Pending tenant deletion approvals (root-only).
   */
  import { invalidateAll } from '$app/navigation';

  import {
    approveRequest as apiApproveRequest,
    rejectRequest as apiRejectRequest,
  } from './api';
  import { MESSAGES } from './constants';
  import { formatDate, showToast } from './utils';

  import type { ApprovalItem } from './types';

  interface Props {
    approvals: ApprovalItem[];
  }

  const { approvals }: Props = $props();

  async function approveRequest(id: number): Promise<void> {
    try {
      await apiApproveRequest(id);
      showToast(MESSAGES.approvalApproved, 'success');
      await invalidateAll();
    } catch {
      showToast(MESSAGES.approvalError, 'error');
    }
  }

  async function rejectRequest(id: number): Promise<void> {
    try {
      await apiRejectRequest(id);
      showToast(MESSAGES.approvalRejected, 'info');
      await invalidateAll();
    } catch {
      showToast(MESSAGES.rejectError, 'error');
    }
  }
</script>

<div class="approval-section">
  <div class="approval-header">
    <i class="fas fa-hourglass-half"></i>
    <div>
      <h3>Ausstehende Löschgenehmigungen</h3>
      <p>Diese Löschanfragen warten auf Ihre Genehmigung</p>
    </div>
  </div>
  <div class="approval-list">
    {#each approvals as approval (approval.id)}
      <div class="approval-item">
        <div class="approval-item-header">
          <div class="approval-item-info">
            <strong>{approval.tenantName}</strong>
            <span class="approval-status pending">{MESSAGES.pendingStatus}</span
            >
            <p>Angefragt von: {approval.requestedBy}</p>
            <p>Datum: {formatDate(approval.requestedAt)}</p>
          </div>
          <div class="approval-item-actions">
            {#if approval.coolingOffComplete}
              <button
                type="button"
                class="btn btn-success btn-sm"
                onclick={() => approveRequest(approval.id)}
              >
                <i class="fas fa-check"></i> Genehmigen
              </button>
            {/if}
            <button
              type="button"
              class="btn btn-danger btn-sm"
              onclick={() => rejectRequest(approval.id)}
            >
              <i class="fas fa-times"></i> Ablehnen
            </button>
          </div>
        </div>
        {#if !approval.coolingOffComplete && approval.coolingOffEndsAt}
          <div class="cooling-off-warning">
            <i class="fas fa-clock"></i>
            <span
              >Wartezeit endet am: {formatDate(approval.coolingOffEndsAt)}</span
            >
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .approval-section {
    margin-bottom: var(--spacing-8);
    border: 1px solid rgb(255 193 7 / 20%);
    border-radius: var(--radius-xl);
    background: rgb(255 193 7 / 5%);
    padding: var(--spacing-6);
  }

  .approval-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
    margin-bottom: var(--spacing-6);
  }

  .approval-header i {
    color: var(--color-warning);
    font-size: 24px;
  }

  .approval-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .approval-item {
    transition: all var(--transition-fast);
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg);
    padding: var(--spacing-3);
  }

  .approval-item:hover {
    transform: translateY(-2px);
    background: var(--glass-bg-active);
  }

  .approval-item-header {
    display: flex;
    justify-content: space-between;
    align-items: start;
    margin-bottom: var(--spacing-2);
  }

  .approval-item-info {
    flex: 1;
  }

  .approval-item-actions {
    display: flex;
    gap: var(--spacing-2);
  }

  .approval-status {
    display: inline-block;
    border-radius: 12px;
    padding: 4px 12px;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
  }

  .approval-status.pending {
    background: rgb(255 193 7 / 20%);
    color: var(--color-warning);
  }

  .cooling-off-warning {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    margin-top: var(--spacing-2);
    border: 1px solid rgb(255 152 0 / 30%);
    border-radius: var(--radius-xl);
    background: rgb(255 152 0 / 10%);
    padding: var(--spacing-3);
    font-size: 13px;
  }

  .cooling-off-warning i {
    color: #ff9800;
  }
</style>

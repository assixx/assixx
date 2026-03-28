<script lang="ts">
  import { resolve } from '$app/paths';

  import { kvpDetailState } from './state.svelte';
  import {
    getFileIconClass,
    formatFileSize,
    formatDateTime,
    canShareSuggestion,
    canUnshareSuggestion,
    canArchiveSuggestion,
    canUnarchiveSuggestion,
  } from './utils';

  import type { ApprovalInfo, Attachment, KvpSuggestion, LinkedWorkOrder } from './types';

  interface Props {
    suggestion: KvpSuggestion;
    linkedWorkOrders: LinkedWorkOrder[];
    approval: ApprovalInfo | null;
    hasApprovalConfig: boolean;
    isApprovalMaster: boolean;
    onopensharemodal: () => void;
    onunshare: () => void;
    onarchive: () => void;
    onunarchive: () => void;
    onconfirm: () => Promise<void>;
    onunconfirm: () => Promise<void>;
    onopenpreview: (attachment: Attachment) => void;
    onopenworkordermodal: () => void;
    onrequestapproval: () => Promise<void>;
    onapprove: () => void;
    onreject: () => void;
  }

  const {
    suggestion,
    linkedWorkOrders,
    approval,
    hasApprovalConfig,
    isApprovalMaster,
    onopensharemodal,
    onunshare,
    onarchive,
    onunarchive,
    onconfirm,
    onunconfirm,
    onopenpreview,
    onopenworkordermodal,
    onrequestapproval,
    onapprove,
    onreject,
  }: Props = $props();

  const canRequestApproval = $derived(
    kvpDetailState.canManage &&
      hasApprovalConfig &&
      approval === null &&
      (suggestion.status === 'new' || suggestion.status === 'restored'),
  );

  /** Active (non-verified) work order blocks new creation */
  const activeWorkOrder = $derived(
    linkedWorkOrders.find((wo: LinkedWorkOrder) => wo.status !== 'verified') ?? null,
  );

  // Loading state for confirm/unconfirm
  let confirming = $state(false);

  async function handleConfirm() {
    confirming = true;
    await onconfirm();
    confirming = false;
  }

  async function handleUnconfirm() {
    confirming = true;
    await onunconfirm();
    confirming = false;
  }
</script>

<div class="detail-sidebar">
  <!-- Read Confirmation (ALL Users - Pattern 2: Individual tracking) -->
  <div class="sidebar-card card">
    <h3 class="section-title">
      <i class="fas fa-check-circle"></i>
      Lesebestätigung
    </h3>
    {#if suggestion.isConfirmed === true}
      <div class="confirmation-done mb-4">
        <i class="fas fa-check-circle text-success"></i>
        <span>Bereits als gelesen markiert</span>
        {#if suggestion.confirmedAt}
          <span class="text-muted text-sm">{formatDateTime(suggestion.confirmedAt)}</span>
        {/if}
      </div>
      <button
        type="button"
        class="btn btn-light text-sm"
        onclick={handleUnconfirm}
        disabled={confirming}
      >
        {#if confirming}
          <span class="spinner-ring spinner-ring--sm mr-2"></span>
        {:else}
          <i class="fas fa-undo mr-2"></i>
        {/if}
        Als ungelesen markieren
      </button>
    {:else}
      <button
        type="button"
        class="btn btn-upload"
        onclick={handleConfirm}
        disabled={confirming}
      >
        {#if confirming}
          <span class="spinner-ring spinner-ring--sm mr-2"></span>
        {:else}
          <i class="fas fa-check mr-2"></i>
        {/if}
        Als gelesen markieren
      </button>
    {/if}
  </div>

  <!-- Other Attachments -->
  {#if kvpDetailState.otherAttachments.length > 0}
    <div class="sidebar-card card">
      <h3 class="section-title">
        <i class="fas fa-paperclip"></i>
        Anhaenge
      </h3>
      <div class="attachment-list">
        {#each kvpDetailState.otherAttachments as attachment (attachment.fileUuid)}
          <div
            class="attachment-item"
            role="button"
            tabindex="0"
            onclick={() => {
              onopenpreview(attachment);
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter') onopenpreview(attachment);
            }}
          >
            <i class="fas {getFileIconClass(attachment.fileType)}"></i>
            <div class="flex-1 truncate">
              <div class="truncate">{attachment.fileName}</div>
              <div class="text-xs text-gray-400">
                {formatFileSize(attachment.fileSize)}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Linked Work Orders -->
  {#if linkedWorkOrders.length > 0}
    <div class="sidebar-card card">
      <h3 class="section-title">
        <i class="fas fa-clipboard-check"></i>
        Arbeitsaufträge
      </h3>
      <div class="linked-wo-list">
        {#each linkedWorkOrders as wo (wo.uuid)}
          <a
            href={resolve(`/work-orders/${wo.uuid}`)}
            class="linked-wo-item"
          >
            <div class="linked-wo-item__title truncate">{wo.title}</div>
            <div class="linked-wo-item__meta">
              <span>{wo.createdByName}</span>
              <span>{formatDateTime(wo.createdAt)}</span>
            </div>
          </a>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Approval Status Badge -->
  {#if approval !== null}
    <div class="sidebar-card card">
      <h3 class="section-title">
        <i class="fas fa-check-double"></i>
        Freigabe-Status
      </h3>
      <div class="approval-status">
        {#if approval.status === 'pending'}
          <span class="badge badge--warning">Freigabe ausstehend</span>
          <p class="approval-meta">Angefordert von {approval.requestedByName}</p>
          <p class="approval-meta">{formatDateTime(approval.createdAt)}</p>
          {#if isApprovalMaster}
            <div class="approval-actions">
              <button
                type="button"
                class="btn btn-success"
                onclick={onapprove}
              >
                <i class="fas fa-check mr-1"></i>
                Genehmigen
              </button>
              <button
                type="button"
                class="btn btn-cancel"
                onclick={onreject}
              >
                <i class="fas fa-times mr-1"></i>
                Ablehnen
              </button>
            </div>
          {/if}
        {:else if approval.status === 'approved'}
          <span class="badge badge--success">Freigabe erteilt</span>
          <p class="approval-meta">Genehmigt von {approval.decidedByName ?? '—'}</p>
          {#if approval.rewardAmount !== null}
            <p class="approval-reward">
              <i class="fas fa-trophy"></i>
              {approval.rewardAmount.toFixed(0)} € Prämie
            </p>
          {/if}
          {#if approval.decidedAt !== null}
            <p class="approval-meta">{formatDateTime(approval.decidedAt)}</p>
          {/if}
          {#if approval.decisionNote !== null && approval.decisionNote !== ''}
            <p class="approval-note">{approval.decisionNote}</p>
          {/if}
        {:else if approval.status === 'rejected'}
          <span class="badge badge--danger">Freigabe abgelehnt</span>
          <p class="approval-meta">Abgelehnt von {approval.decidedByName ?? '—'}</p>
          {#if approval.decisionNote !== null && approval.decisionNote !== ''}
            <p class="approval-reason">{approval.decisionNote}</p>
          {/if}
          {#if approval.decidedAt !== null}
            <p class="approval-meta">{formatDateTime(approval.decidedAt)}</p>
          {/if}
        {/if}
      </div>
    </div>
  {/if}

  <!-- Actions (Admin, Root, Team Lead) -->
  {#if kvpDetailState.canManage}
    <div class="sidebar-card card">
      <h3 class="section-title">
        <i class="fas fa-cog"></i>
        Aktionen
      </h3>
      <div class="action-buttons">
        {#if canRequestApproval}
          <button
            type="button"
            class="btn btn-warning"
            onclick={onrequestapproval}
          >
            <i class="fas fa-check-double"></i>
            Freigabe anfordern
          </button>
        {/if}
        {#if activeWorkOrder !== null}
          <div class="alert alert--info alert--sm mb-0">
            <i class="fas fa-info-circle mr-2"></i>
            Es existiert bereits ein aktiver Arbeitsauftrag. Erst nach Verifizierung kann ein neuer erstellt
            werden.
          </div>
        {:else}
          <button
            type="button"
            class="btn btn-primary"
            onclick={onopenworkordermodal}
          >
            <i class="fas fa-clipboard-check"></i>
            Arbeitsauftrag generieren
          </button>
        {/if}
        {#if canShareSuggestion(suggestion, kvpDetailState.effectiveRole, kvpDetailState.canManage)}
          <button
            type="button"
            class="btn btn-secondary"
            onclick={onopensharemodal}
          >
            <i class="fas fa-share-alt"></i>
            Teilen
          </button>
        {/if}
        {#if canUnshareSuggestion(suggestion, kvpDetailState.effectiveRole, kvpDetailState.currentUser?.id, kvpDetailState.canManage)}
          <button
            type="button"
            class="btn btn-secondary"
            onclick={onunshare}
          >
            <i class="fas fa-undo"></i>
            Teilen rückgängig
          </button>
        {/if}
        {#if canArchiveSuggestion(kvpDetailState.effectiveRole, suggestion.status, kvpDetailState.canManage)}
          <button
            type="button"
            class="btn btn-light"
            onclick={onarchive}
          >
            <i class="fas fa-archive"></i>
            Archivieren
          </button>
        {/if}
        {#if canUnarchiveSuggestion(kvpDetailState.effectiveRole, suggestion.status, kvpDetailState.canManage)}
          <button
            type="button"
            class="btn btn-success"
            onclick={onunarchive}
          >
            <i class="fas fa-undo-alt"></i>
            Wiederherstellen
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .detail-sidebar {
    position: relative;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-6);
  }

  .sidebar-card {
    z-index: 1;
    margin-bottom: 0;
  }

  .confirmation-done {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
    text-align: center;
  }

  .confirmation-done :global(.text-success) {
    font-size: 2rem;
    color: var(--color-success);
  }

  .attachment-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .attachment-item {
    cursor: pointer;
    display: flex;
    gap: var(--spacing-2);
    align-items: center;
    padding: var(--spacing-3);
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg);
  }

  .attachment-item:hover {
    border-color: var(--primary-color);
    background: var(--glass-bg-active);
  }

  .linked-wo-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .linked-wo-item {
    display: block;
    padding: var(--spacing-3);
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg);
    text-decoration: none;
    color: inherit;
    transition:
      border-color 0.2s,
      background 0.2s;
  }

  .linked-wo-item:hover {
    border-color: var(--primary-color);
    background: var(--glass-bg-active);
  }

  .linked-wo-item__title {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .linked-wo-item__meta {
    display: flex;
    justify-content: space-between;
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-3);
  }

  .section-title {
    display: flex;
    gap: var(--spacing-2);
    align-items: center;
    margin-bottom: var(--spacing-4);
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--primary-color);
  }

  .approval-status {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .approval-meta {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .approval-actions {
    display: flex;
    gap: var(--spacing-2);
    margin-top: var(--spacing-3);
  }

  .approval-reward {
    margin: var(--spacing-2) 0 0;
    padding: var(--spacing-2);
    border-radius: var(--radius-md);
    background: oklch(51.29% 0.1307 157.18 / 10%);
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-success);
  }

  .approval-note {
    margin: var(--spacing-2) 0 0;
    padding: var(--spacing-2);
    border-radius: var(--radius-md);
    background: var(--glass-bg);
    font-size: 0.85rem;
    font-style: italic;
  }

  .approval-reason {
    margin: var(--spacing-2) 0 0;
    padding: var(--spacing-2);
    border-radius: var(--radius-md);
    background: var(--color-danger-bg, rgb(220 53 69 / 10%));
    font-size: 0.85rem;
    font-style: italic;
  }
</style>

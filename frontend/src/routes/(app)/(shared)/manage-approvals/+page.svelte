<script lang="ts">
  /**
   * Manage Approvals — Eingehende Freigaben
   * @module shared/manage-approvals/+page
   *
   * Level 3 SSR: Stats cards, filter bar, data table, approve/reject modals.
   * Connected to real backend API.
   */
  import { onMount } from 'svelte';

  import { invalidateAll } from '$app/navigation';

  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import { showErrorAlert, showSuccessAlert } from '$lib/stores/toast';

  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import RootSelfTerminationCard from './RootSelfTerminationCard.svelte';

  import type { PageData } from './$types';

  // Sidebar badge clears the moment the user lands on /manage-approvals —
  // both pending self-terminations and addon approvals are visible from
  // here, so the consolidated `approvals` counter resets on entry.
  // FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN Phase 7 / sidebar badge wiring.
  onMount(() => {
    notificationStore.resetCount('approvals');
  });

  // =============================================================================
  // SSR DATA
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // =============================================================================
  // TYPES
  // =============================================================================

  interface ApprovalItem {
    uuid: string;
    addonCode: string;
    sourceEntityType: string;
    sourceUuid: string;
    title: string;
    description: string | null;
    requestedByName: string;
    status: 'pending' | 'approved' | 'rejected';
    priority: string;
    decidedByName: string | null;
    decisionNote: string | null;
    rewardAmount: number | null;
    isRead: boolean;
    createdAt: string;
  }

  // =============================================================================
  // CLIENT STATE
  // =============================================================================

  let statusFilter = $state('');
  let addonFilter = $state('');
  let submitting = $state(false);

  /** Tracks UUIDs marked as read client-side — survives invalidateAll() */
  const locallyRead: Record<string, boolean> = $state({});

  // Modal state
  let showApproveModal = $state(false);
  let showRejectModal = $state(false);
  let activeApproval = $state<ApprovalItem | null>(null);
  let rejectNote = $state('');
  let approveNote = $state('');
  let selectedRewardAmount = $state<number | null>(null);

  // =============================================================================
  // CONSTANTS
  // =============================================================================

  const STATUS_FILTER_OPTIONS = [
    { value: '', label: 'Alle Status' },
    { value: 'pending', label: 'Offen' },
    { value: 'approved', label: 'Genehmigt' },
    { value: 'rejected', label: 'Abgelehnt' },
  ] as const;

  const ADDON_FILTER_OPTIONS = [
    { value: '', label: 'Alle Module' },
    { value: 'kvp', label: 'KVP' },
    { value: 'tpm', label: 'TPM / Wartung' },
    { value: 'vacation', label: 'Urlaub' },
    { value: 'shift_planning', label: 'Schichtplanung' },
    { value: 'blackboard', label: 'Schwarzes Brett' },
    { value: 'calendar', label: 'Kalender' },
    { value: 'surveys', label: 'Umfragen' },
  ] as const;

  const STATUS_BADGE: Record<string, { label: string; cssClass: string; icon: string }> = {
    pending: { label: 'Offen', cssClass: 'badge--pending', icon: 'fa-clock' },
    approved: { label: 'Genehmigt', cssClass: 'badge--approved', icon: 'fa-check' },
    rejected: { label: 'Abgelehnt', cssClass: 'badge--failed', icon: 'fa-times' },
  };

  const PRIORITY_BADGE: Record<string, string> = {
    low: 'badge--priority-low',
    medium: 'badge--priority-normal',
    high: 'badge--priority-high',
  };

  const PRIORITY_LABEL: Record<string, string> = {
    low: 'Niedrig',
    medium: 'Mittel',
    high: 'Hoch',
  };

  const ADDON_BADGE: Record<string, { cssClass: string; label: string }> = {
    kvp: { cssClass: 'badge--info', label: 'KVP' },
    tpm: { cssClass: 'badge--dark', label: 'TPM' },
    vacation: { cssClass: 'badge--primary', label: 'Urlaub' },
    shift_planning: { cssClass: 'badge--dark', label: 'Schichtplanung' },
    blackboard: { cssClass: 'badge--secondary', label: 'Schwarzes Brett' },
    calendar: { cssClass: 'badge--warning', label: 'Kalender' },
    surveys: { cssClass: 'badge--success', label: 'Umfragen' },
  };

  function addonLabel(code: string): string {
    const entry = (ADDON_BADGE as Record<string, { label: string } | undefined>)[code];
    return entry !== undefined ? entry.label : code;
  }

  /** Resolves the detail page URL for a given approval source, or null if no deep-link exists */
  function resolveSourceUrl(addonCode: string, sourceUuid: string): string | null {
    switch (addonCode) {
      case 'kvp':
        return `/kvp-detail?uuid=${sourceUuid}`;
      case 'tpm':
        return `/lean-management/tpm/plan/${sourceUuid}`;
      case 'blackboard':
        return `/blackboard/${sourceUuid}`;
      default:
        return null;
    }
  }

  // =============================================================================
  // DERIVED
  // =============================================================================

  const stats = $derived(data.stats);
  const approvals = $derived(data.approvals);
  const items = $derived('items' in approvals ? (approvals.items as ApprovalItem[]) : []);
  const rewardTiers = $derived(data.rewardTiers);

  /** Client-side filtering (SSR already filtered, this is for quick toggling) */
  const filteredItems = $derived(
    items.filter((a: ApprovalItem) => {
      if (statusFilter !== '' && a.status !== statusFilter) return false;
      if (addonFilter !== '' && a.addonCode !== addonFilter) return false;
      return true;
    }),
  );

  const hasApprovals = $derived(filteredItems.length > 0);

  // =============================================================================
  // HANDLERS
  // =============================================================================

  function isUnread(approval: ApprovalItem): boolean {
    return !approval.isRead && !locallyRead[approval.uuid];
  }

  function markAsRead(approval: ApprovalItem): void {
    if (approval.isRead || locallyRead[approval.uuid]) return;
    locallyRead[approval.uuid] = true;
    void fetch(`/api/v2/approvals/${approval.uuid}/read`, { method: 'POST' });
  }

  function openApproveModal(approval: ApprovalItem): void {
    markAsRead(approval);
    activeApproval = approval;
    approveNote = '';
    selectedRewardAmount = null;
    showApproveModal = true;
  }

  function openRejectModal(approval: ApprovalItem): void {
    markAsRead(approval);
    activeApproval = approval;
    rejectNote = '';
    showRejectModal = true;
  }

  async function handleApprove(): Promise<void> {
    if (activeApproval === null) return;
    submitting = true;
    try {
      const res = await fetch(`/api/v2/approvals/${activeApproval.uuid}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisionNote: approveNote !== '' ? approveNote : null,
          rewardAmount: selectedRewardAmount,
        }),
      });
      if (res.ok) {
        showSuccessAlert('Freigabe genehmigt');
        showApproveModal = false;
        activeApproval = null; // eslint-disable-line require-atomic-updates -- Svelte single-threaded
        await invalidateAll();
      } else {
        const body = (await res.json()) as { error?: { message?: string } };
        showErrorAlert(body.error?.message ?? 'Fehler beim Genehmigen');
      }
    } catch {
      showErrorAlert('Fehler beim Genehmigen');
    } finally {
      submitting = false;
    }
  }

  async function handleReject(): Promise<void> {
    if (activeApproval === null || rejectNote.trim() === '') return;
    submitting = true;
    try {
      const res = await fetch(`/api/v2/approvals/${activeApproval.uuid}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionNote: rejectNote }),
      });
      if (res.ok) {
        showSuccessAlert('Freigabe abgelehnt');
        showRejectModal = false;
        activeApproval = null; // eslint-disable-line require-atomic-updates -- Svelte single-threaded
        rejectNote = ''; // eslint-disable-line require-atomic-updates -- Svelte single-threaded
        await invalidateAll();
      } else {
        const body = (await res.json()) as { error?: { message?: string } };
        showErrorAlert(body.error?.message ?? 'Fehler beim Ablehnen');
      }
    } catch {
      showErrorAlert('Fehler beim Ablehnen');
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Freigaben verwalten</title>
</svelte:head>

<div class="container">
  <!--
    Step 5.3 — Root self-termination peer-approval card.
    Visible only to root users (data.user.role === 'root'). Renders BEFORE
    the generic approvals list because it is the highest-stakes decision
    type (account termination) and must catch the actor's eye first.
    Backend SSR returned an empty array for non-root → the {#if} below
    keeps the DOM tree small for admins/leads.
    @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §5.3
  -->
  {#if data.user?.role === 'root'}
    <RootSelfTerminationCard
      requests={data.rootSelfTerminationRequests}
      peerRoots={data.rootUsers}
    />
  {/if}

  <!-- Header -->
  <div class="card mb-6">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-check-double mr-2"></i>
        Eingehende Freigaben
      </h2>
      <p class="mt-2 text-(--color-text-secondary)">Freigabe-Anfragen prüfen und bearbeiten</p>
    </div>
  </div>

  <!-- Stats Cards -->
  <div class="stats-grid mb-6">
    <div class="card-stat card-stat--sm card-stat--warning">
      <div class="card-stat__icon"><i class="fas fa-clock"></i></div>
      <span class="card-stat__value">{stats.pending}</span>
      <span class="card-stat__label">Offen</span>
    </div>
    <div class="card-stat card-stat--sm card-stat--success">
      <div class="card-stat__icon"><i class="fas fa-check"></i></div>
      <span class="card-stat__value">{stats.approved}</span>
      <span class="card-stat__label">Genehmigt</span>
    </div>
    <div class="card-stat card-stat--sm card-stat--danger">
      <div class="card-stat__icon"><i class="fas fa-times"></i></div>
      <span class="card-stat__value">{stats.rejected}</span>
      <span class="card-stat__label">Abgelehnt</span>
    </div>
    <div class="card-stat card-stat--sm">
      <div class="card-stat__icon"><i class="fas fa-list"></i></div>
      <span class="card-stat__value">{stats.total}</span>
      <span class="card-stat__label">Gesamt</span>
    </div>
  </div>

  <!-- Filter Bar + Table -->
  <div class="card">
    <div class="card__header">
      <div class="filter-bar">
        <div class="toggle-group">
          {#each STATUS_FILTER_OPTIONS as opt (opt.value)}
            <button
              type="button"
              class="toggle-group__btn"
              class:active={statusFilter === opt.value}
              onclick={() => {
                statusFilter = opt.value;
              }}
            >
              {opt.label}
            </button>
          {/each}
        </div>

        <div class="toggle-group">
          {#each ADDON_FILTER_OPTIONS as opt (opt.value)}
            <button
              type="button"
              class="toggle-group__btn"
              class:active={addonFilter === opt.value}
              onclick={() => {
                addonFilter = opt.value;
              }}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>
    </div>

    <div class="card__body">
      {#if !hasApprovals}
        <div class="empty-state empty-state--in-card">
          <div class="empty-state__icon">
            <i class="fas fa-check-double"></i>
          </div>
          <h3 class="empty-state__title">Keine Freigaben vorhanden</h3>
          <p class="empty-state__description">Es liegen aktuell keine Freigabe-Anfragen vor.</p>
        </div>
      {:else}
        <div class="table-responsive">
          <table class="data-table data-table--hover">
            <thead>
              <tr>
                <th scope="col">Titel</th>
                <th scope="col">Modul</th>
                <th scope="col">Angefragt von</th>
                <th scope="col">Priorität</th>
                <th scope="col">Status</th>
                <th scope="col">Prämie</th>
                <th scope="col">Datum</th>
                <th scope="col">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredItems as approval (approval.uuid)}
                {@const statusBadge = STATUS_BADGE[approval.status] ?? STATUS_BADGE.pending}
                {@const addonBadge = ADDON_BADGE[approval.addonCode]}
                {@const priorityCss = PRIORITY_BADGE[approval.priority] ?? 'badge--outline'}
                {@const priorityLabel = PRIORITY_LABEL[approval.priority] ?? approval.priority}
                {@const sourceUrl = resolveSourceUrl(approval.addonCode, approval.sourceUuid)}
                <tr
                  onclick={() => {
                    markAsRead(approval);
                  }}
                >
                  <td
                    class="td--title"
                    title={approval.title}
                  >
                    {#if sourceUrl !== null}
                      <a
                        href={sourceUrl}
                        class="source-link">{approval.title}</a
                      >
                    {:else}
                      {approval.title}
                    {/if}
                    {#if isUnread(approval)}
                      <span class="badge badge--sm badge--success ml-2">Neu</span>
                    {/if}
                    {#if approval.description}
                      <span class="td--description">{approval.description}</span>
                    {/if}
                  </td>
                  <td>
                    {#if addonBadge}
                      <span class="badge {addonBadge.cssClass}">{addonBadge.label}</span>
                    {:else}
                      <span class="badge badge--outline">{approval.addonCode}</span>
                    {/if}
                  </td>
                  <td>{approval.requestedByName}</td>
                  <td>
                    <span class="badge {priorityCss}">{priorityLabel}</span>
                  </td>
                  <td>
                    <span class="badge {statusBadge.cssClass}">
                      <i class="fas {statusBadge.icon}"></i>
                      {statusBadge.label}
                    </span>
                  </td>
                  <td>
                    {#if approval.rewardAmount !== null}
                      <span class="badge badge--success">{approval.rewardAmount.toFixed(0)} €</span>
                    {:else}
                      <span class="text-(--color-text-secondary)">—</span>
                    {/if}
                  </td>
                  <td>{new Date(approval.createdAt).toLocaleDateString('de-DE')}</td>
                  <td>
                    <div class="action-icons">
                      {#if approval.status === 'pending'}
                        <button
                          type="button"
                          class="action-icon action-icon--success"
                          title="Genehmigen"
                          onclick={() => {
                            openApproveModal(approval);
                          }}
                        >
                          <i class="fas fa-check"></i>
                        </button>
                        <button
                          type="button"
                          class="action-icon action-icon--danger"
                          title="Ablehnen"
                          onclick={() => {
                            openRejectModal(approval);
                          }}
                        >
                          <i class="fas fa-times"></i>
                        </button>
                      {:else if approval.decisionNote !== null}
                        <span
                          class="decision-note-icon"
                          title={approval.decisionNote}
                        >
                          <i class="fas fa-comment"></i>
                        </span>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Approve Modal -->
<ConfirmModal
  show={showApproveModal && activeApproval !== null}
  id="approve-modal"
  wide
  title="Freigabe genehmigen"
  variant="success"
  icon="fa-check"
  confirmLabel="Genehmigen"
  {submitting}
  onconfirm={() => void handleApprove()}
  oncancel={() => {
    showApproveModal = false;
    activeApproval = null;
  }}
>
  {#if activeApproval !== null}
    {@const approveSourceUrl = resolveSourceUrl(
      activeApproval.addonCode,
      activeApproval.sourceUuid,
    )}
    <p>
      <strong>
        {#if approveSourceUrl !== null}
          <a
            href={approveSourceUrl}
            class="source-link"
            target="_blank"
            rel="noopener noreferrer">{activeApproval.title}</a
          >
        {:else}
          {activeApproval.title}
        {/if}
      </strong>
    </p>
    <p>
      Modul: {addonLabel(activeApproval.addonCode)} | Angefragt von: {activeApproval.requestedByName}
    </p>
    {#if activeApproval.addonCode === 'kvp' && rewardTiers.length > 0}
      <div class="reward-select">
        <p class="reward-select__label">Prämie (optional):</p>
        <div class="toggle-group">
          {#each rewardTiers as tier (tier.id)}
            <button
              type="button"
              class="toggle-group__btn"
              class:active={selectedRewardAmount === tier.amount}
              onclick={() => {
                selectedRewardAmount = selectedRewardAmount === tier.amount ? null : tier.amount;
              }}
            >
              {tier.amount.toFixed(0)} €
            </button>
          {/each}
        </div>
      </div>
    {/if}
    <div class="confirm-modal__input-group">
      <textarea
        id="approve-note"
        class="confirm-modal__input"
        rows="3"
        bind:value={approveNote}
        placeholder="Optionaler Kommentar zur Genehmigung..."
      ></textarea>
    </div>
  {/if}
</ConfirmModal>

<!-- Reject Modal -->
<ConfirmModal
  show={showRejectModal && activeApproval !== null}
  id="reject-modal"
  wide
  title="Freigabe ablehnen"
  variant="danger"
  icon="fa-times"
  confirmLabel="Ablehnen"
  {submitting}
  onconfirm={() => void handleReject()}
  oncancel={() => {
    showRejectModal = false;
    activeApproval = null;
    rejectNote = '';
  }}
>
  {#if activeApproval !== null}
    {@const rejectSourceUrl = resolveSourceUrl(activeApproval.addonCode, activeApproval.sourceUuid)}
    <p>
      <strong>
        {#if rejectSourceUrl !== null}
          <a
            href={rejectSourceUrl}
            class="source-link"
            target="_blank"
            rel="noopener noreferrer">{activeApproval.title}</a
          >
        {:else}
          {activeApproval.title}
        {/if}
      </strong>
    </p>
    <p>
      Modul: {addonLabel(activeApproval.addonCode)} | Angefragt von: {activeApproval.requestedByName}
    </p>
    <div class="confirm-modal__input-group">
      <textarea
        id="reject-note"
        class="confirm-modal__input"
        rows="3"
        bind:value={rejectNote}
        placeholder="Begründung für die Ablehnung..."
        required
      ></textarea>
    </div>
  {/if}
</ConfirmModal>

<style>
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--spacing-3);
  }

  @media (width <= 768px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .filter-bar {
    display: flex;
    gap: var(--spacing-4);
    flex-wrap: wrap;
  }

  tr {
    cursor: pointer;
  }

  .td--title {
    font-weight: 600;
    max-width: 350px;
  }

  .td--description {
    display: block;
    color: var(--color-text-secondary);
    font-size: 0.8rem;
    font-weight: 400;
    font-style: italic;
    margin-top: var(--spacing-1);
  }

  .action-icons {
    display: flex;
    gap: var(--spacing-2);
    align-items: center;
  }

  .action-icon {
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--spacing-1) var(--spacing-2);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    transition: all 0.2s ease;
  }

  .action-icon:hover {
    background: var(--glass-bg-hover);
  }

  .action-icon--success:hover {
    color: var(--color-success);
  }

  .action-icon--danger:hover {
    color: var(--color-danger);
  }

  .decision-note-icon {
    color: var(--color-text-secondary);
    opacity: 60%;
    cursor: help;
  }

  .source-link {
    color: var(--color-primary);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .source-link:hover {
    color: var(--color-primary-hover);
    text-decoration: underline;
  }

  .reward-select {
    margin: var(--spacing-3) 0;
  }

  .reward-select__label {
    margin: 0 0 var(--spacing-2);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }
</style>

<script lang="ts">
  /**
   * Manage Approvals — Eingehende Freigaben
   * @module shared/manage-approvals/+page
   *
   * Level 3 SSR: Stats cards, filter bar, data table.
   * Pattern: mirrors work-orders/admin layout.
   * Core addon — always active, no permission-denied fallback needed.
   */

  import type { PageData } from './$types';

  // =============================================================================
  // SSR DATA
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // =============================================================================
  // CLIENT STATE
  // =============================================================================

  let statusFilter = $state('');
  let addonFilter = $state('');
  let priorityFilter = $state('');
  // eslint-disable-next-line prefer-const -- $state requires let, will be reassigned when API is connected
  let loading = $state(false);

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
    { value: 'vacation', label: 'Urlaub' },
    { value: 'blackboard', label: 'Schwarzes Brett' },
    { value: 'calendar', label: 'Kalender' },
    { value: 'surveys', label: 'Umfragen' },
  ] as const;

  const PRIORITY_FILTER_OPTIONS = [
    { value: '', label: 'Alle Prioritäten' },
    { value: 'low', label: 'Niedrig' },
    { value: 'medium', label: 'Mittel' },
    { value: 'high', label: 'Hoch' },
  ] as const;

  const STATUS_BADGE: Record<
    string,
    { label: string; cssClass: string; icon: string }
  > = {
    pending: { label: 'Offen', cssClass: 'badge--warning', icon: 'fa-clock' },
    approved: {
      label: 'Genehmigt',
      cssClass: 'badge--success',
      icon: 'fa-check',
    },
    rejected: {
      label: 'Abgelehnt',
      cssClass: 'badge--error',
      icon: 'fa-times',
    },
  };

  // =============================================================================
  // DERIVED
  // =============================================================================

  const stats = $derived(data.stats);
  const approvals = $derived(data.approvals);
  const hasApprovals = $derived(approvals.length > 0);

  // =============================================================================
  // HANDLERS (placeholders for backend integration)
  // =============================================================================

  function handleStatusFilterChange(value: string): void {
    statusFilter = value;
    // TODO: reload from API
  }

  function handleAddonFilterChange(value: string): void {
    addonFilter = value;
    // TODO: reload from API
  }

  function handlePriorityFilterChange(value: string): void {
    priorityFilter = value;
    // TODO: reload from API
  }

  // Suppress unused variable warnings — will be used when backend API is available
  void loading;
  void handleAddonFilterChange;
  void handlePriorityFilterChange;
</script>

<svelte:head>
  <title>Freigaben verwalten</title>
</svelte:head>

<div class="container">
  <!-- Header -->
  <div class="card mb-6">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-check-double mr-2"></i>
        Eingehende Freigaben
      </h2>
    </div>
  </div>

  <!-- Stats Cards -->
  <div class="stats-grid mb-6">
    <div class="card-stat card-stat--sm">
      <div class="card-stat__icon"><i class="fas fa-clock"></i></div>
      <span class="card-stat__value">{stats.pending}</span>
      <span class="card-stat__label">Offen</span>
    </div>
    <div class="card-stat card-stat--sm">
      <div class="card-stat__icon"><i class="fas fa-check"></i></div>
      <span class="card-stat__value">{stats.approved}</span>
      <span class="card-stat__label">Genehmigt</span>
    </div>
    <div class="card-stat card-stat--sm">
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
        <!-- Status filter -->
        <div class="toggle-group">
          {#each STATUS_FILTER_OPTIONS as opt (opt.value)}
            <button
              type="button"
              class="toggle-group__btn"
              class:active={statusFilter === opt.value}
              onclick={() => {
                handleStatusFilterChange(opt.value);
              }}
            >
              {opt.label}
            </button>
          {/each}
        </div>

        <!-- Addon filter -->
        <div class="toggle-group">
          {#each ADDON_FILTER_OPTIONS as opt (opt.value)}
            <button
              type="button"
              class="toggle-group__btn"
              class:active={addonFilter === opt.value}
              onclick={() => {
                handleAddonFilterChange(opt.value);
              }}
            >
              {opt.label}
            </button>
          {/each}
        </div>

        <!-- Priority filter -->
        <div class="toggle-group">
          {#each PRIORITY_FILTER_OPTIONS as opt (opt.value)}
            <button
              type="button"
              class="toggle-group__btn"
              class:active={priorityFilter === opt.value}
              onclick={() => {
                handlePriorityFilterChange(opt.value);
              }}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>
    </div>

    <div class="card__body">
      {#if loading}
        <div class="empty-state empty-state--in-card">
          <div class="empty-state__icon">
            <i class="fas fa-spinner fa-spin"></i>
          </div>
          <p class="empty-state__description">Freigaben werden geladen...</p>
        </div>
      {:else if !hasApprovals}
        <div class="empty-state empty-state--in-card">
          <div class="empty-state__icon">
            <i class="fas fa-check-double"></i>
          </div>
          <h3 class="empty-state__title">Keine Freigaben vorhanden</h3>
          <p class="empty-state__description">
            Es liegen aktuell keine Freigabe-Anfragen vor.
          </p>
        </div>
      {:else}
        <!-- Approvals Table -->
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Titel</th>
                <th>Modul</th>
                <th>Angefragt von</th>
                <th>Priorität</th>
                <th>Status</th>
                <th>Datum</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {#each approvals as approval (approval.uuid)}
                {@const badge =
                  STATUS_BADGE[approval.status] ?? STATUS_BADGE.pending}
                <tr>
                  <td class="td--title">{approval.title}</td>
                  <td>
                    <span class="badge badge--outline"
                      >{approval.addonCode}</span
                    >
                  </td>
                  <td>{approval.requestedByName}</td>
                  <td>
                    <span class="badge badge--outline">{approval.priority}</span
                    >
                  </td>
                  <td>
                    <span class="badge {badge.cssClass}">
                      <i class="fas {badge.icon}"></i>
                      {badge.label}
                    </span>
                  </td>
                  <td
                    >{new Date(approval.createdAt).toLocaleDateString(
                      'de-DE',
                    )}</td
                  >
                  <td>
                    <div class="action-icons">
                      {#if approval.status === 'pending'}
                        <button
                          type="button"
                          class="action-icon action-icon--success"
                          title="Genehmigen"
                        >
                          <i class="fas fa-check"></i>
                        </button>
                        <button
                          type="button"
                          class="action-icon action-icon--danger"
                          title="Ablehnen"
                        >
                          <i class="fas fa-times"></i>
                        </button>
                      {/if}
                      <button
                        type="button"
                        class="action-icon"
                        title="Details anzeigen"
                      >
                        <i class="fas fa-eye"></i>
                      </button>
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

<style>
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
  }

  @media (width <= 768px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (width <= 480px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .filter-bar {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .td--title {
    font-weight: 600;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .action-icons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .action-icon {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    color: var(--text-secondary);
    transition: all 0.2s ease;
  }

  .action-icon:hover {
    background: var(--bg-hover, rgb(255 255 255 / 10%));
  }

  .action-icon--success:hover {
    color: var(--color-success, #2ecc71);
  }

  .action-icon--danger:hover {
    color: var(--color-danger, #e74c3c);
  }
</style>

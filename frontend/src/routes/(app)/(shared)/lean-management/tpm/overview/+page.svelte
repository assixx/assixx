<script lang="ts">
  /**
   * TPM Employee Overview — Page Component
   * @module shared/lean-management/tpm/+page
   *
   * Level 3 SSR: $derived from props, notification mark-as-read on mount.
   * Shows employee's assigned machines with TPM status summary.
   */
  import { onMount } from 'svelte';

  import { notificationStore } from '$lib/stores/notification.store.svelte';

  import { MESSAGES, DEFAULT_COLORS } from '../_lib/constants';
  import MachineList from '../_lib/MachineList.svelte';

  import type { PageData } from './$types';
  import type {
    CardStatus,
    MachineWithTpmStatus,
    TpmColorConfigEntry,
  } from '../_lib/types';

  // =============================================================================
  // SSR DATA
  // =============================================================================

  const { data }: { data: PageData } = $props();

  const machines = $derived(data.machines);
  const colors = $derived(data.colors);

  // =============================================================================
  // DERIVED STATS
  // =============================================================================

  const totalMachines = $derived(machines.length);

  const totalOpenCards = $derived(
    machines.reduce(
      (sum: number, m: MachineWithTpmStatus) =>
        sum + m.statusCounts.red + m.statusCounts.overdue,
      0,
    ),
  );

  const totalOverdue = $derived(
    machines.reduce(
      (sum: number, m: MachineWithTpmStatus) => sum + m.statusCounts.overdue,
      0,
    ),
  );

  const totalGreenToday = $derived(
    machines.reduce(
      (sum: number, m: MachineWithTpmStatus) => sum + m.statusCounts.green,
      0,
    ),
  );

  /** Resolve color from tenant config or defaults */
  function getStatColor(status: CardStatus): string {
    const custom = colors.find(
      (c: TpmColorConfigEntry) => c.statusKey === status,
    );
    return custom !== undefined ? custom.colorHex : DEFAULT_COLORS[status];
  }

  // =============================================================================
  // LIFECYCLE
  // =============================================================================

  onMount(() => {
    void notificationStore.markTypeAsRead('tpm');
  });
</script>

<svelte:head>
  <title>{MESSAGES.PAGE_TITLE}</title>
</svelte:head>

<div class="tpm-employee">
  <!-- Header -->
  <div class="tpm-employee__header">
    <div class="tpm-employee__title-section">
      <h1 class="tpm-employee__heading">
        <i class="fas fa-tools"></i>
        {MESSAGES.PAGE_HEADING}
      </h1>
      <p class="tpm-employee__description">{MESSAGES.PAGE_DESCRIPTION}</p>
    </div>
  </div>

  <!-- Stats Cards -->
  <div class="tpm-employee__stats">
    <div class="stat-card">
      <div class="stat-card__icon stat-card__icon--blue">
        <i class="fas fa-cog"></i>
      </div>
      <div class="stat-card__content">
        <span class="stat-card__value">{totalMachines}</span>
        <span class="stat-card__label">{MESSAGES.STAT_MACHINES}</span>
      </div>
    </div>

    <div class="stat-card">
      <div
        class="stat-card__icon"
        style="background: color-mix(in srgb, {getStatColor(
          'red',
        )} 15%, transparent);
               color: {getStatColor('red')}"
      >
        <i class="fas fa-exclamation-circle"></i>
      </div>
      <div class="stat-card__content">
        <span class="stat-card__value">{totalOpenCards}</span>
        <span class="stat-card__label">{MESSAGES.STAT_OPEN_CARDS}</span>
      </div>
    </div>

    <div class="stat-card">
      <div
        class="stat-card__icon"
        style="background: color-mix(in srgb, {getStatColor(
          'overdue',
        )} 15%, transparent);
               color: {getStatColor('overdue')}"
      >
        <i class="fas fa-clock"></i>
      </div>
      <div class="stat-card__content">
        <span class="stat-card__value">{totalOverdue}</span>
        <span class="stat-card__label">{MESSAGES.STAT_OVERDUE}</span>
      </div>
    </div>

    <div class="stat-card">
      <div
        class="stat-card__icon"
        style="background: color-mix(in srgb, {getStatColor(
          'green',
        )} 15%, transparent);
               color: {getStatColor('green')}"
      >
        <i class="fas fa-check-circle"></i>
      </div>
      <div class="stat-card__content">
        <span class="stat-card__value">{totalGreenToday}</span>
        <span class="stat-card__label">{MESSAGES.STAT_COMPLETED_TODAY}</span>
      </div>
    </div>
  </div>

  <!-- Machine List -->
  <div class="tpm-employee__main">
    <div class="card">
      <div class="card__header">
        <h2 class="card__title">
          <i class="fas fa-list"></i>
          {MESSAGES.MACHINE_LIST_TITLE}
        </h2>
      </div>
      <div class="card__body">
        <MachineList
          {machines}
          {colors}
        />
      </div>
    </div>
  </div>
</div>

<style>
  .tpm-employee {
    padding: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .tpm-employee__header {
    margin-bottom: 1.5rem;
  }

  .tpm-employee__heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-gray-900);
  }

  .tpm-employee__description {
    color: var(--color-gray-500);
    margin-top: 0.25rem;
    font-size: 0.875rem;
  }

  /* Stats grid */
  .tpm-employee__stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: var(--color-white, #fff);
    border-radius: var(--radius-lg, 12px);
    padding: 1.25rem;
    box-shadow: var(--shadow-sm);
  }

  .stat-card__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md, 8px);
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .stat-card__icon--blue {
    background: var(--color-blue-100, #dbeafe);
    color: var(--color-blue-600, #2563eb);
  }

  .stat-card__content {
    display: flex;
    flex-direction: column;
  }

  .stat-card__value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-gray-900);
    line-height: 1;
  }

  .stat-card__label {
    font-size: 0.75rem;
    color: var(--color-gray-500);
    margin-top: 0.25rem;
  }

  /* Card styles */
  .card {
    background: var(--color-white, #fff);
    border-radius: var(--radius-lg, 12px);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .card__header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--color-gray-200);
  }

  .card__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-gray-800);
  }

  .card__body {
    padding: 1.25rem;
  }

  /* Responsive */
  @media (width <= 640px) {
    .tpm-employee {
      padding: 1rem;
    }

    .tpm-employee__stats {
      grid-template-columns: repeat(2, 1fr);
    }

    .stat-card {
      padding: 1rem;
    }

    .stat-card__value {
      font-size: 1.25rem;
    }
  }
</style>

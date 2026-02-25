<script lang="ts">
  /**
   * TPM Employee Overview — Page Component
   * @module shared/lean-management/tpm/+page
   *
   * Level 3 SSR: $derived from props, notification mark-as-read on mount.
   * Shows employee's assigned machines with TPM status summary.
   */
  import { onMount } from 'svelte';

  import { resolve } from '$app/paths';

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
  // HELPERS
  // =============================================================================

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

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

<div class="container">
  <!-- Header -->
  <div class="card">
    <div class="card__header">
      <div class="flex items-center justify-between gap-4">
        <h2 class="card__title">
          <i class="fas fa-tools mr-2"></i>
          {MESSAGES.PAGE_HEADING}
        </h2>
        <a
          href={resolvePath('/lean-management/tpm/gesamtansicht')}
          class="btn btn-info"
        >
          <i class="fas fa-table"></i>
          {MESSAGES.BTN_GESAMTANSICHT}
        </a>
      </div>
      <p class="mt-2 text-(--color-text-secondary)">
        {MESSAGES.PAGE_DESCRIPTION}
      </p>
    </div>
  </div>

  <!-- Stats Cards -->
  <div class="mt-6 grid grid-cols-2 gap-6 md:grid-cols-4">
    <div class="card-stat">
      <div class="card-stat__icon">
        <i class="fas fa-cog"></i>
      </div>
      <div class="card-stat__content">
        <div class="card-stat__value">{totalMachines}</div>
        <div class="card-stat__label">{MESSAGES.STAT_MACHINES}</div>
      </div>
    </div>

    <div class="card-stat card-stat--danger">
      <div
        class="card-stat__icon"
        style="color: {getStatColor('red')}"
      >
        <i class="fas fa-exclamation-circle"></i>
      </div>
      <div class="card-stat__content">
        <div class="card-stat__value">{totalOpenCards}</div>
        <div class="card-stat__label">{MESSAGES.STAT_OPEN_CARDS}</div>
      </div>
    </div>

    <div class="card-stat card-stat--warning">
      <div
        class="card-stat__icon"
        style="color: {getStatColor('overdue')}"
      >
        <i class="fas fa-clock"></i>
      </div>
      <div class="card-stat__content">
        <div class="card-stat__value">{totalOverdue}</div>
        <div class="card-stat__label">{MESSAGES.STAT_OVERDUE}</div>
      </div>
    </div>

    <div class="card-stat card-stat--success">
      <div
        class="card-stat__icon"
        style="color: {getStatColor('green')}"
      >
        <i class="fas fa-check-circle"></i>
      </div>
      <div class="card-stat__content">
        <div class="card-stat__value">{totalGreenToday}</div>
        <div class="card-stat__label">{MESSAGES.STAT_COMPLETED_TODAY}</div>
      </div>
    </div>
  </div>

  <!-- Machine List -->
  <div class="mt-6">
    <div class="card">
      <div class="card__header">
        <h2 class="card__title">
          <i class="fas fa-list mr-2"></i>
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

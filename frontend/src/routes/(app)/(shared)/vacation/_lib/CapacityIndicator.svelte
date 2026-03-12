<script lang="ts">
  /**
   * CapacityIndicator — Shows capacity analysis result.
   * Displays overall status, team analysis, blackout conflicts, entitlement check.
   */
  import {
    DEFAULT_HIERARCHY_LABELS,
    type HierarchyLabels,
  } from '$lib/types/hierarchy-labels';

  import { CAPACITY_STATUS_CLASS, CAPACITY_STATUS_LABELS } from './constants';

  import type { VacationCapacityAnalysis } from './types';

  const {
    analysis,
    isLoading = false,
    labels = DEFAULT_HIERARCHY_LABELS,
  }: {
    analysis: VacationCapacityAnalysis | null;
    isLoading?: boolean;
    labels?: HierarchyLabels;
  } = $props();

  const hasConflicts = $derived(
    analysis !== null && analysis.blackoutConflicts.length > 0,
  );

  const insufficientBalance = $derived(
    analysis !== null && !analysis.entitlementCheck.sufficient,
  );

  const hasAssetCritical = $derived(
    analysis?.assetAnalysis.some((m) => m.status === 'critical') ?? false,
  );

  /**
   * Context-aware badge label.
   * Shows the specific reason instead of generic "Kapazität nicht ausreichend".
   */
  const statusLabel = $derived.by(() => {
    if (analysis === null) return '';
    if (analysis.overallStatus !== 'blocked') {
      return CAPACITY_STATUS_LABELS[analysis.overallStatus];
    }
    // Blocked — show the specific reason
    if (insufficientBalance) return 'Urlaubskontingent erschöpft';
    if (hasConflicts) return 'Sperrzeitraum-Konflikt';
    if (hasAssetCritical) return `Besetzung ${labels.asset} kritisch`;
    return CAPACITY_STATUS_LABELS.blocked;
  });
</script>

{#if isLoading}
  <div class="capacity-indicator capacity-indicator--loading">
    <div class="spinner-ring spinner-ring--sm mr-2"></div>
    Kapazität wird geprueft...
  </div>
{:else if analysis !== null}
  <div class="capacity-indicator">
    <!-- Overall Status -->
    <div class="capacity-indicator__status">
      <span class="badge {CAPACITY_STATUS_CLASS[analysis.overallStatus]}">
        {statusLabel}
      </span>
      <span class="text-muted ml-2">
        {analysis.workdays} Arbeitstage
      </span>
    </div>

    <!-- Entitlement Check -->
    <div class="capacity-indicator__entitlement">
      {#if insufficientBalance}
        <div class="capacity-indicator__warning">
          <i class="fas fa-exclamation-triangle mr-1"></i>
          Nicht genuegend Urlaubstage:
          {analysis.entitlementCheck.availableDays} verfuegbar,
          {analysis.entitlementCheck.requestedDays} benötigt
        </div>
      {:else}
        <div class="capacity-indicator__ok">
          <i class="fas fa-check-circle mr-1"></i>
          {analysis.entitlementCheck.remainingAfterApproval} Tage verbleibend nach
          Genehmigung
        </div>
      {/if}
    </div>

    <!-- Blackout Conflicts -->
    {#if hasConflicts}
      <div class="capacity-indicator__conflicts">
        <div class="capacity-indicator__warning">
          <i class="fas fa-ban mr-1"></i>
          Sperrzeitraum-Konflikte:
        </div>
        <ul class="capacity-indicator__list">
          {#each analysis.blackoutConflicts as conflict (conflict.id)}
            <li>{conflict.name} ({conflict.startDate} — {conflict.endDate})</li>
          {/each}
        </ul>
      </div>
    {/if}

    <!-- Asset Warnings -->
    {#if analysis.assetAnalysis.length > 0}
      {#each analysis.assetAnalysis.filter((m) => m.status !== 'ok') as asset (asset.assetId)}
        <div class="capacity-indicator__warning">
          <i class="fas fa-cog mr-1"></i>
          {asset.assetName}: Min. {asset.minStaffCount} Mitarbeiter erforderlich
        </div>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .capacity-indicator {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: var(--radius-md, 0.5rem);
    background: var(
      --glass-bg,
      color-mix(in oklch, var(--color-white) 5%, transparent)
    );
    border: 1px solid
      var(
        --glass-border,
        color-mix(in oklch, var(--color-white) 10%, transparent)
      );
  }

  .capacity-indicator--loading {
    display: flex;
    align-items: center;
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .capacity-indicator__status {
    display: flex;
    align-items: center;
  }

  .capacity-indicator__entitlement {
    font-size: 0.875rem;
  }

  .capacity-indicator__warning {
    color: var(--color-warning, #f59e0b);
    font-size: 0.813rem;
    font-weight: 500;
  }

  .capacity-indicator__ok {
    color: var(--color-success, #22c55e);
    font-size: 0.813rem;
  }

  .capacity-indicator__conflicts {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .capacity-indicator__list {
    margin: 0;
    padding-left: 1.25rem;
    font-size: 0.813rem;
    color: var(--text-muted);
  }
</style>

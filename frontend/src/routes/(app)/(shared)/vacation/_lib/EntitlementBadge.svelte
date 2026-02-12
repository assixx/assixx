<script lang="ts">
  /**
   * EntitlementBadge — Shows vacation balance summary.
   * Displays "X/Y days remaining" with progress bar.
   */
  import type { VacationBalance } from './types';

  const { balance }: { balance: VacationBalance | null } = $props();

  const percentage = $derived(
    balance !== null && balance.availableDays > 0 ?
      Math.round((balance.usedDays / balance.availableDays) * 100)
    : 0,
  );

  const barColor = $derived(
    balance !== null ?
      balance.remainingDays <= 2 ? 'var(--color-danger)'
      : balance.remainingDays <= 5 ? 'var(--color-warning)'
      : 'var(--color-success)'
    : 'var(--color-muted)',
  );
</script>

{#if balance !== null}
  <div class="entitlement-badge">
    <div class="entitlement-badge__header">
      <span class="entitlement-badge__label">Urlaubskonto {balance.year}</span>
      <span class="entitlement-badge__value">
        {balance.remainingDays} / {balance.availableDays} Tage
      </span>
    </div>

    <div class="entitlement-badge__bar">
      <div
        class="entitlement-badge__fill"
        style="width: {percentage}%; background: {barColor};"
      ></div>
    </div>

    <div class="entitlement-badge__details">
      <span>Genommen: {balance.usedDays}</span>
      {#if balance.pendingDays > 0}
        <span class="text-warning">Ausstehend: {balance.pendingDays}</span>
      {/if}
      {#if balance.carriedOverDays > 0}
        <span>Uebertrag: {balance.effectiveCarriedOver}</span>
      {/if}
    </div>
  </div>
{:else}
  <div class="entitlement-badge entitlement-badge--empty">
    <span class="text-muted">Kein Urlaubskonto vorhanden</span>
  </div>
{/if}

<style>
  .entitlement-badge {
    padding: 1rem;
    border-radius: var(--radius-lg, 0.75rem);
    background: var(--glass-bg, hsl(0deg 0% 100% / 8%));
    border: 1px solid var(--glass-border, hsl(0deg 0% 100% / 12%));
  }

  .entitlement-badge--empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 4rem;
  }

  .entitlement-badge__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .entitlement-badge__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .entitlement-badge__value {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .entitlement-badge__bar {
    height: 0.5rem;
    border-radius: 999px;
    background: var(--glass-bg, hsl(0deg 0% 100% / 5%));
    overflow: hidden;
    margin-bottom: 0.5rem;
  }

  .entitlement-badge__fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.3s ease;
  }

  .entitlement-badge__details {
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
    color: var(--text-muted);
  }
</style>

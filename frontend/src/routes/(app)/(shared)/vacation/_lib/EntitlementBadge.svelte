<script lang="ts">
  /**
   * EntitlementBadge — Shows vacation balance summary.
   * Displays "X/Y days remaining" with progress bar.
   * @prop {boolean} compact - If true, minimal version (no stats grid). Default: true.
   */
  import type { VacationBalance } from './types';

  const { balance, compact = true }: { balance: VacationBalance | null; compact?: boolean } =
    $props();

  const remainingPercent = $derived(
    balance !== null && balance.availableDays > 0 ?
      Math.round((balance.remainingDays / balance.availableDays) * 100)
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
  {#if compact}
    <!-- Compact version (entitlements page) -->
    <div class="card mb-4">
      <div class="card__body">
        <div class="mb-2 flex items-center justify-between">
          <span
            class="text-muted"
            style="font-size: 0.875rem;"
          >
            {balance.remainingDays} von {balance.availableDays} Tagen verbleibend
          </span>
          <span style="font-size: 0.875rem; font-weight: 600; color: {barColor};">
            {remainingPercent}%
          </span>
        </div>
        <div
          style="height: 8px; background: var(--glass-bg); border-radius: 4px; overflow: hidden;"
        >
          <div
            style="height: 100%; width: {remainingPercent}%; background: {barColor}; border-radius: 4px; transition: width 0.3s;"
          ></div>
        </div>
      </div>
    </div>
  {:else}
    <!-- Full version (vacation main page) -->
    <div class="card mb-6">
      <div class="card__header">
        <h3 class="card__title">
          <i class="fas fa-chart-pie mr-2"></i>
          Mein Urlaubskonto ({balance.year})
        </h3>
      </div>
      <div class="card__body">
        <div class="balance-summary">
          <div class="balance-summary__bar">
            <div class="mb-2 flex items-center justify-between">
              <span
                class="text-muted"
                style="font-size: 0.875rem;"
              >
                {balance.remainingDays} von {balance.availableDays} Tagen verbleibend
              </span>
              <span style="font-size: 0.875rem; font-weight: 600; color: {barColor};">
                {remainingPercent}%
              </span>
            </div>
            <div class="progress-bar">
              <div
                class="progress-bar__fill"
                style="width: {remainingPercent}%; background: {barColor};"
              ></div>
            </div>
          </div>
          <div class="balance-summary__stats">
            <div class="balance-stat">
              <span class="balance-stat__label">Verfügbar</span>
              <span class="balance-stat__value">{balance.availableDays}</span>
            </div>
            <div class="balance-stat">
              <span class="balance-stat__label">Genommen</span>
              <span class="balance-stat__value">{balance.usedDays}</span>
            </div>
            <div class="balance-stat">
              <span class="balance-stat__label">Beantragt</span>
              <span class="balance-stat__value text-warning">
                {balance.pendingDays}
              </span>
            </div>
            <div class="balance-stat">
              <span class="balance-stat__label">Verbleibend</span>
              <span
                class="balance-stat__value"
                class:text-success={balance.remainingDays > 0}
                class:text-danger={balance.remainingDays <= 0}
              >
                {balance.remainingDays}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
{:else}
  <div class="card mb-6">
    <div class="card__body">
      <span class="text-muted">Kein Urlaubskonto vorhanden</span>
    </div>
  </div>
{/if}

<style>
  /* Full version styles (vacation main page) */
  .balance-summary {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .progress-bar {
    height: 8px;
    background: var(--glass-bg);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-bar__fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s;
  }

  .balance-summary__stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
  }

  .balance-stat {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .balance-stat__label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .balance-stat__value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
  }
</style>

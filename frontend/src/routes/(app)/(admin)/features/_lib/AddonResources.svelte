<script lang="ts">
  /**
   * AddonResources — Addon quantity controls (employees, admins, storage)
   * Modifies pendingAddons via $bindable two-way binding.
   */
  import type { TenantAddons } from './types';

  interface Props {
    /** Two-way bound addon state */
    pendingAddons: TenantAddons;
  }

  // eslint-disable-next-line @typescript-eslint/no-useless-default-assignment -- $bindable() is a Svelte semantic marker, not a JS default
  let { pendingAddons = $bindable() }: Props = $props();

  /** Adjust pending addon values (local mutation, parent sees via $bindable) */
  function adjustAddon(
    type: 'employees' | 'admins' | 'storage',
    change: number,
  ): void {
    if (type === 'employees') {
      pendingAddons.employees = Math.max(
        0,
        (pendingAddons.employees ?? 0) + change,
      );
    } else if (type === 'admins') {
      pendingAddons.admins = Math.max(0, (pendingAddons.admins ?? 0) + change);
    } else {
      pendingAddons.storage_gb = Math.max(
        0,
        (pendingAddons.storage_gb ?? 0) + change,
      );
    }
    pendingAddons = { ...pendingAddons };
  }
</script>

<div class="card mb-6">
  <div class="card__header">
    <h2 class="card__title">
      <i class="fas fa-cubes mr-2"></i>
      Zusätzliche Ressourcen
    </h2>
    <p class="mt-2 text-(--color-text-secondary)">
      Erweitern Sie Ihre Kapazitäten nach Bedarf
    </p>
  </div>
  <div class="card__body">
    <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
      <!-- Mitarbeiter -->
      <div class="addon-card">
        <div class="addon-card__icon">
          <i class="fas fa-users"></i>
        </div>
        <h3 class="addon-card__name">Zusätzliche Mitarbeiter</h3>
        <div class="addon-card__price">5€</div>
        <div class="addon-card__unit">pro Mitarbeiter / Monat</div>
        <div class="addon-card__current">
          Aktuell: <strong>{pendingAddons.employees ?? 0}</strong> zusätzlich
        </div>
        <div class="addon-card__controls">
          <button
            type="button"
            class="addon-card__btn"
            onclick={() => {
              adjustAddon('employees', -1);
            }}
            aria-label="Mitarbeiter reduzieren"
          >
            <i class="fas fa-minus"></i>
          </button>
          <span class="addon-card__value">{pendingAddons.employees ?? 0}</span>
          <button
            type="button"
            class="addon-card__btn"
            onclick={() => {
              adjustAddon('employees', 1);
            }}
            aria-label="Mitarbeiter erhöhen"
          >
            <i class="fas fa-plus"></i>
          </button>
        </div>
      </div>

      <!-- Admins -->
      <div class="addon-card">
        <div class="addon-card__icon">
          <i class="fas fa-user-shield"></i>
        </div>
        <h3 class="addon-card__name">Zusätzliche Admins</h3>
        <div class="addon-card__price">10€</div>
        <div class="addon-card__unit">pro Admin / Monat</div>
        <div class="addon-card__current">
          Aktuell: <strong>{pendingAddons.admins ?? 0}</strong> zusätzlich
        </div>
        <div class="addon-card__controls">
          <button
            type="button"
            class="addon-card__btn"
            onclick={() => {
              adjustAddon('admins', -1);
            }}
            aria-label="Admins reduzieren"
          >
            <i class="fas fa-minus"></i>
          </button>
          <span class="addon-card__value">{pendingAddons.admins ?? 0}</span>
          <button
            type="button"
            class="addon-card__btn"
            onclick={() => {
              adjustAddon('admins', 1);
            }}
            aria-label="Admins erhöhen"
          >
            <i class="fas fa-plus"></i>
          </button>
        </div>
      </div>

      <!-- Speicher -->
      <div class="addon-card">
        <div class="addon-card__icon">
          <i class="fas fa-hdd"></i>
        </div>
        <h3 class="addon-card__name">Zusätzlicher Speicher</h3>
        <div class="addon-card__price">10€</div>
        <div class="addon-card__unit">pro 100 GB / Monat</div>
        <div class="addon-card__current">
          Aktuell: <strong>100 GB</strong> inklusive
        </div>
        <div class="addon-card__controls">
          <button
            type="button"
            class="addon-card__btn"
            onclick={() => {
              adjustAddon('storage', -100);
            }}
            aria-label="Speicher reduzieren"
          >
            <i class="fas fa-minus"></i>
          </button>
          <span class="addon-card__value"
            >{pendingAddons.storage_gb ?? 0} GB</span
          >
          <button
            type="button"
            class="addon-card__btn"
            onclick={() => {
              adjustAddon('storage', 100);
            }}
            aria-label="Speicher erhöhen"
          >
            <i class="fas fa-plus"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .addon-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-6);
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg);
    backdrop-filter: blur(10px);
    text-align: center;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .addon-card:hover {
    border-color: var(--color-glass-border-hover);
    box-shadow: var(--shadow-lg);
  }

  .addon-card__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: var(--radius-lg);
    background: color-mix(in oklch, var(--color-primary) 10%, transparent);
    color: var(--color-primary);
    font-size: 20px;
  }

  .addon-card__name {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .addon-card__price {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-primary);
  }

  .addon-card__unit {
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .addon-card__current {
    font-size: 14px;
    color: var(--color-text-secondary);
  }

  .addon-card__controls {
    display: flex;
    gap: var(--spacing-3);
    align-items: center;
    margin-top: var(--spacing-2);
  }

  .addon-card__btn {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--color-glass-border);
    border-radius: 50%;
    color: var(--color-text-primary);
    background: var(--glass-bg);
    transition:
      border-color 0.15s ease,
      background 0.15s ease;
  }

  .addon-card__btn:hover {
    border-color: var(--color-primary);
    background: color-mix(in oklch, var(--color-primary) 10%, transparent);
  }

  .addon-card__value {
    min-width: 48px;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
    text-align: center;
  }

  /* Light mode */
  :global(html:not(.dark)) .addon-card__icon {
    background: color-mix(in oklch, var(--color-primary) 8%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .addon-card,
    .addon-card__btn {
      transition: none;
    }
  }
</style>

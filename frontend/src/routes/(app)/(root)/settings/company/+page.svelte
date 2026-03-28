<script lang="ts">
  /**
   * Addon Settings Page
   * @module settings/company/+page
   *
   * Root-only page for addon configuration.
   * Currently supports KVP daily suggestion limit.
   */
  import { untrack } from 'svelte';

  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';
  import { getApiClient } from '$lib/utils/api-client';

  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  const apiClient = getApiClient();

  interface RewardTier {
    id: number;
    amount: number;
    sortOrder: number;
  }

  // =========================================================================
  // FORM STATE
  // =========================================================================

  const initial = untrack(() => data.kvpSettings);

  let dailyLimit = $state(initial?.dailyLimit ?? 1);
  let saving = $state(false);

  // Reward Tiers
  let rewardTiers = $state(untrack(() => [...data.rewardTiers]));
  let newRewardAmount = $state('');
  let savingReward = $state(false);

  // =========================================================================
  // DERIVED
  // =========================================================================

  const hasChanges = $derived(dailyLimit !== (data.kvpSettings?.dailyLimit ?? 1));

  const isFormValid = $derived(
    dailyLimit >= 0 && dailyLimit <= 100 && Number.isInteger(dailyLimit),
  );

  // =========================================================================
  // HANDLERS
  // =========================================================================

  async function handleSave(): Promise<void> {
    if (!isFormValid || saving) return;

    saving = true;
    try {
      await apiClient.put('/kvp/settings', {
        dailyLimit,
      });
      showSuccessAlert('KVP-Einstellungen gespeichert');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fehler beim Speichern';
      showErrorAlert(message);
    } finally {
      saving = false; // eslint-disable-line require-atomic-updates -- guarded by early return on saving===true
    }
  }

  // =========================================================================
  // REWARD TIER HANDLERS
  // =========================================================================

  async function handleAddRewardTier(): Promise<void> {
    const amount = parseFloat(newRewardAmount);
    if (Number.isNaN(amount) || amount <= 0) return;
    savingReward = true;
    try {
      const result = await apiClient.post<RewardTier>('/kvp/reward-tiers', { amount });
      rewardTiers = [...rewardTiers, result].sort(
        (a: RewardTier, b: RewardTier) => a.amount - b.amount,
      );
      newRewardAmount = ''; // eslint-disable-line require-atomic-updates -- input disabled via savingReward guard
      showSuccessAlert(`Prämie ${String(amount)}€ hinzugefügt`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fehler beim Hinzufügen';
      showErrorAlert(message);
    } finally {
      savingReward = false;
    }
  }

  async function handleDeleteRewardTier(tierId: number, amount: number): Promise<void> {
    savingReward = true;
    try {
      await apiClient.delete(`/kvp/reward-tiers/${String(tierId)}`);
      rewardTiers = rewardTiers.filter((t: { id: number }) => t.id !== tierId);
      showSuccessAlert(`Prämie ${String(amount)}€ entfernt`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fehler beim Entfernen';
      showErrorAlert(message);
    } finally {
      savingReward = false;
    }
  }
</script>

<svelte:head>
  <title>Addon-Einstellungen | Assixx</title>
</svelte:head>

<div class="container">
  <!-- ================================================================= -->
  <!-- SECTION: KVP Addon Settings                                        -->
  <!-- ================================================================= -->
  <div class="card">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-lightbulb mr-2"></i>
        KVP Addon
      </h2>
      <p class="mt-2 text-(--color-text-secondary)">
        Einstellungen für das Kontinuierliche Verbesserungsprozess (KVP) Modul.
      </p>
    </div>

    <div class="card__body">
      {#if data.loadError}
        <div class="alert alert--danger">
          <div class="alert__icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <div class="alert__content">KVP-Einstellungen konnten nicht geladen werden.</div>
        </div>
      {:else}
        <form
          onsubmit={(e: Event) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <div class="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <div class="form-field">
              <label
                class="form-field__label form-field__label--required"
                for="daily_limit"
              >
                Tageslimit pro Benutzer
              </label>
              <input
                type="number"
                id="daily_limit"
                class="form-field__control"
                min="0"
                max="100"
                step="1"
                bind:value={dailyLimit}
                disabled={saving}
              />
              <p class="form-field__hint">
                Maximale Anzahl KVP-Vorschläge pro Tag und Benutzer. 0 = unbegrenzt. Gilt nicht für
                Root und Admins mit Vollzugriff.
              </p>
            </div>
          </div>

          <div class="mt-6 flex justify-end">
            <button
              type="submit"
              class="btn btn-primary"
              disabled={saving || !hasChanges || !isFormValid}
            >
              {#if saving}
                <span class="spinner-ring spinner-ring--sm"></span>
                Speichern...
              {:else}
                <i class="fas fa-save"></i>
                Speichern
              {/if}
            </button>
          </div>
        </form>
      {/if}
    </div>
  </div>

  <!-- ================================================================= -->
  <!-- SECTION: KVP Reward Tiers                                          -->
  <!-- ================================================================= -->
  <div class="card mt-6">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-trophy mr-2"></i>
        KVP Prämien
      </h2>
      <p class="mt-2 text-(--color-text-secondary)">
        Vordefinierte Prämienbeträge für genehmigte KVP-Vorschläge. Der Freigabe-Master wählt beim
        Genehmigen einen Betrag aus.
      </p>
    </div>

    <div class="card__body">
      <!-- Existing tiers -->
      {#if rewardTiers.length > 0}
        <div class="reward-tiers-list">
          {#each rewardTiers as tier (tier.id)}
            <div class="reward-tier-item">
              <span class="reward-tier-amount">{tier.amount.toFixed(2)} €</span>
              <button
                type="button"
                class="reward-tier-delete"
                title="Entfernen"
                disabled={savingReward}
                onclick={() => void handleDeleteRewardTier(tier.id, tier.amount)}
              >
                <i class="fas fa-times"></i>
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <p class="mb-4 text-(--color-text-secondary)">Noch keine Prämienbeträge definiert.</p>
      {/if}

      <!-- Add new tier -->
      <div class="reward-tier-add">
        <input
          type="number"
          class="form-field__control reward-tier-input"
          placeholder="Betrag in €"
          min="0.01"
          step="0.01"
          bind:value={newRewardAmount}
          disabled={savingReward}
          onkeydown={(e: KeyboardEvent) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleAddRewardTier();
            }
          }}
        />
        <button
          type="button"
          class="btn btn-success"
          disabled={savingReward || newRewardAmount === '' || parseFloat(newRewardAmount) <= 0}
          onclick={() => void handleAddRewardTier()}
        >
          {#if savingReward}
            <span class="spinner-ring spinner-ring--sm"></span>
          {:else}
            <i class="fas fa-plus"></i>
          {/if}
          Hinzufügen
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .reward-tiers-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-4);
  }

  .reward-tier-item {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-3);
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg);
  }

  .reward-tier-amount {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .reward-tier-delete {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .reward-tier-delete:hover {
    background: var(--color-danger);
    color: var(--color-white);
  }

  .reward-tier-add {
    display: flex;
    gap: var(--spacing-3);
    align-items: center;
  }

  .reward-tier-input {
    max-width: 150px;
  }
</style>

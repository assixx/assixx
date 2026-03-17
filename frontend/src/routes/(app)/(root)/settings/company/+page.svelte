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

  // =========================================================================
  // FORM STATE
  // =========================================================================

  const initial = untrack(() => data.kvpSettings);

  let dailyLimit = $state(initial?.dailyLimit ?? 1);
  let saving = $state(false);

  // =========================================================================
  // DERIVED
  // =========================================================================

  const hasChanges = $derived(
    dailyLimit !== (data.kvpSettings?.dailyLimit ?? 1),
  );

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
      const message =
        err instanceof Error ? err.message : 'Fehler beim Speichern';
      showErrorAlert(message);
    } finally {
      saving = false; // eslint-disable-line require-atomic-updates -- guarded by early return on saving===true
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
          <div class="alert__content">
            KVP-Einstellungen konnten nicht geladen werden.
          </div>
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
                Maximale Anzahl KVP-Vorschläge pro Tag und Benutzer. 0 =
                unbegrenzt. Gilt nicht für Root und Admins mit Vollzugriff.
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
</div>

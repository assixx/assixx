<script lang="ts">
  import { untrack } from 'svelte';

  import { resolve } from '$app/paths';

  import { getApiClient } from '$lib/utils/api-client';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('TenantDeletionApprovePage');

  import type { PageData } from './$types';

  /** Resolve path with base prefix (for dynamic runtime paths) */
  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  // API Client (for approve action only)
  const apiClient = getApiClient();

  // SSR Data
  const { data }: { data: PageData } = $props();

  // =============================================================================
  // TYPES
  // =============================================================================

  interface DeletionStatusData {
    queueId: number;
    tenantId: number;
    status: string;
    requestedBy: number;
    requestedByName?: string;
    canApprove: boolean;
  }

  // =============================================================================
  // SSR DATA (via $derived - single source of truth)
  // =============================================================================

  const queueId = $derived<number | null>(data.queueId ?? null);
  const queueData = $derived<DeletionStatusData | null>(data.queueData ?? null);

  // =============================================================================
  // UI STATE (client-side only)
  // =============================================================================

  const loading = $state(false);
  let submitting = $state(false);
  let success = $state(false);

  // Initialize from SSR error (intentionally capturing initial value, not tracking)
  let errorMessage = $state<string | null>(untrack(() => data.error));

  // Form inputs
  let confirmationInput = $state('');
  let passwordInput = $state('');

  // =============================================================================
  // DERIVED STATE
  // =============================================================================

  const isConfirmationValid = $derived(confirmationInput === 'LÖSCHEN');
  const isPasswordValid = $derived(passwordInput.length > 0);
  const canSubmit = $derived(
    isConfirmationValid && isPasswordValid && !submitting,
  );

  // =============================================================================
  // API FUNCTIONS
  // =============================================================================

  async function approveDeletion(id: number, password: string): Promise<void> {
    await apiClient.post(`/root/deletion-approvals/${String(id)}/approve`, {
      password,
    });
  }

  // =============================================================================
  // HANDLERS
  // =============================================================================

  async function handleSubmit(event: Event): Promise<void> {
    event.preventDefault();

    if (!canSubmit || queueId === null) return;

    submitting = true;
    errorMessage = null;

    try {
      await approveDeletion(queueId, passwordInput);

      success = true;

      // Redirect after delay (full page reload to switch from standalone to app layout)
      setTimeout(() => {
        window.location.href = resolvePath('/tenant-deletion-status');
      }, 2000);
    } catch (err) {
      log.error({ err }, 'Error approving');
      errorMessage =
        err instanceof Error ? err.message : 'Fehler bei der Genehmigung';
      submitting = false;
    }
  }
</script>

<div class="flex min-h-screen items-center justify-center p-5">
  <div class="card animate-fade-in-up w-full max-w-[500px] text-center">
    {#if loading}
      <!-- Loading State -->
      <div class="py-8">
        <i
          class="fas fa-spinner fa-spin mb-4 text-4xl text-[var(--color-primary)]"
        ></i>
        <p class="text-[var(--color-text-secondary)]">Lade Löschanfrage...</p>
      </div>
    {:else if errorMessage !== null && queueData === null}
      <!-- Error State (no data loaded) -->
      <div
        class="mx-auto mb-6 flex h-20 w-20 items-center justify-center
          rounded-full bg-[rgb(244_67_54/15%)] text-[40px] text-[var(--color-danger)]"
      >
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h1 class="mb-4 text-[28px] font-bold text-[var(--color-text-primary)]">
        Fehler
      </h1>
      <div class="alert alert--danger mb-6">
        <div class="alert__content">
          <p class="alert__message">{errorMessage}</p>
        </div>
      </div>
      <a
        href={resolvePath('/tenant-deletion-status')}
        class="btn btn-primary"
        data-sveltekit-reload
      >
        <i class="fas fa-arrow-left mr-2"></i>
        Zurück zur Übersicht
      </a>
    {:else if success}
      <!-- Success State -->
      <div
        class="mx-auto mb-6 flex h-20 w-20 items-center justify-center
          rounded-full bg-[rgb(76_175_80/15%)] text-[40px] text-[var(--color-success)]"
      >
        <i class="fas fa-check-circle"></i>
      </div>
      <h1 class="mb-4 text-[28px] font-bold text-[var(--color-text-primary)]">
        Genehmigung erfolgreich!
      </h1>
      <div class="alert alert--success mb-6">
        <div class="alert__content">
          <p class="alert__message">
            Löschung erfolgreich genehmigt! 30 Tage Grace Period beginnt.
          </p>
        </div>
      </div>
      <p class="text-[var(--color-text-secondary)]">
        <i class="fas fa-spinner fa-spin mr-2"></i>
        Weiterleitung zur Statusübersicht...
      </p>
    {:else if queueData !== null}
      <!-- Approval Form -->
      <!-- Warning Icon -->
      <div
        class="mx-auto mb-6 flex h-20 w-20 items-center justify-center
          rounded-full bg-[rgb(244_67_54/15%)] text-[40px] text-[var(--color-danger)]"
      >
        <i class="fas fa-exclamation-triangle"></i>
      </div>

      <h1 class="mb-4 text-[28px] font-bold text-[var(--color-text-primary)]">
        Tenant-Löschung genehmigen
      </h1>

      <p
        class="mb-6 text-base leading-relaxed text-[var(--color-text-secondary)]"
      >
        Sie sind dabei, die Löschung eines Tenants als zweiter Root-Benutzer zu
        genehmigen. Nach der Genehmigung beginnt die
        <strong>30-tägige Grace Period</strong>.
      </p>

      <!-- Queue Info -->
      <div
        class="mb-6 rounded-[var(--radius-lg)] border border-[rgb(33_150_243/20%)] bg-[rgb(33_150_243/5%)] p-4"
      >
        <div
          class="flex justify-between border-b border-[rgb(255_255_255/5%)] py-2"
        >
          <span class="text-sm text-[var(--color-text-secondary)]"
            >Queue ID:</span
          >
          <span class="text-sm font-semibold text-[var(--color-text-primary)]">
            {queueData.queueId}
          </span>
        </div>
        <div
          class="flex justify-between border-b border-[rgb(255_255_255/5%)] py-2"
        >
          <span class="text-sm text-[var(--color-text-secondary)]"
            >Tenant ID:</span
          >
          <span class="text-sm font-semibold text-[var(--color-text-primary)]">
            {queueData.tenantId}
          </span>
        </div>
        <div class="flex justify-between py-2">
          <span class="text-sm text-[var(--color-text-secondary)]"
            >Angefordert von:</span
          >
          <span class="text-sm font-semibold text-[var(--color-text-primary)]">
            {queueData.requestedByName ?? `User ${queueData.requestedBy}`}
          </span>
        </div>
      </div>

      <!-- Warning Alert -->
      <div class="alert alert--danger mb-6 text-left">
        <div class="alert__icon">
          <i class="fas fa-skull-crossbones"></i>
        </div>
        <div class="alert__content">
          <p class="alert__title">LETZTE WARNUNG!</p>
          <p class="alert__message">
            Nach der Genehmigung werden nach 30 Tagen ALLE Daten unwiderruflich
            gelöscht!
          </p>
        </div>
      </div>

      <!-- Approval Form -->
      <form
        onsubmit={handleSubmit}
        class="text-left"
      >
        <!-- Confirmation Input -->
        <div class="form-field mb-4">
          <label
            class="form-field__label"
            for="confirmationInput"
          >
            Geben Sie zur Bestätigung <strong class="text-red-500"
              >LÖSCHEN</strong
            > ein:
          </label>
          <input
            type="text"
            id="confirmationInput"
            class="form-field__control"
            placeholder="LÖSCHEN"
            autocomplete="off"
            required
            bind:value={confirmationInput}
          />
        </div>

        <!-- Password Input -->
        <div class="form-field mb-6">
          <label
            for="passwordInput"
            class="form-field__label"
          >
            Ihr Root-Passwort zur Verifizierung:
          </label>
          <input
            type="password"
            id="passwordInput"
            class="form-field__control"
            placeholder="Passwort eingeben"
            autocomplete="current-password"
            required
            bind:value={passwordInput}
          />
        </div>

        <!-- Error Message -->
        {#if errorMessage}
          <div class="alert alert--danger mb-4">
            <div class="alert__content">
              <p class="alert__message">{errorMessage}</p>
            </div>
          </div>
        {/if}

        <!-- Action Buttons -->
        <div class="flex gap-3">
          <a
            href={resolvePath('/tenant-deletion-status')}
            class="btn btn-cancel flex-1"
            data-sveltekit-reload
          >
            <i class="fas fa-arrow-left mr-2"></i>
            Abbrechen
          </a>
          <button
            type="submit"
            class="btn btn-danger flex-1"
            disabled={!canSubmit}
          >
            {#if submitting}
              <i class="fas fa-spinner fa-spin mr-2"></i>
              Wird genehmigt...
            {:else}
              <i class="fas fa-check mr-2"></i>
              Genehmigen
            {/if}
          </button>
        </div>
      </form>
    {/if}
  </div>
</div>

<script lang="ts">
  /**
   * Swap Consent + Status Banner
   * Three sections:
   * 1. Outgoing requests (requester waiting for partner) — with cancel button
   * 2. Incoming consents (target needs to accept/decline)
   * 3. Active swaps awaiting team lead approval
   */
  import { showErrorAlert, showSuccessAlert } from '$lib/utils/alerts';
  import { getErrorMessage } from '$lib/utils/error';
  import { createLogger } from '$lib/utils/logger';

  import {
    cancelSwapRequest,
    fetchMyActiveSwaps,
    fetchMyOutgoingRequests,
    fetchMyPendingConsents,
    respondToSwapRequest,
  } from './api';

  import type { HierarchyLabels } from '$lib/types/hierarchy-labels';
  import type { SwapRequestApiResponse } from './api';

  interface Props {
    currentUserId: number;
    labels: HierarchyLabels;
  }

  const { currentUserId, labels }: Props = $props();

  const log = createLogger('SwapConsentBanner');

  let outgoing = $state<SwapRequestApiResponse[]>([]);
  let consents = $state<SwapRequestApiResponse[]>([]);
  let activeSwaps = $state<SwapRequestApiResponse[]>([]);
  let loading = $state(true);
  let busyUuid = $state<string | null>(null);

  // Wait for currentUserId to be set (SSR init sets it after mount)
  $effect(() => {
    if (currentUserId > 0) {
      void loadData();
    }
  });

  /** Reload all swap data — called after any action */
  export async function loadData(): Promise<void> {
    try {
      const [o, c, a] = await Promise.all([
        fetchMyOutgoingRequests(currentUserId),
        fetchMyPendingConsents(),
        fetchMyActiveSwaps(currentUserId),
      ]);
      outgoing = o.filter((r: SwapRequestApiResponse) => r.requesterId === currentUserId);
      consents = c;
      activeSwaps = a;
    } catch (err: unknown) {
      log.error({ err }, 'Failed to load swap data');
    } finally {
      loading = false;
    }
  }

  async function handleRespond(uuid: string, accept: boolean): Promise<void> {
    busyUuid = uuid;
    try {
      await respondToSwapRequest(uuid, accept);
      // Remove from consents immediately (prevent double-click)
      consents = consents.filter((r: SwapRequestApiResponse) => r.uuid !== uuid);
      showSuccessAlert(accept ? 'Tausch akzeptiert' : 'Tausch abgelehnt');
      void loadData();
    } catch (err: unknown) {
      showErrorAlert(getErrorMessage(err));
    } finally {
      busyUuid = null;
    }
  }

  async function handleCancel(uuid: string): Promise<void> {
    busyUuid = uuid;
    try {
      await cancelSwapRequest(uuid);
      showSuccessAlert('Tausch-Anfrage zurückgezogen');
      void loadData();
    } catch (err: unknown) {
      showErrorAlert(getErrorMessage(err));
    } finally {
      busyUuid = null;
    }
  }

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function partnerName(swap: SwapRequestApiResponse): string {
    return swap.requesterId === currentUserId ?
        (swap.targetName ?? 'Unbekannt')
      : (swap.requesterName ?? 'Unbekannt');
  }
</script>

<!-- 1. Outgoing: Requester waiting for partner response -->
{#if !loading && outgoing.length > 0}
  <div class="alert alert--info mb-4">
    <div class="alert__icon"><i class="fas fa-paper-plane"></i></div>
    <div class="alert__content">
      <strong>Gesendete Tausch-Anfragen ({outgoing.length})</strong>
      {#each outgoing as req (req.uuid)}
        <div class="swap-row">
          <span>
            Anfrage an <strong>{req.targetName ?? 'Unbekannt'}</strong>
            am <strong>{fmtDate(req.startDate)}</strong>
            {#if req.swapScope === 'week'}(ganze Woche){/if}
            {#if req.reason}
              <em class="text-sm text-(--color-text-secondary)">— {req.reason}</em>
            {/if}
            —
            <strong class="text-(--color-warning)"
              ><i class="fas fa-clock"></i> Wartet auf Antwort</strong
            >
          </span>
          <button
            type="button"
            class="btn btn-danger btn--sm"
            disabled={busyUuid !== null}
            onclick={() => void handleCancel(req.uuid)}
          >
            {#if busyUuid === req.uuid}
              <span class="spinner-ring spinner-ring--sm"></span>
            {:else}
              <i class="fas fa-undo"></i>
            {/if}
            Zurückziehen
          </button>
        </div>
      {/each}
    </div>
  </div>
{/if}

<!-- 2. Incoming: Target needs to accept/decline -->
{#if !loading && consents.length > 0}
  <div class="alert alert--info mb-4">
    <div class="alert__icon"><i class="fas fa-exchange-alt"></i></div>
    <div class="alert__content">
      <strong>Offene Tausch-Anfragen ({consents.length})</strong>
      {#each consents as req (req.uuid)}
        <div class="swap-row">
          <span>
            <strong>{req.requesterName ?? 'Unbekannt'}</strong> möchte am
            <strong>{fmtDate(req.startDate)}</strong>
            {#if req.swapScope === 'week'}(ganze Woche){/if}
            mit dir tauschen.
            {#if req.reason}
              <em class="text-sm text-(--color-text-secondary)">— {req.reason}</em>
            {/if}
          </span>
          <span class="swap-row__actions">
            <button
              type="button"
              class="btn btn-success btn--sm"
              disabled={busyUuid !== null}
              onclick={() => void handleRespond(req.uuid, true)}
            >
              {#if busyUuid === req.uuid}
                <span class="spinner-ring spinner-ring--sm"></span>
              {:else}
                <i class="fas fa-check"></i>
              {/if}
              Akzeptieren
            </button>
            <button
              type="button"
              class="btn btn-danger btn--sm"
              disabled={busyUuid !== null}
              onclick={() => void handleRespond(req.uuid, false)}
            >
              <i class="fas fa-times"></i>
              Ablehnen
            </button>
          </span>
        </div>
      {/each}
    </div>
  </div>
{/if}

<!-- 3. Awaiting Team Lead approval -->
{#if !loading && activeSwaps.length > 0}
  <div class="alert alert--info mb-4">
    <div class="alert__icon"><i class="fas fa-hourglass-half"></i></div>
    <div class="alert__content">
      <strong>Warten auf Genehmigung ({activeSwaps.length})</strong>
      {#each activeSwaps as swap (swap.uuid)}
        <div class="swap-row">
          <span>
            Tausch mit <strong>{partnerName(swap)}</strong> am
            <strong>{fmtDate(swap.startDate)}</strong>
            —
            <strong class="text-(--color-warning)">
              <i class="fas fa-clock"></i> Wartet auf {labels.team}-Lead Genehmigung
            </strong>
          </span>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  /* Override alert base: center icon vertically with multi-row content */
  .alert {
    align-items: center;
  }

  .swap-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    padding: var(--spacing-2) 0;
  }

  .swap-row + .swap-row {
    border-top: 1px solid var(--color-glass-border);
  }

  .swap-row__actions {
    display: flex;
    gap: var(--spacing-2);
    flex-shrink: 0;
    margin-left: auto;
  }
</style>

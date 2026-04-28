<script lang="ts">
  /**
   * SelfTerminationCard — Danger-zone card on /root-profile.
   *
   * Renders 5 UI states (FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN §5.1):
   *   1. eligible      → red CTA opens the modal
   *   2. pending       → yellow card with countdown + cancel
   *   3. lastRoot      → red disabled CTA + tooltip
   *   4. cooldown      → red disabled CTA + cooldown countdown tooltip
   *   5. ineligibleMix → fallback for any combination not above
   *
   * Spec Deviation D11: §5.1 state "Recently rejected (>24h)" cannot be
   * surfaced upfront because no backend endpoint exposes the most-recent
   * rejection (the service method is internal-only — see ADR-pending /
   * masterplan §2.4 `getMostRecentRejection ... Internal`). After a >24h
   * cooldown elapses the user simply sees state 1 (eligible) and can
   * re-request normally; the rejection history will be added in a Phase-6
   * follow-up if the backend exposes it.
   */
  import { SELF_TERMINATION_MESSAGES } from './_lib/constants';
  import { createSelfTerminationState } from './_lib/state-self-termination.svelte';
  import { formatDate } from './_lib/utils';
  import SelfTerminationModal from './SelfTerminationModal.svelte';

  import type { SelfTerminationRequest } from './_lib/types';

  interface Props {
    initialPending: SelfTerminationRequest | null;
  }

  const { initialPending }: Props = $props();

  // Seeding intent: snapshot the SSR value ONCE; mutations after request/
  // cancel update the local state holder, which then drives the UI. After
  // `invalidateAll()` re-runs `+page.server.ts`, the new prop arrives but
  // local state already reflects the mutation — they converge. Repo
  // precedent for this pattern: lib/components/PermissionSettings.svelte.
  // svelte-ignore state_referenced_locally
  const state = createSelfTerminationState(initialPending);

  /** Cooldown is "active" iff the parsed end-time is still in the future. */
  const cooldownActive = $derived.by(() => {
    if (state.cooldownEndsAt === null) return false;
    return state.cooldownEndsAt.getTime() > Date.now();
  });

  /** Mutually exclusive UI state, evaluated top-down. */
  type CardState = 'pending' | 'lastRoot' | 'cooldown' | 'eligible';

  const cardState = $derived.by<CardState>(() => {
    if (state.pending !== null) return 'pending';
    if (state.lastRootBlocked) return 'lastRoot';
    if (cooldownActive) return 'cooldown';
    return 'eligible';
  });
</script>

<section class="self-termination-card">
  <header class="card-header">
    <i class="fas fa-skull-crossbones"></i>
    <div>
      <h2>{SELF_TERMINATION_MESSAGES.sectionTitle}</h2>
      <p>{SELF_TERMINATION_MESSAGES.sectionSubtitle}</p>
    </div>
  </header>

  {#if cardState === 'pending' && state.pending !== null}
    <!-- State 2: Pending — yellow card with countdown + cancel -->
    <div class="status-row status-row--pending">
      <div class="status-text">
        <strong>{SELF_TERMINATION_MESSAGES.pendingHeading}</strong>
        <p>
          {SELF_TERMINATION_MESSAGES.pendingExpiresPrefix}
          {formatDate(state.pending.expiresAt)}
        </p>
        {#if state.pending.reason !== null && state.pending.reason !== ''}
          <p class="reason-text">{state.pending.reason}</p>
        {/if}
      </div>
      <button
        type="button"
        class="btn btn-cancel"
        onclick={() => state.cancel()}
        disabled={state.submitting}
      >
        {#if state.submitting}
          <span class="spinner-ring spinner-ring--sm"></span>
        {:else}
          <i class="fas fa-undo"></i>
        {/if}
        {SELF_TERMINATION_MESSAGES.ctaCancel}
      </button>
    </div>
  {:else if cardState === 'lastRoot'}
    <!-- State 3: Last root — disabled red CTA -->
    <div class="status-row status-row--blocked">
      <div class="status-text">
        <strong>{SELF_TERMINATION_MESSAGES.lastRootHeading}</strong>
        <p>{SELF_TERMINATION_MESSAGES.lastRootDisabledTooltip}</p>
      </div>
      <button
        type="button"
        class="btn btn-danger"
        disabled
        title={SELF_TERMINATION_MESSAGES.lastRootDisabledTooltip}
      >
        <i class="fas fa-trash"></i>
        {SELF_TERMINATION_MESSAGES.ctaRequest}
      </button>
    </div>
  {:else if cardState === 'cooldown' && state.cooldownEndsAt !== null}
    <!-- State 4: Cooldown — disabled red CTA with end-time tooltip -->
    <div class="status-row status-row--blocked">
      <div class="status-text">
        <strong>{SELF_TERMINATION_MESSAGES.cooldownHeading}</strong>
        <p>
          {SELF_TERMINATION_MESSAGES.cooldownTooltipPrefix}
          {formatDate(state.cooldownEndsAt.toISOString())}
        </p>
      </div>
      <button
        type="button"
        class="btn btn-danger"
        disabled
        title="{SELF_TERMINATION_MESSAGES.cooldownTooltipPrefix} {formatDate(
          state.cooldownEndsAt.toISOString(),
        )}"
      >
        <i class="fas fa-trash"></i>
        {SELF_TERMINATION_MESSAGES.ctaRequest}
      </button>
    </div>
  {:else}
    <!-- State 1: Eligible — red CTA opens modal -->
    <div class="status-row">
      <button
        type="button"
        class="btn btn-danger"
        onclick={() => {
          state.openModal();
        }}
        disabled={state.submitting}
      >
        <i class="fas fa-trash"></i>
        {SELF_TERMINATION_MESSAGES.ctaRequest}
      </button>
    </div>
  {/if}
</section>

<SelfTerminationModal
  open={state.modalOpen}
  submitting={state.submitting}
  onsubmit={(reason: string | null) => state.request(reason)}
  onclose={() => {
    state.closeModal();
  }}
/>

<style>
  .self-termination-card {
    margin-top: var(--spacing-8);
    border: 1px solid color-mix(in oklch, var(--color-danger) 30%, transparent);
    border-radius: var(--radius-xl);
    background: color-mix(in oklch, var(--color-danger) 5%, transparent);
    padding: var(--spacing-6);
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-4);
    margin-bottom: var(--spacing-5);
  }

  .card-header i {
    color: var(--color-danger);
    font-size: 24px;
  }

  .card-header h2 {
    margin: 0 0 var(--spacing-1) 0;
    color: var(--color-danger);
    font-size: 18px;
    font-weight: 600;
  }

  .card-header p {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 14px;
    line-height: 1.5;
  }

  .status-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-4);
  }

  .status-row--pending {
    border: 1px solid color-mix(in oklch, var(--color-warning) 30%, transparent);
    border-radius: var(--radius-xl);
    background: color-mix(in oklch, var(--color-warning) 10%, transparent);
    padding: var(--spacing-4);
  }

  .status-row--blocked {
    border: 1px solid color-mix(in oklch, var(--color-danger) 25%, transparent);
    border-radius: var(--radius-xl);
    background: color-mix(in oklch, var(--color-danger) 8%, transparent);
    padding: var(--spacing-4);
  }

  .status-text strong {
    display: block;
    margin-bottom: var(--spacing-1);
    color: var(--color-text-primary);
  }

  .status-text p {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 14px;
  }

  .reason-text {
    margin-top: var(--spacing-2) !important;
    font-style: italic;
  }

  @media (width < 768px) {
    .status-row,
    .status-row--pending,
    .status-row--blocked {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>

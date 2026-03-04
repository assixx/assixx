<script lang="ts">
  /**
   * StatusTransition — Status change buttons based on current status + user role.
   *
   * Employee: open→in_progress, open→completed, in_progress→completed
   * Admin:    + completed→verified, completed→in_progress, verified→completed
   */
  import { invalidateAll } from '$app/navigation';

  import { updateStatus, logApiError } from '../../_lib/api';
  import { STATUS_TRANSITION_LABELS, MESSAGES } from '../../_lib/constants';

  import type { WorkOrderStatus } from '../../_lib/types';

  interface Transition {
    target: WorkOrderStatus;
    label: string;
    variant: string;
    icon: string;
  }

  interface Props {
    uuid: string;
    currentStatus: WorkOrderStatus;
    userRole: string;
  }

  const { uuid, currentStatus, userRole }: Props = $props();

  let transitioning = $state(false);

  const isAdmin = $derived(userRole === 'admin' || userRole === 'root');

  /** Compute available transitions for current status + role */
  const transitions = $derived.by((): Transition[] => {
    const result: Transition[] = [];

    if (currentStatus === 'open') {
      result.push({
        target: 'in_progress',
        label: STATUS_TRANSITION_LABELS['open→in_progress'],
        variant: 'btn-primary',
        icon: 'fa-play',
      });
      result.push({
        target: 'completed',
        label: STATUS_TRANSITION_LABELS['open→completed'],
        variant: 'btn-success',
        icon: 'fa-check',
      });
    }

    if (currentStatus === 'in_progress') {
      result.push({
        target: 'completed',
        label: STATUS_TRANSITION_LABELS['in_progress→completed'],
        variant: 'btn-success',
        icon: 'fa-check-circle',
      });
    }

    if (currentStatus === 'completed' && isAdmin) {
      result.push({
        target: 'verified',
        label: STATUS_TRANSITION_LABELS['completed→verified'],
        variant: 'btn-primary',
        icon: 'fa-shield-check',
      });
      result.push({
        target: 'in_progress',
        label: STATUS_TRANSITION_LABELS['completed→in_progress'],
        variant: 'btn-warning',
        icon: 'fa-undo',
      });
    }

    if (currentStatus === 'verified' && isAdmin) {
      result.push({
        target: 'completed',
        label: STATUS_TRANSITION_LABELS['verified→completed'],
        variant: 'btn-warning',
        icon: 'fa-undo',
      });
    }

    return result;
  });

  async function handleTransition(target: WorkOrderStatus): Promise<void> {
    transitioning = true;
    try {
      await updateStatus(uuid, { status: target });
      await invalidateAll();
    } catch (err: unknown) {
      logApiError('statusTransition', err);
    } finally {
      transitioning = false;
    }
  }
</script>

{#if transitions.length > 0}
  <div class="status-transition">
    <h4 class="section-title">
      <i class="fas fa-exchange-alt mr-2"></i>
      {MESSAGES.DETAIL_STATUS}
    </h4>
    <div class="transition-buttons">
      {#each transitions as t (t.target)}
        <button
          type="button"
          class="btn {t.variant} btn--sm"
          disabled={transitioning}
          onclick={() => {
            void handleTransition(t.target);
          }}
        >
          {#if transitioning}
            <i class="fas fa-spinner fa-spin"></i>
          {:else}
            <i class="fas {t.icon}"></i>
          {/if}
          {t.label}
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .status-transition {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .transition-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .transition-buttons :global(.btn) {
    width: 100%;
    justify-content: center;
  }
</style>

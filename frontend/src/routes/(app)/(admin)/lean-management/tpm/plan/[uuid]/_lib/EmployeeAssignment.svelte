<script lang="ts">
  /**
   * TPM Employee Assignment Component
   * @module plan/[uuid]/_lib/EmployeeAssignment
   *
   * Shows team members assigned to the machine's team
   * with their availability status. Informational only.
   * Uses the slot assistant's team availability data.
   */
  import { getApiClient } from '$lib/utils/api-client';
  import { createLogger } from '$lib/utils/logger';

  import { MESSAGES } from '../../../_lib/constants';

  import type { TeamMemberStatus } from '../../../_lib/types';

  interface Props {
    planUuid: string;
  }

  const { planUuid }: Props = $props();

  const log = createLogger('EmployeeAssignment');
  const apiClient = getApiClient();

  // =========================================================================
  // STATE
  // =========================================================================

  let loading = $state(true);
  let members = $state<TeamMemberStatus[]>([]);

  const availableCount = $derived(
    members.filter((m: TeamMemberStatus) => m.isAvailable).length,
  );

  // =========================================================================
  // LOAD TEAM
  // =========================================================================

  async function loadTeam(): Promise<void> {
    loading = true;
    try {
      // Use slot assistant endpoint with today's date for team snapshot
      const today = new Date().toISOString().split('T')[0] ?? '';
      const result: unknown = await apiClient.get(
        `/tpm/plans/${planUuid}/available-slots?startDate=${today}&endDate=${today}`,
      );

      // The slot assistant returns DayAvailability, but we can also
      // derive team info from the response structure. For now, show
      // a simplified view based on available slot data.
      if (result !== null && typeof result === 'object') {
        const obj = result as Record<string, unknown>;
        if (Array.isArray(obj.teamMembers)) {
          members = obj.teamMembers as TeamMemberStatus[];
        }
      }
    } catch (err: unknown) {
      log.error({ err }, 'Error loading team availability');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void loadTeam();
  });
</script>

<div class="card">
  <div class="card__header">
    <h3 class="card__title">
      <i class="fas fa-users mr-2"></i>
      {MESSAGES.EMPLOYEE_TITLE}
    </h3>
    <p class="mt-1 text-xs text-(--color-text-muted)">
      {MESSAGES.EMPLOYEE_DESCRIPTION}
    </p>
  </div>
  <div class="card__body">
    {#if loading}
      <div
        class="flex items-center justify-center gap-2 p-6 text-sm text-(--color-text-muted)"
      >
        <i class="fas fa-spinner fa-spin"></i>
        {MESSAGES.EMPLOYEE_LOADING}
      </div>
    {:else if members.length === 0}
      <div class="empty-state">
        <div class="empty-state__icon">
          <i class="fas fa-user-slash"></i>
        </div>
        <h3 class="empty-state__title">{MESSAGES.EMPLOYEE_EMPTY}</h3>
      </div>
    {:else}
      <!-- Summary -->
      <div class="mb-3 flex items-baseline gap-2">
        <span class="text-xl font-bold text-(--color-success)">
          {availableCount}/{members.length}
        </span>
        <span class="text-sm text-(--color-text-muted)">
          {MESSAGES.EMPLOYEE_AVAILABLE}
        </span>
      </div>

      <!-- Member list -->
      <div class="flex flex-col gap-1.5">
        {#each members as member (member.userId)}
          <div
            class="employee-item"
            class:employee-item--available={member.isAvailable}
            class:employee-item--unavailable={!member.isAvailable}
          >
            <div class="flex items-center gap-2">
              <span class="employee-dot"></span>
              <span class="text-sm font-medium text-(--color-text-secondary)"
                >{member.userName}</span
              >
            </div>
            {#if !member.isAvailable && member.unavailabilityReason !== null}
              <span class="text-xs text-(--color-text-muted) italic">
                {member.unavailabilityReason}
              </span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .employee-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.625rem;
    border-radius: var(--radius-sm);
    font-size: 0.813rem;
  }

  .employee-item--available {
    background: color-mix(in srgb, var(--color-success) 8%, transparent);
  }

  .employee-item--unavailable {
    background: var(--glass-bg-hover);
  }

  .employee-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .employee-item--available .employee-dot {
    background: var(--color-success);
  }

  .employee-item--unavailable .employee-dot {
    background: var(--color-text-muted);
  }
</style>

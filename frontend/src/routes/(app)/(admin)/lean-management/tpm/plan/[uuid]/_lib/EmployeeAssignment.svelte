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

<div class="employee-assignment">
  <div class="employee-assignment__header">
    <h3 class="employee-assignment__title">
      <i class="fas fa-users"></i>
      {MESSAGES.EMPLOYEE_TITLE}
    </h3>
    <p class="employee-assignment__desc">{MESSAGES.EMPLOYEE_DESCRIPTION}</p>
  </div>

  {#if loading}
    <div class="employee-assignment__loading">
      <i class="fas fa-spinner fa-spin"></i>
      {MESSAGES.EMPLOYEE_LOADING}
    </div>
  {:else if members.length === 0}
    <div class="employee-assignment__empty">
      <i class="fas fa-user-slash"></i>
      <p>{MESSAGES.EMPLOYEE_EMPTY}</p>
    </div>
  {:else}
    <!-- Summary -->
    <div class="employee-assignment__summary">
      <span class="employee-assignment__count">
        {availableCount}/{members.length}
      </span>
      <span class="employee-assignment__count-label">
        {MESSAGES.EMPLOYEE_AVAILABLE}
      </span>
    </div>

    <!-- Member list -->
    <div class="employee-list">
      {#each members as member (member.userId)}
        <div
          class="employee-item"
          class:employee-item--available={member.isAvailable}
          class:employee-item--unavailable={!member.isAvailable}
        >
          <div class="employee-item__info">
            <span class="employee-item__dot"></span>
            <span class="employee-item__name">{member.userName}</span>
          </div>
          {#if !member.isAvailable && member.unavailabilityReason !== null}
            <span class="employee-item__reason">
              {member.unavailabilityReason}
            </span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .employee-assignment {
    background: var(--color-white, #fff);
    border-radius: var(--radius-lg, 12px);
    box-shadow: var(--shadow-sm);
    padding: 1.25rem;
  }

  .employee-assignment__header {
    margin-bottom: 1rem;
  }

  .employee-assignment__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.938rem;
    font-weight: 600;
    color: var(--color-gray-800);
  }

  .employee-assignment__desc {
    font-size: 0.75rem;
    color: var(--color-gray-500);
    margin-top: 0.25rem;
  }

  .employee-assignment__loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1.5rem;
    justify-content: center;
    color: var(--color-gray-500);
    font-size: 0.813rem;
  }

  .employee-assignment__empty {
    text-align: center;
    padding: 1.5rem;
    color: var(--color-gray-400);
    font-size: 0.813rem;
  }

  .employee-assignment__empty i {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .employee-assignment__summary {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .employee-assignment__count {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-green-600, #059669);
  }

  .employee-assignment__count-label {
    font-size: 0.813rem;
    color: var(--color-gray-500);
  }

  /* Employee list */
  .employee-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .employee-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.625rem;
    border-radius: var(--radius-sm, 4px);
    font-size: 0.813rem;
  }

  .employee-item--available {
    background: var(--color-green-50, #ecfdf5);
  }

  .employee-item--unavailable {
    background: var(--color-gray-50, #f9fafb);
  }

  .employee-item__info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .employee-item__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .employee-item--available .employee-item__dot {
    background: var(--color-green-500, #10b981);
  }

  .employee-item--unavailable .employee-item__dot {
    background: var(--color-gray-400, #9ca3af);
  }

  .employee-item__name {
    font-weight: 500;
    color: var(--color-gray-700);
  }

  .employee-item__reason {
    font-size: 0.688rem;
    color: var(--color-gray-500);
    font-style: italic;
  }
</style>

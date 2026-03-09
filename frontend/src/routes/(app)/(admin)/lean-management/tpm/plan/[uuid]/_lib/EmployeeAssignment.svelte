<script lang="ts">
  /**
   * TPM Employee Assignment Component
   * @module plan/[uuid]/_lib/EmployeeAssignment
   *
   * Shows team members assigned to the asset's team(s)
   * with their availability status. Informational only.
   * Uses GET /tpm/plans/:uuid/team-availability endpoint.
   */
  import { showErrorAlert } from '$lib/stores/toast';

  import { fetchTeamAvailability, logApiError } from '../../../_lib/api';
  import { MESSAGES } from '../../../_lib/constants';

  import type {
    AssetTeamAvailabilityResult,
    TeamMemberStatus,
  } from '../../../_lib/types';

  interface Props {
    planUuid: string;
  }

  const { planUuid }: Props = $props();

  // =========================================================================
  // STATE
  // =========================================================================

  let loading = $state(true);
  let teamData = $state<AssetTeamAvailabilityResult | null>(null);

  const teams = $derived(teamData?.teams ?? []);
  const members = $derived(teamData?.members ?? []);
  const availableCount = $derived(
    members.filter((m: TeamMemberStatus) => m.isAvailable).length,
  );

  // =========================================================================
  // LOAD TEAM
  // =========================================================================

  async function loadTeam(): Promise<void> {
    loading = true;
    try {
      teamData = await fetchTeamAvailability(planUuid);
    } catch (err: unknown) {
      logApiError('loadTeam', err);
      showErrorAlert(err instanceof Error ? err.message : 'Fehler beim Laden');
      teamData = null;
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
      <!-- Team badge(s) -->
      {#if teams.length > 0}
        <div class="mb-3 flex flex-wrap gap-1.5">
          {#each teams as team (team.teamId)}
            <span class="team-badge">
              <i class="fas fa-users-cog"></i>
              {team.teamName}
            </span>
          {/each}
        </div>
      {/if}

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
  .team-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: var(--radius-full);
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-primary);
  }

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

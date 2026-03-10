<script lang="ts">
  /**
   * TPM Employee Assignment Component
   * @module plan/[uuid]/_lib/EmployeeAssignment
   *
   * Shows team members assigned to the asset's team(s)
   * with their availability status + TPM assignment counts
   * broken down by interval type (from SlotAssistant data).
   */
  import { showErrorAlert } from '$lib/stores/toast';
  import {
    getAvatarColorClass,
    getInitials,
    getProfilePictureUrl,
  } from '$lib/utils/avatar-helpers';

  import { fetchTeamAvailability, logApiError } from '../../../_lib/api';
  import { INTERVAL_LABELS, MESSAGES } from '../../../_lib/constants';

  import {
    COUNT_INTERVAL_COLUMNS,
    buildDateIntervalMap,
    buildPlanAssignmentCounts,
  } from './slot-assistant-helpers';

  import type { AssignmentCount } from './slot-assistant-helpers';
  import type {
    AssetTeamAvailabilityResult,
    IntervalType,
    ProjectedSlot,
    TeamMemberStatus,
    TpmPlanAssignment,
  } from '../../../_lib/types';

  interface Props {
    planUuid: string;
    projectionSlots?: ProjectedSlot[];
    planAssignments?: TpmPlanAssignment[];
  }

  const {
    planUuid,
    projectionSlots = [],
    planAssignments = [],
  }: Props = $props();

  // =========================================================================
  // CONSTANTS
  // =========================================================================

  /** Short column headers for interval types */
  const SHORT_LABELS: Record<IntervalType, string> = {
    daily: 'T',
    weekly: 'W',
    monthly: 'M',
    quarterly: 'Q',
    semi_annual: 'H',
    annual: 'J',
    custom: 'B',
  };

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
  // ASSIGNMENT COUNTS (derived from SlotAssistant data)
  // =========================================================================

  /** Computed assignment counts — reactive to SlotAssistant data changes */
  const assignmentCounts = $derived.by((): AssignmentCount[] => {
    if (projectionSlots.length === 0 || planAssignments.length === 0) return [];
    const dateIntervals = buildDateIntervalMap(projectionSlots, planUuid);
    return buildPlanAssignmentCounts(planAssignments, dateIntervals);
  });

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

  // =========================================================================
  // AVATAR HELPERS
  // =========================================================================

  function hasProfilePic(value: string | null): value is string {
    return value !== null && value !== '';
  }

  function avatarColorClass(member: TeamMemberStatus): string {
    return hasProfilePic(member.profilePicture) ? '' : (
        getAvatarColorClass(member.userId)
      );
  }
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
      <div class="member-list">
        {#each members as member (member.userId)}
          <div
            class="member-item"
            class:member-item--available={member.isAvailable}
            class:member-item--unavailable={!member.isAvailable}
          >
            <div class="avatar avatar--sm {avatarColorClass(member)}">
              {#if hasProfilePic(member.profilePicture)}
                <img
                  src={getProfilePictureUrl(member.profilePicture)}
                  alt={member.userName}
                  class="avatar__image"
                />
              {:else}
                <span class="avatar__initials">
                  {getInitials(member.firstName, member.lastName)}
                </span>
              {/if}
            </div>
            <div class="member-item__info">
              <span class="member-item__name">{member.userName}</span>
              {#if !member.isAvailable && member.unavailabilityReason !== null}
                <span class="member-item__status">
                  {member.unavailabilityReason}
                </span>
              {:else}
                <span
                  class="member-item__status member-item__status--available"
                >
                  Verfügbar
                </span>
              {/if}
            </div>
            <span
              class="member-dot"
              class:member-dot--available={member.isAvailable}
              class:member-dot--unavailable={!member.isAvailable}
            ></span>
          </div>
        {/each}
      </div>

      <!-- TPM-Zuweisungen counts -->
      {#if assignmentCounts.length > 0}
        <div class="tpm-counts">
          <h4 class="tpm-counts__title">
            <i class="fas fa-chart-bar"></i>
            TPM-Zuweisungen
          </h4>
          <div class="tpm-counts__grid">
            <div class="tpm-counts__header">
              <span class="col-name">Mitarbeiter</span>
              {#each COUNT_INTERVAL_COLUMNS as col (col)}
                <span
                  class="col-num"
                  title={INTERVAL_LABELS[col]}
                >
                  {SHORT_LABELS[col]}
                </span>
              {/each}
              <span
                class="col-num col-total"
                title="Gesamt"
              >
                &Sigma;
              </span>
            </div>
            {#each assignmentCounts as entry (entry.userId)}
              <div class="tpm-counts__row">
                <span class="col-name">{entry.lastName}, {entry.firstName}</span
                >
                {#each COUNT_INTERVAL_COLUMNS as col (col)}
                  {@const val = entry.counts[col] ?? 0}
                  <span
                    class="col-num"
                    class:highlight={val > 0}
                  >
                    {val}
                  </span>
                {/each}
                <span
                  class="col-num col-total"
                  class:highlight={entry.total > 0}
                >
                  {entry.total}
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
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

  .member-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .member-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--color-border-light, var(--color-border));
  }

  .member-item:last-child {
    border-bottom: none;
  }

  .member-item__info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .member-item__name {
    font-weight: 600;
    font-size: 0.875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .member-item__status {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-style: italic;
  }

  .member-item__status--available {
    color: var(--color-success);
    font-style: normal;
  }

  .member-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .member-dot--available {
    background: var(--color-success);
  }

  .member-dot--unavailable {
    background: var(--color-text-muted);
  }

  /* ---- TPM Assignment Counts ---- */

  .tpm-counts {
    border: var(--glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg);
    padding: var(--spacing-4) var(--spacing-5);
    margin-top: var(--spacing-4);
  }

  .tpm-counts__title {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-3);
    color: var(--color-text-secondary);
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .tpm-counts__title i {
    font-size: 12px;
    opacity: 70%;
  }

  .tpm-counts__grid {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tpm-counts__header,
  .tpm-counts__row {
    display: grid;
    grid-template-columns: 1fr repeat(5, 32px) 36px;
    align-items: center;
    gap: var(--spacing-1);
  }

  .tpm-counts__header {
    padding-bottom: var(--spacing-2);
    border-bottom: 1px solid var(--color-glass-border);
    margin-bottom: var(--spacing-1);
  }

  .tpm-counts__header .col-num {
    color: var(--color-text-secondary);
    font-size: 11px;
    font-weight: 700;
    text-align: center;
    text-transform: uppercase;
  }

  .tpm-counts__header .col-name {
    color: var(--color-text-secondary);
    font-size: 11px;
    font-weight: 600;
  }

  .tpm-counts__row {
    padding: 3px 0;
    border-radius: var(--radius-sm);
  }

  .tpm-counts__row:hover {
    background: var(--glass-bg-active);
  }

  .col-name {
    color: var(--color-text-primary);
    font-size: 13px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .col-num {
    color: var(--color-text-secondary);
    font-size: 13px;
    font-weight: 600;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .col-num.highlight {
    color: var(--color-text-primary);
  }

  .col-total {
    border-left: 1px solid var(--color-glass-border);
  }
</style>

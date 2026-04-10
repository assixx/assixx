<script lang="ts">
  /**
   * TPM Assignment Modal
   * @module plan/[uuid]/_lib/AssignmentModal
   *
   * Modal for assigning team members to a TPM maintenance date.
   * Shows checkboxes with member avatars + availability status.
   * Uses design system modal + badge components.
   */
  import { SvelteSet } from 'svelte/reactivity';

  import { showErrorAlert, showSuccessAlert } from '$lib/stores/toast';
  import {
    getAvatarColorClass,
    getInitials,
    getProfilePictureUrl,
  } from '$lib/utils/avatar-helpers';

  import { setPlanAssignments, logApiError } from '../../../_admin/api';

  import type { TeamMemberStatus, TpmPlanAssignment } from '../../../_admin/types';

  interface Props {
    planUuid: string;
    scheduledDate: string;
    members: TeamMemberStatus[];
    currentAssignments: TpmPlanAssignment[];
    onclose: () => void;
    onsaved: (assignments: TpmPlanAssignment[]) => void;
  }

  const { planUuid, scheduledDate, members, currentAssignments, onclose, onsaved }: Props =
    $props();

  // =========================================================================
  // STATE
  // =========================================================================

  /** User toggles (XOR with initial assignments) */
  const toggledIds = new SvelteSet<number>();
  let saving = $state(false);

  /** Effective selection: initial assignments XOR user toggles */
  const selectedIds = $derived.by(() => {
    const initial = new SvelteSet(currentAssignments.map((a: TpmPlanAssignment) => a.userId));
    for (const id of toggledIds) {
      if (initial.has(id)) initial.delete(id);
      else initial.add(id);
    }
    return initial;
  });

  const formattedDate = $derived(
    new Date(scheduledDate).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
  );

  const hasChanges = $derived(toggledIds.size > 0);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  function toggleMember(userId: number): void {
    if (toggledIds.has(userId)) {
      toggledIds.delete(userId);
    } else {
      toggledIds.add(userId);
    }
  }

  async function handleSave(): Promise<void> {
    saving = true;
    try {
      const result = await setPlanAssignments(planUuid, [...selectedIds], scheduledDate);
      showSuccessAlert('Zuweisungen gespeichert');
      onsaved(result);
      onclose();
    } catch (err: unknown) {
      logApiError('setAssignments', err);
      showErrorAlert(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      saving = false;
    }
  }

  // =========================================================================
  // AVATAR HELPERS
  // =========================================================================

  function hasProfilePic(value: string | null): value is string {
    return value !== null && value !== '';
  }

  function avatarColorClass(member: TeamMemberStatus): string {
    return hasProfilePic(member.profilePicture) ? '' : getAvatarColorClass(member.userId);
  }
</script>

<div class="modal-overlay modal-overlay--active">
  <div
    class="ds-modal ds-modal--md"
    role="dialog"
    aria-modal="true"
    aria-labelledby="assignment-modal-title"
  >
    <div class="ds-modal__header">
      <h3 id="assignment-modal-title">
        <i class="fas fa-user-plus mr-2"></i>
        Mitarbeiter zuweisen
      </h3>
      <button
        type="button"
        class="ds-modal__close"
        onclick={onclose}
        aria-label="Schließen"
      >
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="ds-modal__body">
      <p class="mb-3 text-sm text-(--color-text-muted)">
        <i class="fas fa-calendar-day mr-1"></i>
        {formattedDate}
      </p>

      {#if members.length === 0}
        <div class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-user-slash"></i>
          </div>
          <h3 class="empty-state__title">Keine Teammitglieder verfügbar</h3>
        </div>
      {:else}
        <div class="assign-list">
          {#each members as member (member.userId)}
            {@const isSelected = selectedIds.has(member.userId)}
            <label
              class="assign-member"
              class:assign-member--selected={isSelected}
              class:assign-member--unavailable={!member.isAvailable}
            >
              <input
                type="checkbox"
                class="assign-member__checkbox"
                checked={isSelected}
                onchange={() => {
                  toggleMember(member.userId);
                }}
              />
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
              <div class="assign-member__info">
                <span class="assign-member__name">{member.userName}</span>
                {#if !member.isAvailable && member.unavailabilityReason !== null}
                  <span class="assign-member__status">
                    {member.unavailabilityReason}
                  </span>
                {:else}
                  <span class="assign-member__status assign-member__status--ok"> Verfügbar </span>
                {/if}
              </div>
              {#if isSelected}
                <span class="badge badge--sm badge--info">Zugewiesen</span>
              {/if}
            </label>
          {/each}
        </div>

        <p class="mt-2 text-xs text-(--color-text-muted)">
          {selectedIds.size} von {members.length} ausgewählt
        </p>
      {/if}
    </div>

    <div class="ds-modal__footer">
      <button
        type="button"
        class="btn btn-cancel"
        onclick={onclose}
      >
        Abbrechen
      </button>
      <button
        type="button"
        class="btn btn-secondary"
        disabled={saving || !hasChanges}
        onclick={handleSave}
      >
        {#if saving}
          <i class="fas fa-spinner fa-spin mr-1"></i> Speichern…
        {:else}
          <i class="fas fa-check mr-1"></i> Zuweisen
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .assign-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .assign-member {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s;
  }

  .assign-member:hover {
    background: color-mix(in srgb, var(--color-primary) 5%, transparent);
    border-color: color-mix(in srgb, var(--color-primary) 25%, transparent);
  }

  .assign-member--selected {
    background: color-mix(in srgb, var(--color-primary) 8%, transparent);
    border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
  }

  .assign-member--unavailable {
    opacity: 70%;
  }

  .assign-member__checkbox {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    accent-color: var(--color-primary);
  }

  .assign-member__info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .assign-member__name {
    font-weight: 600;
    font-size: 0.875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .assign-member__status {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-style: italic;
  }

  .assign-member__status--ok {
    color: var(--color-success);
    font-style: normal;
  }
</style>

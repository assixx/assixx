<script lang="ts">
  /**
   * AssigneeList — Displays assigned employees for a work order.
   * Read-only in employee view. Admin add/remove in Step 5.4.
   */
  import { getAvatarColorClass, getProfilePictureUrl } from '$lib/utils/avatar-helpers';

  import { MESSAGES } from '../../_lib/constants';

  import type { WorkOrderAssignee } from '../../_lib/types';

  interface Props {
    assignees: WorkOrderAssignee[];
  }

  const { assignees }: Props = $props();

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /** Extract initials from a full name */
  function getInitials(name: string): string {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  function hasProfilePic(value: string | null): value is string {
    return value !== null && value !== '';
  }

  function avatarColorClass(assignee: WorkOrderAssignee): string {
    return hasProfilePic(assignee.profilePicture) ? '' : getAvatarColorClass(assignee.userId);
  }
</script>

<div class="assignee-section">
  <h4 class="section-title">
    <i class="fas fa-users mr-2"></i>
    {MESSAGES.ASSIGNEES_HEADING}
    <span class="badge badge--count ml-2">{assignees.length}</span>
  </h4>

  {#if assignees.length === 0}
    <p class="text-muted">{MESSAGES.ASSIGNEES_EMPTY}</p>
  {:else}
    <div class="assignee-list">
      {#each assignees as assignee (assignee.uuid)}
        <div class="assignee-item">
          <div class="avatar avatar--sm {avatarColorClass(assignee)}">
            {#if hasProfilePic(assignee.profilePicture)}
              <img
                src={getProfilePictureUrl(assignee.profilePicture)}
                alt={assignee.userName}
                class="avatar__image"
              />
            {:else}
              <span class="avatar__initials">
                {getInitials(assignee.userName)}
              </span>
            {/if}
          </div>
          <div class="assignee-item__info">
            <span class="assignee-item__name">{assignee.userName}</span>
            <span class="assignee-item__date">
              Zugewiesen am {formatDate(assignee.assignedAt)}
            </span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .assignee-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .assignee-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--color-border-light, var(--color-border));
  }

  .assignee-item:last-child {
    border-bottom: none;
  }

  .assignee-item__info {
    display: flex;
    flex-direction: column;
  }

  .assignee-item__name {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .assignee-item__date {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .text-muted {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    font-style: italic;
  }
</style>

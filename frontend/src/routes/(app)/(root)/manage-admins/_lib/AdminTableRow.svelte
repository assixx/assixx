<script lang="ts">
  import { DEFAULT_HIERARCHY_LABELS } from '$lib/types/hierarchy-labels';
  import { getProfilePictureUrl } from '$lib/utils/avatar-helpers';

  import {
    getStatusBadgeClass,
    getStatusLabel,
    getPositionDisplay,
    getAvatarColor,
    getAreasBadge,
    getDepartmentsBadge,
    getTeamsBadge,
    getAvailabilityBadge,
    getPlannedAvailability,
    getTruncatedNotes,
  } from './utils';

  import type { HierarchyLabels } from '$lib/types/hierarchy-labels';
  import type { Admin } from './types';

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    admin: Admin;
    labels?: HierarchyLabels;
    currentUserId?: number;
    onedit: (adminId: number) => void;
    onavailability: (adminId: number) => void;
    onpermission: (uuid: string) => void;
    ondelete: (adminId: number) => void;
  }

  const {
    admin,
    labels = DEFAULT_HIERARCHY_LABELS,
    currentUserId = 0,
    onedit,
    onavailability,
    onpermission,
    ondelete,
  }: Props = $props();

  const isSelf = $derived(admin.id === currentUserId);

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const hasProfilePicture = $derived(
    admin.profilePicture !== null &&
      admin.profilePicture !== undefined &&
      admin.profilePicture !== '',
  );
  const areasBadge = $derived(getAreasBadge(admin, labels));
  const deptsBadge = $derived(getDepartmentsBadge(admin, labels));
  const teamsBadge = $derived(getTeamsBadge(admin, labels));
  const availabilityBadge = $derived(getAvailabilityBadge(admin));
  const plannedAvailability = $derived(getPlannedAvailability(admin));
  const notes = $derived(getTruncatedNotes(admin.availabilityNotes));
</script>

<tr>
  <td><code class="text-muted">{admin.id}</code></td>
  <td>
    <div class="flex items-center gap-2">
      <div
        class="avatar avatar--sm {hasProfilePicture ? '' : (
          `avatar--color-${getAvatarColor(admin.id)}`
        )}"
      >
        {#if hasProfilePicture}
          <img
            src={getProfilePictureUrl(admin.profilePicture)}
            alt="{admin.firstName} {admin.lastName}"
            class="avatar__image"
          />
        {:else}
          <span class="avatar__initials"
            >{admin.firstName.charAt(0)}{admin.lastName.charAt(0)}</span
          >
        {/if}
      </div>
      <span>{admin.firstName} {admin.lastName}</span>
    </div>
  </td>
  <td>{admin.email}</td>
  <td>{admin.employeeNumber ?? '-'}</td>
  <td>{getPositionDisplay(admin.position ?? '', labels)}</td>
  <td>
    <span class="badge {getStatusBadgeClass(admin.isActive)}"
      >{getStatusLabel(admin.isActive)}</span
    >
  </td>
  <td>
    <span
      class="badge {areasBadge.class}"
      title={areasBadge.title}
    >
      {#if areasBadge.icon}<i class="fas {areasBadge.icon} mr-1"></i>{/if}
      {areasBadge.text}
    </span>
  </td>
  <td>
    <span
      class="badge {deptsBadge.class}"
      title={deptsBadge.title}
    >
      {#if deptsBadge.icon}<i class="fas {deptsBadge.icon} mr-1"></i>{/if}
      {deptsBadge.text}
    </span>
  </td>
  <td>
    <span
      class="badge {teamsBadge.class}"
      title={teamsBadge.title}
    >
      {#if teamsBadge.icon}<i class="fas {teamsBadge.icon} mr-1"></i>{/if}
      {teamsBadge.text}
    </span>
  </td>
  <td>
    <span class="badge {availabilityBadge.class}">
      {#if availabilityBadge.icon}<i class="fas {availabilityBadge.icon} mr-1"
        ></i>{/if}
      {availabilityBadge.text}
    </span>
  </td>
  <td>{plannedAvailability}</td>
  <td title={notes.title}>{notes.text}</td>
  <td>
    {#if isSelf}
      <div class="u-text-center">
        <span class="u-fs-11 text-(--color-text-secondary)">n/a</span>
      </div>
    {:else}
      <div class="flex gap-2">
        <button
          type="button"
          class="action-icon action-icon--edit"
          title="Bearbeiten"
          aria-label="Admin bearbeiten"
          onclick={() => {
            onedit(admin.id);
          }}
        >
          <i class="fas fa-edit"></i>
        </button>
        <button
          type="button"
          class="action-icon action-icon--info"
          title="Verfügbarkeit bearbeiten"
          aria-label="Verfügbarkeit bearbeiten"
          onclick={() => {
            onavailability(admin.id);
          }}
        >
          <i class="fas fa-calendar-alt"></i>
        </button>
        <button
          type="button"
          class="action-icon action-icon--info"
          title="Berechtigungen"
          aria-label="Berechtigungen verwalten"
          onclick={() => {
            onpermission(admin.uuid);
          }}
        >
          <i class="fas fa-shield-alt"></i>
        </button>
        <button
          type="button"
          class="action-icon action-icon--delete"
          title="Löschen"
          aria-label="Admin löschen"
          onclick={() => {
            ondelete(admin.id);
          }}
        >
          <i class="fas fa-trash"></i>
        </button>
      </div>
    {/if}
  </td>
</tr>

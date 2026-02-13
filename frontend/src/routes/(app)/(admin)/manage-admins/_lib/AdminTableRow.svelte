<script lang="ts">
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

  import type { Admin } from './types';

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    admin: Admin;
    onedit: (adminId: number) => void;
    onavailability: (adminId: number) => void;
    onpermission: (uuid: string) => void;
    ondelete: (adminId: number) => void;
  }

  const { admin, onedit, onavailability, onpermission, ondelete }: Props =
    $props();

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const hasProfilePicture = $derived(
    admin.profilePicture !== null &&
      admin.profilePicture !== undefined &&
      admin.profilePicture !== '',
  );
  const areasBadge = $derived(getAreasBadge(admin));
  const deptsBadge = $derived(getDepartmentsBadge(admin));
  const teamsBadge = $derived(getTeamsBadge(admin));
  const availabilityBadge = $derived(getAvailabilityBadge(admin));
  const plannedAvailability = $derived(getPlannedAvailability(admin));
  const notes = $derived(getTruncatedNotes(admin.availabilityNotes));
</script>

<tr>
  <td>{admin.id}</td>
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
  <td>{getPositionDisplay(admin.position ?? '')}</td>
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
        <i class="fas fa-cog"></i>
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
  </td>
</tr>

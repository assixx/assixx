<script lang="ts">
  import {
    DEFAULT_HIERARCHY_LABELS,
    resolvePositionDisplay,
  } from '$lib/types/hierarchy-labels';

  import {
    getStatusBadgeClass,
    getStatusLabel,
    getAvatarColor,
    getTeamsBadge,
    getAvailabilityBadge,
    getAreasBadge,
    getDepartmentsBadge,
    getPlannedAvailability,
    getTruncatedNotes,
  } from './utils';

  import type { HierarchyLabels } from '$lib/types/hierarchy-labels';
  import type { Employee } from './types';

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    employee: Employee;
    labels?: HierarchyLabels;
    onedit: (employeeId: number) => void;
    onavailability: (employeeId: number) => void;
    onpermission: (uuid: string) => void;
    ondelete: (employeeId: number) => void;
  }

  const {
    employee,
    labels = DEFAULT_HIERARCHY_LABELS,
    onedit,
    onavailability,
    onpermission,
    ondelete,
  }: Props = $props();

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const teamsBadge = $derived(getTeamsBadge(employee, labels));
  const areasBadge = $derived(getAreasBadge(employee, labels));
  const departmentsBadge = $derived(getDepartmentsBadge(employee, labels));
  const availabilityBadge = $derived(getAvailabilityBadge(employee));
  const plannedAvailability = $derived(getPlannedAvailability(employee));
  const notes = $derived(getTruncatedNotes(employee.availabilityNotes));
</script>

<tr>
  <td><code class="text-muted">{employee.id}</code></td>
  <td>
    <div class="flex items-center gap-2">
      <div
        class="avatar avatar--sm avatar--color-{getAvatarColor(employee.id)}"
      >
        <span>{employee.firstName.charAt(0)}{employee.lastName.charAt(0)}</span>
      </div>
      <span>{employee.firstName} {employee.lastName}</span>
    </div>
  </td>
  <td>{employee.email}</td>
  <td>{resolvePositionDisplay(employee.position ?? '', labels)}</td>
  <td>{employee.employeeNumber ?? '-'}</td>
  <td>
    <span class="badge {getStatusBadgeClass(employee.isActive)}"
      >{getStatusLabel(employee.isActive)}</span
    >
  </td>
  <td>
    <span
      class="badge {areasBadge.class}"
      title={areasBadge.title}
    >
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- Safe: internal badge text, no user input -->
      {@html areasBadge.text}
    </span>
  </td>
  <td>
    <span
      class="badge {departmentsBadge.class}"
      title={departmentsBadge.title}
    >
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- Safe: internal badge text, no user input -->
      {@html departmentsBadge.text}
    </span>
  </td>
  <td>
    <span
      class="badge {teamsBadge.class}"
      title={teamsBadge.title}
    >
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
        aria-label="Mitarbeiter bearbeiten"
        onclick={() => {
          onedit(employee.id);
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
          onavailability(employee.id);
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
          onpermission(employee.uuid);
        }}
      >
        <i class="fas fa-cog"></i>
      </button>
      <button
        type="button"
        class="action-icon action-icon--delete"
        title="Löschen"
        aria-label="Mitarbeiter löschen"
        onclick={() => {
          ondelete(employee.id);
        }}
      >
        <i class="fas fa-trash"></i>
      </button>
    </div>
  </td>
</tr>

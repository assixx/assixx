<script lang="ts">
  import type { Employee } from './types';
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

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    employee: Employee;
    onedit: (employeeId: number) => void;
    ondelete: (employeeId: number) => void;
  }

  const { employee, onedit, ondelete }: Props = $props();

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const teamsBadge = $derived(getTeamsBadge(employee));
  const areasBadge = $derived(getAreasBadge(employee));
  const departmentsBadge = $derived(getDepartmentsBadge(employee));
  const availabilityBadge = $derived(getAvailabilityBadge(employee));
  const plannedAvailability = $derived(getPlannedAvailability(employee));
  const notes = $derived(getTruncatedNotes(employee.availabilityNotes));
</script>

<tr>
  <td>{employee.id}</td>
  <td>
    <div class="flex items-center gap-2">
      <div class="avatar avatar--sm avatar--color-{getAvatarColor(employee.id)}">
        <span>{employee.firstName.charAt(0)}{employee.lastName.charAt(0)}</span>
      </div>
      <span>{employee.firstName} {employee.lastName}</span>
    </div>
  </td>
  <td>{employee.email}</td>
  <td>{employee.position ?? '-'}</td>
  <td>{employee.employeeNumber ?? '-'}</td>
  <td>
    <span class="badge {getStatusBadgeClass(employee.isActive)}"
      >{getStatusLabel(employee.isActive)}</span
    >
  </td>
  <td>
    <span class="badge {areasBadge.class}" title={areasBadge.title}>
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html areasBadge.text}
    </span>
  </td>
  <td>
    <span class="badge {departmentsBadge.class}" title={departmentsBadge.title}>
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html departmentsBadge.text}
    </span>
  </td>
  <td>
    <span class="badge {teamsBadge.class}" title={teamsBadge.title}>
      {teamsBadge.text}
    </span>
  </td>
  <td>
    <span class="badge {availabilityBadge.class}">{availabilityBadge.text}</span>
  </td>
  <td>{plannedAvailability}</td>
  <td title={notes.title}>{notes.text}</td>
  <td>
    <div class="flex gap-2">
      <button
        class="action-icon action-icon--edit"
        title="Bearbeiten"
        aria-label="Mitarbeiter bearbeiten"
        onclick={() => onedit(employee.id)}
      >
        <i class="fas fa-edit"></i>
      </button>
      <button
        class="action-icon action-icon--delete"
        title="Löschen"
        aria-label="Mitarbeiter löschen"
        onclick={() => ondelete(employee.id)}
      >
        <i class="fas fa-trash"></i>
      </button>
    </div>
  </td>
</tr>

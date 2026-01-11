<!--
  EmployeeSidebar.svelte
  Sidebar showing available employees for drag-and-drop to shift cells
  Extracted from +page.svelte for maintainability
-->
<script lang="ts">
  import { AVAILABILITY_ICONS, AVAILABILITY_LABELS, AVAILABILITY_COLORS } from './constants';
  import { getEmployeeDisplayName, getEffectiveAvailabilityForWeek } from './utils';

  import type { Employee } from './types';

  /**
   * Props interface for EmployeeSidebar
   */
  interface Props {
    employees: Employee[];
    weekDates: Date[];
    canEditShifts: boolean;
    isEditMode: boolean;
    currentPlanId: number | null;
    hasRotationHistory: boolean;

    // Event handlers
    ondragstart: (event: DragEvent, employeeId: number) => void;
    ondragend: () => void;
  }

  const {
    employees,
    weekDates,
    canEditShifts,
    isEditMode,
    currentPlanId,
    hasRotationHistory,
    ondragstart,
    ondragend,
  }: Props = $props();

  // Check if employee item should be locked
  // Only locked when NOT in edit mode (rotation or plan exists)
  function isLocked(): boolean {
    if (isEditMode) return false; // Edit mode always unlocks
    return currentPlanId !== null || hasRotationHistory;
  }

  // Check if employee is draggable
  function isDraggable(): boolean {
    if (!canEditShifts) return false;
    if (isEditMode) return true; // Edit mode always allows drag
    return currentPlanId === null && !hasRotationHistory;
  }
</script>

<div class="employee-sidebar">
  <h3 class="shift-sidebar-title">Verfügbare Mitarbeiter</h3>
  <div class="employee-list">
    {#each employees as employee (employee.id)}
      {@const availabilityStatus = getEffectiveAvailabilityForWeek(employee, weekDates)}
      <div
        class="employee-item"
        class:unavailable={availabilityStatus !== 'available'}
        class:locked={isLocked()}
        data-employee-id={employee.id}
        data-employee-name={getEmployeeDisplayName(employee)}
        draggable={isDraggable()}
        ondragstart={(e) => {
          ondragstart(e, employee.id);
        }}
        {ondragend}
        role="listitem"
      >
        <div class="employee-info">
          <span class="employee-name">{getEmployeeDisplayName(employee)}</span>
          {#if availabilityStatus !== 'available'}
            <span class="availability-badge {AVAILABILITY_COLORS[availabilityStatus]}">
              <i class="fas {AVAILABILITY_ICONS[availabilityStatus]}"></i>
              {AVAILABILITY_LABELS[availabilityStatus]}
            </span>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

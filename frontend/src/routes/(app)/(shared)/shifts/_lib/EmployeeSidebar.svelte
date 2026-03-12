<!--
  EmployeeSidebar.svelte
  Sidebar showing available employees for drag-and-drop to shift cells
  Extracted from +page.svelte for maintainability
-->
<script lang="ts">
  import { resolve } from '$app/paths';

  import {
    AVAILABILITY_ICONS,
    AVAILABILITY_LABELS,
    AVAILABILITY_COLORS,
  } from './constants';
  import {
    getEmployeeDisplayName,
    getEffectiveAvailabilityForWeek,
    getOverlappingUnavailabilities,
    formatAvailabilityPeriod,
  } from './utils';

  import type { HierarchyLabels } from '$lib/types/hierarchy-labels';
  import type { Employee } from './types';

  /**
   * Props interface for EmployeeSidebar
   */
  interface Props {
    /** Dynamic hierarchy labels from layout */
    labels: HierarchyLabels;
    employees: Employee[];
    weekDates: Date[];
    canEditShifts: boolean;
    isEditMode: boolean;
    currentPlanId: number | null;
    hasRotationHistory: boolean;
    minStaffCount: number | null;

    // Event handlers
    ondragstart: (event: DragEvent, employeeId: number) => void;
    ondragend: () => void;
  }

  const {
    labels,
    employees,
    weekDates,
    canEditShifts,
    isEditMode,
    currentPlanId,
    hasRotationHistory,
    minStaffCount,
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
  {#if minStaffCount !== null}
    <div class="mt-2 mb-2 flex items-center gap-2">
      <span
        class="badge badge--warning"
        title={`Mindestbesetzung für diese ${labels.asset}`}
      >
        <i class="fas fa-hard-hat"></i>
        Mindestbesetzung: {minStaffCount}
      </span>
      <a
        href={`${resolve('/vacation/rules', {})}?tab=staffing-rules`}
        class="action-icon action-icon--edit"
        title="Besetzungsregeln bearbeiten"
      >
        <i class="fas fa-edit"></i>
      </a>
    </div>
  {/if}
  <div class="employee-list">
    {#each employees as employee (employee.id)}
      {@const isFullyUnavailable =
        getEffectiveAvailabilityForWeek(employee, weekDates) !== 'available'}
      {@const overlappingEntries = getOverlappingUnavailabilities(
        employee,
        weekDates,
      )}
      <div
        class="employee-item"
        class:unavailable={isFullyUnavailable}
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
          {#each overlappingEntries as entry, idx (idx)}
            {@const period = formatAvailabilityPeriod(
              entry.startDate,
              entry.endDate,
            )}
            <span
              class="availability-badge {AVAILABILITY_COLORS[entry.status]}"
            >
              <i class="fas {AVAILABILITY_ICONS[entry.status]}"></i>
              {AVAILABILITY_LABELS[entry.status]}
            </span>
            {#if period}
              <span class="availability-period">{period}</span>
            {/if}
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .employee-sidebar {
    border: var(--glass-border);
    border-radius: var(--radius-xl);

    background: var(--glass-bg);
    padding: var(--spacing-6);
  }

  .shift-sidebar-title {
    margin-bottom: var(--spacing-6);
    color: var(--color-text-primary);
    font-weight: 500;

    font-size: 17px;
    text-align: center;
  }

  .employee-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .employee-item {
    cursor: grab;

    margin: 5px 0;
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);

    background: var(--glass-bg-active);
    padding: 8px 12px;
    user-select: none;
  }

  .employee-item:hover {
    transform: translateX(2px);
    background: var(--glass-bg-active);
  }

  .employee-item.dragging {
    opacity: 50%;
    cursor: grabbing;
  }

  .employee-item.unavailable {
    opacity: 70%;
    cursor: not-allowed;
  }

  .employee-item.status-vacation {
    border-left: 3px solid var(--color-amber);
    background: oklch(84.42% 0.1721 84.94 / 10%);
  }

  .employee-item.status-sick {
    border-left: 3px solid var(--color-crimson);
    background: oklch(59.16% 0.202 21.23 / 10%);
  }

  .employee-item.status-unavailable {
    border-left: 3px solid var(--color-slate);
    background: oklch(55.75% 0.0165 244.95 / 10%);
  }

  .employee-item[draggable='false'] {
    user-select: none;

    -webkit-user-drag: none;
  }

  .employee-item[draggable='false']:hover {
    cursor: not-allowed;
  }

  .employee-item.locked {
    opacity: 75%;
    cursor: not-allowed;

    -webkit-user-drag: none;
  }

  .employee-item.locked:hover {
    transform: none;
    cursor: not-allowed;
    box-shadow: none;
    background: inherit;
  }

  .employee-info {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 6px;
  }

  .employee-info .employee-name {
    color: var(--text-primary);
    font-weight: 600;
    font-size: 14px;
  }

  .employee-info .badge {
    display: inline-flex;
    align-items: center;
    margin-top: 2px;
    border-radius: 4px;
    padding: 2px 6px;

    width: fit-content;
    font-weight: 600;

    font-size: 10px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .employee-info .badge-success {
    border: 1px solid color-mix(in oklch, var(--color-success) 30%, transparent);
    background: color-mix(in oklch, var(--color-success) 15%, transparent);
    color: color-mix(in oklch, var(--color-success) 95%, transparent);
  }

  .employee-info .badge-warning {
    border: 1px solid oklch(84.42% 0.1721 84.94 / 30%);
    background: oklch(84.42% 0.1721 84.94 / 15%);
    color: oklch(84.42% 0.1721 84.94 / 95%);
  }

  .employee-info .badge-danger {
    border: 1px solid oklch(59.16% 0.202 21.23 / 30%);
    background: oklch(59.16% 0.202 21.23 / 15%);
    color: oklch(59.16% 0.202 21.23 / 95%);
  }

  .employee-info .badge-secondary {
    border: 1px solid oklch(55.75% 0.0165 244.95 / 30%);
    background: oklch(55.75% 0.0165 244.95 / 15%);
    color: oklch(55.75% 0.0165 244.95 / 95%);
  }

  .status-icon {
    margin-left: 8px;
    font-size: 14px;
  }

  .employee-info .status-icon {
    margin-left: 8px;
    font-size: 12px;
  }

  .status-icon.vacation {
    color: var(--color-amber);
  }

  .status-icon.sick {
    color: var(--color-crimson);
  }

  .status-icon.unavailable {
    color: var(--color-slate);
  }

  .availability-badge {
    font-size: 0.7rem;
    padding: 0.125rem 0.5rem;
    border-radius: 10px;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    width: fit-content;
  }

  .availability-badge.badge--warning {
    background: oklch(84.42% 0.1721 84.94 / 20%);
    color: var(--color-amber);
  }

  .availability-badge.badge--danger {
    background: oklch(63.07% 0.194 29.43 / 20%);
    color: var(--color-alizarin);
  }

  .availability-badge.badge--error {
    background: oklch(54.34% 0.174 29.69 / 20%);
    color: var(--color-alizarin-hover);
  }

  .availability-badge.badge--info {
    background: oklch(65.31% 0.1348 242.7 / 20%);
    color: var(--color-sky);
  }

  .availability-badge.badge--dark {
    background: oklch(70.97% 0.0181 201.48 / 20%);
    color: var(--color-concrete);
  }

  .availability-period {
    font-size: 0.65rem;
    color: var(--color-text-secondary);
    white-space: nowrap;
    margin-left: 0.25rem;
  }

  :global(html:not(.dark)) .availability-badge.badge--warning {
    color: var(--color-bronze);
  }

  :global(html:not(.dark)) .availability-badge.badge--danger {
    color: var(--color-status-active);
  }

  :global(html:not(.dark)) .availability-badge.badge--error {
    color: var(--color-brick);
  }

  :global(html:not(.dark)) .availability-badge.badge--info {
    color: var(--color-primary-dark);
  }

  :global(html:not(.dark)) .availability-badge.badge--dark {
    color: var(--color-blue-grey-dark);
  }

  @media (width < 1024px) {
    .employee-sidebar {
      max-height: 200px;
    }

    .employee-list {
      flex-flow: row wrap;
    }

    .employee-item {
      flex: 0 0 auto;
    }
  }
</style>

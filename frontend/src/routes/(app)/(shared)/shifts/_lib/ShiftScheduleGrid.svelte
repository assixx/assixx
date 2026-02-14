<!--
  ShiftScheduleGrid.svelte
  The main shift planning grid with days, shifts, and employee assignments
  Extracted from +page.svelte for maintainability
-->
<script lang="ts">
  import {
    MACHINE_AVAILABILITY_ICONS,
    MACHINE_AVAILABILITY_LABELS,
    type MachineAvailabilityStatus,
  } from '$lib/machine-availability/constants';

  import { FULL_DAY_NAMES, SHIFT_TYPES, SHIFT_TIMES } from './constants';
  import { formatDate, getEmployeeDisplayName } from './utils';

  import type { Employee, ShiftDetailData } from './types';

  /** Machine availability statuses that should be shown in the legend */
  const LEGEND_STATUSES: MachineAvailabilityStatus[] = [
    'maintenance',
    'repair',
    'standby',
    'cleaning',
    'other',
  ];

  /**
   * Props interface for ShiftScheduleGrid
   */
  interface Props {
    weekDates: Date[];
    weeklyNotes: string;
    canEditShifts: boolean;
    isEditMode: boolean;
    currentPlanId: number | null;

    /** Machine availability: date (YYYY-MM-DD) → status string */
    machineAvailabilityMap: Map<string, string>;

    // Data access callbacks
    getShiftEmployees: (dateKey: string, shiftType: string) => number[];
    getEmployeeById: (id: number) => Employee | undefined;
    getShiftDetail: (key: string) => ShiftDetailData | undefined;
    hasRotationShift: (key: string) => boolean;

    // Event handlers
    ondragover: (event: DragEvent) => void;
    ondragenter: (event: DragEvent) => void;
    ondragleave: (event: DragEvent) => void;
    ondrop: (event: DragEvent, dateKey: string, shiftType: string) => void;
    onremoveEmployee: (
      dateKey: string,
      shiftType: string,
      employeeId: number,
    ) => void;
    onnotesChange: (notes: string) => void;
  }

  const {
    weekDates,
    weeklyNotes,
    canEditShifts,
    isEditMode,
    currentPlanId,
    machineAvailabilityMap,
    getShiftEmployees,
    getEmployeeById,
    getShiftDetail,
    hasRotationShift,
    ondragover,
    ondragenter,
    ondragleave,
    ondrop,
    onremoveEmployee,
    onnotesChange,
  }: Props = $props();

  // Day names for data attributes
  const dayNames = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];

  // Check if cell should be locked
  // Only locked when NOT in edit mode
  function isCellLocked(
    dateKey: string,
    shiftType: string,
    employeeIds: number[],
  ): boolean {
    if (isEditMode) return false; // Edit mode always unlocks
    if (currentPlanId !== null) return true;
    // Locked if any employee in this cell has rotation shifts (and not in edit mode)
    return employeeIds.some((empId) =>
      hasRotationShift(`${dateKey}_${shiftType}_${empId}`),
    );
  }

  // Check if remove button should be shown for an employee
  function canRemoveEmployee(
    dateKey: string,
    shiftType: string,
    empId: number,
  ): boolean {
    if (!canEditShifts) return false;
    if (isEditMode) return true; // Edit mode allows removing
    if (currentPlanId !== null) return false;
    return !hasRotationShift(`${dateKey}_${shiftType}_${empId}`);
  }

  /** Get machine availability CSS class for a date (empty string if operational/none) */
  function getMachineAvailClass(dateKey: string): string {
    const status = machineAvailabilityMap.get(dateKey);
    if (status === undefined) return '';
    return `machine-avail-${status}`;
  }
</script>

<div class="week-schedule">
  <!-- Machine Availability Legend (always visible) -->
  <div class="machine-avail-legend">
    <span class="machine-avail-legend-title">
      <i class="fas fa-cogs"></i> Maschinenverfügbarkeit
    </span>
    <div class="machine-avail-legend-items">
      {#each LEGEND_STATUSES as status (status)}
        <div class="machine-avail-legend-item">
          <div class="machine-avail-legend-swatch legend-{status}"></div>
          <i class="fas {MACHINE_AVAILABILITY_ICONS[status]}"></i>
          <span class="machine-avail-legend-label"
            >{MACHINE_AVAILABILITY_LABELS[status]}</span
          >
        </div>
      {/each}
    </div>
  </div>

  <!-- Schedule Header -->
  <div class="schedule-header">
    <div class="day-header">Schicht</div>
    {#each weekDates as date, i (i)}
      {@const day = date.getDate().toString().padStart(2, '0')}
      {@const month = (date.getMonth() + 1).toString().padStart(2, '0')}
      <div class="day-header">
        {FULL_DAY_NAMES[i]}<br />
        <span class="u-fs-12 u-fw-400">{day}.{month}</span>
      </div>
    {/each}
  </div>

  <!-- Shift Rows -->
  {#each SHIFT_TYPES as shiftType (shiftType)}
    <div class="shift-row">
      <div class="shift-label shift-type-{shiftType}">
        {SHIFT_TIMES[shiftType].label}<br />
        <span class="u-fs-11"
          >{SHIFT_TIMES[shiftType].start}-{SHIFT_TIMES[shiftType].end}</span
        >
      </div>

      {#each weekDates as date, dayIndex (formatDate(date))}
        {@const dateKey = formatDate(date)}
        {@const employeeIds = getShiftEmployees(dateKey, shiftType)}
        {@const availStatus = machineAvailabilityMap.get(dateKey)}
        <div
          class="shift-cell {getMachineAvailClass(dateKey)}"
          class:locked={isCellLocked(dateKey, shiftType, employeeIds)}
          data-day={dayNames[dayIndex]}
          data-shift={shiftType}
          data-date={dateKey}
          {ondragover}
          {ondragenter}
          {ondragleave}
          ondrop={(e) => {
            ondrop(e, dateKey, shiftType);
          }}
          role="gridcell"
          tabindex="0"
        >
          <!-- Machine availability indicator icon -->
          {#if availStatus !== undefined}
            {@const statusKey = availStatus as MachineAvailabilityStatus}
            <div
              class="machine-avail-indicator avail-{availStatus}"
              title={MACHINE_AVAILABILITY_LABELS[statusKey]}
            >
              <i class="fas {MACHINE_AVAILABILITY_ICONS[statusKey]}"></i>
            </div>
          {/if}

          <div class="employee-assignment">
            {#if employeeIds.length === 0}
              <!-- Show "+" for admins/editors, "-" for employees (readonly) -->
              <div class="empty-slot">{canEditShifts ? '+' : '-'}</div>
            {:else}
              {#each employeeIds as empId (empId)}
                {@const emp = getEmployeeById(empId)}
                {@const detail = getShiftDetail(
                  `${dateKey}_${shiftType}_${empId}`,
                )}
                <div class="employee-card">
                  <span class="employee-name">
                    {#if emp !== undefined}
                      {getEmployeeDisplayName(emp)}
                    {:else if detail !== undefined}
                      {detail.firstName} {detail.lastName}
                    {:else}
                      Mitarbeiter #{empId}
                    {/if}
                  </span>
                  {#if canRemoveEmployee(dateKey, shiftType, empId)}
                    <button
                      type="button"
                      class="remove-btn"
                      onclick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        onremoveEmployee(dateKey, shiftType, empId);
                      }}
                      aria-label="Mitarbeiter entfernen"
                    >
                      <i class="fas fa-times"></i>
                    </button>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/each}

  <!-- Info/Todo Area Row -->
  <div class="shift-row">
    <div class="shift-label shift-label-night">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path
          d="M13 9h-2V7h2m0 10h-2v-6h2m-1-9A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2z"
        ></path>
      </svg>
      <span class="shift-name">Info & Todo</span>
      <span class="shift-time">Wochennotizen</span>
    </div>
    <div class="shift-info-area shift-info-area-full">
      <div class="shift-info-title">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path
            d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"
          ></path>
        </svg>
        Notizen & Todos für diese Woche
      </div>
      <textarea
        class="shift-info-textarea"
        placeholder="Hier können wichtige Informationen, Todos oder Anmerkungen für diese Woche eingetragen werden...

Beispiele:
• Wartung Anlage 01 am Mittwoch geplant
• Neue Sicherheitsbestimmungen beachten
• Team-Meeting Freitag 14:00 Uhr
• Überstunden-Genehmigung für Donnerstag"
        value={weeklyNotes}
        oninput={(e) => {
          onnotesChange((e.target as HTMLTextAreaElement).value);
        }}
        disabled={!canEditShifts || (currentPlanId !== null && !isEditMode)}
      ></textarea>
    </div>
  </div>
</div>

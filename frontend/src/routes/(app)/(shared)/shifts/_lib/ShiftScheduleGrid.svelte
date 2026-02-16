<!--
  ShiftScheduleGrid.svelte
  The main shift planning grid with days, shifts, and employee assignments
  Extracted from +page.svelte for maintainability
-->
<script lang="ts">
  import {
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
          <!-- Machine availability dot -->
          {#if availStatus !== undefined}
            {@const statusKey = availStatus as MachineAvailabilityStatus}
            <span
              class="machine-avail-dot avail-{availStatus}"
              title={MACHINE_AVAILABILITY_LABELS[statusKey]}
            ></span>
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

<style>
  .week-schedule {
    box-shadow: var(--shadow-sm);
    border: var(--glass-border);
    border-radius: var(--radius-xl);

    padding: 10px;
    overflow: hidden;
  }

  .schedule-header {
    display: grid;
    grid-template-columns: 120px repeat(7, 1fr);
    gap: 2px;

    padding-top: 10px;
    padding-bottom: 10px;
    color: var(--text-primary);

    font-weight: 600;
  }

  .day-header {
    backdrop-filter: blur(5px);
    border: var(--glass-border);
    border-radius: var(--radius-xl);

    background: var(--glass-bg-hover);
    padding: var(--spacing-4) var(--spacing-1);

    color: var(--primary-color);
    text-align: center;
  }

  .shift-row {
    display: grid;
    grid-template-columns: 120px repeat(7, 1fr);
    gap: 2px;

    background: transparent;

    padding-top: 2px;
    padding-bottom: 2px;
  }

  .shift-label {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(5px);
    border: var(--glass-border);
    border-radius: var(--radius-xl);

    background: var(--glass-bg-hover);
    padding: var(--spacing-3);

    min-height: 85px;
    color: var(--text-primary);
    font-weight: 600;

    font-size: 13px;
    text-align: center;
  }

  .shift-type-early {
    background: linear-gradient(
      135deg,
      rgb(255 193 7 / 15%) 0%,
      rgb(255 152 0 / 10%) 100%
    );
  }

  .shift-type-late {
    background: linear-gradient(
      135deg,
      rgb(33 150 243 / 15%) 0%,
      rgb(3 169 244 / 10%) 100%
    );
  }

  .shift-type-night {
    background: linear-gradient(
      135deg,
      rgb(156 39 176 / 15%) 0%,
      rgb(103 58 183 / 10%) 100%
    );
  }

  .shift-label-night {
    background: #b3b8bc4a;
  }

  .shift-cell {
    position: relative;
    backdrop-filter: blur(5px);
    cursor: pointer;
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);

    background: var(--glass-bg);

    min-height: 85px;
  }

  .shift-cell:hover {
    box-shadow: var(--shadow-sm);
    border-color: var(--primary-color);
    background: rgb(33 150 243 / 10%);
  }

  .shift-cell.assigned {
    border-color: var(--success-color);
    background: rgb(76 175 80 / 15%);
  }

  .shift-cell.drag-over {
    box-shadow: 0 0 0 2px rgb(76 175 80 / 30%);
    border-color: var(--success-color);
    background: rgb(76 175 80 / 20%);
  }

  .shift-cell.locked {
    cursor: not-allowed;
    border-color: var(--color-glass-border);
    background:
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 10px,
        var(--glass-bg-hover) 10px,
        var(--glass-bg-hover) 20px
      ),
      var(--glass-bg);
  }

  .shift-cell.locked:hover {
    cursor: not-allowed;
    box-shadow: none;
    border-color: var(--color-glass-border);
    background:
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 10px,
        var(--glass-bg-hover) 10px,
        var(--glass-bg-hover) 20px
      ),
      var(--glass-bg);
  }

  .shift-cell.locked .remove-btn {
    display: none !important;
  }

  .shift-cell.locked .employee-card {
    pointer-events: none;
  }

  .shift-cell.machine-avail-maintenance {
    border-top: 3px solid #ffc107;
  }

  .shift-cell.machine-avail-repair {
    border-top: 3px solid #dc3545;
  }

  .shift-cell.machine-avail-standby {
    border-top: 3px solid #3498db;
  }

  .shift-cell.machine-avail-cleaning {
    border-top: 3px solid #20c997;
  }

  .shift-cell.machine-avail-other {
    border-top: 3px solid #6f42c1;
  }

  .machine-avail-dot {
    position: absolute;
    top: 3px;
    right: 3px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .machine-avail-legend {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    backdrop-filter: blur(10px);

    margin-bottom: var(--spacing-4);
    border: var(--glass-border);
    border-radius: var(--radius-xl);

    background: var(--glass-bg);
    padding: var(--spacing-3) var(--spacing-4);
  }

  .machine-avail-legend-title {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);

    color: var(--text-secondary);
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.3px;
    text-transform: uppercase;
  }

  .machine-avail-legend-title i {
    color: var(--text-tertiary);
    font-size: 16px;
  }

  .machine-avail-legend-items {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-4);
  }

  .machine-avail-legend-item {
    display: flex;
    align-items: center;
    gap: 8px;

    font-size: 14px;
  }

  .machine-avail-legend-swatch {
    border-radius: 50%;
    width: 14px;
    height: 14px;

    box-shadow: 0 0 4px rgb(0 0 0 / 20%);
  }

  .machine-avail-legend-swatch.legend-maintenance {
    background: #ffc107;
  }

  .machine-avail-legend-swatch.legend-repair {
    background: #dc3545;
  }

  .machine-avail-legend-swatch.legend-standby {
    background: #3498db;
  }

  .machine-avail-legend-swatch.legend-cleaning {
    background: #20c997;
  }

  .machine-avail-legend-swatch.legend-other {
    background: #6f42c1;
  }

  .machine-avail-legend-label {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .shift-cell.week-2-cell {
    backdrop-filter: blur(5px);
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);

    background: var(--glass-bg);
    min-height: 85px;
  }

  .employee-assignment {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: var(--spacing-1);

    height: 100%;

    text-align: center;
  }

  .employee-name {
    padding: 5px;
    color: var(--text-primary);
    font-weight: 600;
    font-size: 14px;
  }

  .empty-slot {
    color: var(--text-secondary);
    font-style: italic;
    font-size: 12px;
  }

  .shift-info-area {
    display: flex;
    flex-direction: column;
    backdrop-filter: blur(10px);
    margin-top: 2px;
    box-shadow: inset 0 1px 0 var(--color-glass-border);
    border: var(--glass-border);
    border-radius: var(--radius-xl);

    background: var(--glass-bg);
    padding: var(--spacing-3);

    min-height: 120px;
  }

  .shift-info-area-full {
    grid-column: 2 / -1;
  }

  .shift-info-title {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);

    margin-bottom: var(--spacing-2);
    color: var(--primary-color);
    font-weight: 600;

    font-size: 14px;
  }

  .shift-info-textarea {
    flex: 1;
    backdrop-filter: blur(5px);
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);

    background: var(--glass-bg-hover);
    padding: var(--spacing-3);

    min-height: 300px;
    resize: vertical;
    color: var(--text-primary);
    font-size: 13px;

    font-family: inherit;
  }

  .shift-info-textarea:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgb(33 150 243 / 10%);
    border-color: var(--primary-color);
  }

  .shift-info-textarea::placeholder {
    color: var(--color-text-placeholder);
  }

  .employee-card {
    display: flex;
    position: relative;
    flex-direction: column;
    gap: 2px;

    margin: 2px 0;
    border: 1px solid rgb(33 150 243 / 30%);
    border-radius: var(--radius-xl);

    background: rgb(33 150 243 / 15%);
    padding: 6px 8px;
  }

  .employee-card:hover {
    border-color: rgb(33 150 243 / 50%);
    background: rgb(33 150 243 / 25%);
  }

  .employee-card .employee-name {
    padding: 5px;
    color: var(--text-primary);
    font-weight: 600;
    font-size: 14px;
  }

  .employee-card .employee-position {
    color: var(--text-secondary);
    font-size: 11px;
    line-height: 1.2;
  }

  .employee-card .remove-btn {
    display: flex;

    position: absolute;
    top: -10px;
    right: -3px;
    z-index: 10;
    justify-content: center;
    align-items: center;

    opacity: 0%;
    cursor: pointer;
    border: 2px solid rgb(244 67 54);
    border-radius: 50px;
    background: rgb(244 67 54 / 10%);
    padding: 0;
    pointer-events: auto;

    width: 20px;
    height: 20px;

    color: rgb(244 67 54);
  }

  .employee-card:hover .remove-btn {
    opacity: 100%;
  }

  .employee-card .remove-btn:hover {
    transform: scale(1.2);
    border-color: rgb(244 67 54);
    background: rgb(244 67 54 / 37%);
  }

  .employee-card .remove-btn i {
    font-size: 10px;
  }

  .shift-name {
    color: var(--color-text-primary);
    font-weight: 600;
    font-size: 0.75rem;
  }

  .shift-time {
    color: var(--text-secondary);
    font-size: 11px;
  }

  .u-fs-11 {
    font-size: 11px !important;
  }

  .u-fs-12 {
    font-size: 12px !important;
  }

  .u-fw-400 {
    font-weight: 400 !important;
  }

  @media (width < 768px) {
    .shift-row {
      min-width: 800px;
    }
  }
</style>

<!--
  ShiftScheduleGrid.svelte
  The main shift planning grid with days, shifts, and employee assignments
  Extracted from +page.svelte for maintainability
-->
<script lang="ts">
  import {
    MACHINE_AVAILABILITY_LABELS,
    type AssetAvailabilityStatus,
  } from '$lib/asset-availability/constants';

  import {
    FULL_DAY_NAMES,
    INTERVAL_COLORS,
    INTERVAL_LABELS,
    INTERVAL_SHORT_LABELS,
    SHIFT_TYPES,
  } from './constants';
  import ShiftScheduleLegend from './ShiftScheduleLegend.svelte';
  import {
    formatDate,
    getEmployeeDisplayName,
    getShiftTimeInfo,
    getVisibleTpmIntervals,
  } from './utils';

  import type {
    Employee,
    IntervalColorEntry,
    ShiftDetailData,
    ShiftTimesMap,
    TpmMaintenanceEvent,
  } from './types';
  import type { Snippet } from 'svelte';

  /**
   * Props interface for ShiftScheduleGrid
   */
  interface Props {
    /** Optional snippet rendered directly after the legend bar */
    afterLegend?: Snippet | undefined;
    weekDates: Date[];
    weeklyNotes: string;
    canEditShifts: boolean;
    isEditMode: boolean;
    currentPlanId: number | null;

    /** Tenant-configurable shift times from API */
    shiftTimesMap: ShiftTimesMap;

    /** Precomputed shift minute ranges for TPM overlap */
    shiftMinutes: Record<string, [number, number][]>;

    /** Asset availability: date (YYYY-MM-DD) → status string */
    assetAvailabilityMap: Map<string, string>;

    /** TPM maintenance events: date (YYYY-MM-DD) → events for that day */
    tpmEventsMap: Map<string, TpmMaintenanceEvent[]>;

    /** Tenant-configurable TPM interval colors from API */
    intervalColors: IntervalColorEntry[];

    /** Whether TPM events toggle is active */
    showTpmEvents: boolean;

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
    afterLegend,
    weekDates,
    weeklyNotes,
    canEditShifts,
    isEditMode,
    currentPlanId,
    shiftTimesMap,
    shiftMinutes,
    assetAvailabilityMap,
    tpmEventsMap,
    intervalColors,
    showTpmEvents,
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

  /** Merge tenant DB colors over hardcoded defaults (same pattern as SlotAssistant) */
  const colorMap = $derived.by((): Record<string, string> => {
    const base: Record<string, string> = { ...INTERVAL_COLORS };
    for (const entry of intervalColors) {
      base[entry.statusKey] = entry.colorHex;
    }
    return base;
  });

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

  /** Get asset availability CSS class for a date (empty string if operational/none) */
  function getAssetAvailClass(dateKey: string): string {
    const status = assetAvailabilityMap.get(dateKey);
    if (status === undefined) return '';
    return `asset-avail-${status}`;
  }
</script>

<div class="week-schedule">
  <!-- Asset Availability Legend + TPM Toggle -->
  <ShiftScheduleLegend
    {colorMap}
    {showTpmEvents}
  />

  {#if afterLegend}
    {@render afterLegend()}
  {/if}

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
    {@const shiftInfo = getShiftTimeInfo(shiftType, shiftTimesMap)}
    <div class="shift-row">
      <div class="shift-label shift-type-{shiftType}">
        {shiftInfo.label}<br />
        <span class="u-fs-11">{shiftInfo.start}-{shiftInfo.end}</span>
      </div>

      {#each weekDates as date, dayIndex (formatDate(date))}
        {@const dateKey = formatDate(date)}
        {@const employeeIds = getShiftEmployees(dateKey, shiftType)}
        {@const availStatus = assetAvailabilityMap.get(dateKey)}
        <div
          class="shift-cell {getAssetAvailClass(dateKey)}"
          class:tpm-active={showTpmEvents}
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
          <!-- Asset availability dot -->
          {#if availStatus !== undefined}
            {@const statusKey = availStatus as AssetAvailabilityStatus}
            <span
              class="asset-avail-dot avail-{availStatus}"
              title={MACHINE_AVAILABILITY_LABELS[statusKey]}
            ></span>
          {/if}

          <!-- TPM maintenance badges -->
          {#if showTpmEvents}
            {@const tpmEvents = tpmEventsMap.get(dateKey)}
            {#if tpmEvents !== undefined}
              {#each tpmEvents as event (event.planUuid)}
                {@const visibleIntervals = getVisibleTpmIntervals(
                  event,
                  shiftType,
                  shiftMinutes,
                )}
                {#if visibleIntervals.length > 0}
                  <div
                    class="tpm-badges"
                    title="{event.planName} — {event.assetName}"
                  >
                    {#each visibleIntervals as interval (interval)}
                      <span
                        class="tpm-badge"
                        style="background: {colorMap[interval]}"
                        title="{INTERVAL_LABELS[interval]} — {event.assetName}"
                        >{INTERVAL_SHORT_LABELS[interval]}</span
                      >
                    {/each}
                  </div>
                {/if}
              {/each}
            {/if}
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
    display: flex;
    flex-direction: column;
    position: relative;
    backdrop-filter: blur(5px);
    cursor: pointer;
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);

    background: var(--glass-bg);

    min-height: 85px;
  }

  .shift-cell.tpm-active {
    padding-top: 18px;
  }

  .shift-cell:hover {
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
  }

  .shift-cell.locked .remove-btn {
    display: none !important;
  }

  .shift-cell.locked .employee-card {
    pointer-events: none;
  }

  .shift-cell.asset-avail-maintenance {
    border-top: 3px solid #ffc107;
  }

  .shift-cell.asset-avail-repair {
    border-top: 3px solid #dc3545;
  }

  .shift-cell.asset-avail-standby {
    border-top: 3px solid #3498db;
  }

  .shift-cell.asset-avail-cleaning {
    border-top: 3px solid #20c997;
  }

  .shift-cell.asset-avail-other {
    border-top: 3px solid #6f42c1;
  }

  .asset-avail-dot {
    position: absolute;
    top: 3px;
    right: 3px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  /* TPM Badges — absolute top-left, out of flow */
  .tpm-badges {
    display: flex;
    flex-wrap: wrap;
    position: absolute;
    top: 3px;
    left: 4px;
    z-index: 1;
    gap: 2px;
  }

  .tpm-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 1px 3px;
    border-radius: 2px;

    min-width: 14px;
    color: #000;
    font-weight: 700;
    font-size: 0.65rem;
    line-height: 1;
  }

  .employee-assignment {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 2px;

    text-align: center;
  }

  .employee-name {
    color: var(--text-primary);
    font-weight: 600;
    font-size: 12px;
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
    align-items: center;
    gap: 2px;

    margin: 1px 0;
    border: 1px solid rgb(33 150 243 / 30%);
    border-radius: var(--radius-lg);

    background: rgb(33 150 243 / 15%);
    padding: 3px 6px;
  }

  .employee-card:hover {
    border-color: rgb(33 150 243 / 50%);
    background: rgb(33 150 243 / 25%);
  }

  .employee-card .employee-name {
    color: var(--text-primary);
    font-weight: 600;
    font-size: 12px;
    line-height: 1.3;
  }

  .employee-card .employee-position {
    color: var(--text-secondary);
    font-size: 11px;
    line-height: 1.2;
  }

  .employee-card .remove-btn {
    display: flex;

    position: absolute;
    top: -6px;
    right: -4px;
    z-index: 10;
    justify-content: center;
    align-items: center;

    opacity: 0%;
    cursor: pointer;
    border: 1.5px solid rgb(244 67 54);
    border-radius: 50%;
    background: rgb(244 67 54 / 10%);
    padding: 0;
    pointer-events: auto;

    width: 14px;
    height: 14px;

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
    font-size: 7px;
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

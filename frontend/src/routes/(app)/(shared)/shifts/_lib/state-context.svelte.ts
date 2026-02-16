// =============================================================================
// SHIFTS STATE - CONTEXT MODULE
// Selected context (hierarchy selection), plan management, and machine availability
// =============================================================================

import type {
  MachineAvailabilityEntry,
  SelectedContext,
  RotationPatternType,
} from './types';

const DEFAULT_CONTEXT: SelectedContext = {
  areaId: null,
  departmentId: null,
  machineId: null,
  teamId: null,
  teamLeaderId: null,
};

/**
 * Build a date-to-status map from availability entries.
 * For each day covered by an entry, stores the status string.
 * If multiple entries overlap the same day, the first (earliest start_date) wins.
 */
function buildAvailabilityDateMap(
  entries: MachineAvailabilityEntry[],
): Map<string, string> {
  const dateMap = new Map<string, string>();

  for (const entry of entries) {
    if (entry.status === 'operational') continue;

    const start = new Date(entry.startDate);
    const end = new Date(entry.endDate);
    const cursor = new Date(start);

    while (cursor <= end) {
      const key = cursor.toISOString().split('T')[0] ?? '';
      if (!dateMap.has(key)) {
        dateMap.set(key, entry.status);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return dateMap;
}

/** Machine availability sub-state (date-to-status map for shift cell marking) */
function createMachineAvailabilityState() {
  let machineAvailabilityMap = $state<Map<string, string>>(new Map());

  return {
    get machineAvailabilityMap() {
      return machineAvailabilityMap;
    },
    setMachineAvailability: (entries: MachineAvailabilityEntry[]) => {
      machineAvailabilityMap = buildAvailabilityDateMap(entries);
    },
    clearMachineAvailability: () => {
      machineAvailabilityMap = new Map();
    },
    reset: () => {
      machineAvailabilityMap = new Map();
    },
  };
}

/** Plan data sub-state (planId, patternId, patternType) */
function createPlanState() {
  let currentPlanId = $state<number | null>(null);
  let currentPatternId = $state<number | null>(null);
  let currentPatternType = $state<RotationPatternType | null>(null);

  return {
    get currentPlanId() {
      return currentPlanId;
    },
    get currentPatternId() {
      return currentPatternId;
    },
    get currentPatternType() {
      return currentPatternType;
    },
    setCurrentPlanId: (id: number | null) => {
      currentPlanId = id;
    },
    setCurrentPatternId: (id: number | null) => {
      currentPatternId = id;
    },
    setCurrentPatternType: (type: RotationPatternType | null) => {
      currentPatternType = type;
    },
    clear: () => {
      currentPlanId = null;
      currentPatternId = null;
      currentPatternType = null;
    },
  };
}

function createContextState() {
  let selectedContext = $state<SelectedContext>({ ...DEFAULT_CONTEXT });
  const plan = createPlanState();
  const machineAvail = createMachineAvailabilityState();

  const setSelectedContext = (context: Partial<SelectedContext>) => {
    selectedContext = { ...selectedContext, ...context };
  };

  const isHierarchyValid = (): boolean => {
    const ctx = selectedContext;
    if (ctx.teamId !== null && ctx.teamId !== 0) {
      return ctx.departmentId !== null && ctx.departmentId !== 0;
    }
    return true;
  };

  return {
    get selectedContext() {
      return selectedContext;
    },
    get currentPlanId() {
      return plan.currentPlanId;
    },
    get currentPatternId() {
      return plan.currentPatternId;
    },
    get currentPatternType() {
      return plan.currentPatternType;
    },
    get isContextComplete() {
      return selectedContext.teamId !== null && selectedContext.teamId !== 0;
    },
    get machineAvailabilityMap() {
      return machineAvail.machineAvailabilityMap;
    },
    setSelectedContext,
    resetSelectedContext: () => {
      selectedContext = { ...DEFAULT_CONTEXT };
    },
    setCurrentPlanId: plan.setCurrentPlanId,
    setCurrentPatternId: plan.setCurrentPatternId,
    setCurrentPatternType: plan.setCurrentPatternType,
    setMachineAvailability: machineAvail.setMachineAvailability,
    clearMachineAvailability: machineAvail.clearMachineAvailability,
    isHierarchyValid,
    clearPlanData: plan.clear,
    reset: () => {
      selectedContext = { ...DEFAULT_CONTEXT };
      plan.clear();
      machineAvail.reset();
    },
  };
}

export const contextState = createContextState();

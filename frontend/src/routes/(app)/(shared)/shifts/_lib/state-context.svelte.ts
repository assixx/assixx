// =============================================================================
// SHIFTS STATE - CONTEXT MODULE
// Selected context (hierarchy selection) and plan management
// =============================================================================

import type { SelectedContext, RotationPatternType } from './types';

const DEFAULT_CONTEXT: SelectedContext = {
  areaId: null,
  departmentId: null,
  machineId: null,
  teamId: null,
  teamLeaderId: null,
};

function createContextState() {
  let selectedContext = $state<SelectedContext>({ ...DEFAULT_CONTEXT });
  let currentPlanId = $state<number | null>(null);
  let currentPatternId = $state<number | null>(null);
  let currentPatternType = $state<RotationPatternType | null>(null);

  const setSelectedContext = (context: Partial<SelectedContext>) => {
    selectedContext = { ...selectedContext, ...context };
  };

  const resetSelectedContext = () => {
    selectedContext = { ...DEFAULT_CONTEXT };
  };

  const isHierarchyValid = (): boolean => {
    const ctx = selectedContext;
    if (ctx.teamId !== null && ctx.teamId !== 0) {
      return ctx.departmentId !== null && ctx.departmentId !== 0;
    }
    return true;
  };

  const clearPlanData = () => {
    currentPlanId = null;
    currentPatternId = null;
    currentPatternType = null;
  };

  return {
    get selectedContext() {
      return selectedContext;
    },
    get currentPlanId() {
      return currentPlanId;
    },
    get currentPatternId() {
      return currentPatternId;
    },
    get currentPatternType() {
      return currentPatternType;
    },
    get isContextComplete() {
      return selectedContext.teamId !== null && selectedContext.teamId !== 0;
    },
    setSelectedContext,
    resetSelectedContext,
    setCurrentPlanId: (id: number | null) => {
      currentPlanId = id;
    },
    setCurrentPatternId: (id: number | null) => {
      currentPatternId = id;
    },
    setCurrentPatternType: (type: RotationPatternType | null) => {
      currentPatternType = type;
    },
    isHierarchyValid,
    clearPlanData,
    reset: () => {
      resetSelectedContext();
      clearPlanData();
    },
  };
}

export const contextState = createContextState();

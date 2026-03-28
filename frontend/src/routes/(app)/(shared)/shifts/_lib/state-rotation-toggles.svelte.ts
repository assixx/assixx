// =============================================================================
// SHIFTS STATE - ROTATION TOGGLES MODULE
// Rotation toggles, modals, history tracking
// =============================================================================

/** Creates rotation toggle state (standard/custom enabled) */
function createRotationToggleState() {
  let standardRotationEnabled = $state(false);
  let customRotationEnabled = $state(false);

  return {
    get standardRotationEnabled() {
      return standardRotationEnabled;
    },
    get customRotationEnabled() {
      return customRotationEnabled;
    },
    setStandardEnabledRaw: (enabled: boolean) => {
      standardRotationEnabled = enabled;
    },
    setCustomEnabledRaw: (enabled: boolean) => {
      customRotationEnabled = enabled;
    },
    resetToggles: () => {
      standardRotationEnabled = false;
      customRotationEnabled = false;
    },
  };
}

/** Creates rotation modal state */
function createRotationModalState() {
  let showRotationSetupModal = $state(false);
  let showCustomRotationModal = $state(false);

  return {
    get showRotationSetupModal() {
      return showRotationSetupModal;
    },
    get showCustomRotationModal() {
      return showCustomRotationModal;
    },
    setShowRotationSetupModal: (show: boolean) => {
      showRotationSetupModal = show;
    },
    setShowCustomRotationModal: (show: boolean) => {
      showCustomRotationModal = show;
    },
    resetModals: () => {
      showRotationSetupModal = false;
      showCustomRotationModal = false;
    },
  };
}

/** Creates rotation history and pending deletions state */
function createRotationHistoryState() {
  let rotationHistoryMap = $state(new Map());
  let pendingRotationDeletions = $state(new Set());

  return {
    get rotationHistoryMap() {
      return rotationHistoryMap;
    },
    get pendingRotationDeletions() {
      return pendingRotationDeletions;
    },
    setRotationHistoryMap: (map: Map<string, number>) => {
      rotationHistoryMap = map;
    },
    addPendingRotationDeletion: (id: number) => {
      pendingRotationDeletions = new Set([...pendingRotationDeletions, id]);
    },
    clearPendingRotationDeletions: () => {
      pendingRotationDeletions = new Set();
    },
    clearRotationData: () => {
      rotationHistoryMap = new Map();
      pendingRotationDeletions = new Set();
    },
  };
}

type ToggleState = ReturnType<typeof createRotationToggleState>;
type ModalState = ReturnType<typeof createRotationModalState>;
type HistoryState = ReturnType<typeof createRotationHistoryState>;

/** Creates coordinated setters that manage toggle/modal interactions */
function createCoordinatedSetters(toggles: ToggleState, modals: ModalState, history: HistoryState) {
  return {
    setStandardRotationEnabled: (enabled: boolean) => {
      toggles.setStandardEnabledRaw(enabled);
      if (enabled) {
        toggles.setCustomEnabledRaw(false);
        modals.setShowRotationSetupModal(true);
      }
    },
    setCustomRotationEnabled: (enabled: boolean) => {
      toggles.setCustomEnabledRaw(enabled);
      if (enabled) {
        toggles.setStandardEnabledRaw(false);
        modals.setShowCustomRotationModal(true);
      }
    },
    setStandardRotationEnabledDirect: (enabled: boolean) => {
      toggles.setStandardEnabledRaw(enabled);
      if (enabled) toggles.setCustomEnabledRaw(false);
    },
    setCustomRotationEnabledDirect: (enabled: boolean) => {
      toggles.setCustomEnabledRaw(enabled);
      if (enabled) toggles.setStandardEnabledRaw(false);
    },
    reset: () => {
      toggles.resetToggles();
      modals.resetModals();
      history.clearRotationData();
    },
  };
}

/** Creates combined rotation toggles state */
export function createRotationTogglesState() {
  const toggles = createRotationToggleState();
  const modals = createRotationModalState();
  const history = createRotationHistoryState();
  const coordinated = createCoordinatedSetters(toggles, modals, history);

  return {
    get standardRotationEnabled() {
      return toggles.standardRotationEnabled;
    },
    get customRotationEnabled() {
      return toggles.customRotationEnabled;
    },
    get showRotationSetupModal() {
      return modals.showRotationSetupModal;
    },
    get showCustomRotationModal() {
      return modals.showCustomRotationModal;
    },
    get rotationHistoryMap() {
      return history.rotationHistoryMap;
    },
    get pendingRotationDeletions() {
      return history.pendingRotationDeletions;
    },
    setShowRotationSetupModal: modals.setShowRotationSetupModal,
    setShowCustomRotationModal: modals.setShowCustomRotationModal,
    setRotationHistoryMap: history.setRotationHistoryMap,
    addPendingRotationDeletion: history.addPendingRotationDeletion,
    clearPendingRotationDeletions: history.clearPendingRotationDeletions,
    clearRotationData: history.clearRotationData,
    ...coordinated,
  };
}

export type RotationTogglesState = ReturnType<typeof createRotationTogglesState>;

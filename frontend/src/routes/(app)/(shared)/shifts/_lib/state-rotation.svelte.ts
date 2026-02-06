// =============================================================================
// SHIFTS STATE - ROTATION MODULE (Composed)
// Combines rotation config and toggles state modules
// =============================================================================

import { createRotationConfigState } from './state-rotation-config.svelte';
import { createRotationTogglesState } from './state-rotation-toggles.svelte';

function createRotationState() {
  const config = createRotationConfigState();
  const toggles = createRotationTogglesState();

  return {
    // Config state
    get autofillConfig() {
      return config.autofillConfig;
    },
    get rotationConfig() {
      return config.rotationConfig;
    },
    setAutofillConfig: config.setAutofillConfig,
    setRotationConfig: config.setRotationConfig,

    // Toggles state
    get standardRotationEnabled() {
      return toggles.standardRotationEnabled;
    },
    get customRotationEnabled() {
      return toggles.customRotationEnabled;
    },
    get showRotationSetupModal() {
      return toggles.showRotationSetupModal;
    },
    get showCustomRotationModal() {
      return toggles.showCustomRotationModal;
    },
    get rotationHistoryMap() {
      return toggles.rotationHistoryMap;
    },
    get pendingRotationDeletions() {
      return toggles.pendingRotationDeletions;
    },
    setStandardRotationEnabled: toggles.setStandardRotationEnabled,
    setCustomRotationEnabled: toggles.setCustomRotationEnabled,
    setStandardRotationEnabledDirect: toggles.setStandardRotationEnabledDirect,
    setCustomRotationEnabledDirect: toggles.setCustomRotationEnabledDirect,
    setShowRotationSetupModal: toggles.setShowRotationSetupModal,
    setShowCustomRotationModal: toggles.setShowCustomRotationModal,
    setRotationHistoryMap: toggles.setRotationHistoryMap,
    addPendingRotationDeletion: toggles.addPendingRotationDeletion,
    clearPendingRotationDeletions: toggles.clearPendingRotationDeletions,
    clearRotationData: toggles.clearRotationData,

    // Combined reset
    reset: () => {
      config.reset();
      toggles.reset();
    },
  };
}

export const rotationState = createRotationState();

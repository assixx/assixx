// =============================================================================
// SHIFTS STATE - ROTATION CONFIG MODULE
// Autofill and rotation configuration
// =============================================================================

import type { ShiftAutofillConfig, ShiftRotationConfig } from './types';

const DEFAULT_AUTOFILL: ShiftAutofillConfig = {
  enabled: false,
  fillWeekdays: true,
  skipWeekends: true,
  respectAvailability: true,
};

const DEFAULT_ROTATION: ShiftRotationConfig = {
  enabled: false,
  pattern: 'F_S_alternate',
  nightFixed: true,
  autoGenerateWeeks: 4,
};

export function createRotationConfigState() {
  let autofillConfig = $state<ShiftAutofillConfig>({ ...DEFAULT_AUTOFILL });
  let rotationConfig = $state<ShiftRotationConfig>({ ...DEFAULT_ROTATION });

  return {
    get autofillConfig() {
      return autofillConfig;
    },
    get rotationConfig() {
      return rotationConfig;
    },
    setAutofillConfig: (cfg: Partial<ShiftAutofillConfig>) => {
      autofillConfig = { ...autofillConfig, ...cfg };
    },
    setRotationConfig: (cfg: Partial<ShiftRotationConfig>) => {
      rotationConfig = { ...rotationConfig, ...cfg };
    },
    reset: () => {
      autofillConfig = { ...DEFAULT_AUTOFILL };
      rotationConfig = { ...DEFAULT_ROTATION };
    },
  };
}

export type RotationConfigState = ReturnType<typeof createRotationConfigState>;

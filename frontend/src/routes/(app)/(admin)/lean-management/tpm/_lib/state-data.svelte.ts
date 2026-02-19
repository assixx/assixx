// =============================================================================
// TPM - DATA STATE MODULE
// =============================================================================

import type { TpmPlan, TpmCard, TpmColorConfigEntry } from './types';

/** Creates data-related state (plans, cards, colors) */
export function createDataState() {
  let plans = $state<TpmPlan[]>([]);
  let cards = $state<TpmCard[]>([]);
  let colors = $state<TpmColorConfigEntry[]>([]);
  let totalPlans = $state(0);
  let currentPage = $state(1);

  return {
    get plans() {
      return plans;
    },
    get cards() {
      return cards;
    },
    get colors() {
      return colors;
    },
    get totalPlans() {
      return totalPlans;
    },
    get currentPage() {
      return currentPage;
    },
    setPlans: (v: TpmPlan[]) => {
      plans = v;
    },
    setCards: (v: TpmCard[]) => {
      cards = v;
    },
    setColors: (v: TpmColorConfigEntry[]) => {
      colors = v;
    },
    setTotalPlans: (v: number) => {
      totalPlans = v;
    },
    setCurrentPage: (v: number) => {
      currentPage = v;
    },
  };
}

export type DataState = ReturnType<typeof createDataState>;

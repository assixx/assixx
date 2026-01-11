// =============================================================================
// SURVEY-RESULTS STATE - UI MODULE
// Loading, exporting, error, accordion state
// =============================================================================

import { SvelteSet } from 'svelte/reactivity';

function createUiState() {
  // Loading states - Start true to prevent FOUC
  let isLoading = $state(true);
  let isExporting = $state(false);
  let errorMessage = $state<string | null>(null);

  // Accordion state for individual responses
  const expandedResponses = new SvelteSet<number>();

  const reset = (): void => {
    isLoading = false;
    isExporting = false;
    errorMessage = null;
    expandedResponses.clear();
  };

  return {
    get isLoading() {
      return isLoading;
    },
    get isExporting() {
      return isExporting;
    },
    get errorMessage() {
      return errorMessage;
    },
    setLoading: (val: boolean) => {
      isLoading = val;
    },
    setExporting: (val: boolean) => {
      isExporting = val;
    },
    setError: (message: string | null) => {
      errorMessage = message;
    },
    toggleResponseExpanded: (index: number) => {
      if (expandedResponses.has(index)) {
        expandedResponses.delete(index);
      } else {
        expandedResponses.add(index);
      }
    },
    isResponseExpanded: (index: number): boolean => {
      return expandedResponses.has(index);
    },
    reset,
  };
}

export const uiState = createUiState();

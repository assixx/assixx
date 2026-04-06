// =============================================================================
// INVENTORY - REACTIVE STATE (Svelte 5 Runes)
// =============================================================================
//
// Minimal shared state for the inventory lists overview.
// Most state lives in +page.svelte (Pattern A — page-level state).
// This file provides cross-component reactive state if needed.

// ── Category Autocomplete State ────────────────────────────────

let categorySuggestions = $state<string[]>([]);

export const categoryState = {
  get suggestions(): string[] {
    return categorySuggestions;
  },
  setSuggestions(values: string[]): void {
    categorySuggestions = values;
  },
  reset(): void {
    categorySuggestions = [];
  },
};

// =============================================================================
// INVENTORY - REACTIVE STATE (Svelte 5 Runes)
// =============================================================================
//
// Cross-component reactive state for the inventory module. The page-level
// state lives in +page.svelte (Pattern A). This file holds the *shared*
// tag catalog used by both the list modal (TagInput typeahead) and the
// inventory overview page (TagFilter, TagsManagement modal).

import type { InventoryTagWithUsage } from './types';

// ── Tag Catalog State ──────────────────────────────────────────

let tags = $state<InventoryTagWithUsage[]>([]);

export const tagsState = {
  get tags(): InventoryTagWithUsage[] {
    return tags;
  },
  set(values: InventoryTagWithUsage[]): void {
    tags = values;
  },
  reset(): void {
    tags = [];
  },
  /** Find a tag by ID — returns undefined if missing */
  findById(id: string): InventoryTagWithUsage | undefined {
    return tags.find((t: InventoryTagWithUsage): boolean => t.id === id);
  },
};

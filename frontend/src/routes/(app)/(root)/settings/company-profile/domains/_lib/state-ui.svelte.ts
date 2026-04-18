/**
 * Tenant Domains — UI State (Svelte 5 Runes)
 *
 * Modal open/close, in-flight action ID, instructions-panel target. No backend
 * state lives here — see `state-data.svelte.ts` for that. This split is per
 * the v0.3.4 D24 review: keeping UI state separate makes the §5.4.1
 * "modal open/close isolation" unit test trivial without dragging in the
 * domains list.
 *
 * Svelte 5 `$state` is module-scoped (singleton across imports), so the
 * modal/in-flight state is automatically shared between `+page.svelte` and
 * the child components (`AddDomainModal`, `DomainRow`) without prop drilling.
 *
 * @see masterplan §5.1 + §5.4.1 (modal-open-close isolation test)
 */
import type { VerificationInstructions } from './types.js';

// --- Add-domain modal state ---

let addModalOpen = $state(false);
let addModalDomain = $state(''); // controlled-input value
let addModalSubmitting = $state(false);

// --- In-flight action tracker ---
//
// Single ID at a time — UI assumption: only one row's verify/primary/remove
// action can be in-flight concurrently. The DomainRow disables action buttons
// when its own id matches `pendingActionId`. Cheaper + simpler than a per-row
// flag map.

let pendingActionId = $state<string | null>(null);

// --- Verification instructions panel ---
//
// Populated when `addDomain()` resolves with `verificationInstructions`.
// Cleared when the user clicks "Schließen" on the panel. Persists across
// re-renders (panel doesn't auto-hide on row updates) so the user can copy
// the TXT host/value at their own pace.

let instructionsPanel = $state<{
  id: string;
  domain: string;
  instructions: VerificationInstructions;
} | null>(null);

// --- Add-modal getters/setters ---

export function getAddModalOpen(): boolean {
  return addModalOpen;
}

export function getAddModalDomain(): string {
  return addModalDomain;
}

export function setAddModalDomain(value: string): void {
  addModalDomain = value;
}

export function getAddModalSubmitting(): boolean {
  return addModalSubmitting;
}

export function setAddModalSubmitting(value: boolean): void {
  addModalSubmitting = value;
}

export function openAddModal(): void {
  addModalOpen = true;
  addModalDomain = '';
  addModalSubmitting = false;
}

/**
 * Close the modal AND reset its form state. Svelte 5 `$state` is NOT
 * automatically reset on unmount — without this, re-opening the modal
 * would surface the previous input value. This is the contract pinned by
 * the §5.4.1 "modal open/close isolation" unit test.
 */
export function closeAddModal(): void {
  addModalOpen = false;
  addModalDomain = '';
  addModalSubmitting = false;
}

// --- Pending-action getters/setters ---

export function getPendingActionId(): string | null {
  return pendingActionId;
}

export function setPendingActionId(id: string | null): void {
  pendingActionId = id;
}

// --- Instructions-panel getters/setters ---

export function getInstructionsPanel(): {
  id: string;
  domain: string;
  instructions: VerificationInstructions;
} | null {
  return instructionsPanel;
}

export function showInstructions(
  id: string,
  domain: string,
  instructions: VerificationInstructions,
): void {
  instructionsPanel = { id, domain, instructions };
}

export function hideInstructions(): void {
  instructionsPanel = null;
}

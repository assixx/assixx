/**
 * @deprecated This file is DEPRECATED and will be removed in a future version.
 *
 * MIGRATION: Use `custom-rotation.ts` instead.
 *
 * All functionality has been moved to:
 * - `custom-rotation.ts` (new file)
 * - `customRotationManager` (new singleton export)
 *
 * Old → New mapping:
 * - KontischichtManager → CustomRotationManager
 * - kontischichtManager → customRotationManager
 * - kontischicht-types.ts → custom-rotation-types.ts
 *
 * HTML IDs have also changed:
 * - #kontischicht-pattern-modal → #custom-rotation-modal
 * - #kontischicht-start-date → #custom-rotation-start-date
 * - #kontischicht-end-date → #custom-rotation-end-date
 * - #kontischicht-pattern-list → #custom-rotation-pattern-list
 * - #shift-kontischicht → #shift-custom-rotation
 *
 * CSS classes have also changed:
 * - .kontischicht-active → .custom-rotation-active
 * - .kontischicht-scroll-container → .custom-rotation-scroll-container
 *
 * This file is kept temporarily for reference only.
 * DELETE THIS FILE after confirming all imports have been updated.
 *
 * @see custom-rotation.ts
 */

// Re-export from new location for backwards compatibility (TEMPORARY)
export { customRotationManager as kontischichtManager } from './custom-rotation';

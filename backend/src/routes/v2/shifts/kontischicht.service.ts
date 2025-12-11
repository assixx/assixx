/**
 * @deprecated This file is DEPRECATED and will be removed in a future version.
 *
 * MIGRATION: Use `custom-rotation.service.ts` instead.
 *
 * All functionality has been moved to:
 * - `custom-rotation.service.ts` (new file)
 * - `customRotationService` (new singleton export)
 *
 * Old → New mapping:
 * - KontischichtService → CustomRotationService
 * - kontischichtService → customRotationService
 * - isKontischichtPlan() → isCustomRotationPlan()
 * - calculateKontischichtDateRange() → calculateCustomRotationDateRange()
 *
 * This file is kept temporarily for reference only.
 * DELETE THIS FILE after confirming all imports have been updated.
 *
 * @see custom-rotation.service.ts
 */

// Re-export from new location for backwards compatibility (TEMPORARY)
export { customRotationService as kontischichtService } from './custom-rotation.service.js';

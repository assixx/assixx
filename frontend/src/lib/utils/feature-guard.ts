/**
 * Page-level feature guard utility.
 * @module lib/utils/feature-guard
 *
 * Usage in +page.server.ts:
 * ```typescript
 * const { activeFeatures } = await parent();
 * requireFeature(activeFeatures, 'blackboard');
 * ```
 *
 * Redirects to /feature-unavailable if the feature is not active for the tenant.
 * This is Layer 4 in the Defense-in-Depth security model (see FEAT_FRONTEND_FEATURE_GUARDS_MASTERPLAN.md).
 */
import { redirect } from '@sveltejs/kit';

/**
 * Require a tenant feature to be active. Redirects to /feature-unavailable if not.
 *
 * @param activeFeatures - Array of active feature codes from parent layout data
 * @param featureCode - Required feature code (e.g., 'vacation', 'blackboard')
 */
export function requireFeature(
  activeFeatures: string[],
  featureCode: string,
): void {
  if (!activeFeatures.includes(featureCode)) {
    redirect(302, `/feature-unavailable?feature=${featureCode}`);
  }
}

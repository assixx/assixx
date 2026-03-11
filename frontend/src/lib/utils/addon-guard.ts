/**
 * Page-level addon guard utility.
 * @module lib/utils/addon-guard
 *
 * Usage in +page.server.ts:
 * ```typescript
 * const { activeAddons } = await parent();
 * requireAddon(activeAddons, 'blackboard');
 * ```
 *
 * Redirects to /addon-unavailable if the addon is not active for the tenant.
 * This is Layer 4 in the Defense-in-Depth security model (see FEAT_FRONTEND_FEATURE_GUARDS_MASTERPLAN.md).
 */
import { redirect } from '@sveltejs/kit';

/** Require a tenant addon to be active. Redirects to /addon-unavailable if not. */
export function requireAddon(activeAddons: string[], addonCode: string): void {
  if (!activeAddons.includes(addonCode)) {
    redirect(302, `/addon-unavailable?addon=${addonCode}`);
  }
}

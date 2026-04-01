/**
 * TPM Gesamtansicht — Server-Side Access Check
 *
 * Access: Root | Admin (scoped) | Employee Team-Lead
 * Data loading happens client-side; this file only enforces scope access.
 */
import { assertTeamLevelAccess } from '$lib/server/manage-page-access';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, url }) => {
  const { activeAddons, user, orgScope } = await parent();
  assertTeamLevelAccess(orgScope, { role: user?.role, pathname: url.pathname });
  requireAddon(activeAddons, 'tpm');
};

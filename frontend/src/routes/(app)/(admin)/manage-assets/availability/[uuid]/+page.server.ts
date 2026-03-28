/**
 * Asset Availability History - Server-Side Data Loading
 * @module manage-assets/availability/[uuid]/+page.server
 */
import {
  loadAvailabilityHistory,
  type AssetAvailabilityEntity,
} from '$lib/server/availability-history-loader';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const { entity, ...rest } = await loadAvailabilityHistory<AssetAvailabilityEntity>(
    {
      loggerName: 'AssetAvailabilityHistory',
      apiPathSegment: 'assets',
      entityKey: 'asset',
      errorMessage: 'Fehler beim Laden der Anlagenverfügbarkeitshistorie',
    },
    event,
  );
  return { asset: entity, ...rest };
};

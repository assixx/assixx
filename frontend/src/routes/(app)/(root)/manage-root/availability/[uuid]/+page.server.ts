/**
 * Availability History - Server-Side Data Loading (Root)
 * @module manage-root/availability/[uuid]/+page.server
 */
import {
  loadAvailabilityHistory,
  type UserAvailabilityEntity,
} from '$lib/server/availability-history-loader';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const { entity, ...rest } =
    await loadAvailabilityHistory<UserAvailabilityEntity>(
      {
        loggerName: 'RootAvailabilityHistory',
        apiPathSegment: 'users',
        entityKey: 'employee',
        errorMessage: 'Fehler beim Laden der Verfügbarkeitshistorie',
      },
      event,
    );
  return { employee: entity, ...rest };
};

/**
 * Availability History - Server-Side Data Loading
 * @module manage-employees/availability/[uuid]/+page.server
 */
import {
  loadAvailabilityHistory,
  type UserAvailabilityEntity,
} from '$lib/server/availability-history-loader';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const { entity, ...rest } = await loadAvailabilityHistory<UserAvailabilityEntity>(
    {
      loggerName: 'AvailabilityHistory',
      apiPathSegment: 'users',
      entityKey: 'employee',
      errorMessage: 'Fehler beim Laden der Verfügbarkeitshistorie',
    },
    event,
  );
  return { employee: entity, ...rest };
};

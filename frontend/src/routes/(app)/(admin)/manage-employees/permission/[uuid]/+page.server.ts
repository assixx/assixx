/**
 * Permission Management - Server-Side Data Loading
 * @module manage-employees/permission/[uuid]/+page.server
 *
 * Loads employee data (name) for the permission page.
 * Permissions UI only - no backend logic yet.
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';

const log = createLogger('PermissionPage');
const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface UserData {
  id: number;
  uuid: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface ApiResponse {
  success: boolean;
  data: UserData;
}

export const load: PageServerLoad = async ({ cookies, fetch, params }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') redirect(302, '/login');

  const { uuid } = params;

  try {
    const response = await fetch(`${API_BASE}/users/uuid/${uuid}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      log.error(
        { status: response.status },
        'Failed to fetch user data for permission page',
      );
      return {
        employee: null,
        error: 'Fehler beim Laden der Benutzerdaten',
      };
    }

    const json = (await response.json()) as ApiResponse;

    return {
      employee: {
        id: json.data.id,
        uuid: json.data.uuid,
        firstName: json.data.firstName,
        lastName: json.data.lastName,
        email: json.data.email,
      },
      error: null,
    };
  } catch (err) {
    log.error({ err }, 'Error fetching user data for permission page');
    return {
      employee: null,
      error: 'Verbindungsfehler',
    };
  }
};

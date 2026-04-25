/**
 * Company Profile — Server-Side Data Loading
 * Root-only: RBAC enforced by (root) layout group
 */
import { redirect } from '@sveltejs/kit';

import { buildLoginUrl } from '$lib/utils/build-apex-url';
import { createLogger } from '$lib/utils/logger.js';

import type { PageServerLoad } from './$types';

const log = createLogger('Settings:CompanyProfile');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface CompanyData {
  companyName: string;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
  phone: string | null;
  email: string;
}

interface ApiResponse {
  success?: boolean;
  data?: CompanyData;
}

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }

  try {
    const response = await fetch(`${API_BASE}/company`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      log.error({ status: response.status }, 'Failed to load company data');
      return { company: null, loadError: true };
    }

    const json = (await response.json()) as ApiResponse;
    const data = json.data ?? (json as unknown as CompanyData);

    return { company: data, loadError: false };
  } catch (err: unknown) {
    log.error({ err }, 'Fetch error');
    return { company: null, loadError: true };
  }
};

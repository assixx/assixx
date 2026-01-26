/**
 * Blackboard Archived - Server-Side Data Loading
 * @module blackboard/archived/+page.server
 *
 * Loads archived blackboard entries (is_active = 3)
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';

const log = createLogger('BlackboardArchived');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ArchivedEntry {
  id: number;
  uuid: string;
  title: string;
  content: string;
  authorFullName: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  priority: string;
  orgLevel: string;
}

interface ApiResponse {
  success?: boolean;
  data?: ArchivedEntry[];
  meta?: {
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  try {
    // Fetch archived entries (isActive=3)
    const response = await fetch(`${API_BASE}/blackboard/entries?isActive=3&limit=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      log.error({ status: response.status }, 'Failed to fetch archived entries');
      return { entries: [], error: 'Fehler beim Laden der archivierten Einträge' };
    }

    const json = (await response.json()) as ApiResponse;

    log.info({ count: json.data?.length ?? 0 }, 'API response received');

    if (json.success === true && json.data !== undefined && Array.isArray(json.data)) {
      log.info({ count: json.data.length }, 'Entries found');
      // Ensure plain serializable objects (SvelteKit requires JSON-serializable data)
      const entries = json.data.map((entry) => ({
        id: entry.id,
        uuid: entry.uuid,
        title: entry.title,
        content: entry.content,
        authorFullName: entry.authorFullName,
        authorName: entry.authorName,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        expiresAt: entry.expiresAt,
        priority: entry.priority,
        orgLevel: entry.orgLevel,
      }));
      return {
        entries,
        error: null,
      };
    }

    log.warn({ json }, 'No entries found or invalid response structure');
    return { entries: [] as ArchivedEntry[], error: null };
  } catch (err) {
    log.error({ err }, 'Error fetching archived entries');
    return { entries: [], error: 'Verbindungsfehler' };
  }
};

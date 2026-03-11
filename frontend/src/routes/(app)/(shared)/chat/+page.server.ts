/**
 * Chat Page - Server-Side Data Loading
 * @module chat/+page.server
 *
 * SSR: Loads conversations list. WebSocket connection happens client-side.
 */
import { redirect } from '@sveltejs/kit';

import { requireAddon } from '$lib/utils/addon-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { Conversation } from './_lib/types';

const log = createLogger('Chat');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  conversations?: T;
}

/**
 * Extract data from various API response formats.
 * Handles: T[] | { success: true, data: T } | { data: T } | { conversations: T } | T
 */
function extractResponseData<T>(json: ApiResponse<T>): T | null {
  // Format: T[] (raw array)
  if (Array.isArray(json)) {
    return json as unknown as T;
  }

  // Format: { success: true, data: T }
  if ('success' in json && json.success === true) {
    return json.data ?? null;
  }

  // Format: { data: T }
  if ('data' in json && json.data !== undefined) {
    return json.data;
  }

  // Format: { conversations: T }
  if ('conversations' in json && json.conversations !== undefined) {
    return json.conversations;
  }

  // Format: T (raw response)
  return json as unknown as T;
}

async function apiFetch<T>(
  endpoint: string,
  token: string,
  fetchFn: typeof fetch,
): Promise<T | null> {
  try {
    const response = await fetchFn(`${API_BASE}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      log.error({ status: response.status, endpoint }, 'API error');
      return null;
    }

    const json = (await response.json()) as ApiResponse<T>;
    return extractResponseData(json);
  } catch (err: unknown) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Get user from parent layout
  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'chat');
  const user = parentData.user;

  // Load conversations
  const conversationsData = await apiFetch<Conversation[]>(
    '/chat/conversations',
    token,
    fetch,
  );

  // Normalize conversations (ensure participants array exists)
  const conversations =
    Array.isArray(conversationsData) ?
      conversationsData.map((conv) => ({
        ...conv,
        participants: Array.isArray(conv.participants) ? conv.participants : [],
      }))
    : [];

  return {
    conversations,
    currentUser: user,
  };
};

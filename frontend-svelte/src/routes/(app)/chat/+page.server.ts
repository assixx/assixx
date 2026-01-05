/**
 * Chat Page - Server-Side Data Loading
 * @module chat/+page.server
 *
 * SSR: Loads conversations list. WebSocket connection happens client-side.
 */
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Conversation } from './_lib/types';

const API_BASE = process.env['API_URL'] ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  conversations?: T;
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
      console.error(`[SSR] API error ${response.status} for ${endpoint}`);
      return null;
    }

    const json = (await response.json()) as ApiResponse<T>;

    // Handle different response formats
    if (Array.isArray(json)) {
      return json as unknown as T;
    }
    if ('success' in json && json.success === true) {
      return json.data ?? null;
    }
    if ('data' in json && json.data !== undefined) {
      return json.data;
    }
    if ('conversations' in json && json.conversations !== undefined) {
      return json.conversations;
    }
    return json as unknown as T;
  } catch (error) {
    console.error(`[SSR] Fetch error for ${endpoint}:`, error);
    return null;
  }
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const startTime = performance.now();

  const token = cookies.get('accessToken');
  if (!token) {
    redirect(302, '/login');
  }

  // Get user from parent layout
  const parentData = await parent();
  const user = parentData.user;

  // Load conversations
  const conversationsData = await apiFetch<Conversation[]>('/chat/conversations', token, fetch);

  // Normalize conversations (ensure participants array exists)
  const conversations = Array.isArray(conversationsData)
    ? conversationsData.map((conv) => ({
        ...conv,
        participants: Array.isArray(conv.participants) ? conv.participants : [],
      }))
    : [];

  const duration = (performance.now() - startTime).toFixed(1);
  console.info(
    `[SSR] chat loaded in ${duration}ms (1 API call, ${conversations.length} conversations)`,
  );

  return {
    conversations,
    currentUser: user,
  };
};

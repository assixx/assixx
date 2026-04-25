/**
 * Chat Page - Server-Side Data Loading
 * @module chat/+page.server
 *
 * SSR: Loads conversations list. WebSocket connection happens client-side.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';
import { buildLoginUrl } from '$lib/utils/build-apex-url';

import type { PageServerLoad } from './$types';
import type { Conversation } from './_lib/types';

/**
 * Unwrap conversations from API response.
 * The chat endpoint may return `{ conversations: [...] }` instead of `{ data: [...] }`.
 * The shared apiFetch handles `data`/`success` wrappers, but not `conversations`.
 */
function unwrapConversations(raw: unknown): Conversation[] {
  if (Array.isArray(raw)) return raw as Conversation[];
  if (raw !== null && typeof raw === 'object' && 'conversations' in raw) {
    const wrapped = raw;
    if (Array.isArray(wrapped.conversations)) return wrapped.conversations as Conversation[];
  }
  return [];
}

export const load: PageServerLoad = async ({ cookies, fetch, parent, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }

  // Get user from parent layout
  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'chat');
  const user = parentData.user;

  // Load conversations (apiFetchWithPermission to detect 403 vs empty data)
  const conversationsResult = await apiFetchWithPermission<Conversation[]>(
    '/chat/conversations',
    token,
    fetch,
  );

  if (conversationsResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      conversations: [] as Conversation[],
      currentUser: user,
    };
  }

  // Unwrap (handles {conversations: [...]}) + normalize (ensure participants array exists)
  const conversations = unwrapConversations(conversationsResult.data).map((conv) => ({
    ...conv,
    participants: Array.isArray(conv.participants) ? conv.participants : [],
  }));

  return {
    permissionDenied: false as const,
    conversations,
    currentUser: user,
  };
};

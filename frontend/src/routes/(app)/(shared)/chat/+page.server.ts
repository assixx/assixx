/**
 * Chat Page - Server-Side Data Loading
 * @module chat/+page.server
 *
 * SSR: Loads conversations list. WebSocket connection happens client-side.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

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
    const wrapped = raw as { conversations: unknown };
    if (Array.isArray(wrapped.conversations))
      return wrapped.conversations as Conversation[];
  }
  return [];
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

  // Unwrap (handles {conversations: [...]}) + normalize (ensure participants array exists)
  const conversations = unwrapConversations(conversationsData).map((conv) => ({
    ...conv,
    participants: Array.isArray(conv.participants) ? conv.participants : [],
  }));

  return {
    conversations,
    currentUser: user,
  };
};

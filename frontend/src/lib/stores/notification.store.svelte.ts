/**
 * Notification Store - Svelte 5 Runes
 *
 * Manages notification state and SSE connection for real-time updates.
 * Uses Svelte 5 $state rune for reactive state management.
 */
import { browser } from '$app/environment';

import { type NotificationEvent, getNotificationSSE } from '$lib/utils/notification-sse';

// ============================================
// Types
// ============================================

export interface NotificationCounts {
  total: number;
  surveys: number;
  documents: number;
  kvp: number;
  chat: number;
}

interface NotificationState {
  counts: NotificationCounts;
  isConnected: boolean;
  lastUpdate: Date | null;
  connectionState: 'disconnected' | 'connecting' | 'connected';
}

type CountType = keyof Omit<NotificationCounts, 'total'>;

// ============================================
// Helper Functions
// ============================================

function createInitialCounts(): NotificationCounts {
  return { total: 0, surveys: 0, documents: 0, kvp: 0, chat: 0 };
}

function incrementCount(state: NotificationState, type: CountType): void {
  state.counts[type]++;
  state.counts.total++;
  state.lastUpdate = new Date();
}

function handleSSEEvent(state: NotificationState, event: NotificationEvent): void {
  switch (event.type) {
    case 'CONNECTED':
      state.isConnected = true;
      state.connectionState = 'connected';
      state.lastUpdate = new Date();
      break;
    case 'HEARTBEAT':
      break;
    case 'NEW_SURVEY':
      incrementCount(state, 'surveys');
      break;
    case 'NEW_DOCUMENT':
      incrementCount(state, 'documents');
      break;
    case 'NEW_KVP':
      incrementCount(state, 'kvp');
      break;
    case 'NEW_MESSAGE':
      incrementCount(state, 'chat');
      break;
  }
}

function decrementCountMut(state: NotificationState, type: CountType): void {
  if (state.counts[type] > 0) {
    state.counts[type]--;
    state.counts.total--;
  }
}

function resetCountMut(state: NotificationState, type: CountType): void {
  state.counts.total -= state.counts[type];
  state.counts[type] = 0;
}

function setCountsMut(state: NotificationState, counts: Partial<NotificationCounts>): void {
  state.counts = {
    total: counts.total ?? 0,
    surveys: counts.surveys ?? 0,
    documents: counts.documents ?? 0,
    kvp: counts.kvp ?? 0,
    chat: counts.chat ?? 0,
  };
  state.lastUpdate = new Date();
}

async function fetchInitialCounts(state: NotificationState): Promise<void> {
  try {
    const response = await fetch('/api/v2/chat/unread-count', {
      credentials: 'include',
    });

    if (!response.ok) return;

    // API returns { success: true, data: { totalUnread: number } }
    const json = (await response.json()) as { data: { totalUnread: number } };
    const unreadCount = json.data.totalUnread;
    state.counts.chat = unreadCount;
    state.counts.total =
      state.counts.surveys + state.counts.documents + state.counts.kvp + unreadCount;
    state.lastUpdate = new Date();
  } catch {
    // Silently fail - SSE will update counts when connected
  }
}

// ============================================
// Store Implementation
// ============================================

function createNotificationStore() {
  const state = $state<NotificationState>({
    counts: createInitialCounts(),
    isConnected: false,
    lastUpdate: null,
    connectionState: 'disconnected',
  });

  let unsubscribeSSE: (() => void) | null = null;

  return {
    get counts() {
      return state.counts;
    },
    get isConnected() {
      return state.isConnected;
    },
    get connectionState() {
      return state.connectionState;
    },
    get lastUpdate() {
      return state.lastUpdate;
    },
    get totalUnread() {
      return state.counts.total;
    },
    connect(): void {
      if (!browser) return;
      state.connectionState = 'connecting';
      const sse = getNotificationSSE();
      unsubscribeSSE = sse.subscribe((event) => {
        handleSSEEvent(state, event);
      });
      sse.connect();
    },
    disconnect(): void {
      if (unsubscribeSSE !== null) {
        unsubscribeSSE();
        unsubscribeSSE = null;
      }
      getNotificationSSE().disconnect();
      state.isConnected = false;
      state.connectionState = 'disconnected';
    },
    decrementCount: (type: CountType) => {
      decrementCountMut(state, type);
    },
    resetCount: (type: CountType) => {
      resetCountMut(state, type);
    },
    resetAllCounts: () => {
      state.counts = createInitialCounts();
    },
    setCounts: (counts: Partial<NotificationCounts>) => {
      setCountsMut(state, counts);
    },
    /** Load initial unread counts from API */
    async loadInitialCounts(): Promise<void> {
      if (!browser) return;
      await fetchInitialCounts(state);
    },
  };
}

// ============================================
// Singleton Export
// ============================================

export const notificationStore = createNotificationStore();

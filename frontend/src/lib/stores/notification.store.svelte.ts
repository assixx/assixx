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

/** API response types */
interface ChatUnreadResponse {
  success: boolean;
  data: { totalUnread: number };
}

interface NotificationStatsResponse {
  success: boolean;
  data: {
    total: number;
    unread: number;
    byType: Record<string, number>;
  };
}

export type FeatureType = 'survey' | 'document' | 'kvp';

/** Map feature type to store count key */
const FEATURE_TO_COUNT_KEY: Record<FeatureType, CountType> = {
  survey: 'surveys',
  document: 'documents',
  kvp: 'kvp',
};

/** Rollback count after failed API call */
function rollbackCount(state: NotificationState, countKey: CountType, previousCount: number): void {
  state.counts[countKey] = previousCount;
  state.counts.total += previousCount;
}

/**
 * Mark all notifications of a feature type as read via API (ADR-004)
 * Resets local count and persists to backend
 */
async function markFeatureTypeAsRead(
  state: NotificationState,
  featureType: FeatureType,
): Promise<void> {
  const countKey = FEATURE_TO_COUNT_KEY[featureType];
  const previousCount = state.counts[countKey];

  // Optimistically reset local count
  resetCountMut(state, countKey);

  try {
    const response = await fetch(`/api/v2/notifications/mark-read/${featureType}`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      rollbackCount(state, countKey, previousCount);
    }
  } catch {
    rollbackCount(state, countKey, previousCount);
  }
}

/** Parse chat unread count from response */
async function parseChatCount(response: Response): Promise<number> {
  if (!response.ok) return 0;
  const json = (await response.json()) as ChatUnreadResponse;
  return json.data.totalUnread;
}

/** Parse notification stats from response */
async function parseNotificationStats(
  response: Response,
): Promise<{ survey: number; document: number; kvp: number }> {
  if (!response.ok) return { survey: 0, document: 0, kvp: 0 };
  const json = (await response.json()) as NotificationStatsResponse;
  const byType: Partial<Record<string, number>> = json.data.byType;
  return {
    survey: byType.survey ?? 0,
    document: byType.document ?? 0,
    kvp: byType.kvp ?? 0,
  };
}

/**
 * Fetch initial counts from both APIs in parallel (ADR-004)
 */
async function fetchInitialCounts(state: NotificationState): Promise<void> {
  try {
    const [chatResponse, notificationsResponse] = await Promise.all([
      fetch('/api/v2/chat/unread-count', { credentials: 'include' }),
      fetch('/api/v2/notifications/stats/me', { credentials: 'include' }),
    ]);

    const chatCount = await parseChatCount(chatResponse);
    const stats = await parseNotificationStats(notificationsResponse);

    state.counts.chat = chatCount;
    state.counts.surveys = stats.survey;
    state.counts.documents = stats.document;
    state.counts.kvp = stats.kvp;
    state.counts.total = chatCount + stats.survey + stats.document + stats.kvp;
    state.lastUpdate = new Date();
  } catch {
    // Silently fail - SSE will update counts when connected
  }
}

// ============================================
// Store Implementation
// ============================================

/** Connect to SSE and subscribe to events */
function connectSSE(
  state: NotificationState,
  setUnsubscribe: (fn: (() => void) | null) => void,
): void {
  if (!browser) return;
  state.connectionState = 'connecting';
  const sse = getNotificationSSE();
  setUnsubscribe(
    sse.subscribe((event) => {
      handleSSEEvent(state, event);
    }),
  );
  sse.connect();
}

/** Disconnect from SSE */
function disconnectSSE(
  state: NotificationState,
  unsubscribe: (() => void) | null,
  setUnsubscribe: (fn: (() => void) | null) => void,
): void {
  if (unsubscribe !== null) {
    unsubscribe();
    setUnsubscribe(null);
  }
  getNotificationSSE().disconnect();
  state.isConnected = false;
  state.connectionState = 'disconnected';
}

function createNotificationStore() {
  const state = $state<NotificationState>({
    counts: createInitialCounts(),
    isConnected: false,
    lastUpdate: null,
    connectionState: 'disconnected',
  });
  let unsubscribeSSE: (() => void) | null = null;
  const setUnsubscribe = (fn: (() => void) | null): void => {
    unsubscribeSSE = fn;
  };

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
    connect: () => {
      connectSSE(state, setUnsubscribe);
    },
    disconnect: () => {
      disconnectSSE(state, unsubscribeSSE, setUnsubscribe);
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
    loadInitialCounts: async () => {
      if (browser) await fetchInitialCounts(state);
    },
    markTypeAsRead: async (featureType: FeatureType) => {
      if (browser) await markFeatureTypeAsRead(state, featureType);
    },
  };
}

// ============================================
// Singleton Export
// ============================================

export const notificationStore = createNotificationStore();

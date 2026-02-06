/**
 * Notification Store - Svelte 5 Runes
 *
 * Manages notification state and SSE connection for real-time updates.
 * Uses Svelte 5 $state rune for reactive state management.
 */
import { browser } from '$app/environment';

import { createLogger } from '$lib/utils/logger';
import {
  type NotificationEvent,
  getNotificationSSE,
} from '$lib/utils/notification-sse';
import { perf } from '$lib/utils/perf-logger';

const log = createLogger('NotificationStore');

// ============================================
// Types
// ============================================

export interface NotificationCounts {
  total: number;
  surveys: number;
  documents: number;
  kvp: number;
  chat: number;
  blackboard: number;
  calendar: number;
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
  return {
    total: 0,
    surveys: 0,
    documents: 0,
    kvp: 0,
    chat: 0,
    blackboard: 0,
    calendar: 0,
  };
}

function incrementCount(state: NotificationState, type: CountType): void {
  state.counts[type]++;
  state.counts.total++;
  state.lastUpdate = new Date();
}

/**
 * SSE event types suppressed by feature pages that handle their own badge updates.
 * When a page has a direct real-time channel (e.g., chat page uses WebSocket),
 * it suppresses the SSE handler to prevent double-counting.
 */
const suppressedSSETypes = new Set<string>();

function handleSSEEvent(
  state: NotificationState,
  event: NotificationEvent,
): void {
  // Skip types suppressed by active feature pages (prevents double-counting)
  if (suppressedSSETypes.has(event.type)) return;

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

function setCountsMut(
  state: NotificationState,
  counts: Partial<NotificationCounts>,
): void {
  state.counts = {
    total: counts.total ?? 0,
    surveys: counts.surveys ?? 0,
    documents: counts.documents ?? 0,
    kvp: counts.kvp ?? 0,
    chat: counts.chat ?? 0,
    blackboard: counts.blackboard ?? 0,
    calendar: counts.calendar ?? 0,
  };
  state.lastUpdate = new Date();
}

export type FeatureType = 'survey' | 'document' | 'kvp';

/** Map feature type to store count key */
const FEATURE_TO_COUNT_KEY: Record<FeatureType, CountType> = {
  survey: 'surveys',
  document: 'documents',
  kvp: 'kvp',
};

/** Rollback count after failed API call */
function rollbackCount(
  state: NotificationState,
  countKey: CountType,
  previousCount: number,
): void {
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
    const response = await fetch(
      `/api/v2/notifications/mark-read/${featureType}`,
      {
        method: 'POST',
        credentials: 'include',
      },
    );

    if (!response.ok) {
      rollbackCount(state, countKey, previousCount);
    }
  } catch {
    rollbackCount(state, countKey, previousCount);
  }
}

/**
 * Dashboard counts response from /api/v2/dashboard/counts
 * Single endpoint that combines all notification counts
 */
interface DashboardCountsResponse {
  success: boolean;
  data: {
    chat?: { totalUnread: number };
    notifications?: {
      total: number;
      unread: number;
      byType: Record<string, number>;
    };
    blackboard?: { count: number };
    calendar?: { count: number };
    documents?: { count: number };
    /** KVP unconfirmed count (Pattern 2: Individual read tracking) */
    kvp?: { count: number };
    /** Pending surveys count (active surveys not yet responded to by user) */
    surveys?: { count: number };
    fetchedAt?: string;
  };
}

/**
 * Fetch initial counts from combined dashboard endpoint (optimized)
 * Single HTTP request instead of 5 parallel requests
 */
async function fetchInitialCounts(state: NotificationState): Promise<void> {
  const endTotal = perf.start('notifications:fetchInitialCounts:total');

  try {
    log.debug({}, '📡 Fetching dashboard counts (single optimized request)...');

    const response = await perf.time(
      'notifications:fetch:dashboard-counts',
      () => fetch('/api/v2/dashboard/counts', { credentials: 'include' }),
    );

    if (!response.ok) {
      throw new Error(`Dashboard counts failed: ${response.status}`);
    }

    const json = (await response.json()) as DashboardCountsResponse;
    initFromSSRData(state, json.data);

    log.debug(
      { counts: state.counts },
      `✅ Initial counts loaded: total=${state.counts.total}`,
    );
  } catch (err) {
    log.warn(
      { err },
      'Failed to fetch dashboard counts - SSE will update when connected',
    );
  } finally {
    endTotal();
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

/**
 * SSR counts input type
 *
 * Properties are optional because this data crosses an API boundary —
 * the runtime shape may not match if the backend response changes or
 * a sub-service fails. Defensive access with `?.` and `?? 0` is required.
 */
interface SSRCounts {
  chat?: { totalUnread: number };
  notifications?: { byType: Record<string, number> };
  blackboard?: { count: number };
  calendar?: { count: number };
  documents?: { count: number };
  /** KVP unconfirmed count (Pattern 2: Individual read tracking) */
  kvp?: { count: number };
  /** Pending surveys count (active surveys not yet responded to by user) */
  surveys?: { count: number };
}

/** Safely extract count from an optional API field (defensive against missing data) */
function safeCount(item: { count: number } | undefined): number {
  return item?.count ?? 0;
}

/** Initialize counts from SSR data (no HTTP request needed) */
function initFromSSRData(state: NotificationState, counts: SSRCounts): void {
  const chat = counts.chat?.totalUnread ?? 0;
  const surveys = safeCount(counts.surveys);
  const kvp = safeCount(counts.kvp);
  const blackboard = safeCount(counts.blackboard);
  const calendar = safeCount(counts.calendar);
  const documents = safeCount(counts.documents);

  state.counts = {
    total: chat + surveys + documents + kvp + blackboard + calendar,
    chat,
    surveys,
    documents,
    kvp,
    blackboard,
    calendar,
  };
  state.lastUpdate = new Date();

  log.debug(
    { counts: state.counts },
    '✅ Counts initialized from SSR (0ms fetch!)',
  );
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

function buildStoreActions(
  state: NotificationState,
  getUnsubscribe: () => (() => void) | null,
  setUnsubscribe: (fn: (() => void) | null) => void,
) {
  return {
    connect: () => {
      connectSSE(state, setUnsubscribe);
    },
    disconnect: () => {
      disconnectSSE(state, getUnsubscribe(), setUnsubscribe);
    },
    decrementCount: (type: CountType) => {
      decrementCountMut(state, type);
    },
    incrementCount: (type: CountType) => {
      incrementCount(state, type);
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
    /** Initialize counts from SSR data (no HTTP request needed) */
    initFromSSR: (counts: SSRCounts) => {
      initFromSSRData(state, counts);
    },
    markTypeAsRead: async (featureType: FeatureType) => {
      if (browser) await markFeatureTypeAsRead(state, featureType);
    },
    /**
     * Suppress an SSE event type from auto-incrementing badge counts.
     * Used by feature pages that handle their own real-time updates
     * (e.g., chat page uses WebSocket, so it suppresses SSE NEW_MESSAGE).
     */
    suppressSSEType: (type: string) => suppressedSSETypes.add(type),
    /** Re-enable SSE handling for a previously suppressed event type. */
    unsuppressSSEType: (type: string) => suppressedSSETypes.delete(type),
  };
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
    ...buildStoreActions(state, () => unsubscribeSSE, setUnsubscribe),
  };
}

// ============================================
// Singleton Export
// ============================================

export const notificationStore = createNotificationStore();

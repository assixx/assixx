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
  vacation: number;
  tpm: number;
  workOrders: number;
  approvals: number;
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
    vacation: 0,
    tpm: 0,
    workOrders: 0,
    approvals: 0,
  };
}

function incrementCount(state: NotificationState, type: CountType): void {
  state.counts[type]++;
  state.counts.total++;
  state.lastUpdate = new Date();
}

/**
 * SSE event types suppressed by addon pages that handle their own badge updates.
 * When a page has a direct real-time channel (e.g., chat page uses WebSocket),
 * it suppresses the SSE handler to prevent double-counting.
 */
const suppressedSSETypes = new Set<string>();

/** Map SSE event types to their corresponding count key */
const SSE_EVENT_TO_COUNT = new Map<string, CountType>([
  ['NEW_SURVEY', 'surveys'],
  ['NEW_DOCUMENT', 'documents'],
  ['NEW_KVP', 'kvp'],
  ['NEW_MESSAGE', 'chat'],
  ['VACATION_REQUEST_CREATED', 'vacation'],
  ['VACATION_REQUEST_RESPONDED', 'vacation'],
  ['VACATION_REQUEST_WITHDRAWN', 'vacation'],
  ['VACATION_REQUEST_CANCELLED', 'vacation'],
  ['TPM_CARD_STATUS_RED', 'tpm'],
  ['TPM_CARD_STATUS_YELLOW', 'tpm'],
  ['TPM_CARD_OVERDUE', 'tpm'],
  ['TPM_EXECUTION_PENDING', 'tpm'],
  ['WORK_ORDER_ASSIGNED', 'workOrders'],
  ['WORK_ORDER_STATUS_CHANGED', 'workOrders'],
  ['WORK_ORDER_DUE_SOON', 'workOrders'],
  ['WORK_ORDER_VERIFIED', 'workOrders'],
  ['NEW_APPROVAL', 'approvals'],
  ['APPROVAL_DECIDED', 'approvals'],
]);

function handleSSEEvent(
  state: NotificationState,
  event: NotificationEvent,
): void {
  if (suppressedSSETypes.has(event.type)) return;

  if (event.type === 'CONNECTED') {
    state.isConnected = true;
    state.connectionState = 'connected';
    state.lastUpdate = new Date();
    return;
  }

  const countKey = SSE_EVENT_TO_COUNT.get(event.type);
  if (countKey !== undefined) {
    incrementCount(state, countKey);
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
  state.counts = { ...createInitialCounts(), ...counts };
  state.lastUpdate = new Date();
}

export type AddonType =
  | 'survey'
  | 'document'
  | 'kvp'
  | 'vacation'
  | 'tpm'
  | 'work_orders';

/** Map addon type to store count key */
const ADDON_TO_COUNT_KEY: Record<AddonType, CountType> = {
  survey: 'surveys',
  document: 'documents',
  kvp: 'kvp',
  vacation: 'vacation',
  tpm: 'tpm',
  work_orders: 'workOrders',
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
 * Mark all notifications of an addon type as read via API (ADR-004)
 * Resets local count and persists to backend
 */
async function markAddonTypeAsRead(
  state: NotificationState,
  addonType: AddonType,
): Promise<void> {
  const countKey = ADDON_TO_COUNT_KEY[addonType];
  const previousCount = state.counts[countKey];

  // Optimistically reset local count
  resetCountMut(state, countKey);

  try {
    const response = await fetch(
      `/api/v2/notifications/mark-read/${addonType}`,
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
 * Mark notifications for a specific entity as read (e.g., one work order).
 * Decrements count by the number of actually marked notifications.
 */
async function markAddonEntityAsRead(
  state: NotificationState,
  addonType: AddonType,
  entityUuid: string,
): Promise<void> {
  try {
    const response = await fetch(
      `/api/v2/notifications/mark-read/${addonType}/${entityUuid}`,
      { method: 'POST', credentials: 'include' },
    );

    if (!response.ok) return;

    const json = (await response.json()) as { marked: number };
    const countKey = ADDON_TO_COUNT_KEY[addonType];

    for (let i = 0; i < json.marked; i++) {
      decrementCountMut(state, countKey);
    }
  } catch {
    // Silent — notification dismiss is non-critical
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
    /** Unread vacation notifications */
    vacation?: { count: number };
    /** Unread TPM notifications */
    tpm?: { count: number };
    /** Unread work order notifications */
    workOrders?: { count: number };
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
  } catch (err: unknown) {
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
  /** Unread vacation notifications */
  vacation?: { count: number };
  /** Unread TPM notifications */
  tpm?: { count: number };
  /** Unread work order notifications */
  workOrders?: { count: number };
  /** Pending approval notifications */
  approvals?: { count: number };
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
  const vacation = safeCount(counts.vacation);
  const tpm = safeCount(counts.tpm);
  const workOrders = safeCount(counts.workOrders);
  const approvals = safeCount(counts.approvals);

  state.counts = {
    total:
      chat +
      surveys +
      documents +
      kvp +
      blackboard +
      calendar +
      vacation +
      tpm +
      workOrders +
      approvals,
    chat,
    surveys,
    documents,
    kvp,
    blackboard,
    calendar,
    vacation,
    tpm,
    workOrders,
    approvals,
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
    markTypeAsRead: async (addonType: AddonType) => {
      if (browser) await markAddonTypeAsRead(state, addonType);
    },
    markEntityAsRead: async (addonType: AddonType, entityUuid: string) => {
      if (browser) await markAddonEntityAsRead(state, addonType, entityUuid);
    },
    /**
     * Suppress an SSE event type from auto-incrementing badge counts.
     * Used by addon pages that handle their own real-time updates
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

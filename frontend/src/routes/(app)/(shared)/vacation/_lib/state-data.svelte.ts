// =============================================================================
// VACATION STATE - DATA MODULE
// Vacation requests, balance, capacity analysis
// =============================================================================

import type {
  PaginatedResult,
  VacationBalance,
  VacationCapacityAnalysis,
  VacationRequest,
  VacationStatusLogEntry,
} from './types';

/** Empty paginated result for initial state */
function emptyPage<T>(): PaginatedResult<T> {
  return { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
}

function createDataState() {
  let myRequests = $state<PaginatedResult<VacationRequest>>(emptyPage<VacationRequest>());
  let incomingRequests = $state<PaginatedResult<VacationRequest>>(emptyPage<VacationRequest>());
  let balance = $state<VacationBalance | null>(null);
  let capacityAnalysis = $state<VacationCapacityAnalysis | null>(null);
  let statusLog = $state<VacationStatusLogEntry[]>([]);

  function setMyRequests(data: PaginatedResult<VacationRequest>) {
    myRequests = data;
  }

  function setIncomingRequests(data: PaginatedResult<VacationRequest>) {
    incomingRequests = data;
  }

  function setBalance(data: VacationBalance | null) {
    balance = data;
  }

  function setCapacityAnalysis(data: VacationCapacityAnalysis | null) {
    capacityAnalysis = data;
  }

  function setStatusLog(data: VacationStatusLogEntry[]) {
    statusLog = data;
  }

  function reset() {
    myRequests = emptyPage<VacationRequest>();
    incomingRequests = emptyPage<VacationRequest>();
    balance = null;
    capacityAnalysis = null;
    statusLog = [];
  }

  return {
    get myRequests() {
      return myRequests;
    },
    get incomingRequests() {
      return incomingRequests;
    },
    get balance() {
      return balance;
    },
    get capacityAnalysis() {
      return capacityAnalysis;
    },
    get statusLog() {
      return statusLog;
    },
    setMyRequests,
    setIncomingRequests,
    setBalance,
    setCapacityAnalysis,
    setStatusLog,
    reset,
  };
}

export const dataState = createDataState();

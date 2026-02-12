/**
 * Frontend type definitions for the Vacation module.
 * Mirrors backend vacation.types.ts but only the shapes needed by the UI.
 */

// ─── Enums (string unions) ───────────────────────────────────────────

export type VacationRequestStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'withdrawn'
  | 'cancelled';

export type VacationType =
  | 'regular'
  | 'special_doctor'
  | 'special_bereavement'
  | 'special_birth'
  | 'special_wedding'
  | 'special_move'
  | 'unpaid';

export type VacationHalfDay = 'none' | 'morning' | 'afternoon';

export type CapacityStatus = 'ok' | 'warning' | 'critical';

export type OverallCapacityStatus = 'ok' | 'warning' | 'blocked';

// ─── Core response types ─────────────────────────────────────────────

export interface VacationRequest {
  id: string;
  requesterId: number;
  approverId: number | null;
  substituteId: number | null;
  startDate: string;
  endDate: string;
  halfDayStart: VacationHalfDay;
  halfDayEnd: VacationHalfDay;
  vacationType: VacationType;
  status: VacationRequestStatus;
  computedDays: number;
  isSpecialLeave: boolean;
  requestNote: string | null;
  responseNote: string | null;
  respondedAt: string | null;
  respondedBy: number | null;
  createdAt: string;
  updatedAt: string;
  /** JOINed display names */
  requesterName?: string;
  approverName?: string;
  substituteName?: string;
}

export interface VacationBalance {
  year: number;
  totalDays: number;
  carriedOverDays: number;
  effectiveCarriedOver: number;
  additionalDays: number;
  availableDays: number;
  usedDays: number;
  remainingDays: number;
  pendingDays: number;
  projectedRemaining: number;
}

export interface VacationStatusLogEntry {
  id: string;
  requestId: string;
  previousStatus: VacationRequestStatus | null;
  newStatus: VacationRequestStatus;
  changedBy: number;
  changedByName?: string;
  note: string | null;
  createdAt: string;
}

// ─── Capacity analysis ───────────────────────────────────────────────

export interface DayCapacity {
  date: string;
  totalMembers: number;
  absentMembers: number;
  availableMembers: number;
  availableAfterApproval: number;
  status: CapacityStatus;
}

export interface MachineCapacity {
  machineId: number;
  machineName: string;
  minStaffCount: number;
  worstDay: DayCapacity | null;
  status: CapacityStatus;
}

export interface BlackoutConflict {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  scopeType: string;
}

export interface EntitlementCheck {
  currentBalance: number;
  requestedDays: number;
  remainingAfter: number;
  sufficient: boolean;
}

export interface VacationCapacityAnalysis {
  workdays: number;
  teamAnalysis: DayCapacity[];
  machineAnalysis: MachineCapacity[];
  blackoutConflicts: BlackoutConflict[];
  entitlementCheck: EntitlementCheck;
  overallStatus: OverallCapacityStatus;
}

// ─── Paginated result ────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Form payloads ───────────────────────────────────────────────────

export interface CreateVacationRequestPayload {
  startDate: string;
  endDate: string;
  halfDayStart?: VacationHalfDay;
  halfDayEnd?: VacationHalfDay;
  vacationType?: VacationType;
  requestNote?: string;
  substituteId?: number;
}

export interface RespondPayload {
  action: 'approve' | 'deny';
  responseNote?: string;
  isSpecialLeave?: boolean;
}

// ─── SSR page data ───────────────────────────────────────────────────

export interface VacationPageData {
  myRequests: PaginatedResult<VacationRequest>;
  incomingRequests: PaginatedResult<VacationRequest>;
  balance: VacationBalance | null;
  currentYear: number;
  userRole: 'root' | 'admin' | 'employee';
  userId: number;
  canApprove: boolean;
}

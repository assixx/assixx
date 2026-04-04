/**
 * Shift Swap Request Types
 *
 * DB row types and API response types for the swap request system.
 * Replaces legacy types in shifts.types.ts.
 */

// ============================================================
// ENUMS (mirror DB enums)
// ============================================================

export type SwapRequestScope = 'single_day' | 'week' | 'date_range';

export type SwapRequestStatus =
  | 'pending_partner'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'cancelled';

// ============================================================
// DB ROW TYPES
// ============================================================

export interface DbSwapRequestRow {
  uuid: string;
  tenant_id: number;
  requester_id: number | null;
  requester_shift_id: number | null;
  target_id: number | null;
  target_shift_id: number | null;
  team_id: number;
  swap_scope: SwapRequestScope;
  start_date: string;
  end_date: string;
  status: SwapRequestStatus;
  reason: string | null;
  partner_responded_at: string | null;
  partner_note: string | null;
  approval_uuid: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/** Extended row with JOINed user/shift names for list queries (LEFT JOIN → nullable) */
export interface DbSwapRequestDetailRow extends DbSwapRequestRow {
  requester_first_name: string | null;
  requester_last_name: string | null;
  target_first_name: string | null;
  target_last_name: string | null;
  requester_shift_date: string | null;
  requester_shift_type: string | null;
  target_shift_date: string | null;
  target_shift_type: string | null;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface SwapRequestResponse {
  uuid: string;
  requesterId: number | null;
  requesterName: string | null;
  requesterShiftId: number | null;
  requesterShiftDate: string;
  requesterShiftType: string;
  targetId: number | null;
  targetName: string | null;
  targetShiftId: number | null;
  targetShiftDate: string;
  targetShiftType: string;
  teamId: number;
  swapScope: SwapRequestScope;
  startDate: string;
  endDate: string;
  status: SwapRequestStatus;
  reason: string | null;
  partnerRespondedAt: string | null;
  partnerNote: string | null;
  approvalUuid: string | null;
  createdAt: string;
}

// ============================================================
// FILTER TYPES
// ============================================================

export interface SwapRequestFilters {
  userId?: number | undefined;
  status?: SwapRequestStatus | undefined;
  teamId?: number | undefined;
}

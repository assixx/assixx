// =============================================================================
// KVP - TYPE DEFINITIONS
// Based on: frontend/src/scripts/kvp/types.ts
// =============================================================================

/**
 * User roles
 */
export type UserRole = 'root' | 'admin' | 'employee';

/**
 * KVP Suggestion status
 */
export type KvpStatus =
  | 'new'
  | 'in_review'
  | 'approved'
  | 'implemented'
  | 'rejected'
  | 'archived'
  | 'restored';

/**
 * KVP Suggestion priority
 */
export type KvpPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Organization level
 */
export type OrgLevel = 'company' | 'department' | 'area' | 'team';

/**
 * Filter types for KVP list
 */
export type KvpFilter = 'all' | 'mine' | 'team' | 'department' | 'company' | 'manage' | 'archived';

/**
 * Current user
 */
export interface User {
  id: number;
  role: UserRole;
  tenantId?: number;
  departmentId?: number | null;
  teamId?: number;
}

/**
 * Current user alias (for backwards compatibility)
 */
export type CurrentUser = User;

/**
 * KVP Suggestion
 */
export interface KvpSuggestion {
  id: number;
  uuid: string;
  title: string;
  description: string;
  status: KvpStatus;
  priority: KvpPriority;
  orgLevel: OrgLevel;
  orgId: number;
  isShared: number; // 0 = private, 1 = shared
  departmentId: number;
  departmentName: string;
  areaId?: number;
  areaName?: string;
  teamId?: number;
  teamName?: string;
  submittedBy: number;
  submittedByName: string;
  submittedByLastname: string;
  categoryId: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  sharedBy?: number;
  sharedByName?: string;
  sharedAt?: string;
  createdAt: string;
  expectedBenefit?: string;
  estimatedCost?: number;
  actualSavings?: number;
  attachmentCount?: number;
  roi?: number;
  /** Read confirmation status (Pattern 2: Individual tracking) */
  isConfirmed?: boolean;
  /** When user FIRST saw this suggestion (null = never seen, for "Neu" badge) */
  firstSeenAt?: string | null;
}

/**
 * KVP Category
 */
export interface KvpCategory {
  id: number;
  name: string;
  icon?: string;
  color: string;
}

/**
 * Department
 */
export interface Department {
  id: number;
  name: string;
}

/**
 * Team
 */
export interface Team {
  id: number;
  name: string;
  teamLeadId?: number;
  team_lead_id?: number;
  leaderId?: number;
}

/**
 * Statistics response (v2 API format)
 */
export interface KvpStats {
  company?: {
    total: number;
    byStatus: StatusCounts;
    totalSavings: number;
  };
  total?: number;
  byStatus?: StatusCounts;
  totalSavings?: number;
}

/**
 * Status counts
 */
export interface StatusCounts {
  new?: number;
  inReview?: number;
  approved?: number;
  implemented?: number;
  rejected?: number;
  archived?: number;
  restored?: number;
}

/**
 * Form data for creating KVP suggestion
 */
export interface KvpFormData {
  title: string;
  description: string;
  categoryId: number | null;
  priority: KvpPriority;
  expectedBenefit?: string;
  orgLevel: OrgLevel;
  orgId: number;
  departmentId: number | null;
}

/**
 * Badge counts for filter toggle
 */
export interface BadgeCounts {
  all: number;
  mine: number;
  team: number;
  department: number;
  company: number;
  manage: number;
  archived: number;
}

/**
 * API pagination response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Suggestions API response
 */
export interface SuggestionsResponse {
  suggestions: KvpSuggestion[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

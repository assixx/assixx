// =============================================================================
// KVP - TYPE DEFINITIONS
// Based on: frontend/src/scripts/kvp/types.ts
// =============================================================================

/**
 * User roles
 */
export type UserRole = 'root' | 'admin' | 'employee' | 'dummy';

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
export type OrgLevel = 'company' | 'department' | 'area' | 'team' | 'asset';

/**
 * Filter types for KVP list
 */
export type KvpFilter =
  | 'all'
  | 'mine'
  | 'team'
  | 'asset'
  | 'department'
  | 'company'
  | 'manage'
  | 'archived';

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
  isShared: boolean;
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
  /** True when the custom category was soft-deleted (shown with strikethrough) */
  categoryIsDeleted?: boolean;
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
  /** Organization assignments from junction table (teams and/or assets) */
  organizations?: KvpOrgAssignment[];
}

/**
 * KVP Category (with source for global/custom distinction)
 */
export interface KvpCategory {
  id: number;
  source: 'global' | 'custom';
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
 * Dashboard statistics (flat structure matching backend DashboardStats)
 */
export interface KvpStats {
  totalSuggestions: number;
  newSuggestions: number;
  inReviewSuggestions: number;
  approvedSuggestions: number;
  implementedSuggestions: number;
  rejectedSuggestions: number;
  teamTotalSuggestions: number;
  teamImplementedSuggestions: number;
}

/**
 * Form data for creating KVP suggestion
 */
export interface KvpFormData {
  title: string;
  description: string;
  categoryId: number | null;
  customCategoryId: number | null;
  expectedBenefit?: string;
  teamIds: number[];
  assetIds: number[];
  departmentId: number | null;
}

/** Organization assignment on a KVP suggestion */
export interface KvpOrgAssignment {
  orgType: 'team' | 'asset';
  orgId: number;
  orgName?: string;
  /** For assets: team IDs that own this asset (from asset_teams) */
  relatedTeamIds?: number[];
}

/** User's team with assigned assets — from GET /kvp/my-organizations */
export interface UserTeamWithAssets {
  teamId: number;
  teamName: string;
  assets: { id: number; name: string }[];
}

/**
 * Badge counts for filter toggle
 */
export interface BadgeCounts {
  all: number;
  mine: number;
  team: number;
  asset: number;
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

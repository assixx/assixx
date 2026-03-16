// =============================================================================
// KVP-DETAIL - TYPE DEFINITIONS
// Based on: frontend/src/scripts/pages/kvp-detail/ui.ts
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
 * Current user
 */
export interface User {
  id: number;
  role: UserRole;
  tenantId: number;
  departmentId?: number | null;
  teamId?: number;
}

/**
 * KVP Suggestion (full detail)
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
  expectedBenefit?: string | null;
  estimatedCost?: number;
  actualSavings?: number;
  assignedTo?: number;
  assignedToName?: string;
  implementationDate?: string;
  rejectionReason?: string;
  sharedBy?: number;
  sharedByName?: string;
  sharedAt?: string;
  createdAt: string;
  updatedAt?: string;
  attachmentCount?: number;
  /** Read confirmation status (Pattern 2: Individual tracking) */
  isConfirmed?: boolean;
  /** When the user confirmed (read) this suggestion */
  confirmedAt?: string;
  /** Organization assignments from junction table (teams and/or assets) */
  organizations?: KvpOrgAssignment[];
}

/** Organization assignment on a KVP suggestion */
export interface KvpOrgAssignment {
  orgType: 'team' | 'asset';
  orgId: number;
  orgName?: string;
  /** For assets: team IDs that own this asset (from asset_teams) */
  relatedTeamIds?: number[];
}

/**
 * Comment on a suggestion
 * Note: Backend KVPComment has no uuid field, only id
 */
export interface Comment {
  id: number;
  suggestionId: number;
  comment: string;
  isInternal: boolean;
  parentId: number | null;
  replyCount: number;
  createdBy: number;
  createdByName: string;
  createdByLastname: string;
  profilePicture?: string | null;
  createdAt: string;
}

export interface PaginatedComments {
  comments: Comment[];
  total: number;
  hasMore: boolean;
}

/**
 * Attachment on a suggestion
 */
export interface Attachment {
  id: number;
  fileUuid: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedBy: number;
  uploadedByName?: string;
  createdAt: string;
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
  departmentId?: number | null;
  departmentName?: string;
  departmentAreaId?: number | null;
  departmentAreaName?: string;
}

/**
 * Area
 */
export interface Area {
  id: number;
  name: string;
}

/**
 * Asset
 */
export interface Asset {
  id: number;
  name: string;
}

/**
 * Linked work order summary (shown on KVP detail page)
 */
export interface LinkedWorkOrder {
  uuid: string;
  title: string;
  status: string;
  createdByName: string;
  createdAt: string;
}

/**
 * Share request data
 */
export interface ShareRequest {
  orgLevel: OrgLevel;
  orgId: number | null;
}

/**
 * Status update request
 */
export interface StatusUpdateRequest {
  status: KvpStatus;
  rejectionReason?: string;
}

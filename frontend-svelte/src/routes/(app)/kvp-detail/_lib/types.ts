// =============================================================================
// KVP-DETAIL - TYPE DEFINITIONS
// Based on: frontend/src/scripts/pages/kvp-detail/ui.ts
// =============================================================================

/**
 * User roles
 */
export type UserRole = 'root' | 'admin' | 'employee';

/**
 * KVP Suggestion status
 */
export type KvpStatus = 'new' | 'in_review' | 'approved' | 'implemented' | 'rejected' | 'archived';

/**
 * KVP Suggestion priority
 */
export type KvpPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Organization level
 */
export type OrgLevel = 'company' | 'department' | 'area' | 'team';

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
  isShared: number;
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
  expectedBenefit?: string;
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
  createdBy: number;
  createdByName: string;
  createdByLastname: string;
  createdAt: string;
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
}

/**
 * Area
 */
export interface Area {
  id: number;
  name: string;
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

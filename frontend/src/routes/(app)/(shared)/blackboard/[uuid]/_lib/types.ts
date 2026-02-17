/**
 * Blackboard Detail Types
 * Extended interfaces for the detail view
 */

// Re-export common types from parent
export type { Priority, EntryColor, OrgLevel } from '../../_lib/types';

// ============================================================================
// Detail Entry Type (Extended)
// ============================================================================

export interface DetailEntry {
  id: number;
  uuid: string;
  title: string;
  content: string;
  orgLevel: 'company' | 'department' | 'team' | 'area';
  orgId: number | null;
  expiresAt: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  color: 'yellow' | 'blue' | 'green' | 'red' | 'orange' | 'pink';
  /** is_active: 0=inactive, 1=active, 3=archive, 4=deleted */
  isActive: number;
  authorId: number;
  authorName?: string;
  authorFullName?: string;
  departmentName?: string;
  teamName?: string;
  areaName?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  isConfirmed?: boolean;
  confirmedAt?: string | null;
}

// ============================================================================
// Comment Type
// ============================================================================

export interface Comment {
  id: number;
  entryId: number;
  userId: number;
  comment: string;
  isInternal: boolean;
  parentId: number | null;
  replyCount: number;
  createdAt: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  profilePicture?: string | null;
}

export interface PaginatedComments {
  comments: Comment[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// Attachment Type
// ============================================================================

export interface Attachment {
  id: number;
  fileUuid: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: number;
  uploaderName: string;
  uploadedAt: string;
  /** Download URL (from documents service) */
  downloadUrl: string;
  /** Preview URL (from documents service) */
  previewUrl?: string;
}

// ============================================================================
// Preview Attachment Type (subset for modal)
// ============================================================================

export interface PreviewAttachment {
  fileUuid: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  uploaderName: string;
  downloadUrl: string;
  previewUrl?: string;
}

// ============================================================================
// Current User Type
// ============================================================================

export interface CurrentUser {
  id: number;
  role: string;
  tenantId: number;
  hasFullAccess: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface FullEntryResponse {
  success: boolean;
  data: {
    entry: DetailEntry;
    comments?: PaginatedComments;
    attachments?: Attachment[];
  };
  error?: {
    message: string;
  };
}

export interface MeResponse {
  success: boolean;
  data: CurrentUser;
}

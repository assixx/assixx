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
  status: 'active' | 'archived';
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
  createdAt: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  profilePicture?: string | null;
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
  uploadedByName: string;
  uploadedAt: string;
}

// ============================================================================
// Preview Attachment Type (subset for modal)
// ============================================================================

export interface PreviewAttachment {
  fileUuid: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  uploadedByName: string;
}

// ============================================================================
// Current User Type
// ============================================================================

export interface CurrentUser {
  id: number;
  role: string;
  tenantId: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface FullEntryResponse {
  success: boolean;
  data: {
    entry: DetailEntry;
    comments: Comment[];
    attachments: Attachment[];
  };
  error?: {
    message: string;
  };
}

export interface MeResponse {
  success: boolean;
  data: CurrentUser;
}

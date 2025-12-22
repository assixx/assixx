// =============================================================================
// DOCUMENTS EXPLORER - TYPE DEFINITIONS
// =============================================================================

/**
 * Document entity with all properties
 * Matches backend API v2 response structure
 */
export interface Document {
  /** Document ID (numeric, not UUID) */
  id: number;

  /** Original filename */
  filename: string;

  /** Stored filename (UUID-based) */
  storedFilename: string;

  /** Document category/type */
  category: string;

  /** Access scope - WHO can see this document */
  accessScope: AccessScope;

  /** File size in bytes */
  size: number;

  /** Upload timestamp */
  uploadedAt: string;

  /** ID of user who uploaded */
  uploadedBy: number;

  /** Name of user who uploaded */
  uploaderName: string;

  /** Whether document has been read by current user */
  isRead: boolean;

  /** Download URL */
  downloadUrl: string;

  /** Preview URL (if available) */
  previewUrl?: string;

  /** Owner user ID (for personal/payroll documents) */
  ownerUserId?: number | null;

  /** Target team ID (for team documents) */
  targetTeamId?: number | null;

  /** Target department ID (for department documents) */
  targetDepartmentId?: number | null;

  /** Salary year (for payroll documents) */
  salaryYear?: number | null;

  /** Salary month 1-12 (for payroll documents) */
  salaryMonth?: number | null;

  /** Blackboard entry ID (for blackboard attachments) */
  blackboardEntryId?: number | null;

  /** ID of recipient (computed field for compatibility) */
  recipientId?: number | null;

  /** Tags for categorization and search */
  tags?: string[];
}

/**
 * Access scope types for documents
 */
export type AccessScope =
  | 'personal'
  | 'team'
  | 'department'
  | 'company'
  | 'payroll'
  | 'blackboard'
  | 'chat';

/**
 * Document category for sidebar navigation
 */
export type DocumentCategory =
  | 'all'
  | 'personal'
  | 'team'
  | 'department'
  | 'company'
  | 'payroll'
  | 'blackboard'
  | 'chat';

/**
 * View mode for document display
 */
export type ViewMode = 'list' | 'grid';

/**
 * Sort options for document list
 */
export type SortOption = 'newest' | 'oldest' | 'name' | 'size';

/**
 * User role types
 */
export type UserRole = 'root' | 'admin' | 'employee';

/**
 * Folder item for sidebar display
 */
export interface FolderItem {
  category: DocumentCategory;
  label: string;
  icon: string;
  count: number;
  isActive: boolean;
}

/**
 * Chat folder (conversation with attachments)
 */
export interface ChatFolder {
  conversationId: number;
  conversationUuid: string;
  participantName: string;
  participantId: number;
  attachmentCount: number;
  isGroup: boolean;
  groupName: string | null;
}

/**
 * Document stats for quick stats display
 */
export interface DocumentStats {
  total: number;
  unread: number;
  thisWeek: number;
}

/**
 * Category counts for sidebar
 */
export type CategoryCounts = Record<DocumentCategory, number>;

/**
 * Upload form data
 */
export interface UploadFormData {
  file: File;
  accessScope: AccessScope;
  category: string;
  documentName?: string | null;
  description?: string | null;
  tags?: string[];
  ownerUserId?: number;
  targetTeamId?: number;
  targetDepartmentId?: number;
  salaryYear?: number;
  salaryMonth?: number;
}

/**
 * Category mapping configuration for upload
 */
export interface CategoryMapping {
  accessScope: AccessScope;
  requiresField?: 'team_id' | 'department_id';
  requiresPayrollPeriod?: boolean;
  categoryValue: string;
}

/**
 * User info for upload validation and permission checks
 */
export interface CurrentUser {
  id: number;
  tenant_id: number;
  department_id?: number | null;
  team_id?: number | null;
  role: string;
  /** Admin: 1 = full access to all documents, 0 = limited access */
  hasFullAccess?: boolean | null;
}

/**
 * Update document data (for edit modal)
 */
export interface UpdateDocumentData {
  documentName?: string;
  category?: string;
  tags?: string[];
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data?: T;
  success?: boolean;
  message?: string;
}

/**
 * File type display info for upload preview
 */
export interface FileTypeDisplayInfo {
  cssClass: string;
  iconClass: string;
}

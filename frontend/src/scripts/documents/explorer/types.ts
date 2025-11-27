/**
 * Documents Explorer - TypeScript Type Definitions
 *
 * Central type definitions for the Documents Explorer SPA
 * Used across all explorer modules for type safety
 *
 * @module explorer/types
 */

/**
 * Document category types
 * Maps to backend recipient types
 * Updated 2025-11-24: Added 'blackboard' for blackboard attachments
 */
export type DocumentCategory = 'all' | 'personal' | 'team' | 'department' | 'company' | 'payroll' | 'blackboard';

/**
 * View mode for document display
 */
export type ViewMode = 'list' | 'grid';

/**
 * Sort options for documents
 */
export type SortOption = 'newest' | 'oldest' | 'name' | 'size';

/**
 * User role types (from auth-helpers.ts)
 */
export type UserRole = 'employee' | 'admin' | 'root';

/**
 * Document interface (NEW: clean structure, refactored 2025-01-10)
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

  /** NEW: Access scope - WHO can see this document
   * Updated 2025-11-24: Added 'blackboard' */
  accessScope: 'personal' | 'team' | 'department' | 'company' | 'payroll' | 'blackboard';

  /** NEW: Owner user ID (for personal/payroll documents) */
  ownerUserId?: number | null;

  /** NEW: Target team ID (for team documents) */
  targetTeamId?: number | null;

  /** NEW: Target department ID (for department documents) */
  targetDepartmentId?: number | null;

  /** NEW: Salary year (for payroll documents) */
  salaryYear?: number | null;

  /** NEW: Salary month 1-12 (for payroll documents) */
  salaryMonth?: number | null;

  /** NEW: Blackboard entry ID (for blackboard attachments, 2025-11-24) */
  blackboardEntryId?: number | null;

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

  /** ID of recipient (computed field for compatibility) */
  recipientId?: number | null;

  /** Download URL */
  downloadUrl: string;

  /** Preview URL (if available) */
  previewUrl?: string;
}

/**
 * Application state interface
 * Central state managed by StateManager
 */
export interface AppState {
  /** Currently active category */
  currentCategory: DocumentCategory;

  /** Current view mode */
  viewMode: ViewMode;

  /** Current sort option */
  sortOption: SortOption;

  /** Search query */
  searchQuery: string;

  /** All documents (unfiltered) */
  documents: Document[];

  /** Filtered and sorted documents */
  filteredDocuments: Document[];

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: string | null;

  /** Currently selected document (for preview) */
  selectedDocument: Document | null;

  /** User role (determines UI permissions) */
  userRole: UserRole | null;

  /** Statistics */
  stats: DocumentStats;
}

/**
 * Document statistics
 */
export interface DocumentStats {
  /** Total documents in current view */
  total: number;

  /** Unread documents */
  unread: number;

  /** Documents uploaded this week */
  thisWeek: number;
}

/**
 * Folder tree item for sidebar
 */
export interface FolderItem {
  /** Category key */
  category: DocumentCategory;

  /** Display label */
  label: string;

  /** Icon HTML (SVG) */
  icon: string;

  /** Document count */
  count: number;

  /** Whether this folder is active */
  isActive: boolean;
}

/**
 * State observer callback
 * Called when state changes
 */
export type StateObserver = (state: AppState) => void;

/**
 * Router route definition
 */
export interface Route {
  /** Route path pattern (e.g., "/documents/:category") */
  path: string;

  /** Handler function */
  handler: (params: RouteParams) => void;
}

/**
 * Route parameters
 */
export type RouteParams = Record<string, string>;

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  /** Success flag */
  success: boolean;

  /** Response data */
  data: T | null;

  /** Error message (if any) */
  error: string | null;
}

/**
 * Upload form data (NEW: clean structure, refactored 2025-01-10)
 */
export interface UploadFormData {
  /** PDF file */
  file: File;

  /** NEW: Access scope - WHO can see this document */
  accessScope: 'personal' | 'team' | 'department' | 'company' | 'payroll';

  /** NEW: Owner user ID (for personal/payroll documents) */
  ownerUserId?: number | null;

  /** NEW: Target team ID (for team documents) */
  targetTeamId?: number | null;

  /** NEW: Target department ID (for department documents) */
  targetDepartmentId?: number | null;

  /** Document category */
  category: string;

  /** Document name (user-visible name, from input field) */
  documentName?: string | null;

  /** Document description (optional) */
  description?: string | null;

  /** NEW: Salary year (for payroll documents) */
  salaryYear?: number | null;

  /** NEW: Salary month 1-12 (for payroll documents) */
  salaryMonth?: number | null;
}

/**
 * Upload progress callback
 */
export type UploadProgressCallback = (progress: number) => void;

/**
 * Filter options
 */
export interface FilterOptions {
  /** Categories to include */
  categories?: string[];

  /** Year filter */
  year?: number;

  /** Month filter */
  month?: number;

  /** Only unread */
  onlyUnread?: boolean;

  /** Date range */
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Blackboard Types
 * Complete TypeScript interfaces matching backend model
 * Based on backend/src/models/blackboard.ts
 */

// ============================================================================
// Core Entry Types
// ============================================================================

export type OrgLevel = 'company' | 'department' | 'team' | 'area';
export type EntryStatus = 'active' | 'archived';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type EntryColor = 'yellow' | 'blue' | 'green' | 'red' | 'orange' | 'pink';

/**
 * Blackboard Entry (API v2 format)
 * CamelCase fields from API
 */
export interface BlackboardEntry {
  id: number;
  uuid: string; // External UUIDv7 identifier for secure, SEO-friendly URLs
  tenantId: number;
  title: string;
  content: string;
  orgLevel: OrgLevel;
  orgId: number | null;
  authorId: number;
  expiresAt?: string | null;
  priority: Priority;
  color: EntryColor;
  status: EntryStatus;
  createdAt: string;
  updatedAt: string;
  uuidCreatedAt?: string; // Track when UUID was generated

  // Extended fields from joins
  authorName?: string;
  authorFirstName?: string;
  authorLastName?: string;
  authorFullName?: string;
  isConfirmed?: boolean;
  attachmentCount?: number;
  commentCount?: number; // Number of comments on this entry
  attachments?: BlackboardAttachment[];
}

// ============================================================================
// Attachment Types
// ============================================================================

/**
 * Blackboard Attachment (API v2 format)
 * Updated 2025-11-24: Now uses documents system
 */
export interface BlackboardAttachment {
  id: number;
  fileUuid?: string; // UUID for file reference
  filename: string; // User-visible filename
  storedFilename?: string; // UUID-based storage filename
  originalName?: string; // Original uploaded filename (alias for filename)
  fileSize: number;
  mimeType: string;
  previewUrl?: string; // For inline preview
  downloadUrl?: string; // For download
  uploadedBy?: number;
  uploadedAt?: string;
  uploaderName?: string;
  // Legacy fields (backwards compatibility)
  entryId?: number;
  filePath?: string;
}

// ============================================================================
// Confirmation Types
// ============================================================================

/**
 * Confirmation User
 */
export interface ConfirmationUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  confirmed: boolean;
  confirmedAt?: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Entry Query Options (for filtering/pagination)
 */
export interface EntryQueryOptions {
  status?: EntryStatus | undefined;
  filter?: 'all' | OrgLevel | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  sortBy?: string | undefined;
  sortDir?: 'ASC' | 'DESC' | undefined;
  priority?: Priority | undefined;
}

/**
 * Create Entry Data
 * Multi-organization support: Entry can belong to multiple departments/teams/areas
 * If no organization arrays provided, entry is company-wide
 */
export interface CreateEntryData {
  title: string;
  content: string;
  // Multi-organization support - arrays of IDs
  departmentIds?: number[];
  teamIds?: number[];
  areaIds?: number[];
  // Legacy fields (optional for backwards compatibility)
  orgLevel?: OrgLevel;
  orgId?: number | null;
  expiresAt?: string | null;
  priority?: Priority;
  color?: EntryColor;
}

/**
 * Update Entry Data
 * Multi-organization support: Entry can belong to multiple departments/teams/areas
 */
export interface UpdateEntryData {
  title?: string;
  content?: string;
  // Multi-organization support - arrays of IDs
  departmentIds?: number[];
  teamIds?: number[];
  areaIds?: number[];
  // Legacy fields (optional for backwards compatibility)
  orgLevel?: OrgLevel;
  orgId?: number | null;
  expiresAt?: string | null;
  priority?: Priority;
  color?: EntryColor;
  status?: EntryStatus;
}

/**
 * API Response with Pagination
 */
export interface PaginatedResponse<T> {
  entries: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ============================================================================
// Organization Types
// ============================================================================

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
  departmentId?: number;
}

/**
 * Area
 */
export interface Area {
  id: number;
  name: string;
  type?: string;
  description?: string;
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Filter State
 */
export interface FilterState {
  status: EntryStatus;
  filter: 'all' | OrgLevel;
  search: string;
  sortBy: string;
  sortDir: 'ASC' | 'DESC';
  priority?: Priority | undefined;
}

/**
 * Pagination State
 */
export interface PaginationState {
  currentPage: number;
  totalPages: number;
  limit: number;
  total: number;
}

// ============================================================================
// Form Types
// ============================================================================

/**
 * Entry Form State
 */
export interface EntryFormState {
  mode: 'create' | 'edit';
  editingEntryId: number | null;
  selectedFiles: File[];
}

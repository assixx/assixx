/**
 * Blackboard Types
 * TypeScript interfaces for the blackboard module
 * Based on Legacy frontend/src/scripts/blackboard/types.ts
 */

// ============================================================================
// Core Types
// ============================================================================

export type OrgLevel = 'company' | 'department' | 'team' | 'area';
export type EntryStatus = 'active' | 'archived';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type EntryColor = 'yellow' | 'blue' | 'green' | 'red' | 'orange' | 'pink';
export type FormMode = 'create' | 'edit';
export type SortDir = 'ASC' | 'DESC';

// ============================================================================
// Organization Types
// ============================================================================

export interface OrgItem {
  id: number;
  name: string;
}

export interface Department extends OrgItem {
  areaId?: number;
  areaName?: string;
}

export interface Team extends OrgItem {
  departmentId?: number;
}

export interface Area extends OrgItem {
  type?: string;
  description?: string;
  departmentCount?: number;
}

// ============================================================================
// Entry Types
// ============================================================================

export interface BlackboardEntry {
  id: number;
  uuid: string;
  tenantId?: number;
  title: string;
  content: string;
  orgLevel: OrgLevel;
  orgId?: number | null;
  authorId?: number;
  expiresAt?: string | null;
  priority: Priority;
  color: EntryColor;
  status?: EntryStatus;
  createdAt: string;
  updatedAt?: string;
  // Extended fields from joins
  authorName?: string;
  authorFirstName?: string;
  authorLastName?: string;
  authorFullName?: string;
  isConfirmed?: boolean;
  attachmentCount?: number;
  commentCount?: number;
  attachments?: BlackboardAttachment[];
  // Organization targeting (for edit modal)
  departmentIds?: number[];
  teamIds?: number[];
  areaIds?: number[];
}

export interface BlackboardAttachment {
  id: number;
  fileUuid?: string;
  filename: string;
  storedFilename?: string;
  originalName?: string;
  fileSize: number;
  mimeType: string;
  previewUrl?: string;
  downloadUrl?: string;
  uploadedBy?: number;
  uploadedAt?: string;
  uploaderName?: string;
  entryId?: number;
  filePath?: string;
}

// ============================================================================
// API Types
// ============================================================================

export interface CreateEntryData {
  title: string;
  content: string;
  departmentIds?: number[];
  teamIds?: number[];
  areaIds?: number[];
  orgLevel?: OrgLevel;
  orgId?: number | null;
  expiresAt?: string | null;
  priority?: Priority;
  color?: EntryColor;
}

export interface UpdateEntryData {
  title?: string;
  content?: string;
  departmentIds?: number[];
  teamIds?: number[];
  areaIds?: number[];
  orgLevel?: OrgLevel;
  orgId?: number | null;
  expiresAt?: string | null;
  priority?: Priority;
  color?: EntryColor;
  status?: EntryStatus;
}

export interface PaginatedResponse<T> {
  entries?: T[];
  data?: T[];
  meta?: {
    pagination: PaginationMeta;
  };
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface FilterState {
  status: EntryStatus;
  filter: 'all' | OrgLevel;
  search: string;
  sortBy: string;
  sortDir: SortDir;
  priority?: Priority;
}

// ============================================================================
// Form Types
// ============================================================================

export interface EntryFormData {
  title: string;
  content: string;
  priority: Priority;
  color: EntryColor;
  expiresAt: string;
  companyWide: boolean;
  departmentIds: number[];
  teamIds: number[];
  areaIds: number[];
}

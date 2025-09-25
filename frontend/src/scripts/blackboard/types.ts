/**
 * Blackboard Types & Interfaces
 * All type definitions for the blackboard feature
 */

import type { User } from '../../types/api.types';

export interface BlackboardEntry {
  id: number;
  title: string;
  content: string;
  priority_level: 'low' | 'medium' | 'high' | 'critical';
  org_level: 'all' | 'department' | 'team';
  org_id?: number;
  department_id?: number;
  team_id?: number;
  color: string;
  created_by: number;
  created_by_name?: string;
  author_name?: string;
  author_first_name?: string;
  author_last_name?: string;
  author_full_name?: string;
  // API v2 fields (camelCase)
  authorName?: string;
  authorFirstName?: string;
  authorLastName?: string;
  authorFullName?: string;
  created_at: string;
  updated_at: string;
  // API v2 date fields (camelCase)
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  attachment_count?: number;
  attachments?: BlackboardAttachment[];
}

export interface BlackboardAttachment {
  id: number;
  entry_id: number;
  filename: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by: number;
  uploaded_at: string;
  uploader_name?: string;
}

export interface Department {
  id: number;
  name: string;
}

export interface Team {
  id: number;
  name: string;
  department_id: number;
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalEntries: number;
  entriesPerPage: number;
}

export interface BlackboardResponse {
  entries: BlackboardEntry[];
  pagination?: PaginationInfo;
}

export interface UserData extends User {
  departmentId?: number;
  department_id?: number;
  teamId?: number;
  team_id?: number;
}

// Map v2 API response (camelCase) to UI format (snake_case) if needed
export interface V2EntryResponse {
  id: number;
  title: string;
  content: string;
  priority?: string;
  priority_level?: string;
  orgLevel?: string;
  org_level?: string;
  orgId?: number;
  org_id?: number;
  createdBy?: number;
  created_by?: number;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  color?: string;
  // Author fields from API v2
  authorName?: string;
  authorFirstName?: string;
  authorLastName?: string;
  authorFullName?: string;
  [key: string]: unknown;
}

// V2 API detail response
export interface V2EntryDetailResponse {
  id: number;
  title: string;
  content: string;
  priority?: string;
  priority_level?: string;
  orgLevel?: string;
  org_level?: string;
  orgId?: number;
  org_id?: number;
  color?: string;
  // Author fields from API v2
  authorName?: string;
  authorFirstName?: string;
  authorLastName?: string;
  authorFullName?: string;
  [key: string]: unknown;
}

// Direct attachment handler types
export interface DirectAttachHandlers {
  dropZoneClick?: () => void;
  fileInputChange?: (e: Event) => void;
  dragOver?: (e: DragEvent) => void;
  dragLeave?: () => void;
  drop?: (e: DragEvent) => void;
}

// Constants
export const MIME_TYPE_PDF = 'application/pdf';
export const FULLSCREEN_MODE_CLASS = 'fullscreen-mode';
export const DISPLAY_INLINE_FLEX = 'inline-flex';
export const DISPLAY_NONE = 'none';

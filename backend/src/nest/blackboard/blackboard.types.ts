/**
 * Blackboard Types
 *
 * Shared type definitions for the blackboard module.
 * Used by service, helpers, and sub-services.
 */

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface DbBlackboardEntry {
  id: number;
  uuid: string;
  tenant_id: number;
  title: string;
  content: string | Buffer | { type: 'Buffer'; data: number[] };
  org_level: 'company' | 'department' | 'team' | 'area';
  org_id: number;
  author_id: number;
  expires_at: Date | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  color: string;
  is_active: number; // 0=inactive, 1=active, 3=archive, 4=deleted
  created_at: Date;
  updated_at: Date;
  uuid_created_at?: Date;
  author_name?: string;
  is_confirmed?: boolean | number;
  confirmed_at?: Date;
  first_seen_at?: Date;
  author_first_name?: string;
  author_last_name?: string;
  author_full_name?: string;
  attachment_count?: number;
  comment_count?: number;
}

export interface DbBlackboardComment {
  id: number;
  tenant_id: number;
  entry_id: number;
  user_id: number;
  comment: string;
  is_internal: number;
  parent_id: number | null;
  created_at: Date;
  user_name?: string;
  user_first_name?: string;
  user_last_name?: string;
  user_full_name?: string;
  user_role?: string;
  user_profile_picture?: string | null;
  reply_count?: number;
}

export interface DbConfirmationUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  confirmed: number;
  confirmed_at?: Date;
}

export interface UserDepartmentTeam {
  role: string | null;
  has_full_access: boolean;
  primary_department_id: number | null;
  team_id: number | null;
  department_name: string | null;
  team_name: string | null;
}

export interface CountResult {
  total: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export type BlackboardEntryResponse = Record<string, unknown>;

export interface PaginatedEntriesResult {
  entries: BlackboardEntryResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface EntryFilters {
  isActive: number | undefined; // 0=inactive, 1=active, 3=archive, 4=deleted
  filter: 'all' | 'company' | 'department' | 'team' | 'area' | undefined;
  search: string | undefined;
  page: number | undefined;
  limit: number | undefined;
  sortBy: string | undefined;
  sortDir: 'ASC' | 'DESC' | undefined;
  priority: string | undefined;
}

/** Normalized filter values with defaults applied */
export interface NormalizedFilters {
  isActive: number; // 0=inactive, 1=active, 3=archive, 4=deleted
  filter: 'all' | 'company' | 'department' | 'team' | 'area';
  search: string;
  page: number;
  limit: number;
  sortBy: string;
  sortDir: 'ASC' | 'DESC';
  priority: string | undefined;
}

export interface BlackboardComment {
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

export interface PaginatedBlackboardComments {
  comments: BlackboardComment[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// USER ACCESS TYPES
// ============================================================================

export interface UserAccessInfo {
  role: string | null;
  departmentId: number | null;
  teamId: number | null;
  hasFullAccess: boolean;
}

// ============================================================================
// ADR-045 Layer 2 — Own effective blackboard permissions
// ============================================================================

export interface BlackboardMyPermissions {
  posts: { canRead: boolean; canWrite: boolean; canDelete: boolean };
  comments: { canRead: boolean; canWrite: boolean; canDelete: boolean };
  archive: { canRead: boolean; canWrite: boolean };
}

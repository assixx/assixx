/**
 * KVP Types - Database and API interfaces
 *
 * Separated from service for cleaner code organization and ESLint max-lines compliance.
 */

// ============================================================================
// DATABASE TYPES (internal use only)
// ============================================================================

export interface DbCategory {
  id: number;
  tenant_id: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface DbSuggestion {
  id: number;
  uuid: string;
  tenant_id: number;
  title: string;
  description: string;
  category_id: number;
  custom_category_id: number | null;
  org_level: 'company' | 'department' | 'area' | 'team';
  org_id: number;
  department_id: number | null;
  team_id: number | null;
  is_shared: boolean;
  submitted_by: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  expected_benefit?: string;
  estimated_cost?: string;
  status: string;
  assigned_to?: number;
  actual_savings?: number;
  rejection_reason?: string;
  created_at: Date;
  updated_at: Date;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  department_name?: string;
  team_name?: string;
  area_name?: string;
  submitted_by_name?: string;
  submitted_by_lastname?: string;
  assigned_to_name?: string;
  assigned_to_lastname?: string;
  attachment_count?: number;
  comment_count?: number;
  /** Read confirmation status (COALESCE returns boolean, never null) */
  is_confirmed?: boolean;
  /** When the user confirmed (read) this suggestion (null from LEFT JOIN) */
  confirmed_at?: Date | string | null;
  /** When the user FIRST saw this suggestion (null = never seen) */
  first_seen_at?: Date | string | null;
}

export interface DbComment {
  id: number;
  suggestion_id: number;
  user_id: number;
  comment: string;
  is_internal: boolean;
  created_at: Date;
  first_name?: string;
  last_name?: string;
  role?: string;
  profile_picture?: string | null;
}

export interface DbAttachment {
  id: number;
  file_uuid: string;
  suggestion_id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: number;
  uploaded_at: Date | null;
}

export interface DbDashboardStats {
  total_suggestions: number;
  new_suggestions: number;
  in_progress_count: number;
  implemented: number;
  rejected: number;
  avg_savings: number | null;
}

/**
 * Basic user org info (legacy - kept for backwards compatibility)
 */
export interface UserOrgInfo {
  team_id: number | null;
  department_id: number | null;
  area_id: number | null;
}

/**
 * Extended user org info for KVP visibility checks
 *
 * Contains all memberships, lead positions, and inheritance chains
 * needed to determine what KVP suggestions a user can see.
 *
 * @see /docs/kvp-share-doc.md for full visibility logic
 */
export interface ExtendedUserOrgInfo {
  // Direct memberships (user is member/assigned)
  /** Team IDs where user is a member (from user_teams) */
  teamIds: number[];
  /** Department IDs where user is assigned (from user_departments) */
  departmentIds: number[];
  /** Area IDs derived from user's departments */
  areaIds: number[];

  // Lead positions (user is the lead)
  /** Team IDs where user is team_lead_id */
  teamLeadOf: number[];
  /** Department IDs where user is department_lead_id */
  departmentLeadOf: number[];
  /** Area IDs where user is area_lead_id */
  areaLeadOf: number[];

  // Inheritance chains (for visibility propagation)
  /** Department IDs of user's teams (Team → Department inheritance) */
  teamsDepartmentIds: number[];
  /** Area IDs of user's departments (Department → Area inheritance) */
  departmentsAreaIds: number[];

  // Special access flag
  /** If true, user sees ALL KVPs in tenant (bypasses visibility) */
  hasFullAccess: boolean;
}

// ============================================================================
// API TYPES (exported for controller use)
// ============================================================================

export interface Category {
  id: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

/** Category option for dropdown (includes source for global/custom distinction) */
export interface CategoryOption {
  id: number;
  source: 'global' | 'custom';
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface KVPSuggestionResponse {
  id: number;
  uuid: string;
  title: string;
  description: string;
  categoryId: number;
  customCategoryId: number | null;
  orgLevel: string;
  orgId: number;
  isShared: boolean;
  departmentId: number | null;
  teamId: number | null;
  submittedBy: number;
  status: string;
  priority: string;
  expectedBenefit?: string;
  estimatedCost?: string;
  actualSavings?: number;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  /** Whether current user has marked this suggestion as read */
  isConfirmed?: boolean;
  /** When the user confirmed (read) this suggestion */
  confirmedAt?: string;
  /** When the user FIRST saw this suggestion (never reset, for "Neu" badge) */
  firstSeenAt?: string;
  category?: {
    id: number;
    name: string;
    color?: string;
    icon?: string;
  };
  submitter?: {
    firstName: string;
    lastName: string;
  };
}

export interface KVPComment {
  id: number;
  suggestionId: number;
  comment: string;
  isInternal: boolean;
  createdBy: number;
  createdByName?: string;
  createdByLastname?: string;
  profilePicture?: string | null;
  createdAt: string;
}

export interface KVPAttachment {
  id: number;
  suggestionId: number;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  uploadedBy: number;
  fileUuid: string;
  createdAt: string;
}

export interface DashboardStats {
  totalSuggestions: number;
  newSuggestions: number;
  inReviewSuggestions: number;
  approvedSuggestions: number;
  implementedSuggestions: number;
  rejectedSuggestions: number;
}

export interface PaginatedSuggestionsResult {
  suggestions: KVPSuggestionResponse[];
  pagination: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
  };
}

export interface SuggestionFilters {
  status: string | undefined;
  categoryId: number | undefined;
  customCategoryId: number | undefined;
  priority: string | undefined;
  orgLevel: string | undefined;
  search: string | undefined;
  page: number | undefined;
  limit: number | undefined;
  mineOnly: boolean | undefined;
}

// ============================================================================
// INTERNAL TYPES (used by sub-services and helpers)
// ============================================================================

/** DB result interface for extended org info query */
export interface DbExtendedOrgInfo {
  has_full_access: boolean;
  team_ids: number[];
  department_ids: number[];
  area_ids: number[];
  team_lead_of: number[];
  department_lead_of: number[];
  area_lead_of: number[];
  teams_department_ids: number[];
  departments_area_ids: number[];
}

/** SQL placeholder strings for org-based visibility queries */
export interface OrgPlaceholders {
  teamIds: string;
  teamLeadOf: string;
  deptIds: string;
  teamsDeptIds: string;
  deptLeadOf: string;
  areaIds: string;
  deptsAreaIds: string;
  areaLeadOf: string;
  userId: string;
}

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
  org_level: 'company' | 'department' | 'area' | 'team';
  org_id: number;
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
  submitted_by_name?: string;
  submitted_by_lastname?: string;
  assigned_to_name?: string;
  assigned_to_lastname?: string;
  attachment_count?: number;
  comment_count?: number;
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

export interface UserOrgInfo {
  team_id: number | null;
  department_id: number | null;
  area_id: number | null;
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

export interface KVPSuggestionResponse {
  id: number;
  uuid: string;
  title: string;
  description: string;
  categoryId: number;
  orgLevel: string;
  orgId: number;
  isShared: boolean;
  submittedBy: number;
  status: string;
  priority: string;
  expectedBenefit?: string;
  estimatedCost?: string;
  actualSavings?: number;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
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
  priority: string | undefined;
  orgLevel: string | undefined;
  search: string | undefined;
  page: number | undefined;
  limit: number | undefined;
}

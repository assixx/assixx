/**
 * KVP Types and Interfaces
 * Shared type definitions for KVP functionality
 */

export interface User {
  id: number;
  role: 'root' | 'admin' | 'employee';
  tenantId: number;
  departmentId: number | null; // Make it explicitly nullable but always present
}

export interface KvpSuggestion {
  id: number;
  title: string;
  description: string;
  status: 'new' | 'in_review' | 'approved' | 'implemented' | 'rejected' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  orgLevel: 'company' | 'department' | 'team';
  orgId: number;
  departmentId: number;
  departmentName: string;
  teamId?: number;
  teamName?: string;
  submittedBy: number;
  submittedByName: string;
  submittedByLastname: string;
  categoryId: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  sharedBy?: number;
  sharedByName?: string;
  sharedAt?: string;
  createdAt: string;
  expectedBenefit?: string;
  estimatedCost?: number;
  actualSavings?: number;
  attachmentCount?: number;
  roi?: number; // NEW in v2!
}

export interface KvpCategory {
  id: number;
  name: string;
  icon?: string;
  color: string;
}

export interface Department {
  id: number;
  name: string;
}

export interface KvpWindow extends Window {
  selectCategory: (id: string, name: string) => void;
  selectDepartment: (id: string, name: string) => void;
  selectKvpCategory?: (id: string, name: string) => void;
  showCreateModal: () => void;
  hideCreateModal: () => void;
  selectedPhotos?: File[];
}

// Type for v1 API response with snake_case fields
export interface V1Suggestion {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  org_level?: string;
  orgLevel?: string;
  org_id?: number;
  orgId?: number;
  department_id?: number;
  departmentId?: number;
  department_name?: string;
  departmentName?: string;
  submitted_by?: number;
  submittedBy?: number;
  submitted_by_name?: string;
  submittedByName?: string;
  submitted_by_lastname?: string;
  submittedByLastname?: string;
  category_id?: number;
  categoryId?: number;
  category_name?: string;
  categoryName?: string;
  category_icon?: string;
  categoryIcon?: string;
  category_color?: string;
  categoryColor?: string;
  shared_by?: number;
  sharedBy?: number;
  shared_by_name?: string;
  sharedByName?: string;
  shared_at?: string;
  sharedAt?: string;
  created_at?: string;
  createdAt?: string;
  expected_benefit?: string;
  expectedBenefit?: string;
  estimated_cost?: number;
  estimatedCost?: number;
  actual_savings?: number;
  actualSavings?: number;
  attachment_count?: number;
  attachmentCount?: number;
  roi?: number;
}

export interface V1Status {
  new?: number;
  in_review?: number;
  implemented?: number;
  approved?: number;
  rejected?: number;
  archived?: number;
}

export interface V2Status {
  new?: number;
  inReview?: number;
  approved?: number;
  implemented?: number;
  rejected?: number;
  archived?: number;
}

export interface StatsResponse {
  company?: {
    total: number;
    byStatus: V1Status | V2Status;
    totalSavings: number;
  };
  total?: number;
  byStatus?: V2Status;
  totalSavings?: number;
}

export interface UserMeResponse {
  id?: number;
  teamId?: number;
  team_id?: number;
  teamName?: string;
  team?: { id: number };
  teams?: { id: number; team_id?: number }[];
}

export interface TeamResponse {
  id: number;
  team_lead_id?: number;
  teamLeadId?: number;
  leaderId?: number;
}

export interface ValidationError extends Error {
  details?: {
    field: string;
    message: string;
  }[];
}

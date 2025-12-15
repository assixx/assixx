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
  uuid: string; // NEW: External UUIDv7 identifier for secure URLs
  title: string;
  description: string;
  status: 'new' | 'in_review' | 'approved' | 'implemented' | 'rejected' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  orgLevel: 'company' | 'department' | 'area' | 'team';
  orgId: number;
  isShared: number; // 0 = private (only creator + team leader), 1 = shared
  departmentId: number;
  departmentName: string;
  areaId?: number;
  areaName?: string;
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
    byStatus: V2Status;
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

// =============================================================================
// MANAGE TEAMS - TYPE DEFINITIONS
// =============================================================================

/**
 * Department interface
 */
export interface Department {
  id: number;
  name: string;
}

/**
 * Machine interface
 */
export interface Machine {
  id: number;
  name: string;
  departmentId?: number;
  departmentName?: string;
  status?: string;
}

/**
 * Team member interface
 */
export interface TeamMember {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  position?: string;
  role?: string;
}

/**
 * Admin interface for team lead selection
 */
export interface Admin {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role?: string;
}

/**
 * Team interface - main data model
 */
export interface Team {
  id: number;
  name: string;
  description?: string;
  leaderId?: number;
  leaderName?: string;
  departmentId?: number;
  departmentName?: string;
  memberCount?: number;
  memberNames?: string;
  machineCount?: number;
  machineNames?: string;
  isActive: IsActiveStatus;
  createdAt: string;
  updatedAt: string;
  members?: TeamMember[];
  machines?: Machine[];
}

/**
 * Status filter type for team list filtering
 */
export type StatusFilter = 'active' | 'inactive' | 'archived' | 'all';

/**
 * isActive status values
 * 0 = inactive, 1 = active, 3 = archived, 4 = deleted (soft delete)
 */
export type IsActiveStatus = 0 | 1 | 3 | 4;

/**
 * Form-compatible isActive status (excludes deleted)
 */
export type FormIsActiveStatus = 0 | 1 | 3;

/**
 * Team form data structure
 */
export interface TeamFormData {
  name: string;
  description: string;
  departmentId: number | null;
  leaderId: number | null;
  memberIds: number[];
  machineIds: number[];
  isActive: FormIsActiveStatus;
}

/**
 * API request payload for creating/updating team
 */
export interface TeamPayload {
  name: string;
  description?: string;
  departmentId?: number;
  leaderId?: number;
  isActive: FormIsActiveStatus;
}

/**
 * Team details response with relations
 */
export interface TeamDetails {
  members?: { id: number }[];
  machines?: { id: number }[];
}

/**
 * API error with details
 */
export interface ApiErrorWithDetails {
  message?: string;
  code?: string;
  details?: {
    memberCount?: number;
  };
}

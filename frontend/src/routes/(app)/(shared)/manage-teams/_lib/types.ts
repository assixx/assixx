// =============================================================================
// MANAGE TEAMS - TYPE DEFINITIONS
// =============================================================================

import type {
  IsActiveStatus,
  FormIsActiveStatus,
  StatusFilter,
} from '@assixx/shared';

export type { IsActiveStatus, FormIsActiveStatus, StatusFilter };

/**
 * Department interface - with area hierarchy info
 */
export interface Department {
  id: number;
  name: string;
  areaId?: number;
  areaName?: string;
}

/**
 * Badge info for display with tooltip
 * BADGE-INHERITANCE-DISPLAY: Used for showing hierarchy tooltips
 */
export interface BadgeInfo {
  class: string;
  text: string;
  title: string;
}

/**
 * Asset interface
 */
export interface Asset {
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
  memberCount?: number | string;
  memberNames?: string;
  assetCount?: number | string;
  assetNames?: string;
  isActive: IsActiveStatus;
  createdAt: string;
  updatedAt: string;
  members?: TeamMember[];
  assets?: Asset[];
}

/**
 * Team form data structure
 */
export interface TeamFormData {
  name: string;
  description: string;
  departmentId: number | null;
  leaderId: number | null;
  memberIds: number[];
  assetIds: number[];
  isActive: FormIsActiveStatus;
}

/**
 * API request payload for creating/updating team
 */
export interface TeamPayload {
  name: string;
  description?: string;
  departmentId?: number | null;
  leaderId?: number | null;
  isActive: FormIsActiveStatus;
}

/**
 * Team details response with relations
 */
export interface TeamDetails {
  members?: { id: number }[];
  assets?: { id: number }[];
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

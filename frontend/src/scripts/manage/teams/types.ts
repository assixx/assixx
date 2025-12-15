/**
 * Types and Interfaces for Teams Management
 * Shared type definitions used across teams management modules
 */

import type { ApiClient } from '../../../utils/api-client';

/**
 * Interface describing the TeamsManager methods needed by data.ts and forms.ts
 * Avoids circular dependencies while maintaining type safety
 */
export interface ITeamsManager {
  apiClient: ApiClient;
  getTeamDetails(id: number): Promise<Team | null>;
  deleteTeam(id: number): void;
  updateTeam(id: number, teamData: Partial<Team>): Promise<Team>;
  createTeam(teamData: Partial<Team>): Promise<Team>;
  loadTeams(): Promise<void>;
}

export interface TeamMember {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  position?: string | null;
  employeeId?: string;
}

/**
 * UPDATED: isArchived removed, using unified isActive status (2025-12-02)
 * Status: 0=inactive, 1=active, 3=archived, 4=deleted
 */
export interface Team {
  id: number;
  name: string;
  description?: string;
  leaderId?: number;
  leaderName?: string;
  departmentId?: number;
  departmentName?: string;
  areaId?: number;
  shiftModelId?: number;
  memberCount?: number;
  memberNames?: string;
  machineCount?: number;
  machineNames?: string;
  maxMembers?: number;
  teamType?: 'production' | 'quality' | 'maintenance' | 'logistics' | 'administration' | 'other';
  status?: 'active' | 'inactive' | 'restructuring'; // Legacy - prefer isActive
  foundedDate?: string;
  costCenter?: string;
  budget?: number;
  performanceScore?: number;
  notes?: string;
  isActive: 0 | 1 | 3 | 4; // Status: 0=inactive, 1=active, 3=archived, 4=deleted
  createdAt: string;
  updatedAt: string;
  members?: TeamMember[];
  machines?: { id: number; name: string }[];
}

export interface Department {
  id: number;
  name: string;
}

export interface Machine {
  id: number;
  name: string;
  departmentId?: number | null;
  departmentName?: string | null;
  areaId?: number | null;
  status?: string;
}

export interface WindowWithTeamHandlers extends Window {
  editTeam?: (id: number) => Promise<void>;
  viewTeamDetails?: (id: number) => Promise<void>;
  deleteTeam?: (id: number) => void;
  showTeamModal?: () => Promise<void>;
  closeTeamModal?: () => void;
  saveTeam?: () => Promise<void>;
}

export interface ProcessedFormData {
  teamData: Record<string, string | number | null>;
  machineIds: number[];
  userIds: number[];
}

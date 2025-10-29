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
  status: 'active' | 'inactive' | 'restructuring';
  foundedDate?: string;
  costCenter?: string;
  budget?: number;
  performanceScore?: number;
  notes?: string;
  isActive?: boolean;
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
  teamData: Record<string, string | number>;
  machineIds: number[];
  userIds: number[];
}

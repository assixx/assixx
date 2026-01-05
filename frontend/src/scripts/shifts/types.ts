/**
 * Type definitions for Shift Planning System
 * Extracted from index.ts for modular architecture
 */

import type { User } from '../../types/api.types';

// Re-export User for convenience
export type { User };

// Rotation Pattern from database
export interface RotationPattern {
  id: number;
  tenantId: number;
  teamId: number | null;
  name: string;
  description?: string;
  patternType: 'alternate_fs' | 'fixed_n' | 'custom';
  patternConfig: Record<string, unknown>;
  cycleLengthWeeks: number;
  startsAt: string;
  endsAt?: string | null;
  isActive: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

// Team structure
export interface Team {
  id: number;
  name: string;
  description?: string | undefined;
  leaderId?: number | undefined;
  leaderName?: string | undefined;
  departmentId?: number | undefined;
  departmentName?: string | undefined;
  memberCount?: number | undefined;
  status?: string | undefined;
  createdAt: string;
  updatedAt: string;
  members?: TeamMember[] | undefined;
  teamLeadId?: number | undefined;
}

// Shift detail data for display
export interface ShiftDetailData {
  employeeId: number;
  firstName: string;
  lastName: string;
  username: string;
  date?: string;
  shiftType?: string;
  isRotationShift?: boolean; // Flag to identify shifts from rotation history
}

// Employee with shift-specific extensions
export interface Employee extends User {
  shiftAssignments?: ShiftAssignment[];
  availabilityReason?: string;
  availableFrom?: string;
}

// Shift assignment record
export interface ShiftAssignment {
  id: number;
  employeeId: number;
  date: string;
  shiftType: 'early' | 'late' | 'night';
  departmentId?: number;
  machineId?: number;
  teamLeaderId?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Area (top of hierarchy)
export interface Area {
  id: number;
  name: string;
  description?: string;
  type?: string;
}

// Department
export interface Department {
  id: number;
  name: string;
  description?: string;
  areaId?: number;
}

// Machine
export interface Machine {
  id: number;
  name: string;
  departmentId: number;
  areaId?: number;
  description?: string;
}

// Team member
export interface TeamMember {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  role: 'member' | 'lead';
  userRole?: 'admin' | 'employee' | 'root';
  availabilityStatus?: string;
  availabilityStart?: string;
  availabilityEnd?: string;
}

// Team leader
export interface TeamLeader {
  id: number;
  name: string;
  username: string;
}

// Selected context for shift planning
export interface SelectedContext {
  areaId: number | null;
  departmentId: number | null;
  machineId: number | null;
  teamId: number | null;
  teamLeaderId: number | null;
}

// Shift favorite configuration
export interface ShiftFavorite {
  id: number | string;
  name: string;
  areaId: number;
  areaName: string;
  departmentId: number;
  departmentName: string;
  machineId: number;
  machineName: string;
  teamId: number;
  teamName: string;
  createdAt: string;
}

// Window extension for shift functions
export interface ShiftsWindow extends Window {
  selectOption: (type: string, value: string, text: string) => void;
}

// Autofill configuration
export interface ShiftAutofillConfig {
  enabled: boolean;
  fillWeekdays: boolean;
  skipWeekends: boolean;
  respectAvailability: boolean;
}

// Rotation configuration
export interface ShiftRotationConfig {
  enabled: boolean;
  pattern: 'F_S_alternate' | 'custom';
  nightFixed: boolean;
  autoGenerateWeeks: number;
}

// Shift type literals
export type ShiftType = 'early' | 'late' | 'night' | 'F' | 'S' | 'N';

// API response types
export interface ShiftPlanResponse {
  plan?: {
    id: number;
    name: string;
    shiftNotes?: string;
    startDate: string;
    endDate: string;
  };
  shifts: {
    id?: number;
    userId: number;
    date: string;
    type: string;
    startTime?: string;
    endTime?: string;
    user?: {
      id: number;
      firstName: string;
      lastName: string;
      username: string;
    };
  }[];
  notes?: Record<string, { note: string }> | unknown[];
}

// Legacy shift data format (kept for backwards compatibility with old API responses)
export interface LegacyShiftData {
  date: string;
  shiftType: string;
  employeeId: number;
  firstName: string;
  lastName: string;
  username: string;
}

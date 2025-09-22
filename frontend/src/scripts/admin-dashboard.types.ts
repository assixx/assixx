/**
 * Type definitions for Admin Dashboard
 */

import type { BlackboardEntry } from '../types/api.types';

export interface DashboardStats {
  employeeCount: number;
  documentCount: number;
  departmentCount: number;
  teamCount: number;
}

export interface Department {
  id: number;
  name: string;
  description?: string;
  status?: string;
  visibility?: string;
  memberCount?: number;
}

export interface Team {
  id: number;
  name: string;
  departmentId: number;
  departmentName?: string;
  description?: string;
  memberCount?: number;
}

export interface EmployeeFormData {
  username: string;
  email: string;
  emailConfirm: string;
  password: string;
  passwordConfirm: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  position?: string;
  departmentId?: number;
  teamId?: number;
  phone?: string;
  birthDate?: string;
  startDate?: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  role?: string;
}

export interface BlackboardAttachment {
  id: number;
  entryId: number;
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: number;
  uploadedAt: string;
  uploaderName?: string;
}

export interface BlackboardEntryExtended extends BlackboardEntry {
  priorityLevel?: 'low' | 'medium' | 'high' | 'critical';
  orgLevel?: 'all' | 'department' | 'team';
  orgId?: number;
  departmentId?: number;
  teamId?: number;
  color?: string;
  createdBy: number;
  createdByName?: string;
  authorName?: string;
  authorFirstName?: string;
  authorLastName?: string;
  authorFullName?: string;
  createdAt?: string;
  updatedAt?: string;
  attachmentCount?: number;
  attachments?: BlackboardAttachment[];
}

// Constants
export const API_V2_DEPARTMENTS = '/api/v2/departments';
export const API_V1_DEPARTMENTS = '/api/departments';
export const API_V1_TEAMS = '/api/teams';

// UI Class Constants
export const CLASS_COMPACT_ITEM = 'compact-item';
export const CLASS_COMPACT_ITEM_NAME = 'compact-item-name';

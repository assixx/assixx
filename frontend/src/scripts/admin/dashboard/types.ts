/**
 * Type definitions for Admin Dashboard
 */

import type { BlackboardEntry } from '../../../types/api.types';

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
  // color, createdBy, createdByName, createdAt, updatedAt inherited from BlackboardEntry
  authorName?: string;
  authorFirstName?: string;
  authorLastName?: string;
  authorFullName?: string;
  attachmentCount?: number;
  attachments?: BlackboardAttachment[];
}

// Constants
export const API_V2_DEPARTMENTS = '/api/v2/departments';
export const API_V1_DEPARTMENTS = '/api/departments';
export const API_V1_TEAMS = '/api/teams';

// Calendar Event type matching actual API v2 response (uses startTime/endTime)
export interface CalendarEventApi {
  id: number;
  tenantId: number;
  createdBy: number;
  title: string;
  description?: string;
  startTime: string; // API returns startTime, not startDate
  endTime: string; // API returns endTime, not endDate
  allDay: boolean | number; // Can be boolean or 0/1
  location?: string;
  category: string;
  color?: string;
  orgLevel?: string; // API returns orgLevel for visibility
  recurring?: boolean;
  recurrencePattern?: string;
  createdAt: string;
  updatedAt: string;
}

// UI Class Constants
export const CLASS_COMPACT_ITEM = 'compact-item';
export const CLASS_COMPACT_ITEM_NAME = 'compact-item-name';

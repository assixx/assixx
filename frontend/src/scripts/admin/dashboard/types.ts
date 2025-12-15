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
  position?: string | undefined;
  departmentId?: number | undefined;
  teamId?: number | undefined;
  phone?: string | undefined;
  birthDate?: string | undefined;
  startDate?: string | undefined;
  street?: string | undefined;
  houseNumber?: string | undefined;
  postalCode?: string | undefined;
  city?: string | undefined;
  role?: string | undefined;
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
  priorityLevel?: 'low' | 'medium' | 'high' | 'critical' | undefined;
  // orgLevel inherited from BlackboardEntry: 'company' | 'department' | 'team'
  // orgId inherited from BlackboardEntry: number | null
  departmentId?: number | undefined;
  teamId?: number | undefined;
  // color, createdBy, createdByName, createdAt, updatedAt inherited from BlackboardEntry
  // authorName, authorFirstName, authorLastName, authorFullName, attachmentCount, attachments inherited from BlackboardEntry
}

// Constants (API v2 only)
export const API_V2_DEPARTMENTS = '/api/v2/departments';

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

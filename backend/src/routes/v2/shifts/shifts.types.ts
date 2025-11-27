/**
 * Shifts Controller Types
 * Type definitions for shift-related API operations
 */

export interface ShiftCreateData {
  planId?: number;
  userId: number;
  templateId?: number;
  date: string;
  startTime: string;
  endTime: string;
  title?: string;
  requiredEmployees?: number;
  breakMinutes?: number;
  status?: string;
  type?: string;
  notes?: string;
  departmentId: number;
  teamId?: number;
}

export interface ShiftUpdateData {
  planId?: number;
  userId?: number;
  templateId?: number;
  date?: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  requiredEmployees?: number;
  actualStart?: string;
  actualEnd?: string;
  breakMinutes?: number;
  status?: string;
  type?: string;
  notes?: string;
  departmentId?: number;
  teamId?: number;
}

export interface TemplateCreateData {
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  color?: string;
  isNightShift?: boolean;
  isActive?: boolean;
}

export interface TemplateUpdateData {
  name?: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  color?: string;
  isNightShift?: boolean;
  isActive?: boolean;
}

export interface SwapRequestCreateData {
  shiftId: number;
  requestedWithUserId?: number;
  reason?: string;
}

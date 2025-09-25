/**
 * Shift Types and Interfaces
 * Shared type definitions for shift system
 */
import type { RowDataPacket } from '../utils/db';

// Error Messages
export const ERROR_MESSAGES = {
  MISSING_REQUIRED_FIELDS: 'Missing required fields',
} as const;

// SQL Query Fragments
export const SQL_FRAGMENTS = {
  DEPARTMENT_FILTER: ' AND sp.department_id = ?',
  TEAM_FILTER: ' AND sp.team_id = ?',
} as const;

/**
 * Format datetime strings for MySQL (remove 'Z' and convert to local format)
 */
export function formatDateForMysql(dateString: string | Date | null): string | null {
  if (dateString == null || dateString === '') return null;
  const date = new Date(dateString);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Format date only for MySQL
 */
export function formatDateOnlyForMysql(dateString: string | Date | null): string | null {
  if (dateString == null || dateString === '') return null;
  const date = new Date(dateString);
  return date.toISOString().slice(0, 10);
}

// Database interfaces
export interface DbShiftTemplate extends RowDataPacket {
  id: number;
  tenant_id: number;
  name: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  duration_hours: number;
  break_minutes: number;
  color: string;
  is_active: boolean | number;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

export interface DbShiftPlan extends RowDataPacket {
  id: number;
  tenant_id: number;
  name: string;
  description?: string | null;
  start_date: Date;
  end_date: Date;
  department_id?: number | null;
  team_id?: number | null;
  status: 'draft' | 'published' | 'archived';
  created_by: number;
  created_at: Date;
  updated_at: Date;
  // Extended fields from joins
  created_by_name?: string;
  department_name?: string | null;
  team_name?: string | null;
}

export interface DbShift extends RowDataPacket {
  id: number;
  tenant_id: number;
  plan_id: number;
  template_id?: number | null;
  date: Date;
  start_time: string;
  end_time: string;
  required_employees: number;
  created_by: number;
  created_at: Date;
  updated_at: Date;
  // Extended fields from joins
  template_name?: string | null;
  template_color?: string | null;
  assignments?: string | null;
  assignedEmployees?: { name: string; status: string }[];
  assignment_status?: string;
  assigned_at?: Date;
  plan_name?: string;
}

export interface DbShiftAssignment extends RowDataPacket {
  id: number;
  tenant_id: number;
  shift_id: number;
  user_id: number;
  status: 'A' | 'R';
  assigned_by: number;
  assigned_at: Date;
  // Extended fields from joins
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface DbEmployeeAvailability extends RowDataPacket {
  id: number;
  tenant_id: number;
  user_id: number;
  date: Date;
  availability_type: 'available' | 'unavailable' | 'partial';
  start_time?: string | null;
  end_time?: string | null;
  notes?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ShiftQueryResult extends RowDataPacket {
  id: number;
  assigned_user_name?: string;
  first_name?: string;
  last_name?: string;
  department_name?: string;
  team_name?: string;
  [key: string]: unknown;
}

export interface ShiftNoteRow extends RowDataPacket {
  date: string;
  notes: string;
}

export interface DbShiftExchangeRequest extends RowDataPacket {
  id: number;
  tenant_id: number;
  shift_id: number;
  requester_id: number;
  target_user_id?: number | null;
  exchange_type: 'swap' | 'giveaway';
  target_shift_id?: number | null;
  message?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: Date;
  updated_at: Date;
  // Extended fields from joins
  date?: Date;
  start_time?: string;
  end_time?: string;
  shift_template_name?: string | null;
  requester_first_name?: string;
  requester_last_name?: string;
  target_first_name?: string | null;
  target_last_name?: string | null;
}

export interface ShiftPlanFilters {
  department_id?: number;
  team_id?: number;
  start_date?: string | Date;
  end_date?: string | Date;
  status?: 'draft' | 'published' | 'archived';
  page?: number;
  limit?: number;
}

export interface ShiftExchangeFilters {
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  limit?: number;
}

export interface ShiftTemplateData {
  tenant_id: number;
  name: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  duration_hours: number;
  break_minutes?: number;
  color?: string;
  created_by: number;
}

export interface ShiftPlanData {
  tenant_id: number;
  name: string;
  description?: string | null;
  start_date: string | Date;
  end_date: string | Date;
  department_id?: number | null;
  team_id?: number | null;
  created_by: number;
}

export interface ShiftData {
  tenant_id: number;
  plan_id: number;
  template_id?: number | null;
  date: string | Date;
  start_time: string;
  end_time: string;
  required_employees?: number;
  created_by: number;
}

export interface ShiftAssignmentData {
  tenant_id: number;
  shift_id: number;
  user_id: number;
  assigned_by: number;
}

export interface EmployeeAvailabilityData {
  tenant_id: number;
  user_id: number;
  date: string | Date;
  availability_type: 'available' | 'unavailable' | 'partial';
  start_time?: string | null;
  end_time?: string | null;
  notes?: string | null;
}

export interface ShiftExchangeRequestData {
  tenant_id: number;
  shift_id: number;
  requester_id: number;
  target_user_id?: number | null;
  exchange_type: 'swap' | 'giveaway';
  target_shift_id?: number | null;
  message?: string | null;
}

export interface CountResult extends RowDataPacket {
  total: number;
}

// V2 API Interfaces
export interface V2ShiftFilters {
  tenant_id: number;
  date?: string;
  start_date?: string;
  end_date?: string;
  user_id?: number;
  department_id?: number;
  team_id?: number;
  status?: string;
  type?: string;
  template_id?: number;
  plan_id?: number;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  offset?: number;
}

export interface V2ShiftData extends RowDataPacket {
  id: number;
  tenant_id: number;
  plan_id?: number;
  user_id: number;
  template_id?: number;
  date: string;
  start_time: string;
  end_time: string;
  title?: string;
  required_employees?: number;
  actual_start?: string;
  actual_end?: string;
  break_minutes?: number;
  status?: string;
  type?: string;
  notes?: string;
  department_id: number;
  team_id?: number;
  created_by?: number;
  created_at?: Date;
  updated_at?: Date;
  // Joined fields
  template_name?: string;
  template_color?: string;
  user_name?: string;
  first_name?: string;
  last_name?: string;
  department_name?: string;
  team_name?: string;
}

export interface V2TemplateData {
  tenant_id: number;
  name: string;
  description?: string;
  start_time: string;
  end_time: string;
  break_minutes?: number;
  color?: string;
  is_night_shift?: boolean;
  is_active?: boolean;
  created_by?: number;
}

export interface V2SwapRequestData {
  shift_id: number;
  requested_by: number;
  requested_with?: number;
  reason?: string;
  tenant_id: number;
  status: string;
}

export interface V2SwapRequestFilters {
  userId?: number;
  status?: string;
}

export interface V2SwapRequestResult extends RowDataPacket {
  id: number;
  shift_id: number;
  requested_by: number;
  requested_with?: number;
  reason?: string;
  status: string;
  approved_by?: number;
  approved_at?: Date;
  created_at: Date;
  updated_at: Date;
  // Joined fields
  shift_date?: string;
  shift_start_time?: string;
  shift_end_time?: string;
  original_user_id?: number;
  requested_by_username?: string;
  requested_by_first_name?: string;
  requested_by_last_name?: string;
  requested_with_username?: string;
  requested_with_first_name?: string;
  requested_with_last_name?: string;
}

/**
 * Helper function to calculate duration hours
 */
export function calculateDurationHours(startTime: string, endTime: string): number {
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  const diffMs = end.getTime() - start.getTime();
  return diffMs / (1000 * 60 * 60);
}

/**
 * Calendar State Management
 * Centralized state for the calendar system
 * Replaces scattered global variables with a singleton class
 *
 * Updated for @event-calendar/core (Phase 0 Migration)
 * UPGRADE: v3 → v5 (createCalendar API) - 2025-12-22
 */

import type { createCalendar } from '@event-calendar/core';
import type { User } from '../../types/api.types';
import type { Department, Team, FilterLevel, ViewMode } from './types';

// v5 API: Calendar type is return type of createCalendar
type Calendar = ReturnType<typeof createCalendar>;

/**
 * Calendar State Manager (Singleton)
 *
 * Manages all mutable state for the calendar system:
 * - EventCalendar instance
 * - Current user info
 * - Organization data (departments, teams, employees)
 * - UI state (filters, search, selected items)
 */
class CalendarState {
  // ============================================================================
  // Singleton Pattern
  // ============================================================================

  private static instance: CalendarState | null = null;

  /**
   * Get singleton instance
   */
  public static getInstance(): CalendarState {
    CalendarState.instance ??= new CalendarState();
    return CalendarState.instance;
  }

  /**
   * Reset state (useful for testing)
   */
  public static reset(): void {
    CalendarState.instance = null;
  }

  // ============================================================================
  // EventCalendar Instance
  // ============================================================================

  private _calendar: Calendar | null = null;

  /**
   * Get EventCalendar instance
   */

  public get calendar(): Calendar | null {
    return this._calendar;
  }

  /**
   * Set EventCalendar instance
   */

  public set calendar(instance: Calendar | null) {
    this._calendar = instance;
  }

  /**
   * Check if calendar is initialized
   */
  public isCalendarInitialized(): boolean {
    return this._calendar !== null;
  }

  // ============================================================================
  // Current User
  // ============================================================================

  private _currentUserId: number | null = null;
  private _isAdmin: boolean = false;

  /**
   * Get current user ID
   */
  public get currentUserId(): number | null {
    return this._currentUserId;
  }

  /**
   * Set current user ID
   */
  public set currentUserId(id: number | null) {
    this._currentUserId = id;
  }

  /**
   * Get admin status
   */
  public get isAdmin(): boolean {
    return this._isAdmin;
  }

  /**
   * Set admin status
   */
  public set isAdmin(value: boolean) {
    this._isAdmin = value;
  }

  /**
   * Set user from user data object
   */
  public setUser(user: { id: number; role?: string }): void {
    this._currentUserId = user.id;
    this._isAdmin = user.role === 'admin' || user.role === 'root';
  }

  // ============================================================================
  // Organization Data
  // ============================================================================

  private _departments: Department[] = [];
  private _teams: Team[] = [];
  private _areas: { id: number; name: string }[] = [];
  private _employees: User[] = [];

  /**
   * Get departments
   */
  public get departments(): Department[] {
    return this._departments;
  }

  /**
   * Set departments
   */
  public set departments(depts: Department[]) {
    this._departments = depts;
  }

  /**
   * Get teams
   */
  public get teams(): Team[] {
    return this._teams;
  }

  /**
   * Set teams
   */
  public set teams(teams: Team[]) {
    this._teams = teams;
  }

  /**
   * Get areas
   */
  public get areas(): { id: number; name: string }[] {
    return this._areas;
  }

  /**
   * Set areas
   */
  public set areas(areas: { id: number; name: string }[]) {
    this._areas = areas;
  }

  /**
   * Get employees
   */
  public get employees(): User[] {
    return this._employees;
  }

  /**
   * Set employees
   */
  public set employees(users: User[]) {
    this._employees = users;
  }

  // ============================================================================
  // Filter State
  // ============================================================================

  private _currentFilter: FilterLevel = 'all';

  /**
   * Get current filter level
   */
  public get currentFilter(): FilterLevel {
    return this._currentFilter;
  }

  /**
   * Set current filter level
   */
  public set currentFilter(level: FilterLevel) {
    this._currentFilter = level;
  }

  // ============================================================================
  // Search State
  // ============================================================================

  private _currentSearch: string = '';

  /**
   * Get current search query
   */
  public get currentSearch(): string {
    return this._currentSearch;
  }

  /**
   * Set current search query
   */
  public set currentSearch(query: string) {
    this._currentSearch = query;
  }

  // ============================================================================
  // View State
  // ============================================================================

  private _calendarView: ViewMode = 'dayGridMonth';

  /**
   * Get current calendar view
   */
  public get calendarView(): ViewMode {
    return this._calendarView;
  }

  /**
   * Set current calendar view
   */
  public set calendarView(view: ViewMode) {
    this._calendarView = view;
  }

  // ============================================================================
  // Selected Items State
  // ============================================================================

  private _selectedAttendees: number[] = [];
  private _eventToDelete: number | null = null;

  /**
   * Get selected attendees
   */
  public get selectedAttendees(): number[] {
    return this._selectedAttendees;
  }

  /**
   * Set selected attendees
   */
  public set selectedAttendees(ids: number[]) {
    this._selectedAttendees = ids;
  }

  /**
   * Add attendee to selection
   */
  public addAttendee(userId: number): void {
    if (!this._selectedAttendees.includes(userId)) {
      this._selectedAttendees.push(userId);
    }
  }

  /**
   * Remove attendee from selection
   */
  public removeAttendee(userId: number): void {
    this._selectedAttendees = this._selectedAttendees.filter((id) => id !== userId);
  }

  /**
   * Clear selected attendees
   */
  public clearAttendees(): void {
    this._selectedAttendees = [];
  }

  /**
   * Get event to delete
   */
  public get eventToDelete(): number | null {
    return this._eventToDelete;
  }

  /**
   * Set event to delete
   */
  public set eventToDelete(id: number | null) {
    this._eventToDelete = id;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if user can create events
   */
  public canCreateEvents(): boolean {
    return this._isAdmin;
  }

  /**
   * Check if user can edit event
   */
  public canEditEvent(event: { created_by: number } | { createdBy?: number }): boolean {
    if (this._isAdmin) {
      return true;
    }

    // Check both v1 and v2 field names
    const createdBy = 'created_by' in event ? event.created_by : (event as { createdBy?: number }).createdBy;

    return createdBy === this._currentUserId;
  }

  /**
   * Check if user can delete event
   * Only admin/root can delete events (employees cannot delete, even their own)
   */
  public canDeleteEvent(_event: { created_by: number } | { createdBy?: number }): boolean {
    // Only admins and root can delete events
    return this._isAdmin;
  }

  /**
   * Get department by ID
   */
  public getDepartmentById(id: number): Department | undefined {
    return this._departments.find((dept) => dept.id === id);
  }

  /**
   * Get team by ID
   */
  public getTeamById(id: number): Team | undefined {
    return this._teams.find((team) => team.id === id);
  }

  /**
   * Get employee by ID
   */
  public getEmployeeById(id: number): User | undefined {
    return this._employees.find((emp) => emp.id === id);
  }

  /**
   * Get teams for department
   */
  public getTeamsByDepartment(departmentId: number): Team[] {
    return this._teams.filter((team) => (team.department_id ?? team.departmentId) === departmentId);
  }

  // ============================================================================
  // Reset Methods
  // ============================================================================

  /**
   * Reset organization data
   */
  public resetOrgData(): void {
    this._departments = [];
    this._teams = [];
    this._employees = [];
  }

  /**
   * Reset UI state (filters, search, selections)
   */
  public resetUIState(): void {
    this._currentFilter = 'all';
    this._currentSearch = '';
    this._selectedAttendees = [];
    this._eventToDelete = null;
  }

  /**
   * Reset all state
   */
  public resetAll(): void {
    this._calendar = null;
    this._currentUserId = null;
    this._isAdmin = false;
    this.resetOrgData();
    this.resetUIState();
  }

  // ============================================================================
  // Private Constructor (Singleton)
  // ============================================================================

  private constructor() {
    // Private constructor prevents direct instantiation
  }
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Singleton instance for easy access
 */
export const state = CalendarState.getInstance();

/**
 * Export class for testing
 */
export { CalendarState };

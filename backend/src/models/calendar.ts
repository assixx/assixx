/**
 * Calendar Model
 * Handles database operations for the calendar events and attendees
 */

import pool from '../database';
import User from './user';
import { logger } from '../utils/logger';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

// Helper function to handle both real pool and mock database
async function executeQuery<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: any[]
): Promise<[T, any]> {
  const result = await (pool as any).query(sql, params);
  if (Array.isArray(result) && result.length === 2) {
    return result as [T, any];
  }
  return [result as T, null];
}

/**
 * Format datetime strings for MySQL (remove 'Z' and convert to local format)
 */
function formatDateForMysql(dateString: string | Date | null): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// Database interfaces
interface DbCalendarEvent extends RowDataPacket {
  id: number;
  tenant_id: number;
  title: string;
  description?: string | Buffer | { type: 'Buffer'; data: number[] };
  location?: string;
  start_time: Date;
  end_time: Date;
  all_day: boolean | number;
  org_level: 'company' | 'department' | 'team';
  org_id: number;
  created_by: number;
  reminder_time?: number | null;
  color: string;
  status: 'active' | 'cancelled';
  created_at: Date;
  updated_at: Date;
  // Extended fields from joins
  creator_name?: string;
  user_response?: string | null;
}

interface DbEventAttendee extends RowDataPacket {
  user_id: number;
  response_status: 'pending' | 'accepted' | 'declined' | 'tentative';
  responded_at?: Date;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  profile_picture?: string;
}

interface EventQueryOptions {
  status?: 'active' | 'cancelled';
  filter?: 'all' | 'company' | 'department' | 'team';
  search?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
}

interface EventCreateData {
  tenant_id: number;
  title: string;
  description?: string;
  location?: string;
  start_time: string | Date;
  end_time: string | Date;
  all_day?: boolean;
  org_level: 'company' | 'department' | 'team';
  org_id: number;
  created_by: number;
  reminder_time?: number | null;
  color?: string;
}

interface EventUpdateData {
  title?: string;
  description?: string;
  location?: string;
  start_time?: string | Date;
  end_time?: string | Date;
  all_day?: boolean;
  org_level?: 'company' | 'department' | 'team';
  org_id?: number;
  status?: 'active' | 'cancelled';
  reminder_time?: number | string | null;
  color?: string;
  created_by?: number;
}

interface CountResult extends RowDataPacket {
  total: number;
}

interface UserInfo {
  role: string | null;
  departmentId: number | null;
  teamId: number | null;
}

export class Calendar {
  /**
   * Get all calendar events visible to the user
   */
  static async getAllEvents(
    tenantId: number,
    userId: number,
    options: EventQueryOptions = {}
  ) {
    try {
      const {
        status = 'active',
        filter = 'all',
        search = '',
        start_date,
        end_date,
        page = 1,
        limit = 50,
        sortBy = 'start_time',
        sortDir = 'ASC',
      } = options;

      // Determine user's department and team for access control
      const { role, departmentId, teamId } =
        await User.getUserDepartmentAndTeam(userId);

      // Build base query
      let query = `
        SELECT e.*, 
               u.username as creator_name,
               CASE WHEN a.id IS NOT NULL THEN a.response_status ELSE NULL END as user_response
        FROM calendar_events e
        LEFT JOIN users u ON e.created_by = u.id
        LEFT JOIN calendar_attendees a ON e.id = a.event_id AND a.user_id = ?
        WHERE e.tenant_id = ? AND e.status = ?
      `;

      const queryParams: any[] = [userId, tenantId, status];

      // Apply org level filter
      if (filter !== 'all') {
        query += ' AND e.org_level = ?';
        queryParams.push(filter);
      }

      // Apply access control for non-admin users
      if (role !== 'admin' && role !== 'root') {
        query += ` AND (
          e.org_level = 'company' OR 
          (e.org_level = 'department' AND e.org_id = ?) OR
          (e.org_level = 'team' AND e.org_id = ?) OR
          EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = ?)
        )`;
        queryParams.push(departmentId || 0, teamId || 0, userId);
      }

      // Apply date range filter
      if (start_date) {
        query += ' AND e.end_time >= ?';
        queryParams.push(start_date);
      }

      if (end_date) {
        query += ' AND e.start_time <= ?';
        queryParams.push(end_date);
      }

      // Apply search filter
      if (search) {
        query +=
          ' AND (e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)';
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
      }

      // Apply sorting
      query += ` ORDER BY e.${sortBy} ${sortDir}`;

      // Apply pagination
      const offset = (page - 1) * limit;
      query += ' LIMIT ? OFFSET ?';
      queryParams.push(parseInt(limit.toString(), 10), offset);

      // Execute query
      const [events] = await executeQuery<DbCalendarEvent[]>(
        query,
        queryParams
      );

      // Convert Buffer description to String if needed
      events.forEach((event) => {
        if (event.description && Buffer.isBuffer(event.description)) {
          event.description = event.description.toString('utf8');
        } else if (
          event.description &&
          typeof event.description === 'object' &&
          'type' in event.description &&
          event.description.type === 'Buffer' &&
          Array.isArray(event.description.data)
        ) {
          event.description = Buffer.from(event.description.data).toString(
            'utf8'
          );
        }
      });

      // Count total events for pagination
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM calendar_events e
        WHERE e.tenant_id = ? AND e.status = ?
      `;

      const countParams: any[] = [tenantId, status];

      // Apply org level filter for count
      if (filter !== 'all') {
        countQuery += ' AND e.org_level = ?';
        countParams.push(filter);
      }

      // Apply access control for non-admin users for count
      if (role !== 'admin' && role !== 'root') {
        countQuery += ` AND (
          e.org_level = 'company' OR 
          (e.org_level = 'department' AND e.org_id = ?) OR
          (e.org_level = 'team' AND e.org_id = ?) OR
          EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = ?)
        )`;
        countParams.push(departmentId || 0, teamId || 0, userId);
      }

      // Apply date range filter for count
      if (start_date) {
        countQuery += ' AND e.end_time >= ?';
        countParams.push(start_date);
      }

      if (end_date) {
        countQuery += ' AND e.start_time <= ?';
        countParams.push(end_date);
      }

      // Apply search filter for count
      if (search) {
        countQuery +=
          ' AND (e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)';
        const searchTerm = `%${search}%`;
        countParams.push(searchTerm, searchTerm, searchTerm);
      }

      const [countResult] = await executeQuery<CountResult[]>(
        countQuery,
        countParams
      );
      const totalEvents = countResult[0].total;

      return {
        events,
        pagination: {
          total: totalEvents,
          page: parseInt(page.toString(), 10),
          limit: parseInt(limit.toString(), 10),
          totalPages: Math.ceil(totalEvents / limit),
        },
      };
    } catch (error) {
      logger.error('Error in getAllEvents:', error);
      throw error;
    }
  }

  /**
   * Get a specific calendar event by ID
   */
  static async getEventById(
    id: number,
    tenantId: number,
    userId: number
  ): Promise<DbCalendarEvent | null> {
    try {
      // Determine user's department and team for access control
      const { role, departmentId, teamId } =
        await User.getUserDepartmentAndTeam(userId);

      // Query the event with user response status
      const query = `
        SELECT e.*, 
               u.username as creator_name,
               CASE WHEN a.id IS NOT NULL THEN a.response_status ELSE NULL END as user_response
        FROM calendar_events e
        LEFT JOIN users u ON e.created_by = u.id
        LEFT JOIN calendar_attendees a ON e.id = a.event_id AND a.user_id = ?
        WHERE e.id = ? AND e.tenant_id = ?
      `;

      const [events] = await executeQuery<DbCalendarEvent[]>(query, [
        userId,
        id,
        tenantId,
      ]);

      if (events.length === 0) {
        return null;
      }

      const event = events[0];

      // Convert Buffer description to String if needed
      if (event.description && Buffer.isBuffer(event.description)) {
        event.description = event.description.toString('utf8');
      } else if (
        event.description &&
        typeof event.description === 'object' &&
        'type' in event.description &&
        event.description.type === 'Buffer' &&
        Array.isArray(event.description.data)
      ) {
        event.description = Buffer.from(event.description.data).toString(
          'utf8'
        );
      }

      // Check access control for non-admin users
      if (role !== 'admin' && role !== 'root') {
        // Check if user is an attendee
        const [attendeeRows] = await executeQuery<RowDataPacket[]>(
          'SELECT 1 FROM calendar_attendees WHERE event_id = ? AND user_id = ?',
          [id, userId]
        );

        const isAttendee = attendeeRows.length > 0;

        const hasAccess =
          event.org_level === 'company' ||
          (event.org_level === 'department' && event.org_id === departmentId) ||
          (event.org_level === 'team' && event.org_id === teamId) ||
          isAttendee;

        if (!hasAccess) {
          return null; // User doesn't have access to this event
        }
      }

      return event;
    } catch (error) {
      logger.error('Error in getEventById:', error);
      throw error;
    }
  }

  /**
   * Create a new calendar event
   */
  static async createEvent(
    eventData: EventCreateData
  ): Promise<DbCalendarEvent | null> {
    try {
      const {
        tenant_id,
        title,
        description,
        location,
        start_time,
        end_time,
        all_day,
        org_level,
        org_id,
        created_by,
        reminder_time,
        color,
      } = eventData;

      // Validate required fields
      if (
        !tenant_id ||
        !title ||
        !start_time ||
        !end_time ||
        !org_level ||
        !org_id ||
        !created_by
      ) {
        throw new Error('Missing required fields');
      }

      // Ensure dates are valid
      if (new Date(start_time) > new Date(end_time)) {
        throw new Error('Start time must be before end time');
      }

      // Insert new event
      const query = `
        INSERT INTO calendar_events 
        (tenant_id, title, description, location, start_time, end_time, all_day, 
         org_level, org_id, created_by, reminder_time, color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await executeQuery<ResultSetHeader>(query, [
        tenant_id,
        title,
        description || null,
        location || null,
        formatDateForMysql(start_time),
        formatDateForMysql(end_time),
        all_day ? 1 : 0,
        org_level,
        org_id,
        created_by,
        reminder_time || null,
        color || '#3498db',
      ]);

      // Get the created event
      const createdEvent = await this.getEventById(
        result.insertId,
        tenant_id,
        created_by
      );

      // Add the creator as an attendee with 'accepted' status
      if (createdEvent) {
        await this.addEventAttendee(createdEvent.id, created_by, 'accepted');
      }

      return createdEvent;
    } catch (error) {
      logger.error('Error in createEvent:', error);
      throw error;
    }
  }

  /**
   * Update a calendar event
   */
  static async updateEvent(
    id: number,
    eventData: EventUpdateData,
    tenantId: number
  ): Promise<DbCalendarEvent | null> {
    try {
      const {
        title,
        description,
        location,
        start_time,
        end_time,
        all_day,
        org_level,
        org_id,
        status,
        reminder_time,
        color,
      } = eventData;

      // Build query dynamically based on provided fields
      let query = 'UPDATE calendar_events SET updated_at = NOW()';
      const queryParams: any[] = [];

      if (title !== undefined) {
        query += ', title = ?';
        queryParams.push(title);
      }

      if (description !== undefined) {
        query += ', description = ?';
        queryParams.push(description);
      }

      if (location !== undefined) {
        query += ', location = ?';
        queryParams.push(location);
      }

      if (start_time !== undefined) {
        query += ', start_time = ?';
        queryParams.push(formatDateForMysql(start_time));
      }

      if (end_time !== undefined) {
        query += ', end_time = ?';
        queryParams.push(formatDateForMysql(end_time));
      }

      if (all_day !== undefined) {
        query += ', all_day = ?';
        queryParams.push(all_day ? 1 : 0);
      }

      if (org_level !== undefined) {
        query += ', org_level = ?';
        queryParams.push(org_level);
      }

      if (org_id !== undefined) {
        query += ', org_id = ?';
        queryParams.push(org_id);
      }

      if (status !== undefined) {
        query += ', status = ?';
        queryParams.push(status);
      }

      if (reminder_time !== undefined) {
        query += ', reminder_time = ?';
        // Convert empty string to null for integer field
        const reminderValue =
          reminder_time === '' || reminder_time === null
            ? null
            : parseInt(reminder_time.toString()) || null;
        queryParams.push(reminderValue);
      }

      if (color !== undefined) {
        query += ', color = ?';
        queryParams.push(color);
      }

      // Finish query
      query += ' WHERE id = ? AND tenant_id = ?';
      queryParams.push(id, tenantId);

      // Execute update
      await executeQuery(query, queryParams);

      // Get the updated event
      const updatedEvent = await this.getEventById(
        id,
        tenantId,
        eventData.created_by || 0
      );
      return updatedEvent;
    } catch (error) {
      logger.error('Error in updateEvent:', error);
      throw error;
    }
  }

  /**
   * Delete a calendar event
   */
  static async deleteEvent(id: number, tenantId: number): Promise<boolean> {
    try {
      // Delete event
      const query =
        'DELETE FROM calendar_events WHERE id = ? AND tenant_id = ?';
      const [result] = await executeQuery<ResultSetHeader>(query, [
        id,
        tenantId,
      ]);

      return result.affectedRows > 0;
    } catch (error) {
      logger.error('Error in deleteEvent:', error);
      throw error;
    }
  }

  /**
   * Add an attendee to a calendar event
   */
  static async addEventAttendee(
    eventId: number,
    userId: number,
    responseStatus:
      | 'pending'
      | 'accepted'
      | 'declined'
      | 'tentative' = 'pending'
  ): Promise<boolean> {
    try {
      // Check if already an attendee
      const [attendees] = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM calendar_attendees WHERE event_id = ? AND user_id = ?',
        [eventId, userId]
      );

      if (attendees.length > 0) {
        // Update existing attendee status
        await executeQuery(
          'UPDATE calendar_attendees SET response_status = ?, responded_at = NOW() WHERE event_id = ? AND user_id = ?',
          [responseStatus, eventId, userId]
        );
      } else {
        // Add new attendee
        await executeQuery(
          'INSERT INTO calendar_attendees (event_id, user_id, response_status, responded_at) VALUES (?, ?, ?, NOW())',
          [eventId, userId, responseStatus]
        );
      }

      return true;
    } catch (error) {
      logger.error('Error in addEventAttendee:', error);
      throw error;
    }
  }

  /**
   * Remove an attendee from a calendar event
   */
  static async removeEventAttendee(
    eventId: number,
    userId: number
  ): Promise<boolean> {
    try {
      // Remove attendee
      const query =
        'DELETE FROM calendar_attendees WHERE event_id = ? AND user_id = ?';
      const [result] = await executeQuery<ResultSetHeader>(query, [
        eventId,
        userId,
      ]);

      return result.affectedRows > 0;
    } catch (error) {
      logger.error('Error in removeEventAttendee:', error);
      throw error;
    }
  }

  /**
   * User responds to a calendar event
   */
  static async respondToEvent(
    eventId: number,
    userId: number,
    response: string
  ): Promise<boolean> {
    try {
      // Validate response
      const validResponses = ['accepted', 'declined', 'tentative'];
      if (!validResponses.includes(response)) {
        throw new Error('Invalid response status');
      }

      // Update response
      return await this.addEventAttendee(
        eventId,
        userId,
        response as 'accepted' | 'declined' | 'tentative'
      );
    } catch (error) {
      logger.error('Error in respondToEvent:', error);
      throw error;
    }
  }

  /**
   * Get attendees for a calendar event
   */
  static async getEventAttendees(
    eventId: number,
    tenantId: number
  ): Promise<DbEventAttendee[]> {
    try {
      const query = `
        SELECT a.user_id, a.response_status, a.responded_at,
               u.username, u.first_name, u.last_name, u.email, u.profile_picture
        FROM calendar_attendees a
        JOIN users u ON a.user_id = u.id
        JOIN calendar_events e ON a.event_id = e.id
        WHERE a.event_id = ? AND e.tenant_id = ?
        ORDER BY u.first_name, u.last_name
      `;

      const [attendees] = await executeQuery<DbEventAttendee[]>(query, [
        eventId,
        tenantId,
      ]);
      return attendees;
    } catch (error) {
      logger.error('Error in getEventAttendees:', error);
      throw error;
    }
  }

  /**
   * Get upcoming events for a user's dashboard
   */
  static async getDashboardEvents(
    tenantId: number,
    userId: number,
    days = 7,
    limit = 5
  ): Promise<DbCalendarEvent[]> {
    try {
      // Get user info for access control
      const { role, departmentId, teamId } =
        await User.getUserDepartmentAndTeam(userId);

      // Calculate date range
      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + days);

      // Format dates for MySQL
      const todayStr = today.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Build query for dashboard events
      let query = `
        SELECT e.*, 
               u.username as creator_name,
               CASE WHEN a.id IS NOT NULL THEN a.response_status ELSE NULL END as user_response
        FROM calendar_events e
        LEFT JOIN users u ON e.created_by = u.id
        LEFT JOIN calendar_attendees a ON e.id = a.event_id AND a.user_id = ?
        WHERE e.tenant_id = ? AND e.status = 'active'
        AND e.start_time >= ? AND e.start_time <= ?
      `;

      const queryParams: any[] = [userId, tenantId, todayStr, endDateStr];

      // Apply access control for non-admin users
      if (role !== 'admin' && role !== 'root') {
        query += ` AND (
          e.org_level = 'company' OR 
          (e.org_level = 'department' AND e.org_id = ?) OR
          (e.org_level = 'team' AND e.org_id = ?) OR
          EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = ?)
        )`;
        queryParams.push(departmentId || 0, teamId || 0, userId);
      }

      // Sort by start time, limited to the next few events
      query += `
        ORDER BY e.start_time ASC
        LIMIT ?
      `;
      queryParams.push(parseInt(limit.toString(), 10));

      const [events] = await executeQuery<DbCalendarEvent[]>(
        query,
        queryParams
      );

      // Convert Buffer description to String if needed
      events.forEach((event) => {
        if (event.description && Buffer.isBuffer(event.description)) {
          event.description = event.description.toString('utf8');
        } else if (
          event.description &&
          typeof event.description === 'object' &&
          'type' in event.description &&
          event.description.type === 'Buffer' &&
          Array.isArray(event.description.data)
        ) {
          event.description = Buffer.from(event.description.data).toString(
            'utf8'
          );
        }
      });

      return events;
    } catch (error) {
      logger.error('Error in getDashboardEvents:', error);
      throw error;
    }
  }

  /**
   * Check if a user can manage an event
   */
  static async canManageEvent(
    eventId: number,
    userId: number,
    userInfo: UserInfo | null = null
  ): Promise<boolean> {
    try {
      // Get event details
      const [events] = await executeQuery<DbCalendarEvent[]>(
        'SELECT * FROM calendar_events WHERE id = ?',
        [eventId]
      );

      if (events.length === 0) {
        return false;
      }

      const event = events[0];

      // Get user info if not provided
      const userRole = userInfo ? userInfo.role : null;
      const userDeptId = userInfo ? userInfo.departmentId : null;
      const userTeamId = userInfo ? userInfo.teamId : null;

      // If already have user info, use it
      let role: string | null,
        departmentId: number | null,
        teamId: number | null;

      if (userRole && userDeptId !== undefined && userTeamId !== undefined) {
        role = userRole;
        departmentId = userDeptId;
        teamId = userTeamId;
      } else {
        // Otherwise get it from the database
        const userDetails = await User.getUserDepartmentAndTeam(userId);
        role = userDetails.role;
        departmentId = userDetails.departmentId;
        teamId = userDetails.teamId;
      }

      // Admins can manage all events
      if (role === 'admin' || role === 'root') {
        return true;
      }

      // Event creator can manage their events
      if (event.created_by === userId) {
        return true;
      }

      // Department managers can manage department events
      if (
        role === 'manager' &&
        event.org_level === 'department' &&
        event.org_id === departmentId
      ) {
        return true;
      }

      // Team leads can manage team events
      if (
        role === 'team_lead' &&
        event.org_level === 'team' &&
        event.org_id === teamId
      ) {
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error in canManageEvent:', error);
      throw error;
    }
  }
}

// Export individual functions for backward compatibility
export const {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  addEventAttendee,
  removeEventAttendee,
  respondToEvent,
  getEventAttendees,
  getDashboardEvents,
  canManageEvent,
} = Calendar;

// Default export
export default Calendar;

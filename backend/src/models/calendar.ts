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
  user_id: number;
  title: string;
  description?: string | Buffer | { type: 'Buffer'; data: number[] };
  location?: string;
  start_date: Date;
  end_date: Date;
  all_day: boolean | number;
  type?: 'meeting' | 'training' | 'vacation' | 'sick_leave' | 'other';
  status?: 'tentative' | 'confirmed' | 'cancelled';
  is_private?: boolean | number;
  reminder_minutes?: number | null;
  color?: string;
  recurrence_rule?: string | null;
  parent_event_id?: number | null;
  created_at: Date;
  updated_at: Date;
  // Extended fields from joins
  creator_name?: string;
  user_response?: string | null;
  // Aliases for API compatibility
  start_time?: Date;
  end_time?: Date;
  org_level?: 'company' | 'department' | 'team' | 'personal';
  org_id?: number;
  created_by?: number;
  reminder_time?: number | null;
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
  filter?: 'all' | 'company' | 'department' | 'team' | 'personal';
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
  org_level: 'company' | 'department' | 'team' | 'personal';
  org_id?: number;
  created_by: number;
  reminder_time?: number | null;
  color?: string;
  recurrence_rule?: string | null;
  parent_event_id?: number | null;
}

interface EventUpdateData {
  title?: string;
  description?: string;
  location?: string;
  start_time?: string | Date;
  end_time?: string | Date;
  all_day?: boolean;
  org_level?: 'company' | 'department' | 'team' | 'personal';
  org_id?: number;
  status?: 'active' | 'cancelled';
  reminder_time?: number | string | null;
  color?: string;
  created_by?: number;
  recurrence_rule?: string | null;
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
        sortBy = 'start_date',
        sortDir = 'ASC',
      } = options;

      // Map status from API to database
      const dbStatus = status === 'active' ? 'confirmed' : status;

      // Determine user's role for access control
      const { role } = await User.getUserDepartmentAndTeam(userId);

      // Build base query
      let query = `
        SELECT e.*, 
               u.username as creator_name,
               CASE WHEN a.id IS NOT NULL THEN a.response_status ELSE NULL END as user_response
        FROM calendar_events e
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN calendar_attendees a ON e.id = a.event_id AND a.user_id = ?
        WHERE e.tenant_id = ? AND e.status = ?
      `;

      const queryParams: any[] = [userId, tenantId, dbStatus];

      // Apply org level filter (map to type)
      if (filter !== 'all') {
        if (filter === 'company') {
          query += " AND e.type IN ('meeting', 'training')";
        } else if (filter === 'personal') {
          query += " AND e.type NOT IN ('meeting', 'training')";
        }
      }

      // Apply access control for non-admin users
      if (role !== 'admin' && role !== 'root') {
        query += ` AND (
          e.type IN ('meeting', 'training') OR 
          e.user_id = ? OR
          EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = ?)
        )`;
        queryParams.push(userId, userId);
      }

      // Apply date range filter
      if (start_date) {
        query += ' AND e.end_date >= ?';
        queryParams.push(start_date);
      }

      if (end_date) {
        query += ' AND e.start_date <= ?';
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

      // Map database fields to API fields
      events.forEach((event) => {
        // Map database column names to API property names
        event.start_time = event.start_date;
        event.end_time = event.end_date;
        event.reminder_time = event.reminder_minutes;
        event.created_by = event.user_id;

        // Map org fields based on type
        if (event.type === 'meeting' || event.type === 'training') {
          event.org_level = 'company';
        } else {
          event.org_level = 'personal';
        }
        event.org_id = 0;

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
      });

      // Count total events for pagination
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM calendar_events e
        WHERE e.tenant_id = ? AND e.status = ?
      `;

      const countParams: any[] = [tenantId, dbStatus];

      // Apply org level filter for count (map to type)
      if (filter !== 'all') {
        if (filter === 'company') {
          countQuery += " AND e.type IN ('meeting', 'training')";
        } else if (filter === 'personal') {
          countQuery += " AND e.type NOT IN ('meeting', 'training')";
        }
      }

      // Apply access control for non-admin users for count
      if (role !== 'admin' && role !== 'root') {
        countQuery += ` AND (
          e.type IN ('meeting', 'training') OR 
          e.user_id = ? OR
          EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = ?)
        )`;
        countParams.push(userId, userId);
      }

      // Apply date range filter for count
      if (start_date) {
        countQuery += ' AND e.end_date >= ?';
        countParams.push(start_date);
      }

      if (end_date) {
        countQuery += ' AND e.start_date <= ?';
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
      // Determine user's role for access control
      const { role } = await User.getUserDepartmentAndTeam(userId);

      // Query the event with user response status
      const query = `
        SELECT e.*, 
               u.username as creator_name,
               CASE WHEN a.id IS NOT NULL THEN a.response_status ELSE NULL END as user_response
        FROM calendar_events e
        LEFT JOIN users u ON e.user_id = u.id
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

      // Map database fields to API fields
      event.start_time = event.start_date;
      event.end_time = event.end_date;
      event.reminder_time = event.reminder_minutes;
      event.created_by = event.user_id;

      // Map org fields based on type
      if (event.type === 'meeting' || event.type === 'training') {
        event.org_level = 'company';
      } else {
        event.org_level = 'personal';
      }
      event.org_id = 0;

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
          event.type === 'meeting' ||
          event.type === 'training' ||
          event.user_id === userId ||
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
        created_by,
        reminder_time,
        color,
        recurrence_rule,
        parent_event_id,
      } = eventData;

      // Validate required fields
      if (!tenant_id || !title || !start_time || !end_time || !created_by) {
        throw new Error('Missing required fields');
      }

      // Ensure dates are valid
      if (new Date(start_time) > new Date(end_time)) {
        throw new Error('Start time must be before end time');
      }

      // Map org_level to type for database
      let eventType = 'other';
      if (org_level === 'company') {
        eventType = 'meeting';
      } else if (org_level === 'team' || org_level === 'department') {
        eventType = 'training';
      }

      // Insert new event
      const query = `
        INSERT INTO calendar_events 
        (tenant_id, user_id, title, description, location, start_date, end_date, all_day, 
         type, status, is_private, reminder_minutes, color, recurrence_rule, parent_event_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await executeQuery<ResultSetHeader>(query, [
        tenant_id,
        created_by, // user_id
        title,
        description || null,
        location || null,
        formatDateForMysql(start_time),
        formatDateForMysql(end_time),
        all_day ? 1 : 0,
        eventType,
        'confirmed', // status
        0, // is_private
        reminder_time || null,
        color || '#3498db',
        recurrence_rule || null,
        parent_event_id || null,
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

        // If this is a recurring event, generate future occurrences
        if (recurrence_rule && !parent_event_id) {
          await this.generateRecurringEvents(createdEvent, recurrence_rule);
        }
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
        query += ', start_date = ?';
        queryParams.push(formatDateForMysql(start_time));
      }

      if (end_time !== undefined) {
        query += ', end_date = ?';
        queryParams.push(formatDateForMysql(end_time));
      }

      if (all_day !== undefined) {
        query += ', all_day = ?';
        queryParams.push(all_day ? 1 : 0);
      }

      if (org_level !== undefined) {
        // Map org_level to type for database
        let eventType = 'other';
        if (org_level === 'company') {
          eventType = 'meeting';
        } else if (org_level === 'team' || org_level === 'department') {
          eventType = 'training';
        }
        query += ', type = ?';
        queryParams.push(eventType);
      }

      if (status !== undefined) {
        query += ', status = ?';
        queryParams.push(status);
      }

      if (reminder_time !== undefined) {
        query += ', reminder_minutes = ?';
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
      const { role } = await User.getUserDepartmentAndTeam(userId);

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
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN calendar_attendees a ON e.id = a.event_id AND a.user_id = ?
        WHERE e.tenant_id = ? AND e.status = 'confirmed'
        AND e.start_date >= ? AND e.start_date <= ?
      `;

      const queryParams: any[] = [userId, tenantId, todayStr, endDateStr];

      // Apply access control for non-admin users
      if (role !== 'admin' && role !== 'root') {
        query += ` AND (
          e.type IN ('meeting', 'training') OR 
          e.user_id = ? OR
          EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = ?)
        )`;
        queryParams.push(userId, userId);
      }

      // Sort by start time, limited to the next few events
      query += `
        ORDER BY e.start_date ASC
        LIMIT ?
      `;
      queryParams.push(parseInt(limit.toString(), 10));

      const [events] = await executeQuery<DbCalendarEvent[]>(
        query,
        queryParams
      );

      // Map database fields to API fields
      events.forEach((event) => {
        // Map database column names to API property names
        event.start_time = event.start_date;
        event.end_time = event.end_date;
        event.reminder_time = event.reminder_minutes;
        event.created_by = event.user_id;

        // Map org fields based on type
        if (event.type === 'meeting' || event.type === 'training') {
          event.org_level = 'company';
        } else {
          event.org_level = 'personal';
        }
        event.org_id = 0;

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

      // Get user role
      let role: string | null;

      if (userRole) {
        role = userRole;
      } else {
        // Otherwise get it from the database
        const userDetails = await User.getUserDepartmentAndTeam(userId);
        role = userDetails.role;
      }

      // Admins can manage all events
      if (role === 'admin' || role === 'root') {
        return true;
      }

      // Event creator can manage their events
      if (event.user_id === userId) {
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error in canManageEvent:', error);
      throw error;
    }
  }

  /**
   * Generate recurring events based on recurrence rule
   */
  static async generateRecurringEvents(
    parentEvent: DbCalendarEvent,
    recurrenceRule: string
  ): Promise<void> {
    try {
      // Parse recurrence rule
      const [pattern, ...options] = recurrenceRule.split(';');
      let count = 52; // Default to 1 year of weekly events
      let until: Date | null = null;

      // Parse options
      for (const option of options) {
        if (option.startsWith('COUNT=')) {
          count = parseInt(option.substring(6), 10);
        } else if (option.startsWith('UNTIL=')) {
          until = new Date(option.substring(6));
        }
      }

      // Calculate interval based on pattern
      let intervalDays = 1;
      switch (pattern) {
        case 'daily':
          intervalDays = 1;
          break;
        case 'weekly':
          intervalDays = 7;
          break;
        case 'biweekly':
          intervalDays = 14;
          break;
        case 'monthly':
          intervalDays = 30; // Approximate
          break;
        case 'yearly':
          intervalDays = 365;
          break;
        case 'weekdays':
          intervalDays = 1; // Special handling needed
          break;
      }

      // Generate occurrences
      const startDate = new Date(parentEvent.start_time);
      const endDate = new Date(parentEvent.end_time);
      const duration = endDate.getTime() - startDate.getTime();

      let currentDate = new Date(startDate);
      let occurrences = 0;

      while (occurrences < count && (!until || currentDate <= until)) {
        // Skip first occurrence (parent event)
        if (occurrences > 0) {
          // Skip weekends for weekdays pattern
          if (pattern === 'weekdays') {
            while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
              currentDate.setDate(currentDate.getDate() + 1);
            }
          }

          const newStartDate = new Date(currentDate);
          const newEndDate = new Date(currentDate.getTime() + duration);

          // Create child event
          await this.createEvent({
            tenant_id: parentEvent.tenant_id,
            title: parentEvent.title,
            description:
              typeof parentEvent.description === 'string'
                ? parentEvent.description
                : parentEvent.description?.toString('utf8'),
            location: parentEvent.location,
            start_time: newStartDate.toISOString(),
            end_time: newEndDate.toISOString(),
            all_day: Boolean(parentEvent.all_day),
            org_level: parentEvent.org_level,
            org_id: parentEvent.org_id,
            created_by: parentEvent.created_by,
            reminder_time: parentEvent.reminder_time,
            color: parentEvent.color,
            parent_event_id: parentEvent.id,
          });
        }

        // Move to next occurrence
        if (pattern === 'monthly') {
          currentDate.setMonth(currentDate.getMonth() + 1);
        } else if (pattern === 'yearly') {
          currentDate.setFullYear(currentDate.getFullYear() + 1);
        } else {
          currentDate.setDate(currentDate.getDate() + intervalDays);
        }

        occurrences++;
      }
    } catch (error) {
      logger.error('Error generating recurring events:', error);
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

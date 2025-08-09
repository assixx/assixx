/**
 * Calendar Model
 * Handles database operations for the calendar events and attendees
 */

import {
  query as executeQuery,
  RowDataPacket,
  ResultSetHeader,
} from "../utils/db";
import { logger } from "../utils/logger";

import User from "./user";

/**
 * Format datetime strings for MySQL (remove 'Z' and convert to local format)
 */
function formatDateForMysql(dateString: string | Date | null): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toISOString().slice(0, 19).replace("T", " ");
}

// Database interfaces
interface DbCalendarEvent extends RowDataPacket {
  id: number;
  tenant_id: number;
  user_id: number;
  title: string;
  description?: string | Buffer | { type: "Buffer"; data: number[] };
  location?: string;
  start_date: Date;
  end_date: Date;
  all_day: boolean | number;
  type?: "meeting" | "training" | "vacation" | "sick_leave" | "other";
  status?: "tentative" | "confirmed" | "cancelled";
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
  org_level?: "company" | "department" | "team" | "personal";
  department_id?: number | null;
  team_id?: number | null;
  created_by?: number;
  created_by_role?: "admin" | "lead" | "user";
  allow_attendees?: boolean | number;
  reminder_time?: number | null;
}

interface DbEventAttendee extends RowDataPacket {
  user_id: number;
  response_status: "pending" | "accepted" | "declined" | "tentative";
  responded_at?: Date;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  profile_picture?: string;
}

interface EventQueryOptions {
  status?: "active" | "cancelled";
  filter?: "all" | "company" | "department" | "team" | "personal";
  search?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: "ASC" | "DESC";
  userDepartmentId?: number | null;
  userTeamId?: number | null;
}

interface EventCreateData {
  tenant_id: number;
  title: string;
  description?: string;
  location?: string;
  start_time: string | Date;
  end_time: string | Date;
  all_day?: boolean;
  org_level: "company" | "department" | "team" | "personal";
  department_id?: number | null;
  team_id?: number | null;
  created_by: number;
  created_by_role?: string;
  allow_attendees?: boolean;
  reminder_time?: number | null;
  color?: string;
  recurrence_rule?: string | null;
  parent_event_id?: number | null;
  requires_response?: boolean;
}

interface EventUpdateData {
  title?: string;
  description?: string;
  location?: string;
  start_time?: string | Date;
  end_time?: string | Date;
  all_day?: boolean;
  org_level?: "company" | "department" | "team" | "personal";
  department_id?: number | null;
  team_id?: number | null;
  status?: "active" | "cancelled";
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
    tenant_id: number,
    userId: number,
    options: EventQueryOptions = {},
  ) {
    try {
      const {
        status = "active",
        filter = "all",
        search = "",
        start_date,
        end_date,
        page = 1,
        limit = 50,
        sortBy = "start_date",
        sortDir = "ASC",
        userDepartmentId,
        userTeamId,
      } = options;

      // Map status from API to database
      const dbStatus = status === "active" ? "confirmed" : status;

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

      const queryParams: unknown[] = [userId, tenant_id, dbStatus];

      // Apply org level filter based on new structure
      if (filter !== "all") {
        switch (filter) {
          case "company":
            query += " AND e.org_level = 'company'";
            break;
          case "department":
            query += " AND e.org_level = 'department' AND e.department_id = ?";
            queryParams.push(userDepartmentId);
            break;
          case "team":
            query += " AND e.org_level = 'team' AND e.team_id = ?";
            queryParams.push(userTeamId);
            break;
          case "personal":
            query +=
              " AND (e.org_level = 'personal' AND (e.user_id = ? OR EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = ?)))";
            queryParams.push(userId, userId);
            break;
        }
      }

      // Apply access control for ALL users (including admins) for privacy
      // Admins should not see private events between other users
      if (filter === "all") {
        query += ` AND (
          e.org_level = 'company' OR 
          (e.org_level = 'department' AND e.department_id = ?) OR
          (e.org_level = 'team' AND e.team_id = ?) OR
          e.user_id = ? OR
          EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = ?)
        )`;
        queryParams.push(userDepartmentId, userTeamId, userId, userId);
      }

      // Apply date range filter
      if (start_date) {
        query += " AND e.end_date >= ?";
        queryParams.push(start_date);
      }

      if (end_date) {
        query += " AND e.start_date <= ?";
        queryParams.push(end_date);
      }

      // Apply search filter
      if (search) {
        query +=
          " AND (e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)";
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
      }

      // Apply sorting
      query += ` ORDER BY e.${sortBy} ${sortDir}`;

      // Apply pagination
      const offset = (page - 1) * limit;
      query += " LIMIT ? OFFSET ?";
      queryParams.push(parseInt(limit.toString(), 10), offset);

      // Execute query
      const [events] = await executeQuery<DbCalendarEvent[]>(
        query,
        queryParams,
      );

      // Map database fields to API fields
      events.forEach((event) => {
        // Map database column names to API property names
        event.start_time = event.start_date;
        event.end_time = event.end_date;
        event.reminder_time = event.reminder_minutes;
        event.created_by = event.user_id;

        // org_level and org_id are now stored directly in the database
        // No need to map them based on type

        // Convert Buffer description to String if needed
        if (event.description && Buffer.isBuffer(event.description)) {
          event.description = event.description.toString("utf8");
        } else if (
          event.description &&
          typeof event.description === "object" &&
          "type" in event.description &&
          event.description.type === "Buffer" &&
          Array.isArray(event.description.data)
        ) {
          event.description = Buffer.from(event.description.data).toString(
            "utf8",
          );
        }
      });

      // Count total events for pagination
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM calendar_events e
        WHERE e.tenant_id = ? AND e.status = ?
      `;

      const countParams: unknown[] = [tenant_id, dbStatus];

      // Apply org level filter for count
      if (filter !== "all") {
        switch (filter) {
          case "company":
            countQuery += " AND e.org_level = 'company'";
            break;
          case "department":
            countQuery +=
              " AND e.org_level = 'department' AND e.department_id = ?";
            countParams.push(userDepartmentId);
            break;
          case "team":
            countQuery += " AND e.org_level = 'team' AND e.team_id = ?";
            countParams.push(userTeamId);
            break;
          case "personal":
            countQuery +=
              " AND (e.org_level = 'personal' AND (e.user_id = ? OR EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = ?)))";
            countParams.push(userId, userId);
            break;
        }
      }

      // Apply access control for non-admin users for count
      if (role !== "admin" && role !== "root") {
        countQuery += ` AND (
          e.type IN ('meeting', 'training') OR 
          e.user_id = ? OR
          EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = ?)
        )`;
        countParams.push(userId, userId);
      }

      // Apply date range filter for count
      if (start_date) {
        countQuery += " AND e.end_date >= ?";
        countParams.push(start_date);
      }

      if (end_date) {
        countQuery += " AND e.start_date <= ?";
        countParams.push(end_date);
      }

      // Apply search filter for count
      if (search) {
        countQuery +=
          " AND (e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)";
        const searchTerm = `%${search}%`;
        countParams.push(searchTerm, searchTerm, searchTerm);
      }

      const [countResult] = await executeQuery<CountResult[]>(
        countQuery,
        countParams,
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
      logger.error("Error in getAllEvents:", error);
      throw error;
    }
  }

  /**
   * Check if a calendar event exists (without permission check)
   */
  static async checkEventExists(
    id: number,
    tenant_id: number,
  ): Promise<boolean> {
    try {
      const [rows] = await executeQuery<RowDataPacket[]>(
        "SELECT 1 FROM calendar_events WHERE id = ? AND tenant_id = ?",
        [id, tenant_id],
      );
      return rows.length > 0;
    } catch (error) {
      logger.error("Error in checkEventExists:", error);
      return false;
    }
  }

  /**
   * Get a specific calendar event by ID
   */
  static async getEventById(
    id: number,
    tenant_id: number,
    userId: number,
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
        tenant_id,
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

      // org_level and org_id are now stored directly in the database
      // No need to map them based on type

      // Convert Buffer description to String if needed
      if (event.description && Buffer.isBuffer(event.description)) {
        event.description = event.description.toString("utf8");
      } else if (
        event.description &&
        typeof event.description === "object" &&
        "type" in event.description &&
        event.description.type === "Buffer" &&
        Array.isArray(event.description.data)
      ) {
        event.description = Buffer.from(event.description.data).toString(
          "utf8",
        );
      }

      // Check access control for non-admin users
      if (role !== "admin" && role !== "root") {
        // Company events are visible to all employees
        if (event.org_level === "company") {
          // All users in the tenant can see company events
          return event;
        }

        // Department events are visible to department members
        if (event.org_level === "department" && event.department_id) {
          const userInfo = await User.getUserDepartmentAndTeam(userId);
          if (userInfo.departmentId === event.department_id) {
            return event;
          }
        }

        // Team events are visible to team members
        if (event.org_level === "team" && event.team_id) {
          const userInfo = await User.getUserDepartmentAndTeam(userId);
          if (userInfo.teamId === event.team_id) {
            return event;
          }
        }

        // Personal events and other types - check if user is creator or attendee
        const [attendeeRows] = await executeQuery<RowDataPacket[]>(
          "SELECT 1 FROM calendar_attendees WHERE event_id = ? AND user_id = ?",
          [id, userId],
        );

        const isAttendee = attendeeRows.length > 0;

        const hasAccess =
          event.type === "meeting" ||
          event.type === "training" ||
          event.user_id === userId ||
          isAttendee;

        if (!hasAccess) {
          return null; // User doesn't have access to this event
        }
      }

      return event;
    } catch (error) {
      logger.error("Error in getEventById:", error);
      throw error;
    }
  }

  /**
   * Create a new calendar event
   */
  static async createEvent(
    eventData: EventCreateData,
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
        department_id,
        team_id,
        created_by,
        created_by_role,
        allow_attendees,
        reminder_time,
        color,
        recurrence_rule,
        parent_event_id,
      } = eventData;

      // Validate required fields
      if (!tenant_id || !title || !start_time || !end_time || !created_by) {
        throw new Error("Missing required fields");
      }

      // Ensure dates are valid
      if (new Date(start_time) > new Date(end_time)) {
        throw new Error("Start time must be before end time");
      }

      // Insert new event
      const query = `
        INSERT INTO calendar_events 
        (tenant_id, user_id, title, description, location, start_date, end_date, all_day, 
         org_level, department_id, team_id, created_by_role, allow_attendees, requires_response, 
         type, status, is_private, reminder_minutes, color, recurrence_rule, parent_event_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await executeQuery<ResultSetHeader>(query, [
        tenant_id,
        created_by, // user_id
        title,
        description ?? null,
        location ?? null,
        formatDateForMysql(start_time),
        formatDateForMysql(end_time),
        all_day ? 1 : 0,
        org_level,
        department_id ?? null,
        team_id ?? null,
        created_by_role ?? "user",
        allow_attendees ? 1 : 0,
        eventData.requires_response ? 1 : 0, // requires_response
        "other", // type
        "confirmed", // status
        0, // is_private
        reminder_time ?? null,
        color ?? "#3498db",
        recurrence_rule ?? null,
        parent_event_id ?? null,
      ]);

      // Get the created event
      const createdEvent = await this.getEventById(
        result.insertId,
        tenant_id,
        created_by,
      );

      // Add the creator as an attendee with 'accepted' status
      if (createdEvent) {
        await this.addEventAttendee(createdEvent.id, created_by, "accepted");

        // If this is a recurring event, generate future occurrences
        if (recurrence_rule && !parent_event_id) {
          await this.generateRecurringEvents(createdEvent, recurrence_rule);
        }
      }

      return createdEvent;
    } catch (error) {
      logger.error("Error in createEvent:", error);
      throw error;
    }
  }

  /**
   * Update a calendar event
   */
  static async updateEvent(
    id: number,
    eventData: EventUpdateData,
    tenant_id: number,
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
        department_id,
        team_id,
        status,
        reminder_time,
        color,
      } = eventData;

      // Build query dynamically based on provided fields
      let query = "UPDATE calendar_events SET updated_at = NOW()";
      const queryParams: unknown[] = [];

      if (title !== undefined) {
        query += ", title = ?";
        queryParams.push(title);
      }

      if (description !== undefined) {
        query += ", description = ?";
        queryParams.push(description);
      }

      if (location !== undefined) {
        query += ", location = ?";
        queryParams.push(location);
      }

      if (start_time !== undefined) {
        query += ", start_date = ?";
        queryParams.push(formatDateForMysql(start_time));
      }

      if (end_time !== undefined) {
        query += ", end_date = ?";
        queryParams.push(formatDateForMysql(end_time));
      }

      if (all_day !== undefined) {
        query += ", all_day = ?";
        queryParams.push(all_day ? 1 : 0);
      }

      if (org_level !== undefined) {
        query += ", org_level = ?";
        queryParams.push(org_level);
      }

      if (department_id !== undefined) {
        query += ", department_id = ?";
        queryParams.push(department_id);
      }

      if (team_id !== undefined) {
        query += ", team_id = ?";
        queryParams.push(team_id);
      }

      if (status !== undefined) {
        query += ", status = ?";
        queryParams.push(status);
      }

      if (reminder_time !== undefined) {
        query += ", reminder_minutes = ?";
        // Convert empty string to null for integer field
        const reminderValue =
          reminder_time === "" || reminder_time === null
            ? null
            : parseInt(reminder_time.toString()) || null;
        queryParams.push(reminderValue);
      }

      if (color !== undefined) {
        query += ", color = ?";
        queryParams.push(color);
      }

      // Finish query
      query += " WHERE id = ? AND tenant_id = ?";
      queryParams.push(id, tenant_id);

      // Execute update
      await executeQuery(query, queryParams);

      // Get the updated event - we need to get the current user_id first
      const [eventRows] = await executeQuery<RowDataPacket[]>(
        "SELECT user_id FROM calendar_events WHERE id = ? AND tenant_id = ?",
        [id, tenant_id],
      );

      if (!eventRows || eventRows.length === 0) {
        return null;
      }

      const updatedEvent = await this.getEventById(
        id,
        tenant_id,
        eventRows[0].user_id,
      );
      return updatedEvent;
    } catch (error) {
      logger.error("Error in updateEvent:", error);
      throw error;
    }
  }

  /**
   * Delete a calendar event
   */
  static async deleteEvent(id: number, tenant_id: number): Promise<boolean> {
    try {
      // Delete event
      const query =
        "DELETE FROM calendar_events WHERE id = ? AND tenant_id = ?";
      const [result] = await executeQuery<ResultSetHeader>(query, [
        id,
        tenant_id,
      ]);

      return result.affectedRows > 0;
    } catch (error) {
      logger.error("Error in deleteEvent:", error);
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
      | "pending"
      | "accepted"
      | "declined"
      | "tentative" = "pending",
    tenantIdParam?: number,
  ): Promise<boolean> {
    try {
      // Check if already an attendee
      const [attendees] = await executeQuery<RowDataPacket[]>(
        "SELECT * FROM calendar_attendees WHERE event_id = ? AND user_id = ?",
        [eventId, userId],
      );

      if (attendees.length > 0) {
        // Update existing attendee status
        await executeQuery(
          "UPDATE calendar_attendees SET response_status = ?, responded_at = NOW() WHERE event_id = ? AND user_id = ?",
          [responseStatus, eventId, userId],
        );
      } else {
        // Get tenant_id from event if not provided
        let finalTenantId = tenantIdParam;
        if (!finalTenantId) {
          const [event] = await executeQuery<DbCalendarEvent[]>(
            "SELECT tenant_id FROM calendar_events WHERE id = ?",
            [eventId],
          );
          if (event.length > 0) {
            finalTenantId = event[0].tenant_id;
          }
        }

        // Add new attendee with tenant_id
        await executeQuery(
          "INSERT INTO calendar_attendees (event_id, user_id, response_status, responded_at, tenant_id) VALUES (?, ?, ?, NOW(), ?)",
          [eventId, userId, responseStatus, finalTenantId],
        );
      }

      return true;
    } catch (error) {
      logger.error("Error in addEventAttendee:", error);
      throw error;
    }
  }

  /**
   * Remove an attendee from a calendar event
   */
  static async removeEventAttendee(
    eventId: number,
    userId: number,
  ): Promise<boolean> {
    try {
      // Remove attendee
      const query =
        "DELETE FROM calendar_attendees WHERE event_id = ? AND user_id = ?";
      const [result] = await executeQuery<ResultSetHeader>(query, [
        eventId,
        userId,
      ]);

      return result.affectedRows > 0;
    } catch (error) {
      logger.error("Error in removeEventAttendee:", error);
      throw error;
    }
  }

  /**
   * User responds to a calendar event
   */
  static async respondToEvent(
    eventId: number,
    userId: number,
    response: string,
  ): Promise<boolean> {
    try {
      // Validate response
      const validResponses = ["accepted", "declined", "tentative"];
      if (!validResponses.includes(response)) {
        throw new Error("Invalid response status");
      }

      // Update response
      return await this.addEventAttendee(
        eventId,
        userId,
        response as "accepted" | "declined" | "tentative",
      );
    } catch (error) {
      logger.error("Error in respondToEvent:", error);
      throw error;
    }
  }

  /**
   * Get attendees for a calendar event
   */
  static async getEventAttendees(
    eventId: number,
    tenant_id: number,
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
        tenant_id,
      ]);
      return attendees;
    } catch (error) {
      logger.error("Error in getEventAttendees:", error);
      throw error;
    }
  }

  /**
   * Get upcoming events for a user's dashboard
   */
  static async getDashboardEvents(
    tenant_id: number,
    userId: number,
    days = 7,
    limit = 5,
  ): Promise<DbCalendarEvent[]> {
    try {
      // Get user info for access control
      const {
        role,
        departmentId: userDepartmentId,
        teamId: userTeamId,
      } = await User.getUserDepartmentAndTeam(userId);

      // Calculate date range
      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + days);

      // Format dates for MySQL
      const todayStr = today.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

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

      const queryParams: unknown[] = [userId, tenant_id, todayStr, endDateStr];

      // Apply access control for non-admin users (dashboard shows all accessible events)
      if (role !== "admin" && role !== "root") {
        query += ` AND (
          e.org_level = 'company' OR 
          (e.org_level = 'department' AND e.department_id = ?) OR
          (e.org_level = 'team' AND e.team_id = ?) OR
          e.user_id = ? OR
          EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = e.id AND user_id = ?)
        )`;
        queryParams.push(userDepartmentId, userTeamId, userId, userId);
      }

      // Sort by start time, limited to the next few events
      query += `
        ORDER BY e.start_date ASC
        LIMIT ?
      `;
      queryParams.push(parseInt(limit.toString(), 10));

      const [events] = await executeQuery<DbCalendarEvent[]>(
        query,
        queryParams,
      );

      // Map database fields to API fields
      events.forEach((event) => {
        // Map database column names to API property names
        event.start_time = event.start_date;
        event.end_time = event.end_date;
        event.reminder_time = event.reminder_minutes;
        event.created_by = event.user_id;

        // org_level and org_id are now stored directly in the database
        // No need to map them based on type

        // Convert Buffer description to String if needed
        if (event.description && Buffer.isBuffer(event.description)) {
          event.description = event.description.toString("utf8");
        } else if (
          event.description &&
          typeof event.description === "object" &&
          "type" in event.description &&
          event.description.type === "Buffer" &&
          Array.isArray(event.description.data)
        ) {
          event.description = Buffer.from(event.description.data).toString(
            "utf8",
          );
        }
      });

      return events;
    } catch (error) {
      logger.error("Error in getDashboardEvents:", error);
      throw error;
    }
  }

  /**
   * Check if a user can manage an event
   */
  static async canManageEvent(
    eventId: number,
    userId: number,
    userInfo: UserInfo | null = null,
  ): Promise<boolean> {
    try {
      // Get event details
      const [events] = await executeQuery<DbCalendarEvent[]>(
        "SELECT * FROM calendar_events WHERE id = ?",
        [eventId],
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
      if (role === "admin" || role === "root") {
        return true;
      }

      // Event creator can manage their events
      if (event.user_id === userId) {
        return true;
      }

      return false;
    } catch (error) {
      logger.error("Error in canManageEvent:", error);
      throw error;
    }
  }

  /**
   * Generate recurring events based on recurrence rule
   */
  static async generateRecurringEvents(
    parentEvent: DbCalendarEvent,
    recurrenceRule: string,
  ): Promise<void> {
    try {
      // Parse recurrence rule
      const [pattern, ...options] = recurrenceRule.split(";");
      let count = 52; // Default to 1 year of weekly events
      let until: Date | null = null;

      // Parse options
      for (const option of options) {
        if (option.startsWith("COUNT=")) {
          count = parseInt(option.substring(6), 10);
        } else if (option.startsWith("UNTIL=")) {
          until = new Date(option.substring(6));
        }
      }

      // Calculate interval based on pattern
      let intervalDays = 1;
      switch (pattern) {
        case "daily":
          intervalDays = 1;
          break;
        case "weekly":
          intervalDays = 7;
          break;
        case "biweekly":
          intervalDays = 14;
          break;
        case "monthly":
          intervalDays = 30; // Approximate
          break;
        case "yearly":
          intervalDays = 365;
          break;
        case "weekdays":
          intervalDays = 1; // Special handling needed
          break;
      }

      // Generate occurrences
      const startDate = new Date(
        parentEvent.start_time ?? parentEvent.start_date,
      );
      const endDate = new Date(parentEvent.end_time ?? parentEvent.end_date);
      const duration = endDate.getTime() - startDate.getTime();

      let currentDate = new Date(startDate);
      let occurrences = 0;

      while (occurrences < count && (!until || currentDate <= until)) {
        // Skip first occurrence (parent event)
        if (occurrences > 0) {
          // Skip weekends for weekdays pattern
          if (pattern === "weekdays") {
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
              typeof parentEvent.description === "string"
                ? parentEvent.description
                : parentEvent.description?.toString("utf8"),
            location: parentEvent.location,
            start_time: newStartDate.toISOString(),
            end_time: newEndDate.toISOString(),
            all_day: Boolean(parentEvent.all_day),
            org_level: parentEvent.org_level ?? "personal",
            department_id: parentEvent.department_id ?? null,
            team_id: parentEvent.team_id ?? null,
            created_by: parentEvent.created_by ?? parentEvent.user_id,
            reminder_time: parentEvent.reminder_time,
            color: parentEvent.color,
            parent_event_id: parentEvent.id,
          });
        }

        // Move to next occurrence
        if (pattern === "monthly") {
          currentDate.setMonth(currentDate.getMonth() + 1);
        } else if (pattern === "yearly") {
          currentDate.setFullYear(currentDate.getFullYear() + 1);
        } else {
          currentDate.setDate(currentDate.getDate() + intervalDays);
        }

        occurrences++;
      }
    } catch (error) {
      logger.error("Error generating recurring events:", error);
      throw error;
    }
  }
}

// Export individual functions for backward compatibility
export const {
  getAllEvents,
  getEventById,
  checkEventExists,
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

// Type exports
export type {
  DbCalendarEvent,
  DbCalendarEvent as CalendarEvent,
  DbEventAttendee,
  DbEventAttendee as EventAttendee,
  EventQueryOptions,
  EventCreateData,
  EventUpdateData,
};

// Default export
export default Calendar;

/**
 * Calendar Service
 * Handles calendar business logic
 */

import {
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
} from '../models/calendar';
import { Pool } from 'mysql2/promise';

// Re-export interfaces from model
interface CalendarEvent {
  id: number;
  tenant_id: number;
  title: string;
  description?: string | null;
  location?: string | null;
  start_time: Date;
  end_time: Date;
  all_day: boolean | number;
  org_level: 'company' | 'department' | 'team' | 'personal';
  org_id?: number;
  created_by: number;
  reminder_time?: number | null;
  color: string;
  status: 'active' | 'cancelled';
  created_at: Date;
  updated_at: Date;
  // Extended fields
  creator_name?: string;
  user_response?: string | null;
}

interface EventFilters {
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
  org_level: 'company' | 'department' | 'team' | 'personal';
  org_id?: number;
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
  org_level?: 'company' | 'department' | 'team' | 'personal';
  org_id?: number;
  status?: 'active' | 'cancelled';
  reminder_time?: number | string | null;
  color?: string;
  created_by?: number;
}

interface EventsResponse {
  events: CalendarEvent[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

class CalendarService {
  /**
   * Holt alle Calendar Einträge für einen Tenant
   * Note: This method is kept for compatibility but uses the more specific getAllEvents internally
   */
  async getAll(
    _tenantDb: Pool,
    _filters: EventFilters = {}
  ): Promise<CalendarEvent[]> {
    try {
      // Extract tenant_id from the connection pool config if possible
      // For now, we'll need to pass it as a parameter in the controller
      console.warn(
        'CalendarService.getAll: This method requires refactoring to pass tenantId and userId'
      );
      throw new Error('Method needs refactoring - use getAllEvents directly');
    } catch (error) {
      console.error('Error in CalendarService.getAll:', error);
      throw error;
    }
  }

  /**
   * Get all calendar events visible to the user
   */
  async getAllEvents(
    tenantId: number,
    userId: number,
    options: EventFilters = {}
  ): Promise<EventsResponse> {
    try {
      return await (getAllEvents as any)(tenantId, userId, options);
    } catch (error) {
      console.error('Error in CalendarService.getAllEvents:', error);
      throw error;
    }
  }

  /**
   * Holt einen Calendar Eintrag per ID
   * Note: This method is kept for compatibility but uses getEventById internally
   */
  async getById(_tenantDb: Pool, _id: number): Promise<CalendarEvent | null> {
    try {
      console.warn(
        'CalendarService.getById: This method requires refactoring to pass tenantId and userId'
      );
      throw new Error('Method needs refactoring - use getEventById directly');
    } catch (error) {
      console.error('Error in CalendarService.getById:', error);
      throw error;
    }
  }

  /**
   * Get a specific calendar event by ID
   */
  async getEventById(
    id: number,
    tenantId: number,
    userId: number
  ): Promise<CalendarEvent | null> {
    try {
      return (await (getEventById as any)(
        id,
        tenantId,
        userId
      )) as CalendarEvent | null;
    } catch (error) {
      console.error('Error in CalendarService.getEventById:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Calendar Eintrag
   * Note: This method is kept for compatibility but uses createEvent internally
   */
  async create(
    _tenantDb: Pool,
    data: EventCreateData
  ): Promise<CalendarEvent | null> {
    try {
      return (await createEvent(data)) as CalendarEvent | null;
    } catch (error) {
      console.error('Error in CalendarService.create:', error);
      throw error;
    }
  }

  /**
   * Create a new calendar event
   */
  async createEvent(eventData: EventCreateData): Promise<CalendarEvent | null> {
    try {
      return (await createEvent(eventData)) as CalendarEvent | null;
    } catch (error) {
      console.error('Error in CalendarService.createEvent:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen Calendar Eintrag
   * Note: This method is kept for compatibility but uses updateEvent internally
   */
  async update(
    _tenantDb: Pool,
    _id: number,
    _data: EventUpdateData
  ): Promise<CalendarEvent | null> {
    try {
      console.warn(
        'CalendarService.update: This method requires refactoring to pass tenantId'
      );
      throw new Error('Method needs refactoring - use updateEvent directly');
    } catch (error) {
      console.error('Error in CalendarService.update:', error);
      throw error;
    }
  }

  /**
   * Update a calendar event
   */
  async updateEvent(
    id: number,
    eventData: EventUpdateData,
    tenantId: number
  ): Promise<CalendarEvent | null> {
    try {
      return (await updateEvent(
        id,
        eventData,
        tenantId
      )) as CalendarEvent | null;
    } catch (error) {
      console.error('Error in CalendarService.updateEvent:', error);
      throw error;
    }
  }

  /**
   * Löscht einen Calendar Eintrag
   * Note: This method is kept for compatibility but uses deleteEvent internally
   */
  async delete(_tenantDb: Pool, _id: number): Promise<boolean> {
    try {
      console.warn(
        'CalendarService.delete: This method requires refactoring to pass tenantId'
      );
      throw new Error('Method needs refactoring - use deleteEvent directly');
    } catch (error) {
      console.error('Error in CalendarService.delete:', error);
      throw error;
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(id: number, tenantId: number): Promise<boolean> {
    try {
      return await deleteEvent(id, tenantId);
    } catch (error) {
      console.error('Error in CalendarService.deleteEvent:', error);
      throw error;
    }
  }

  /**
   * Add attendee to event
   */
  async addEventAttendee(
    eventId: number,
    userId: number,
    responseStatus?: 'pending' | 'accepted' | 'declined' | 'tentative'
  ): Promise<boolean> {
    try {
      return await addEventAttendee(eventId, userId, responseStatus);
    } catch (error) {
      console.error('Error in CalendarService.addEventAttendee:', error);
      throw error;
    }
  }

  /**
   * Remove attendee from event
   */
  async removeEventAttendee(eventId: number, userId: number): Promise<boolean> {
    try {
      return await removeEventAttendee(eventId, userId);
    } catch (error) {
      console.error('Error in CalendarService.removeEventAttendee:', error);
      throw error;
    }
  }

  /**
   * Respond to event invitation
   */
  async respondToEvent(
    eventId: number,
    userId: number,
    response: string
  ): Promise<boolean> {
    try {
      return await respondToEvent(eventId, userId, response);
    } catch (error) {
      console.error('Error in CalendarService.respondToEvent:', error);
      throw error;
    }
  }

  /**
   * Get event attendees
   */
  async getEventAttendees(eventId: number, tenantId: number): Promise<any[]> {
    try {
      return await getEventAttendees(eventId, tenantId);
    } catch (error) {
      console.error('Error in CalendarService.getEventAttendees:', error);
      throw error;
    }
  }

  /**
   * Get dashboard events
   */
  async getDashboardEvents(
    tenantId: number,
    userId: number,
    days?: number,
    limit?: number
  ): Promise<CalendarEvent[]> {
    try {
      return (await (getDashboardEvents as any)(
        tenantId,
        userId,
        days,
        limit
      )) as CalendarEvent[];
    } catch (error) {
      console.error('Error in CalendarService.getDashboardEvents:', error);
      throw error;
    }
  }

  /**
   * Check if user can manage event
   */
  async canManageEvent(
    eventId: number,
    userId: number,
    userInfo?: any
  ): Promise<boolean> {
    try {
      return await canManageEvent(eventId, userId, userInfo);
    } catch (error) {
      console.error('Error in CalendarService.canManageEvent:', error);
      throw error;
    }
  }
}

// Export singleton instance
const calendarService = new CalendarService();
export default calendarService;

// Named export for the class
export { CalendarService };

// CommonJS compatibility

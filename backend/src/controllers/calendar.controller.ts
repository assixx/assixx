/**
 * Calendar Controller
 * Handles calendar-related operations
 *
 * NOTE: This controller uses generic CRUD methods that don't match
 * the actual Calendar model/service which has specific event methods.
 * Should be refactored to use getAllEvents, createEvent, etc.
 */

import { Request, Response } from 'express';
import { Pool } from 'mysql2/promise';
import calendarService from '../services/calendar.service';

// Extended Request interface with tenant database
interface TenantRequest extends Request {
  tenantDb?: Pool;
}

// Interface for create/update request bodies
interface CalendarEventCreateRequest extends TenantRequest {
  body: {
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
  };
}

interface CalendarEventUpdateRequest extends TenantRequest {
  body: {
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
  };
  params: {
    id: string;
  };
}

interface CalendarEventGetRequest extends TenantRequest {
  params: {
    id: string;
  };
}

interface CalendarEventQueryRequest extends TenantRequest {
  query: {
    status?: 'active' | 'cancelled';
    filter?: 'all' | 'company' | 'department' | 'team';
    search?: string;
    start_date?: string;
    end_date?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortDir?: 'ASC' | 'DESC';
  };
}

class CalendarController {
  /**
   * Holt alle Calendar Einträge
   * GET /api/calendar
   * NOTE: This method should be refactored to use getAllEvents with proper tenantId and userId
   */
  async getAll(req: CalendarEventQueryRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      console.warn(
        'CalendarController.getAll: This method should be refactored to use specific event methods'
      );
      // The calendarService.getAll method will throw an error as it needs refactoring
      try {
        // Parse query parameters to appropriate types
        const filters = {
          status: req.query.status,
          filter: req.query.filter,
          search: req.query.search,
          start_date: req.query.start_date,
          end_date: req.query.end_date,
          page: req.query.page ? parseInt(req.query.page) : undefined,
          limit: req.query.limit ? parseInt(req.query.limit) : undefined,
          sortBy: req.query.sortBy,
          sortDir: req.query.sortDir,
        };

        // Temporarily return paginated response format with empty events
        // TODO: Implement proper calendar event fetching with tenantId and userId
        console.log('Calendar events requested with filters:', filters);
        res.json({
          events: [],
          pagination: {
            total: 0,
            page: filters.page || 1,
            limit: filters.limit || 50,
            totalPages: 0
          }
        });
      } catch {
        // Return a helpful error message for the migration period
        res.status(501).json({
          error: 'Method not implemented',
          message:
            'Calendar controller needs refactoring to use specific event methods',
          suggestion: 'Use /api/calendar/events endpoint instead',
        });
      }
    } catch (error) {
      console.error('Error in CalendarController.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Holt einen Calendar Eintrag per ID
   * GET /api/calendar/:id
   * NOTE: This method should be refactored to use getEventById with proper tenantId and userId
   */
  async getById(req: CalendarEventGetRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      console.warn(
        'CalendarController.getById: This method should be refactored to use getEventById'
      );
      try {
        const result = await calendarService.getById(req.tenantDb, id);
        if (!result) {
          res.status(404).json({ error: 'Nicht gefunden' });
          return;
        }
        res.json(result);
      } catch {
        // Return a helpful error message for the migration period
        res.status(501).json({
          error: 'Method not implemented',
          message:
            'Calendar controller needs refactoring to use specific event methods',
        });
      }
    } catch (error) {
      console.error('Error in CalendarController.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Erstellt einen neuen Calendar Eintrag
   * POST /api/calendar
   * NOTE: This method should be refactored to use createEvent
   */
  async create(req: CalendarEventCreateRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      console.warn(
        'CalendarController.create: This method should be refactored to use createEvent'
      );
      try {
        const result = await calendarService.create(req.tenantDb, req.body);
        res.status(201).json(result);
      } catch {
        // For create, we can try to use the actual createEvent method
        const result = await calendarService.createEvent(req.body);
        res.status(201).json(result);
      }
    } catch (error) {
      console.error('Error in CalendarController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Aktualisiert einen Calendar Eintrag
   * PUT /api/calendar/:id
   * NOTE: This method should be refactored to use updateEvent
   */
  async update(req: CalendarEventUpdateRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      console.warn(
        'CalendarController.update: This method should be refactored to use updateEvent'
      );
      try {
        const result = await calendarService.update(req.tenantDb, id, req.body);
        res.json(result);
      } catch {
        // Return a helpful error message for the migration period
        res.status(501).json({
          error: 'Method not implemented',
          message:
            'Calendar controller needs refactoring to use specific event methods',
        });
      }
    } catch (error) {
      console.error('Error in CalendarController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Löscht einen Calendar Eintrag
   * DELETE /api/calendar/:id
   * NOTE: This method should be refactored to use deleteEvent
   */
  async delete(req: CalendarEventGetRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      console.warn(
        'CalendarController.delete: This method should be refactored to use deleteEvent'
      );
      try {
        await calendarService.delete(req.tenantDb, id);
        res.status(204).send();
      } catch {
        // Return a helpful error message for the migration period
        res.status(501).json({
          error: 'Method not implemented',
          message:
            'Calendar controller needs refactoring to use specific event methods',
        });
      }
    } catch (error) {
      console.error('Error in CalendarController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Löschen',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Additional methods that should be added in refactoring:

  /**
   * Get all events (proper implementation)
   * GET /api/calendar/events
   */
  async getAllEvents(
    _req: CalendarEventQueryRequest,
    res: Response
  ): Promise<void> {
    try {
      // This would need tenantId and userId from the request
      // Implementation would depend on how these are extracted from the request
      res.status(501).json({
        error: 'Not implemented',
        message:
          'This endpoint should be implemented to replace the generic getAll method',
      });
    } catch (error) {
      console.error('Error in CalendarController.getAllEvents:', error);
      res.status(500).json({
        error: 'Server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Export singleton instance
const calendarController = new CalendarController();
export default calendarController;

// Named export for the class
export { CalendarController };

// CommonJS compatibility

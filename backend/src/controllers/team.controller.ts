/**
 * Team Controller
 * Handles team-related operations
 */
import { Request, Response } from 'express';
import { Pool } from 'mysql2/promise';

import teamService from '../services/team.service';

// Constants
const TENANT_DB_NOT_AVAILABLE = 'Tenant database not available';
const UNKNOWN_ERROR = 'Unknown error';

// Extended Request interface with tenant database
interface TenantRequest extends Request {
  tenantDb?: Pool;
}

// Interface for create/update request bodies
interface TeamCreateRequest extends TenantRequest {
  body: {
    tenant_id: number;
    name: string;
    description?: string;
    department_id?: number;
    team_lead_id?: number;
    location?: string;
    max_members?: number;
    budget?: number;
    is_active?: boolean;
    goals?: string;
    meeting_schedule?: string;
  };
}

interface TeamUpdateRequest extends TenantRequest {
  body: {
    name?: string;
    description?: string;
    department_id?: number;
    team_lead_id?: number;
    location?: string;
    max_members?: number;
    budget?: number;
    is_active?: boolean;
    goals?: string;
    meeting_schedule?: string;
  };
  params: {
    id: string;
  };
}

interface TeamGetRequest extends TenantRequest {
  params: {
    id: string;
  };
}

interface TeamQueryRequest extends TenantRequest {
  query: {
    search?: string;
    department_id?: string;
    team_lead_id?: string;
    is_active?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortDir?: 'ASC' | 'DESC';
  };
}

/**
 *
 */
class TeamController {
  /**
   * Parse number query parameter
   */
  private parseNumberParam(value: string | undefined): number | undefined {
    if (value == null || value === '') {
      return undefined;
    }
    return Number.parseInt(value, 10);
  }

  /**
   * Parse boolean query parameter
   */
  private parseBooleanParam(value: string | undefined): boolean | undefined {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  }

  /**
   * Parse query filters
   */
  private parseQueryFilters(query: TeamQueryRequest['query']): Record<string, unknown> {
    return {
      ...query,
      department_id: this.parseNumberParam(query.department_id),
      team_lead_id: this.parseNumberParam(query.team_lead_id),
      is_active: this.parseBooleanParam(query.is_active),
      page: this.parseNumberParam(query.page),
      limit: this.parseNumberParam(query.limit),
    };
  }

  /**
   * Holt alle Team Einträge
   * GET /api/team
   * @param req - The request object
   * @param res - The response object
   */
  async getAll(req: TeamQueryRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: TENANT_DB_NOT_AVAILABLE });
        return;
      }

      const filters = this.parseQueryFilters(req.query);
      const result = await teamService.getAll(req.tenantDb, filters);
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in TeamController.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }

  /**
   * Holt einen Team Eintrag per ID
   * GET /api/team/:id
   * @param req - The request object
   * @param res - The response object
   */
  async getById(req: TeamGetRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: TENANT_DB_NOT_AVAILABLE });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const result = await teamService.getById(req.tenantDb, id);
      if (!result) {
        res.status(404).json({ error: 'Nicht gefunden' });
        return;
      }
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in TeamController.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }

  /**
   * Erstellt einen neuen Team Eintrag
   * POST /api/team
   * @param req - The request object
   * @param res - The response object
   */
  async create(req: TeamCreateRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: TENANT_DB_NOT_AVAILABLE });
        return;
      }

      const result = await teamService.create(req.tenantDb, req.body);
      res.status(201).json(result);
    } catch (error: unknown) {
      console.error('Error in TeamController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }

  /**
   * Aktualisiert einen Team Eintrag
   * PUT /api/team/:id
   * @param req - The request object
   * @param res - The response object
   */
  async update(req: TeamUpdateRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: TENANT_DB_NOT_AVAILABLE });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const result = await teamService.update(req.tenantDb, id, req.body);
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in TeamController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }

  /**
   * Löscht einen Team Eintrag
   * DELETE /api/team/:id
   * @param req - The request object
   * @param res - The response object
   */
  async delete(req: TeamGetRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: TENANT_DB_NOT_AVAILABLE });
        return;
      }

      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      await teamService.delete(req.tenantDb, id);
      res.status(204).send();
    } catch (error: unknown) {
      console.error('Error in TeamController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Löschen',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }
}

// Export singleton instance
const teamController = new TeamController();
export default teamController;

// Named export for the class
export { TeamController };

// CommonJS compatibility

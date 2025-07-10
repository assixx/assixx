/**
 * Team Controller
 * Handles team-related operations
 */

import { Request, Response } from 'express';
import { Pool } from 'mysql2/promise';
import teamService from '../services/team.service';

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

class TeamController {
  /**
   * Holt alle Team Einträge
   * GET /api/team
   */
  async getAll(req: TeamQueryRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      const filters = {
        ...req.query,
        department_id: req.query.department_id
          ? parseInt(req.query.department_id, 10)
          : undefined,
        team_lead_id: req.query.team_lead_id
          ? parseInt(req.query.team_lead_id, 10)
          : undefined,
        is_active:
          req.query.is_active === 'true'
            ? true
            : req.query.is_active === 'false'
              ? false
              : undefined,
        page: req.query.page ? parseInt(req.query.page, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
      };
      const result = await teamService.getAll(req.tenantDb, filters);
      res.json(result);
    } catch (error) {
      console.error('Error in TeamController.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Holt einen Team Eintrag per ID
   * GET /api/team/:id
   */
  async getById(req: TeamGetRequest, res: Response): Promise<void> {
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

      const result = await teamService.getById(req.tenantDb, id);
      if (!result) {
        res.status(404).json({ error: 'Nicht gefunden' });
        return;
      }
      res.json(result);
    } catch (error) {
      console.error('Error in TeamController.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Erstellt einen neuen Team Eintrag
   * POST /api/team
   */
  async create(req: TeamCreateRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(400).json({ error: 'Tenant database not available' });
        return;
      }

      const result = await teamService.create(req.tenantDb, req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error('Error in TeamController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Aktualisiert einen Team Eintrag
   * PUT /api/team/:id
   */
  async update(req: TeamUpdateRequest, res: Response): Promise<void> {
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

      const result = await teamService.update(req.tenantDb, id, req.body);
      res.json(result);
    } catch (error) {
      console.error('Error in TeamController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Löscht einen Team Eintrag
   * DELETE /api/team/:id
   */
  async delete(req: TeamGetRequest, res: Response): Promise<void> {
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

      await teamService.delete(req.tenantDb, id);
      res.status(204).send();
    } catch (error) {
      console.error('Error in TeamController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Löschen',
        message: error instanceof Error ? error.message : 'Unknown error',
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

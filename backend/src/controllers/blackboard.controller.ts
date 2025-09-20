/**
 * Blackboard Controller
 * Handles blackboard-related operations
 */
import { Response } from 'express';
import { Pool } from 'mysql2/promise';

import blackboardService from '../services/blackboard.service';
import { AuthenticatedRequest } from '../types/request.types';

// Constants
const DB_CONNECTION_ERROR = 'Database connection not available';
const UNKNOWN_ERROR = 'Unknown error';

// Extended Request interface with tenant database
interface TenantRequest extends AuthenticatedRequest {
  tenantDb?: Pool;
}

// Interface for create/update request bodies
interface BlackboardCreateRequest extends TenantRequest {
  body: {
    tenant_id: number;
    title: string;
    content: string;
    category?: string | null;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    is_pinned?: boolean;
    color?: string | null;
    tags?: string | string[] | null;
    created_by: number;
    expires_at?: Date | string | null;
    org_level?: string;
    org_id?: number | null;
  };
}

interface BlackboardUpdateRequest extends TenantRequest {
  body: {
    title?: string;
    content?: string;
    category?: string | null;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    is_pinned?: boolean;
    color?: string | null;
    tags?: string | null;
    expires_at?: Date | string | null;
  };
  params: {
    id: string;
  };
}

interface BlackboardGetRequest extends TenantRequest {
  params: {
    id: string;
  };
}

interface BlackboardQueryRequest extends TenantRequest {
  query: {
    category?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    is_pinned?: string;
    search?: string;
    page?: string;
    limit?: string;
  };
}

/**
 *
 */
class BlackboardController {
  /**
   * Holt alle Blackboard Einträge
   * GET /api/blackboard
   * @param req - The request object
   * @param res - The response object
   */
  async getAll(req: BlackboardQueryRequest, res: Response): Promise<void> {
    try {
      // Parse query parameters to appropriate types
      const filters = {
        category: req.query.category,
        priority: req.query.priority,
        is_pinned: req.query.is_pinned !== undefined ? req.query.is_pinned === 'true' : undefined,
        search: req.query.search,
        page: req.query.page !== undefined ? Number.parseInt(req.query.page) : undefined,
        limit: req.query.limit !== undefined ? Number.parseInt(req.query.limit) : undefined,
      };

      if (!req.tenantDb) {
        res.status(500).json({ error: DB_CONNECTION_ERROR });
        return;
      }
      const result = await blackboardService.getAll(
        req.tenantDb,
        filters,
        req.user.tenant_id,
        req.user.id,
      );
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in BlackboardController.getAll:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }

  /**
   * Holt einen Blackboard Eintrag per ID
   * GET /api/blackboard/:id
   * @param req - The request object
   * @param res - The response object
   */
  async getById(req: BlackboardGetRequest, res: Response): Promise<void> {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      if (!req.tenantDb) {
        res.status(500).json({ error: DB_CONNECTION_ERROR });
        return;
      }
      const result = await blackboardService.getById(
        req.tenantDb,
        id,
        req.user.tenant_id,
        req.user.id,
      );
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in BlackboardController.getById:', error);
      res.status(500).json({
        error: 'Fehler beim Abrufen der Daten',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }

  /**
   * Parse tags from request body
   */
  private parseTags(tags: unknown): string[] | undefined {
    if (tags === null || tags === undefined) {
      return undefined;
    }
    return typeof tags === 'string' ? tags.split(',') : (tags as string[]);
  }

  /**
   * Parse expires_at date from request body
   */
  private parseExpiresAt(expiresAt: unknown): Date | undefined {
    if (expiresAt === null || expiresAt === undefined) {
      return undefined;
    }
    return new Date(expiresAt as string);
  }

  /**
   * Erstellt einen neuen Blackboard Eintrag
   * POST /api/blackboard
   * @param req - The request object
   * @param res - The response object
   */
  async create(req: BlackboardCreateRequest, res: Response): Promise<void> {
    try {
      if (!req.tenantDb) {
        res.status(500).json({ error: DB_CONNECTION_ERROR });
        return;
      }

      const createData = {
        ...req.body,
        tenant_id: req.user.tenant_id,
        created_by: req.user.id,
        author_id: req.user.id,
        org_level: (req.body.org_level ?? 'company') as 'company' | 'department' | 'team',
        org_id: req.body.org_id ?? null,
        expires_at: this.parseExpiresAt(req.body.expires_at),
        tags: this.parseTags(req.body.tags),
        color: req.body.color === null ? undefined : req.body.color,
      };

      const result = await blackboardService.create(req.tenantDb, createData);
      res.status(201).json(result);
    } catch (error: unknown) {
      console.error('Error in BlackboardController.create:', error);
      res.status(500).json({
        error: 'Fehler beim Erstellen',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }

  /**
   * Parse nullable field value
   */
  private parseNullableField<T>(value: T | null): T | undefined {
    return value === null ? undefined : value;
  }

  /**
   * Aktualisiert einen Blackboard Eintrag
   * PUT /api/blackboard/:id
   * @param req - The request object
   * @param res - The response object
   */
  async update(req: BlackboardUpdateRequest, res: Response): Promise<void> {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      if (!req.tenantDb) {
        res.status(500).json({ error: DB_CONNECTION_ERROR });
        return;
      }

      const updateData = {
        ...req.body,
        tags: this.parseTags(req.body.tags),
        color: this.parseNullableField(req.body.color),
        category: this.parseNullableField(req.body.category),
      };

      const result = await blackboardService.update(
        req.tenantDb,
        id,
        updateData,
        req.user.tenant_id,
      );
      res.json(result);
    } catch (error: unknown) {
      console.error('Error in BlackboardController.update:', error);
      res.status(500).json({
        error: 'Fehler beim Aktualisieren',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }

  /**
   * Löscht einen Blackboard Eintrag
   * DELETE /api/blackboard/:id
   * @param req - The request object
   * @param res - The response object
   */
  async delete(req: BlackboardGetRequest, res: Response): Promise<void> {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      if (!req.tenantDb) {
        res.status(500).json({ error: DB_CONNECTION_ERROR });
        return;
      }
      await blackboardService.delete(req.tenantDb, id, req.user.tenant_id);
      res.status(204).send();
    } catch (error: unknown) {
      console.error('Error in BlackboardController.delete:', error);
      res.status(500).json({
        error: 'Fehler beim Löschen',
        message: error instanceof Error ? error.message : UNKNOWN_ERROR,
      });
    }
  }
}

// Export singleton instance
const blackboardController = new BlackboardController();
export default blackboardController;

// Named export for the class
export { BlackboardController };

// CommonJS compatibility

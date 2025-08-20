/**
 * Audit Trail Controller for v2 API
 * Handles HTTP requests for audit logging and compliance
 */
import { log, error as logError } from 'console';
import { Response } from 'express';

import type { AuthenticatedRequest } from '../../../types/request.types.js';
import { ServiceError } from '../../../utils/ServiceError.js';
import { errorResponse, successResponse } from '../../../utils/apiResponse.js';
import { auditTrailService } from './audit-trail.service.js';
import { AuditEntry, AuditFilter } from './types.js';

export const auditTrailController = {
  /**
   * Get audit entries with filters
   * @param req
   * @param res
   */
  async getEntries(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      log('[Audit Trail v2] getEntries called with user:', req.user?.id);
      if (!req.user) {
        res.status(401).json(errorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const filter: AuditFilter = {
        tenantId: req.user.tenant_id,
        userId: req.query.userId ? Number.parseInt(req.query.userId as string) : undefined,
        action: req.query.action as string,
        resourceType: req.query.resourceType as string,
        resourceId:
          req.query.resourceId ? Number.parseInt(req.query.resourceId as string) : undefined,
        status: req.query.status as 'success' | 'failure',
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        search: req.query.search as string,
        page: req.query.page ? Number.parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? Number.parseInt(req.query.limit as string) : 50,
        sortBy: req.query.sortBy as
          | 'created_at'
          | 'action'
          | 'user_id'
          | 'resource_type'
          | undefined,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      // Only root users can see entries from other users
      if (req.user.role !== 'root') {
        // Non-root users can only see their own entries
        if (filter.userId && filter.userId !== req.user.id) {
          res
            .status(403)
            .json(errorResponse('FORBIDDEN', "Cannot view other users' audit entries"));
          return;
        }
        // Force filter to only show their own entries
        filter.userId = req.user.id;
      }

      const result = await auditTrailService.getEntries(filter);

      res.json(
        successResponse(
          {
            entries: result.entries,
            pagination: {
              currentPage: filter.page ?? 1,
              pageSize: filter.limit ?? 50,
              totalItems: result.total,
              totalPages: Math.ceil(result.total / (filter.limit ?? 50)),
            },
          },
          'Audit entries retrieved successfully',
        ),
      );
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        logError('[Audit Trail v2] Get entries error:', error);
        if (error instanceof Error) {
          logError('[Audit Trail v2] Error stack:', error.stack);
        }
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to retrieve audit entries'));
      }
    }
  },

  /**
   * Get audit entry by ID
   * @param req
   * @param res
   */
  async getEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(errorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      const id = Number.parseInt(req.params.id);
      const entry = await auditTrailService.getEntryById(id, req.user.tenant_id);

      // Only root users can see entries from other users
      if (req.user.role !== 'root' && entry.userId !== req.user.id) {
        res.status(403).json(errorResponse('FORBIDDEN', "Cannot view other users' audit entries"));
        return;
      }

      res.json(successResponse(entry, 'Audit entry retrieved successfully'));
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        logError('[Audit Trail v2] Get entry error:', error);
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to retrieve audit entry'));
      }
    }
  },

  /**
   * Get audit statistics
   * @param req
   * @param res
   */
  async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(errorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      // Only admin and root users can view statistics
      if (!['admin', 'root'].includes(req.user.role)) {
        res.status(403).json(errorResponse('FORBIDDEN', 'Insufficient permissions'));
        return;
      }

      const filter: AuditFilter = {
        tenantId: req.user.tenant_id,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
      };

      const stats = await auditTrailService.getStats(filter);

      res.json(successResponse(stats, 'Audit statistics retrieved successfully'));
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        logError('[Audit Trail v2] Get stats error:', error);
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to retrieve audit statistics'));
      }
    }
  },

  /**
   * Generate compliance report
   * @param req
   * @param res
   */
  async generateReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(errorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      // Only admin and root users can generate reports
      if (!['admin', 'root'].includes(req.user.role)) {
        res.status(403).json(errorResponse('FORBIDDEN', 'Insufficient permissions'));
        return;
      }

      const { reportType, dateFrom, dateTo } = req.body as {
        reportType: 'gdpr' | 'data_access' | 'data_changes' | 'user_activity';
        dateFrom: string;
        dateTo: string;
      };

      const report = await auditTrailService.generateComplianceReport(
        req.user.tenant_id,
        reportType,
        dateFrom,
        dateTo,
        req.user.id,
      );

      res.json(successResponse(report, 'Compliance report generated successfully'));
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        logError('[Audit Trail v2] Generate report error:', error);
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to generate compliance report'));
      }
    }
  },

  /**
   * Export audit entries
   * @param req
   * @param res
   */
  async exportEntries(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(errorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      // Only admin and root users can export
      if (!['admin', 'root'].includes(req.user.role)) {
        res.status(403).json(errorResponse('FORBIDDEN', 'Insufficient permissions'));
        return;
      }

      const format = (req.query.format as string) ?? 'json';
      const filter: AuditFilter = {
        tenantId: req.user.tenant_id,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        // No pagination for export
        page: 1,
        limit: 10000, // Max export limit
      };

      const result = await auditTrailService.getEntries(filter);

      // Log the export action itself
      await auditTrailService.createEntry(
        req.user.tenant_id,
        req.user.id,
        {
          action: 'export',
          resourceType: 'audit_trail',
          resourceName: `Audit export (${result.entries.length} entries)`,
          status: 'success',
        },
        req.ip,
        req.get('user-agent'),
      );

      if (format === 'csv') {
        // Generate CSV
        const csv = auditTrailController.generateCSV(result.entries);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=audit-trail-export.csv');
        res.send(csv);
      } else {
        // JSON format
        res.json(successResponse(result.entries, 'Audit entries exported successfully'));
      }
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        logError('[Audit Trail v2] Export error:', error);
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to export audit entries'));
      }
    }
  },

  /**
   * Delete old audit entries (data retention)
   * @param req
   * @param res
   */
  async deleteOldEntries(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(errorResponse('UNAUTHORIZED', 'User not authenticated'));
        return;
      }

      // Only root users can delete audit entries
      if (req.user.role !== 'root') {
        res
          .status(403)
          .json(errorResponse('FORBIDDEN', 'Only root users can delete audit entries'));
        return;
      }

      const { olderThanDays } = req.body as {
        olderThanDays: number;
        confirmPassword: string;
      };

      if (!olderThanDays || olderThanDays < 90) {
        res
          .status(400)
          .json(errorResponse('VALIDATION_ERROR', 'Cannot delete entries newer than 90 days'));
        return;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const deletedCount = await auditTrailService.deleteOldEntries(req.user.tenant_id, cutoffDate);

      // Log the deletion
      await auditTrailService.createEntry(
        req.user.tenant_id,
        req.user.id,
        {
          action: 'delete',
          resourceType: 'audit_trail',
          resourceName: `Deleted ${deletedCount} entries older than ${olderThanDays} days`,
          changes: { deletedCount, olderThanDays },
          status: 'success',
        },
        req.ip,
        req.get('user-agent'),
      );

      res.json(
        successResponse(
          {
            deletedCount,
            cutoffDate: cutoffDate.toISOString(),
          },
          `Deleted ${deletedCount} audit entries`,
        ),
      );
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        res.status(error.statusCode).json(errorResponse(error.code, error.message));
      } else {
        logError('[Audit Trail v2] Delete old entries error:', error);
        res.status(500).json(errorResponse('SERVER_ERROR', 'Failed to delete old audit entries'));
      }
    }
  },

  /**
   * Generate CSV from audit entries
   * @param entries
   */
  generateCSV(entries: AuditEntry[]): string {
    const headers = [
      'ID',
      'Date/Time',
      'User',
      'Role',
      'Action',
      'Resource Type',
      'Resource',
      'Status',
      'IP Address',
    ];

    const rows = entries.map((entry) => [
      entry.id,
      entry.createdAt,
      entry.userName ?? entry.userId,
      entry.userRole ?? '',
      entry.action,
      entry.resourceType,
      entry.resourceName ?? entry.resourceId ?? '',
      entry.status,
      entry.ipAddress ?? '',
    ]);

    return [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join(
      '\n',
    );
  },
};

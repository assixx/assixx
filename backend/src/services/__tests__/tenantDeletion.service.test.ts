/**
 * Unit Tests for TenantDeletionService
 * Tests the complete tenant deletion workflow
 */

import { jest } from '@jest/globals';
import { tenantDeletionService } from '../tenantDeletion.service';
import { query } from '../../utils/db';
import { logger } from '../../utils/logger';
import { emailService } from '../../utils/emailService';
import { getRedisClient } from '../../config/redis';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock all dependencies
jest.mock('../../utils/db');
jest.mock('../../utils/logger');
jest.mock('../../utils/emailService');
jest.mock('../../config/redis');
jest.mock('fs/promises');

// Mock Redis client
const mockRedisClient = {
  keys: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
};

describe('TenantDeletionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getRedisClient as jest.Mock).mockResolvedValue(mockRedisClient);
  });

  describe('markTenantForDeletion', () => {
    it('should successfully mark tenant for deletion', async () => {
      const tenantId = 1;
      const requestedBy = 100;
      const reason = 'Test deletion';

      // Mock database queries
      (query as jest.Mock)
        .mockResolvedValueOnce([{ id: 1, deletion_status: 'active', company_name: 'Test Company' }]) // Check tenant exists
        .mockResolvedValueOnce([]) // Check shared resources
        .mockResolvedValueOnce([]) // Check active legal holds
        .mockResolvedValueOnce({ affectedRows: 1 }) // Update tenant status
        .mockResolvedValueOnce({ insertId: 1 }) // Insert into queue
        .mockResolvedValueOnce({ insertId: 1 }); // Insert audit log

      const result = await tenantDeletionService.markTenantForDeletion(tenantId, requestedBy, reason);

      expect(result.success).toBe(true);
      expect(result.queueId).toBe(1);
      expect(result.message).toContain('scheduled for deletion');

      // Verify tenant was marked
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE tenants SET deletion_status = 'marked_for_deletion'"),
        [tenantId]
      );

      // Verify queue entry was created
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tenant_deletion_queue'),
        expect.arrayContaining([tenantId, requestedBy, reason])
      );
    });

    it('should fail if tenant is already marked for deletion', async () => {
      (query as jest.Mock).mockResolvedValueOnce([
        { id: 1, deletion_status: 'marked_for_deletion', company_name: 'Test Company' }
      ]);

      const result = await tenantDeletionService.markTenantForDeletion(1, 100, 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already marked for deletion');
    });

    it('should fail if tenant has shared resources', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce([{ id: 1, deletion_status: 'active', company_name: 'Test Company' }])
        .mockResolvedValueOnce([{ count: 5 }]); // Has shared resources

      const result = await tenantDeletionService.markTenantForDeletion(1, 100, 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('shared resources');
    });

    it('should fail if tenant has active legal holds', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce([{ id: 1, deletion_status: 'active', company_name: 'Test Company' }])
        .mockResolvedValueOnce([]) // No shared resources
        .mockResolvedValueOnce([{ count: 2 }]); // Has legal holds

      const result = await tenantDeletionService.markTenantForDeletion(1, 100, 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('legal hold');
    });

    it('should send warning email on successful marking', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce([{ id: 1, deletion_status: 'active', company_name: 'Test Company' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce({ affectedRows: 1 })
        .mockResolvedValueOnce({ insertId: 1 })
        .mockResolvedValueOnce({ insertId: 1 })
        .mockResolvedValueOnce([{ email: 'admin@test.com' }]); // Admin emails

      await tenantDeletionService.markTenantForDeletion(1, 100, 'Test');

      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: 'admin@test.com',
        subject: expect.stringContaining('Löschung geplant'),
        html: expect.stringContaining('30 Tage')
      });
    });
  });

  describe('cancelDeletion', () => {
    it('should successfully cancel deletion', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce([{ 
          id: 1, 
          deletion_status: 'marked_for_deletion',
          deletion_requested_at: new Date(Date.now() - 86400000) // 1 day ago
        }])
        .mockResolvedValueOnce({ affectedRows: 1 }) // Update tenant status
        .mockResolvedValueOnce({ affectedRows: 1 }) // Update queue status
        .mockResolvedValueOnce({ insertId: 1 }); // Audit log

      const result = await tenantDeletionService.cancelDeletion(1, 100);

      expect(result.success).toBe(true);
      expect(result.message).toContain('cancelled successfully');

      // Verify tenant status was restored
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE tenants SET deletion_status = 'active'"),
        [1]
      );
    });

    it('should fail if grace period has expired', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31); // 31 days ago

      (query as jest.Mock).mockResolvedValueOnce([{
        id: 1,
        deletion_status: 'marked_for_deletion',
        deletion_requested_at: oldDate
      }]);

      const result = await tenantDeletionService.cancelDeletion(1, 100);

      expect(result.success).toBe(false);
      expect(result.error).toContain('grace period has expired');
    });

    it('should fail if tenant is not marked for deletion', async () => {
      (query as jest.Mock).mockResolvedValueOnce([{
        id: 1,
        deletion_status: 'active'
      }]);

      const result = await tenantDeletionService.cancelDeletion(1, 100);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not marked for deletion');
    });
  });

  describe('processQueue', () => {
    it('should process queued deletions', async () => {
      const mockQueueItem = {
        id: 1,
        tenant_id: 1,
        created_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) // 31 days old
      };

      (query as jest.Mock)
        .mockResolvedValueOnce([mockQueueItem]) // Get queued items
        .mockResolvedValueOnce({ affectedRows: 1 }); // Update to processing

      // Mock processTenantDeletion
      const processSpy = jest.spyOn(tenantDeletionService as any, 'processTenantDeletion')
        .mockResolvedValue({ success: true });

      await tenantDeletionService.processQueue();

      expect(processSpy).toHaveBeenCalledWith(1, 1);
    });

    it('should skip items still in grace period', async () => {
      const mockQueueItem = {
        id: 1,
        tenant_id: 1,
        created_at: new Date() // Just created
      };

      (query as jest.Mock).mockResolvedValueOnce([mockQueueItem]);

      const processSpy = jest.spyOn(tenantDeletionService as any, 'processTenantDeletion');

      await tenantDeletionService.processQueue();

      expect(processSpy).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('still in grace period')
      );
    });

    it('should handle processing errors', async () => {
      const mockQueueItem = {
        id: 1,
        tenant_id: 1,
        created_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
      };

      (query as jest.Mock)
        .mockResolvedValueOnce([mockQueueItem])
        .mockResolvedValueOnce({ affectedRows: 1 });

      // Mock processTenantDeletion to throw error
      jest.spyOn(tenantDeletionService as any, 'processTenantDeletion')
        .mockRejectedValue(new Error('Processing failed'));

      await tenantDeletionService.processQueue();

      // Should update queue status to failed
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE tenant_deletion_queue SET status = 'failed'"),
        expect.arrayContaining(['Processing failed'])
      );
    });
  });

  describe('getDeletionStatus', () => {
    it('should return correct status for marked tenant', async () => {
      const mockTenant = {
        deletion_status: 'marked_for_deletion',
        deletion_requested_at: new Date()
      };

      const mockQueue = {
        id: 1,
        status: 'queued',
        progress: 0,
        current_step: null
      };

      (query as jest.Mock)
        .mockResolvedValueOnce([mockTenant])
        .mockResolvedValueOnce([mockQueue]);

      const result = await tenantDeletionService.getDeletionStatus(1);

      expect(result).toMatchObject({
        deletion_status: 'marked_for_deletion',
        progress: 0,
        status: 'queued',
        grace_period_days: 30,
        days_remaining: expect.any(Number)
      });
    });

    it('should handle completed deletion', async () => {
      const mockQueue = {
        id: 1,
        status: 'completed',
        progress: 100,
        completed_at: new Date()
      };

      (query as jest.Mock)
        .mockResolvedValueOnce([]) // No tenant found
        .mockResolvedValueOnce([mockQueue]);

      const result = await tenantDeletionService.getDeletionStatus(1);

      expect(result.deletion_status).toBe('completed');
      expect(result.progress).toBe(100);
    });
  });

  describe('Deletion Steps', () => {
    describe('executeStep - createDataExport', () => {
      it('should create data export successfully', async () => {
        const mockUsers = [
          { id: 1, email: 'user1@test.com', first_name: 'John' },
          { id: 2, email: 'user2@test.com', first_name: 'Jane' }
        ];

        const mockDocuments = [
          { id: 1, filename: 'doc1.pdf', created_at: new Date() }
        ];

        (query as jest.Mock)
          .mockResolvedValueOnce(mockUsers) // Get users
          .mockResolvedValueOnce(mockDocuments) // Get documents
          .mockResolvedValueOnce([]) // Get messages
          .mockResolvedValueOnce({ insertId: 1 }); // Insert export record

        (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
        (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

        const step = (tenantDeletionService as any).deletionSteps.find(
          (s: any) => s.name === 'createDataExport'
        );
        
        const result = await (tenantDeletionService as any).executeStep(step, 1, 1);

        expect(result.success).toBe(true);
        expect(fs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('users.json'),
          expect.any(String)
        );
      });
    });

    describe('executeStep - cleanupRedis', () => {
      it('should cleanup Redis sessions', async () => {
        mockRedisClient.keys.mockResolvedValue([
          'sess:tenant:1:user:1',
          'sess:tenant:1:user:2',
          'other:key'
        ]);

        const step = (tenantDeletionService as any).deletionSteps.find(
          (s: any) => s.name === 'cleanupRedis'
        );

        const result = await (tenantDeletionService as any).executeStep(step, 1, 1);

        expect(result.success).toBe(true);
        expect(result.recordsDeleted).toBe(2);
        expect(mockRedisClient.del).toHaveBeenCalledWith([
          'sess:tenant:1:user:1',
          'sess:tenant:1:user:2'
        ]);
      });
    });

    describe('executeStep - deleteUsers', () => {
      it('should delete users with optimized query', async () => {
        (query as jest.Mock).mockResolvedValueOnce({ affectedRows: 15 });

        const step = (tenantDeletionService as any).deletionSteps.find(
          (s: any) => s.name === 'deleteUsers'
        );

        const result = await (tenantDeletionService as any).executeStep(step, 1, 1);

        expect(result.success).toBe(true);
        expect(result.recordsDeleted).toBe(15);
        expect(query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE u FROM users u'),
          [1]
        );
      });
    });

    describe('executeStep - cleanupFilesystem', () => {
      it('should cleanup tenant files', async () => {
        (fs.rm as jest.Mock).mockResolvedValue(undefined);

        const step = (tenantDeletionService as any).deletionSteps.find(
          (s: any) => s.name === 'cleanupFilesystem'
        );

        const result = await (tenantDeletionService as any).executeStep(step, 1, 1);

        expect(result.success).toBe(true);
        expect(fs.rm).toHaveBeenCalledWith(
          expect.stringContaining('/uploads/tenants/1'),
          { recursive: true, force: true }
        );
      });

      it('should handle missing directories gracefully', async () => {
        (fs.rm as jest.Mock).mockRejectedValue({ code: 'ENOENT' });

        const step = (tenantDeletionService as any).deletionSteps.find(
          (s: any) => s.name === 'cleanupFilesystem'
        );

        const result = await (tenantDeletionService as any).executeStep(step, 1, 1);

        expect(result.success).toBe(true);
        expect(result.notes).toContain('No files found');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection lost');
      (query as jest.Mock).mockRejectedValue(dbError);

      const result = await tenantDeletionService.markTenantForDeletion(1, 100, 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection lost');
      expect(logger.error).toHaveBeenCalledWith(
        'Error marking tenant for deletion:',
        dbError
      );
    });

    it('should continue with non-critical step failures', async () => {
      const mockQueueItem = {
        id: 1,
        tenant_id: 1,
        created_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
      };

      (query as jest.Mock)
        .mockResolvedValueOnce([mockQueueItem])
        .mockResolvedValueOnce({ affectedRows: 1 })
        .mockResolvedValueOnce({ affectedRows: 1 }) // Update to deleting
        // Mock some steps failing
        .mockRejectedValueOnce(new Error('Step failed')) // First step fails
        .mockResolvedValue({ affectedRows: 1 }); // Other steps succeed

      // Override executeStep to simulate mixed results
      const executeStepSpy = jest.spyOn(tenantDeletionService as any, 'executeStep')
        .mockImplementation(async (step) => {
          if (step.critical) {
            return { success: true, recordsDeleted: 1 };
          }
          // Non-critical step fails
          throw new Error('Non-critical step failed');
        });

      await tenantDeletionService.processQueue();

      // Should still mark as completed if only non-critical steps failed
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Non-critical step failed')
      );
    });
  });

  describe('Rollback Functionality', () => {
    it('should create rollback information', async () => {
      const mockRollbackData = {
        tenant_data: { id: 1, company_name: 'Test Company' },
        users_count: 10,
        documents_count: 50
      };

      (query as jest.Mock)
        .mockResolvedValueOnce([{ id: 1, company_name: 'Test Company' }]) // Get tenant
        .mockResolvedValueOnce([{ count: 10 }]) // Users count
        .mockResolvedValueOnce([{ count: 50 }]) // Documents count
        .mockResolvedValueOnce({ insertId: 1 }); // Insert rollback

      const step = (tenantDeletionService as any).deletionSteps.find(
        (s: any) => s.name === 'createRollbackInfo'
      );

      const result = await (tenantDeletionService as any).executeStep(step, 1, 1);

      expect(result.success).toBe(true);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tenant_deletion_rollback'),
        expect.arrayContaining([1, expect.any(String)])
      );
    });
  });
});
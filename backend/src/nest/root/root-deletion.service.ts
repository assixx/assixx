/**
 * Root Deletion Sub-Service
 *
 * Handles tenant deletion requests, approvals, and lifecycle.
 * Extracted from root.service.ts — bounded context: tenant deletion.
 *
 * Uses tenantDeletionService for the actual deletion engine.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';

import { DatabaseService } from '../database/database.service.js';
import { UserRepository } from '../database/repositories/user.repository.js';
import { TenantDeletionService } from '../tenant-deletion/tenant-deletion.service.js';
import { ERROR_CODES } from './root.helpers.js';
import type {
  DbDeletionQueueRow,
  DbDeletionRequestRow,
  DbTenantRow,
  DeletionApproval,
  DeletionDryRunReport,
  TenantDeletionStatus,
} from './root.types.js';

@Injectable()
export class RootDeletionService {
  private readonly logger = new Logger(RootDeletionService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly userRepository: UserRepository,
    private readonly tenantDeletion: TenantDeletionService,
  ) {}

  /**
   * Request tenant deletion
   */
  async requestTenantDeletion(
    tenantId: number,
    requestedBy: number,
    reason?: string,
    ipAddress?: string,
  ): Promise<number> {
    this.logger.log(`Requesting tenant deletion for tenant ${tenantId}`);

    // SECURITY: Check if there are at least 2 ACTIVE root users (is_active = 1)
    const rootCount = await this.userRepository.countByRole('root', tenantId);

    if (rootCount < 2) {
      throw new BadRequestException({
        code: ERROR_CODES.INSUFFICIENT_ROOT_USERS,
        message: 'At least 2 root users required before tenant deletion',
      });
    }

    try {
      const result = await this.tenantDeletion.requestTenantDeletion(
        tenantId,
        requestedBy,
        reason ?? 'No reason provided',
        ipAddress,
      );
      return result.queueId;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('already marked_for_deletion')) {
        throw new ConflictException({
          code: ERROR_CODES.ALREADY_SCHEDULED,
          message: 'Tenant is already marked for deletion',
        });
      }
      throw error;
    }
  }

  /**
   * Get tenant deletion status
   */
  async getDeletionStatus(
    tenantId: number,
    currentUserId?: number,
  ): Promise<TenantDeletionStatus | null> {
    this.logger.debug(`Getting deletion status for tenant ${tenantId}`);

    const deletions = await this.db.query<DbDeletionQueueRow>(
      `SELECT dq.*, t.company_name, u.username as requested_by_name
       FROM tenant_deletion_queue dq
       JOIN tenants t ON t.id = dq.tenant_id
       JOIN users u ON u.id = dq.created_by
       WHERE dq.tenant_id = $1 AND dq.status NOT IN ('cancelled', 'completed')
       ORDER BY dq.created_at DESC LIMIT 1`,
      [tenantId],
    );

    const deletion = deletions[0];
    if (deletion === undefined) {
      return null;
    }

    const hasUserId = currentUserId !== undefined && currentUserId !== 0;
    const isCreator = hasUserId ? deletion.created_by === currentUserId : false;
    const canApprove = deletion.status === 'pending_approval' && !isCreator;
    const canCancel =
      ['pending_approval', 'approved'].includes(deletion.status) && isCreator;

    return {
      queueId: deletion.id,
      tenantId: deletion.tenant_id,
      status: deletion.status,
      requestedBy: deletion.created_by,
      requestedByName: deletion.requested_by_name,
      requestedAt: deletion.created_at,
      approvedBy: deletion.approved_by ?? undefined,
      approvedAt: deletion.approved_at ?? undefined,
      scheduledFor: deletion.scheduled_for ?? undefined,
      reason: deletion.reason,
      errorMessage: deletion.error_message ?? undefined,
      coolingOffHours: deletion.cooling_off_hours,
      canCancel,
      canApprove,
    };
  }

  /**
   * Cancel deletion
   */
  async cancelDeletion(tenantId: number, userId: number): Promise<void> {
    this.logger.log(`Cancelling deletion for tenant ${tenantId}`);
    await this.tenantDeletion.cancelDeletion(tenantId, userId);
  }

  /**
   * Perform deletion dry run
   */
  async performDeletionDryRun(tenantId: number): Promise<DeletionDryRunReport> {
    this.logger.log(`Performing deletion dry run for tenant ${tenantId}`);

    const report = await this.tenantDeletion.performDryRun(tenantId);

    // Get tenant name
    const tenant = await this.db.query<DbTenantRow>(
      'SELECT company_name FROM tenants WHERE id = $1',
      [tenantId],
    );

    const records = report.affectedRecords as Record<
      string,
      number | undefined
    >;

    return {
      tenantId: report.tenantId,
      companyName: tenant[0]?.company_name ?? 'Unknown',
      estimatedDuration: `${report.estimatedDuration} minutes`,
      affectedRecords: {
        users: records['users'] ?? 0,
        documents: records['documents'] ?? 0,
        departments: records['departments'] ?? 0,
        teams: records['teams'] ?? 0,
        shifts: records['shifts'] ?? 0,
        kvpSuggestions: records['kvp_suggestions'] ?? 0,
        surveys: records['surveys'] ?? 0,
        logs: records['logs'] ?? 0,
        total: report.totalRecords,
      },
      storageToFree: 0,
      warnings: report.warnings,
      canProceed: report.blockers.length === 0,
    };
  }

  // ==========================================================================
  // DELETION APPROVALS
  // ==========================================================================

  /**
   * Get all deletion requests
   */
  async getAllDeletionRequests(): Promise<DeletionApproval[]> {
    this.logger.debug('Getting all deletion requests');

    const deletions = await this.db.query<DbDeletionRequestRow>(
      `SELECT q.*, t.company_name, t.subdomain, u.username as requester_name, u.email as requester_email
       FROM tenant_deletion_queue q
       JOIN tenants t ON t.id = q.tenant_id
       JOIN users u ON u.id = q.created_by
       ORDER BY q.created_at DESC`,
    );

    return deletions.map((d: DbDeletionRequestRow) => ({
      queueId: d.id,
      tenantId: d.tenant_id,
      companyName: d.company_name,
      subdomain: d.subdomain,
      requesterId: d.created_by,
      requesterName: d.requester_name,
      requesterEmail: d.requester_email,
      requestedAt: d.created_at,
      reason: d.reason,
      status: d.status,
    }));
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals(
    currentUserId: number,
  ): Promise<DeletionApproval[]> {
    this.logger.debug(`Getting pending approvals for user ${currentUserId}`);

    const approvals = await this.db.query<DbDeletionRequestRow>(
      `SELECT q.*, t.company_name, t.subdomain, u.username as requester_name, u.email as requester_email
       FROM tenant_deletion_queue q
       JOIN tenants t ON t.id = q.tenant_id
       JOIN users u ON u.id = q.created_by
       WHERE q.status = 'pending_approval' AND q.created_by != $1
       ORDER BY q.created_at DESC`,
      [currentUserId],
    );

    return approvals.map((a: DbDeletionRequestRow) => ({
      queueId: a.id,
      tenantId: a.tenant_id,
      companyName: a.company_name,
      subdomain: a.subdomain,
      requesterId: a.created_by,
      requesterName: a.requester_name,
      requesterEmail: a.requester_email,
      requestedAt: a.created_at,
      reason: a.reason,
      status: a.status,
    }));
  }

  /**
   * Approve deletion with password verification (Two-Person-Principle)
   *
   * SECURITY: The approving user must verify their identity with their password.
   * This implements the "Zwei-Personen-Prinzip" for critical operations.
   */
  async approveDeletion(
    queueId: number,
    userId: number,
    password: string,
    comment?: string,
  ): Promise<void> {
    this.logger.log(`Approving deletion ${queueId} - verifying user password`);

    // SECURITY: Get user's password hash for verification
    // IMPORTANT: Only allow ACTIVE users (is_active = 1) to approve deletions
    // TODO: Add tenantId parameter to use UserRepository.getPasswordHash() for full isolation
    const users = await this.db.query<{ password: string | null }>(
      'SELECT password FROM users WHERE id = $1 AND is_active = 1',
      [userId],
    );

    const userRecord = users[0];
    if (userRecord === undefined) {
      this.logger.error(
        `User ${userId} not found or inactive for deletion approval`,
      );
      throw new Error('User not found or inactive');
    }

    // SECURITY: Verify the password matches
    const storedHash = userRecord.password;
    if (storedHash === null || storedHash === '') {
      this.logger.error(`User ${userId} has no password set`);
      throw new Error('User password not configured');
    }

    const isPasswordValid = await bcrypt.compare(password, storedHash);
    if (!isPasswordValid) {
      this.logger.warn(
        `Invalid password for deletion approval by user ${userId}`,
      );
      throw new Error('Ungültiges Passwort');
    }

    this.logger.log(
      `Password verified for user ${userId}, proceeding with approval`,
    );
    await this.tenantDeletion.approveDeletion(queueId, userId, comment);
  }

  /**
   * Reject deletion
   */
  async rejectDeletion(
    queueId: number,
    userId: number,
    reason: string,
  ): Promise<void> {
    this.logger.log(`Rejecting deletion ${queueId}`);
    await this.tenantDeletion.rejectDeletion(queueId, userId, reason);
  }

  /**
   * Emergency stop
   */
  async emergencyStop(tenantId: number, userId: number): Promise<void> {
    this.logger.log(`Emergency stop for tenant ${tenantId}`);
    await this.tenantDeletion.triggerEmergencyStop(tenantId, userId);
  }
}

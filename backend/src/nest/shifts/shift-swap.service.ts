/**
 * Shift Swap Service
 *
 * Sub-service for shift swap request management.
 * Handles listing, creating, and status updates for swap requests.
 * Injected into the ShiftsService facade.
 *
 * NOTE: Shift ownership verification is handled by the facade (cross-domain coordination).
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { dbToApi } from '../../utils/fieldMapper.js';
import { DatabaseService } from '../database/database.service.js';
import type { CreateSwapRequestDto } from './dto/create-swap-request.dto.js';
import type { UpdateSwapRequestStatusDto } from './dto/swap-request-status.dto.js';
import type {
  DbSwapRequestRow,
  SwapRequestFilters,
  SwapRequestResponse,
} from './shifts.types.js';

@Injectable()
export class ShiftSwapService {
  private readonly logger = new Logger(ShiftSwapService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async listSwapRequests(
    tenantId: number,
    filters: SwapRequestFilters,
  ): Promise<SwapRequestResponse[]> {
    this.logger.debug(`Listing swap requests for tenant ${tenantId}`);

    let query = `SELECT * FROM shift_swap_requests WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters.userId !== undefined) {
      query += ` AND (requested_by = $${paramIndex} OR requested_with = $${paramIndex})`;
      params.push(filters.userId);
      paramIndex++;
    }
    if (filters.status !== undefined) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
    }

    query += ` ORDER BY created_at DESC`;

    const requests = await this.databaseService.query<DbSwapRequestRow>(
      query,
      params,
    );
    return requests.map(
      (r: DbSwapRequestRow) =>
        dbToApi(r as unknown as Record<string, unknown>) as SwapRequestResponse,
    );
  }

  /**
   * Creates a swap request.
   * NOTE: Shift ownership verification must be done by the caller (facade).
   */
  async createSwapRequest(
    dto: CreateSwapRequestDto,
    tenantId: number,
    userId: number,
  ): Promise<SwapRequestResponse> {
    this.logger.debug(`Creating swap request for tenant ${tenantId}`);

    const result = await this.databaseService.query<{ id: number }>(
      `INSERT INTO shift_swap_requests (tenant_id, shift_id, requested_by, requested_with, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id`,
      [
        tenantId,
        dto.shiftId,
        userId,
        dto.requestedWithUserId ?? null,
        dto.reason ?? null,
      ],
    );

    const requestId = result[0]?.id ?? 0;

    return {
      id: requestId,
      shiftId: dto.shiftId,
      requestedBy: userId,
      requestedWith: dto.requestedWithUserId,
      status: 'pending',
      reason: dto.reason,
      message: 'Swap request created successfully',
    };
  }

  async updateSwapRequestStatus(
    id: number,
    dto: UpdateSwapRequestStatusDto,
    tenantId: number,
    userId: number,
  ): Promise<{ message: string }> {
    this.logger.debug(
      `Updating swap request ${id} status for tenant ${tenantId}`,
    );

    const requests = await this.databaseService.query<DbSwapRequestRow>(
      `SELECT * FROM shift_swap_requests WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    if (requests.length === 0) {
      throw new NotFoundException(`Swap request ${id} not found`);
    }

    await this.databaseService.query(
      `UPDATE shift_swap_requests SET status = $1, reviewed_by = $2, reviewed_at = NOW()
       WHERE id = $3 AND tenant_id = $4`,
      [dto.status, userId, id, tenantId],
    );

    return { message: `Swap request ${dto.status} successfully` };
  }
}

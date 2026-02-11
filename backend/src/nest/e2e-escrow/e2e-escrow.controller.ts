/**
 * E2E Key Escrow Controller
 *
 * REST endpoints for zero-knowledge encrypted private key backup.
 *
 * Endpoints:
 * - POST /e2e/escrow  — Store initial escrow blob
 * - GET  /e2e/escrow  — Retrieve escrow blob for recovery
 * - PUT  /e2e/escrow  — Re-encrypt blob (password change)
 *
 * Rate limiting via AuthThrottle / UserThrottle decorators (ADR-001).
 * ResponseInterceptor (ADR-007) wraps all responses — do NOT wrap manually.
 *
 * @see ADR-022 (E2E Key Escrow)
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import {
  AuthThrottle,
  UserThrottle,
} from '../common/decorators/throttle.decorators.js';
import { CustomThrottlerGuard } from '../common/guards/throttler.guard.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { StoreEscrowDto } from './dto/index.js';
import { E2eEscrowService } from './e2e-escrow.service.js';
import type { E2eEscrowResponse } from './e2e-escrow.types.js';

@Controller('e2e/escrow')
export class E2eEscrowController {
  constructor(private readonly escrowService: E2eEscrowService) {}

  /**
   * Store an initial escrow blob.
   * Returns 409 Conflict if an escrow already exists (use PUT to update).
   * Rate limited: 10 per 5 minutes (escrow creation is rare).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle()
  async storeEscrow(
    @Body() dto: StoreEscrowDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
  ): Promise<E2eEscrowResponse> {
    return await this.escrowService.storeEscrow(
      tenantId,
      user.id,
      dto.encryptedBlob,
      dto.argon2Salt,
      dto.xchachaNonce,
      dto.argon2Params,
    );
  }

  /**
   * Retrieve the escrow blob for key recovery.
   * Returns null (wrapped as success: true, data: null) if no escrow exists.
   */
  @Get()
  @UseGuards(CustomThrottlerGuard)
  @UserThrottle()
  async getEscrow(
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
  ): Promise<E2eEscrowResponse | null> {
    return await this.escrowService.getEscrow(tenantId, user.id);
  }

  /**
   * Update the escrow blob (re-encrypt after password change).
   * Returns the updated escrow data, or null if no escrow existed.
   */
  @Put()
  @HttpCode(HttpStatus.OK)
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle()
  async updateEscrow(
    @Body() dto: StoreEscrowDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
  ): Promise<E2eEscrowResponse | null> {
    return await this.escrowService.updateEscrow(
      tenantId,
      user.id,
      dto.encryptedBlob,
      dto.argon2Salt,
      dto.xchachaNonce,
      dto.argon2Params,
    );
  }
}

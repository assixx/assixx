/**
 * E2E Keys Controller
 *
 * REST endpoints for managing X25519 public keys used in E2E encryption.
 *
 * Endpoints:
 * - POST   /e2e/keys              — Register a new public key (user, 409 if exists)
 * - POST   /e2e/keys/with-escrow  — Atomic key + escrow registration (ADR-022, post-mortem 2026-05-01)
 * - GET    /e2e/keys/me           — Get own key data
 * - GET    /e2e/keys/:userId      — Get another user's public key
 * - DELETE /e2e/keys/:userId      — Admin: reset a user's key (marks is_active=4)
 *
 * Rate limiting via AuthThrottle / UserThrottle / AdminThrottle decorators (ADR-001).
 * ResponseInterceptor (ADR-007) wraps all responses — do NOT wrap manually.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import {
  AdminThrottle,
  AuthThrottle,
  UserThrottle,
} from '../common/decorators/throttle.decorators.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { CustomThrottlerGuard } from '../common/guards/throttler.guard.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { RegisterKeysDto, RegisterKeysWithEscrowDto } from './dto/index.js';
import type { E2eKeyWithEscrowResponse } from './e2e-keys.service.js';
import { E2eKeysService } from './e2e-keys.service.js';
import type { E2eKeyResponse, E2ePublicKeyResponse } from './e2e-keys.types.js';

@Controller('e2e/keys')
export class E2eKeysController {
  constructor(private readonly e2eKeysService: E2eKeysService) {}

  /**
   * Register a new E2E public key (key-only path).
   * Returns 409 Conflict if an active key already exists (multi-tab race protection).
   * Rate limited: 10 per 5 minutes (key registration is rare).
   *
   * Prefer `POST /e2e/keys/with-escrow` for first-time registration —
   * the standalone register leaves a race window between key insert and
   * follow-up escrow insert that produced irrecoverable `(key, no escrow)`
   * state (post-mortem 2026-05-01). This endpoint is retained for legacy
   * paths where the escrow is created via `tryCreateEscrowIfMissing` on
   * the next same-origin login.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle()
  async registerKeys(
    @Body() dto: RegisterKeysDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
  ): Promise<E2eKeyResponse> {
    return await this.e2eKeysService.registerKeys(dto.publicKey, tenantId, user.id);
  }

  /**
   * Atomic key + escrow registration. Both rows commit in a single
   * `tenantTransaction()` or both roll back — by construction there is
   * no observable `(key, no escrow)` state, eliminating the irrecoverable
   * divergence class documented in the 2026-05-01 post-mortem.
   *
   * Returns 409 Conflict if EITHER an active key OR an active escrow
   * already exists for this user (use the retrieval endpoints instead).
   *
   * Rate limited as `AuthThrottle()` to match the legacy `POST /e2e/keys`.
   */
  @Post('with-escrow')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle()
  async registerKeysWithEscrow(
    @Body() dto: RegisterKeysWithEscrowDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
  ): Promise<E2eKeyWithEscrowResponse> {
    return await this.e2eKeysService.registerKeysWithEscrow(
      dto.publicKey,
      dto.escrow,
      tenantId,
      user.id,
    );
  }

  /**
   * Rotate the current user's E2E key.
   * Deactivates the old key and registers the new one atomically.
   * Used when client detects key mismatch (container browser cleared IndexedDB).
   */
  @Put('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle()
  async rotateOwnKey(
    @Body() dto: RegisterKeysDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
  ): Promise<E2eKeyResponse> {
    return await this.e2eKeysService.rotateOwnKey(dto.publicKey, tenantId, user.id);
  }

  /**
   * Get the current user's own active key data.
   * Returns null (wrapped as success: true, data: null) if no key exists.
   */
  @Get('me')
  @UseGuards(CustomThrottlerGuard)
  @UserThrottle()
  async getOwnKeys(
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
  ): Promise<E2eKeyResponse | null> {
    return await this.e2eKeysService.getOwnKeys(tenantId, user.id);
  }

  /**
   * Get another user's public key (for encrypting messages to them).
   * Returns null if the user has no active key.
   */
  @Get(':userId')
  @UseGuards(CustomThrottlerGuard)
  @UserThrottle()
  async getPublicKey(
    @Param('userId', ParseIntPipe) userId: number,
    @TenantId() tenantId: number,
  ): Promise<E2ePublicKeyResponse | null> {
    return await this.e2eKeysService.getPublicKey(tenantId, userId);
  }

  /**
   * Admin-only: Reset a user's E2E key (marks is_active=4).
   * User must regenerate keys on next login.
   * Returns 404 if no active key found.
   */
  @Delete(':userId')
  @UseGuards(RolesGuard, CustomThrottlerGuard)
  @Roles('admin', 'root')
  @AdminThrottle()
  async resetKeys(
    @Param('userId', ParseIntPipe) userId: number,
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
  ): Promise<{ message: string }> {
    await this.e2eKeysService.resetKeys(tenantId, userId, user.id);
    return { message: `E2E key reset for user ${userId}` };
  }
}

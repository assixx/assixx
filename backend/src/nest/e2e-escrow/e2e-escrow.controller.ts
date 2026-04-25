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
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import { AuthThrottle, UserThrottle } from '../common/decorators/throttle.decorators.js';
import { CustomThrottlerGuard } from '../common/guards/throttler.guard.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import {
  ConsumeEscrowUnlockTicketDto,
  CreateEscrowUnlockTicketDto,
  StoreEscrowDto,
} from './dto/index.js';
import { E2eEscrowService } from './e2e-escrow.service.js';
import type { E2eEscrowResponse } from './e2e-escrow.types.js';
import {
  EscrowUnlockTicketService,
  type UnlockTicketConsumeResult,
} from './escrow-unlock-ticket.service.js';

@Controller('e2e/escrow')
export class E2eEscrowController {
  constructor(
    private readonly escrowService: E2eEscrowService,
    private readonly unlockTicketService: EscrowUnlockTicketService,
  ) {}

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

  /**
   * Mint a single-use unlock ticket for cross-origin login handoff
   * (ADR-050 × ADR-022). Called from the apex-login use:enhance callback
   * AFTER the user has authenticated: the client derives the wrappingKey
   * client-side via Argon2id (the Worker already has hash-wasm), POSTs it
   * here, and appends the returned `ticketId` to the subdomain handoff URL.
   *
   * The subdomain's post-login layout then consumes via `POST consume-unlock`
   * on its own origin (authenticated, host-cross-checked) to get the
   * wrappingKey back without a second Argon2id round-trip or re-prompting
   * the user for their password.
   *
   * Rate-limited with AuthThrottle — this endpoint is hit at most once per
   * login, so 10 per 5 minutes is generous AND prevents a compromised
   * client from flooding Redis with 60s TTL entries.
   */
  @Post('unlock-ticket')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(CustomThrottlerGuard)
  @AuthThrottle()
  async createUnlockTicket(
    @Body() dto: CreateEscrowUnlockTicketDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
  ): Promise<{ ticketId: string }> {
    // Bootstrap variant: salt + params present together → user has no escrow
    // yet, the subdomain will create the first one (ADR-022 §"New-user
    // scenario"). DTO refine guarantees both are present or both absent.
    const bootstrap =
      dto.argon2Salt !== undefined && dto.argon2Params !== undefined ?
        { argon2Salt: dto.argon2Salt, argon2Params: dto.argon2Params }
      : undefined;
    const ticketId = await this.unlockTicketService.create(
      user.id,
      tenantId,
      dto.wrappingKey,
      bootstrap,
    );
    return { ticketId };
  }

  /**
   * Consume a single-use unlock ticket. Called from the subdomain (app)
   * layout AFTER the handoff token has been swapped for auth cookies.
   * Redis GETDEL is atomic; the ticket is bound to `{userId, tenantId}` at
   * creation time, so a ticket intercepted cross-user cannot be redeemed.
   *
   * Host cross-check: the `CurrentUser` is derived from the JWT, and the
   * subdomain middleware (ADR-050) already asserts `jwt.tenantId ===
   * hostTenantId` in `JwtAuthGuard`. By the time this handler runs, the
   * tuple is guaranteed consistent with the current request host → no
   * additional check needed here.
   *
   * Rate-limited with UserThrottle — consume is called exactly once per
   * handoff in the happy path; generous limits avoid spurious 429 on
   * retries after transient failures.
   */
  @Post('consume-unlock')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CustomThrottlerGuard)
  @UserThrottle()
  async consumeUnlockTicket(
    @Body() dto: ConsumeEscrowUnlockTicketDto,
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
  ): Promise<UnlockTicketConsumeResult> {
    // Returns `{ wrappingKey }` for unlock tickets, plus optional `bootstrap`
    // (salt + params) for bootstrap tickets. Subdomain branches on the
    // presence of `bootstrap` (ADR-022 §"New-user scenario").
    return await this.unlockTicketService.consume(dto.ticketId, user.id, tenantId);
  }
}

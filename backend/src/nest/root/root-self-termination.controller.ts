/**
 * Root Self-Termination Controller — Step 2.5 of FEAT_ROOT_ACCOUNT_PROTECTION.
 *
 * Wraps `RootSelfTerminationService` (Layer 3 — peer-approval lifecycle of
 * the 4-layer Defense-in-Depth model) in 6 REST endpoints. All endpoints
 * are gated by `@Roles('root')` at the class level (RolesGuard, ADR-010);
 * the service additionally re-asserts via `assertActorIsRoot()` for callers
 * that bypass the controller boundary.
 *
 * Endpoint surface (mounted under `/api/v2/users/...` per Phase 2 DoD):
 *   POST   /users/me/self-termination-request                  → create request
 *   GET    /users/me/self-termination-request                  → read own pending (or null)
 *   DELETE /users/me/self-termination-request                  → cancel own pending
 *   GET    /users/self-termination-requests/pending            → list peer pending
 *   POST   /users/self-termination-requests/:id/approve        → approve peer's request
 *   POST   /users/self-termination-requests/:id/reject         → reject peer's request
 *
 * Path-collision audit vs. existing `UsersController` (also `@Controller('users')`):
 * verified safe — none of the literal segments above are claimed by
 * UsersController. NestJS+Fastify radix routing prefers literal over
 * parametric, so `/users/self-termination-requests/...` does not clash
 * with `/users/:id/...` handlers either.
 *
 * Status codes (per Phase 4 §4 API-test expectations):
 *   - POST request    → 201 (NestJS default)
 *   - DELETE cancel   → 204 (`@HttpCode(NO_CONTENT)`)
 *   - POST approve    → 200 (`@HttpCode(OK)` — overrides POST default 201)
 *   - POST reject     → 200 (same)
 *
 * Param DTO note: masterplan §2.5 mandates the centralized `param.factory.ts`
 * but names `idField` (numeric). The Phase 1 schema declares
 * `root_self_termination_requests.id UUID PRIMARY KEY DEFAULT uuidv7()`,
 * so the correct factory export is `UuidIdParamDto` (UUID-typed pre-built
 * DTO). Documented as Spec-Deviation D5 in the masterplan changelog.
 *
 * Actor mapping: existing `RootController` consumes `@CurrentUser()` as
 * `JwtPayload`; the same pattern is used here. `JwtPayload` carries
 * `id`, `tenantId`, and `role` — exactly the `SelfTerminationActor` shape.
 * `toActor()` keeps the JWT-payload internals (sub/iat/exp/type) out of
 * the service layer.
 *
 * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §2.5
 * @see docs/infrastructure/adr/ADR-007-api-response-standardization.md
 * @see docs/infrastructure/adr/ADR-010-user-role-assignment-permissions.md
 * @see docs/infrastructure/adr/ADR-030-zod-validation-architecture.md
 * @see ADR-053 (planned, Phase 6)
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UuidIdParamDto } from '../common/dto/index.js';
import type { JwtPayload } from '../common/interfaces/auth.interface.js';
import {
  ApproveSelfTerminationDto,
  RejectSelfTerminationDto,
  RequestSelfTerminationDto,
} from './dto/index.js';
import type {
  RootSelfTerminationRequest,
  SelfTerminationActor,
} from './root-self-termination.service.js';
import { RootSelfTerminationService } from './root-self-termination.service.js';

@Controller('users')
@Roles('root')
export class RootSelfTerminationController {
  constructor(private readonly service: RootSelfTerminationService) {}

  /**
   * POST /users/me/self-termination-request
   *
   * Create a pending peer-approval request for the acting root. Service
   * enforces (in order): 24h rejection cooldown → no existing pending
   * row → last-root protection → INSERT + event + audit. Returns the
   * full domain row so the client can render the countdown card without
   * a follow-up GET.
   */
  @Post('me/self-termination-request')
  async createOwnRequest(
    @Body() dto: RequestSelfTerminationDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<RootSelfTerminationRequest> {
    return await this.service.requestSelfTermination(this.toActor(user), dto.reason ?? null);
  }

  /**
   * GET /users/me/self-termination-request
   *
   * Returns the actor's currently pending request, or `null` when none
   * exists. Used by `/root-profile` (Step 5.1) to render the countdown
   * card vs. the "Konto löschen" CTA.
   */
  @Get('me/self-termination-request')
  async getOwnPendingRequest(
    @CurrentUser() user: JwtPayload,
  ): Promise<RootSelfTerminationRequest | null> {
    return await this.service.getMyPendingRequest(this.toActor(user));
  }

  /**
   * DELETE /users/me/self-termination-request → 204
   *
   * Cancel the actor's own pending request. Idempotent in spirit: the
   * service throws 404 when no pending row exists, which the frontend
   * treats as success ("nothing to cancel") via UI state reload.
   */
  @Delete('me/self-termination-request')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelOwnRequest(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.service.cancelOwnRequest(this.toActor(user));
  }

  /**
   * GET /users/self-termination-requests/pending
   *
   * List all pending peer requests in the actor's tenant (excludes the
   * actor's own request — they cannot decide on it). RLS already scopes
   * to tenant; the service additionally filters expired rows so the UI
   * never shows stale items between cron sweeps.
   */
  @Get('self-termination-requests/pending')
  async listPendingForApproval(
    @CurrentUser() user: JwtPayload,
  ): Promise<RootSelfTerminationRequest[]> {
    return await this.service.getPendingRequestsForApproval(this.toActor(user));
  }

  /**
   * POST /users/self-termination-requests/:id/approve → 200
   *
   * Approve a peer's pending request and execute the soft-delete
   * atomically. The service performs the §2.4 TX ordering verbatim:
   * `FOR UPDATE` on request + every active root row → recount → flip
   * status='approved' → set the trigger-bypass GUC → UPDATE users
   * is_active=DELETED. Layer 4 trigger validates the approved row
   * exists in its 5-min window before allowing the user mutation.
   */
  @Post('self-termination-requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param() params: UuidIdParamDto,
    @Body() dto: ApproveSelfTerminationDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.service.approveSelfTermination(this.toActor(user), params.id, dto.comment);
  }

  /**
   * POST /users/self-termination-requests/:id/reject → 200
   *
   * Reject a peer's pending request. `rejectionReason` is required and
   * trimmed-non-empty (DTO is the first defense → 400; service re-asserts
   * → 409). No users-table touch; rejection metadata is recorded and
   * surfaced to the requester via notification (Step 2.7).
   */
  @Post('self-termination-requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param() params: UuidIdParamDto,
    @Body() dto: RejectSelfTerminationDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.service.rejectSelfTermination(this.toActor(user), params.id, dto.rejectionReason);
  }

  /**
   * Map the JWT payload to the service-facing actor shape. Keeps the
   * controller free of `as` casts and prevents the JWT-only fields
   * (sub/iat/exp/type) from leaking into the service layer's audit
   * paths.
   */
  private toActor(user: JwtPayload): SelfTerminationActor {
    return { id: user.id, tenantId: user.tenantId, role: user.role };
  }
}

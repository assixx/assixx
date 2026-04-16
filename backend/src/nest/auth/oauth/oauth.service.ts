/**
 * OAuth Service — provider-agnostic orchestration for the Microsoft sign-in flow.
 *
 * Ties together the dependency-free pieces built in earlier steps:
 *   - OAuthStateService (2.2)     -> single-use state + PKCE-verifier cache
 *   - MicrosoftProvider (2.3)     -> Azure AD v2.0 authorize/token/JWKS
 *   - OAuthAccountRepository (2.4) -> user_oauth_accounts CRUD
 *   - SignupService.registerTenantWithOAuth (2.7) -> tenant+user+link in ONE txn
 *
 * Three public methods map 1:1 to the three controller endpoints (Step 2.6):
 *   - `startAuthorization(mode)`   -> GET /authorize
 *   - `handleCallback(code,state)` -> GET /callback
 *   - `completeSignup(ticket,...)` -> POST /complete-signup
 *
 * Redis keyspace (prefix `oauth:` already set on the ioredis client):
 *   - `state:{uuid}`         10-min TTL, managed by OAuthStateService
 *   - `signup-ticket:{uuid}` 15-min TTL, managed here
 *
 * V1 is hard-wired to Microsoft (single provider injected). V2 will replace
 * the injected `provider` with a provider registry keyed by `OAuthProviderId`.
 *
 * @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md (Phase 2, Step 2.5)
 * @see ADR-046 (to be written in Phase 6)
 */
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import type { Redis } from 'ioredis';
import { v7 as uuidv7 } from 'uuid';

import { getErrorMessage } from '../../common/utils/error.utils.js';
import type { SignupResponseData } from '../../signup/dto/index.js';
import { SignupService } from '../../signup/signup.service.js';
import type { CompleteSignupDto } from './dto/index.js';
import { OAuthAccountRepository } from './oauth-account.repository.js';
import { OAuthStateService } from './oauth-state.service.js';
import { OAUTH_REDIS_CLIENT } from './oauth.tokens.js';
import type {
  CallbackResult,
  OAuthMode,
  OAuthProviderId,
  OAuthUserInfo,
  SignupTicket,
  SignupTicketPreview,
} from './oauth.types.js';
import { MicrosoftProvider } from './providers/microsoft.provider.js';

/** 15 min — plan §0.3. Long enough for the user to fill the signup form. */
const SIGNUP_TICKET_TTL_SECONDS = 15 * 60;

/** Sub-prefix appended to the ioredis `oauth:` keyPrefix -> `oauth:signup-ticket:{uuid}`. */
const SIGNUP_TICKET_KEY_PREFIX = 'signup-ticket:';

/** V1 is single-provider. Extracted so the magic string appears exactly once. */
const PROVIDER_ID: OAuthProviderId = 'microsoft';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    @Inject(OAUTH_REDIS_CLIENT) private readonly redis: Redis,
    private readonly stateService: OAuthStateService,
    private readonly provider: MicrosoftProvider,
    private readonly accountRepo: OAuthAccountRepository,
    private readonly signupService: SignupService,
  ) {}

  /**
   * Build the provider's authorize URL. The controller 302s the browser there.
   * PKCE pair is generated here so the verifier never leaves the backend
   * (only the challenge is sent to Microsoft).
   */
  async startAuthorization(mode: OAuthMode): Promise<{ url: string }> {
    const { codeVerifier, codeChallenge } = OAuthService.generatePkce();
    const state = await this.stateService.create(mode, codeVerifier);
    const url = this.provider.buildAuthorizationUrl({ state, codeChallenge, mode });
    return { url };
  }

  /**
   * Handle the provider redirect: consume state, exchange code, verify id_token,
   * then branch on the stored `mode`. State consumption is atomic GETDEL
   * (R2: replay defence) — reused states throw `UnauthorizedException`.
   */
  async handleCallback(code: string, state: string): Promise<CallbackResult> {
    const stored = await this.stateService.consume(state);
    const tokens = await this.provider.exchangeCodeForTokens(code, stored.codeVerifier);
    const info = await this.provider.verifyIdToken(tokens.idToken);

    if (stored.mode === 'login') {
      return await this.resolveLogin(info);
    }
    return await this.resolveSignupContinue(info);
  }

  /**
   * Peek at a signup ticket WITHOUT consuming it — used by the SSR load of
   * `/signup/oauth-complete` to pre-fill the form with the OAuth-provided
   * email + display name (Plan §5.4).
   *
   * Idempotent: the ticket stays in Redis and is only cleared by
   * `completeSignup()` (atomic GETDEL). Multiple peeks are safe so the SvelteKit
   * load can refetch on client-side navigation without burning the ticket.
   *
   * Returns `null` when the ticket is missing or expired; callers translate
   * that to HTTP 404. Tampered / wrong-shape Redis payloads surface via
   * `UnauthorizedException` (reuses the same type-guard as `consumeSignupTicket`).
   *
   * Security note: only `email` + `displayName` are returned. `providerUserId`
   * and `microsoftTenantId` are forensic identifiers and stay server-side so a
   * leaked ticket ID can only reveal what the user already saw at the Microsoft
   * consent screen.
   */
  async peekSignupTicket(ticketId: string): Promise<SignupTicketPreview | null> {
    const raw = await this.redis.get(`${SIGNUP_TICKET_KEY_PREFIX}${ticketId}`);
    if (raw === null) return null;
    const ticket = OAuthService.parseSignupTicketOrThrow(raw);
    return {
      email: ticket.email,
      displayName: ticket.displayName,
    };
  }

  /**
   * Finalise an OAuth signup: consume the ticket (single-use) and hand off to
   * SignupService, which creates tenant+user+oauth-link inside ONE transaction
   * (R8 atomicity). Controller sets JWT cookies on the returned userId/tenantId.
   */
  async completeSignup(
    ticketId: string,
    details: CompleteSignupDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SignupResponseData> {
    const oauthInfo = await this.consumeSignupTicket(ticketId);
    return await this.signupService.registerTenantWithOAuth(
      details,
      oauthInfo,
      ipAddress,
      userAgent,
    );
  }

  // === private: login path =================================================

  private async resolveLogin(info: OAuthUserInfo): Promise<CallbackResult> {
    const row = await this.accountRepo.findLinkedByProviderSub(PROVIDER_ID, info.providerUserId);
    if (row === null) {
      // Controller translates to 302 -> /login?oauth=not-linked (see callback-result union).
      return { mode: 'login-not-linked', email: info.email };
    }
    // Last-login bump is bookkeeping, not a security gate — fire-and-forget.
    this.bumpLastLoginSilently(row.tenant_id, row.user_id);
    return { mode: 'login-success', userId: row.user_id, tenantId: row.tenant_id };
  }

  private bumpLastLoginSilently(tenantId: number, userId: number): void {
    void this.accountRepo.updateLastLogin(tenantId, userId, PROVIDER_ID).catch((error: unknown) => {
      this.logger.warn(`last_login_at bump failed: ${getErrorMessage(error)}`);
    });
  }

  // === private: signup path ================================================

  /**
   * Signup branch: R3 early-check (same Microsoft account twice → 409), then
   * stash the resolved identity in Redis under a single-use ticket. The
   * company-details form (Phase 5) reads the ticket ID from the redirect query
   * and submits it to `completeSignup` along with the form payload.
   */
  private async resolveSignupContinue(info: OAuthUserInfo): Promise<CallbackResult> {
    const existing = await this.accountRepo.findLinkedByProviderSub(
      PROVIDER_ID,
      info.providerUserId,
    );
    if (existing !== null) {
      throw new ConflictException(
        'Dieses Microsoft-Konto ist bereits mit einem Assixx-Tenant verknüpft.',
      );
    }
    const ticketId = uuidv7();
    const payload: SignupTicket = {
      provider: PROVIDER_ID,
      providerUserId: info.providerUserId,
      email: info.email,
      emailVerified: info.emailVerified,
      displayName: info.displayName,
      microsoftTenantId: info.microsoftTenantId,
      createdAt: Date.now(),
    };
    await this.redis.set(
      `${SIGNUP_TICKET_KEY_PREFIX}${ticketId}`,
      JSON.stringify(payload),
      'EX',
      SIGNUP_TICKET_TTL_SECONDS,
    );
    return { mode: 'signup-continue', ticket: ticketId };
  }

  private async consumeSignupTicket(ticketId: string): Promise<SignupTicket> {
    const raw = await this.redis.getdel(`${SIGNUP_TICKET_KEY_PREFIX}${ticketId}`);
    if (raw === null) {
      throw new UnauthorizedException('Signup ticket is invalid or expired');
    }
    return OAuthService.parseSignupTicketOrThrow(raw);
  }

  // === private static: pure helpers (no `this`, trivially unit-testable) ===

  /**
   * RFC 7636 PKCE pair.
   *   verifier = base64url(32 random bytes) → 43-char, ≥256-bit entropy
   *   challenge = base64url(SHA256(verifier))
   * Verifier stays server-side (Redis via OAuthStateService); challenge goes
   * to Microsoft in the authorize URL.
   */
  private static generatePkce(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    return { codeVerifier, codeChallenge };
  }

  private static parseSignupTicketOrThrow(raw: string): SignupTicket {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new UnauthorizedException('Malformed signup ticket payload');
    }
    if (!OAuthService.isSignupTicket(parsed)) {
      throw new UnauthorizedException('Malformed signup ticket payload');
    }
    return parsed;
  }

  /** Type guard — validates the Redis-stored JSON shape before trusting it. */
  private static isSignupTicket(value: unknown): value is SignupTicket {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string, unknown>;
    return (
      v['provider'] === 'microsoft' &&
      typeof v['providerUserId'] === 'string' &&
      typeof v['email'] === 'string' &&
      typeof v['emailVerified'] === 'boolean' &&
      (typeof v['displayName'] === 'string' || v['displayName'] === null) &&
      (typeof v['microsoftTenantId'] === 'string' || v['microsoftTenantId'] === null) &&
      typeof v['createdAt'] === 'number'
    );
  }
}

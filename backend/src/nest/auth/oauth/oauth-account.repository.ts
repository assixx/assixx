/**
 * OAuth Account Repository — DB access layer for `user_oauth_accounts`.
 *
 * Isolated from HTTP concerns so `OAuthService` (orchestration, Step 2.5) stays
 * thin. Mirrors the `UserRepository` pattern: explicit methods, snake_case row
 * shape that matches DB columns 1:1, DatabaseService-routed reads/writes,
 * `is_active` filter baked into every hot-path read.
 *
 * Pool / context selection — decided per ADR-019 decision tree:
 *   - `findLinkedByProviderSub` -> systemQuery     (pre-auth; tenant is unknown
 *                                                   until the (provider, sub)
 *                                                   match gives it to us)
 *   - `createLink`              -> client.query()  (inside the signup transaction;
 *                                                   parent already set
 *                                                   app.tenant_id via
 *                                                   setTenantContext())
 *   - `updateLastLogin`         -> queryAsTenant   (post-match, pre-JWT — CLS
 *                                                   has no tenantId yet, so
 *                                                   explicit tenantId param)
 *
 * Token storage policy (V1): IDENTITY claims only (sub, email, display_name,
 * microsoft_tid). Access/refresh tokens from Microsoft are NEVER persisted —
 * V1 has no Graph integration. Re-introducing token storage requires a
 * dedicated data-protection ADR.
 *
 * @see docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md (Phase 2, Step 2.4)
 * @see ADR-019 (Multi-Tenant RLS Isolation) — pool-selection rationale
 * @see ADR-046 (to be written in Phase 6)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import type { IsActiveStatus } from '@assixx/shared/types';
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../../database/database.service.js';
import type { OAuthProviderId, OAuthUserInfo } from './oauth.types.js';

/**
 * Raw row shape for `user_oauth_accounts`. snake_case mirrors the DB exactly —
 * same convention as `UserBase`. Keeping a 1:1 interface avoids double-renames
 * every time a column is added and makes grep-by-column trivial.
 */
export interface OAuthAccountRow {
  id: string;
  tenant_id: number;
  user_id: number;
  provider: OAuthProviderId;
  provider_user_id: string;
  email: string;
  email_verified: boolean;
  display_name: string | null;
  microsoft_tenant_id: string | null;
  linked_at: Date;
  last_login_at: Date | null;
  is_active: IsActiveStatus;
  created_at: Date;
  updated_at: Date;
}

/**
 * Shared column list — change here, every SELECT picks it up. Whitespace is
 * intentional: the template expands inline inside SQL strings below.
 */
const OAUTH_ACCOUNT_COLUMNS = `
  id, tenant_id, user_id, provider, provider_user_id,
  email, email_verified, display_name, microsoft_tenant_id,
  linked_at, last_login_at, is_active, created_at, updated_at
`;

@Injectable()
export class OAuthAccountRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Find an active OAuth link by (provider, provider_user_id).
   *
   * Runs on the system pool (BYPASSRLS) because at login-time we do not yet
   * know which Assixx tenant this provider account belongs to — that is
   * precisely what we are looking up. Once the caller has the row, subsequent
   * queries switch to tenant-scoped methods (see `updateLastLogin`).
   *
   * The UNIQUE constraint `(provider, provider_user_id)` guarantees at most
   * one row, so `systemQueryOne` returning null means "not linked yet" — the
   * controller translates that to the `login-not-linked` CallbackResult
   * (OAuthService Step 2.5).
   */
  async findLinkedByProviderSub(
    provider: OAuthProviderId,
    providerUserId: string,
  ): Promise<OAuthAccountRow | null> {
    return await this.db.systemQueryOne<OAuthAccountRow>(
      `SELECT ${OAUTH_ACCOUNT_COLUMNS}
         FROM user_oauth_accounts
        WHERE provider = $1::oauth_provider
          AND provider_user_id = $2
          AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [provider, providerUserId],
    );
  }

  /**
   * Insert a new OAuth link inside the caller's transaction.
   *
   * Runs on the passed-in `PoolClient` directly — no DatabaseService wrapper —
   * because the parent transaction (SignupService.registerTenantWithOAuth,
   * Step 2.7) has already set `app.tenant_id` for this client via
   * `setTenantContext()`. Per ADR-019 decision tree: "inside a transaction
   * callback -> client.query() directly."
   *
   * Atomicity with the surrounding tenant+user creation is what mitigates R8
   * (signup race): the UNIQUE constraint on `(provider, provider_user_id)`
   * serialises concurrent inserts — one commits, the other rolls back as part
   * of the outer transaction with no half-created tenant left behind.
   *
   * `id`, `linked_at`, `is_active`, `created_at`, `updated_at` all use DB
   * defaults (uuidv7(), NOW(), 1). `last_login_at` stays NULL here — first
   * login populates it via `updateLastLogin()`.
   */
  async createLink(
    client: PoolClient,
    tenantId: number,
    userId: number,
    provider: OAuthProviderId,
    info: OAuthUserInfo,
  ): Promise<void> {
    await client.query(
      `INSERT INTO user_oauth_accounts (
         tenant_id, user_id, provider, provider_user_id,
         email, email_verified, display_name, microsoft_tenant_id
       ) VALUES ($1, $2, $3::oauth_provider, $4, $5, $6, $7, $8)`,
      [
        tenantId,
        userId,
        provider,
        info.providerUserId,
        info.email,
        info.emailVerified,
        info.displayName,
        info.microsoftTenantId,
      ],
    );
  }

  /**
   * Bump `last_login_at` for an existing active link.
   *
   * Called right after a successful OAuth login, BEFORE the JWT is issued —
   * CLS therefore has no `tenantId` yet. `queryAsTenant` takes an explicit
   * tenantId and sets RLS context for this single statement (ADR-019).
   *
   * Silent best-effort: zero rows affected (inactive link, concurrent unlink)
   * is not an error. The preceding `findLinkedByProviderSub` already answered
   * the happy-path question; this method is bookkeeping for the "last seen"
   * column — not a security gate.
   */
  async updateLastLogin(
    tenantId: number,
    userId: number,
    provider: OAuthProviderId,
  ): Promise<void> {
    await this.db.queryAsTenant(
      `UPDATE user_oauth_accounts
          SET last_login_at = NOW(),
              updated_at = NOW()
        WHERE user_id = $1
          AND provider = $2::oauth_provider
          AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [userId, provider],
      tenantId,
    );
  }
}

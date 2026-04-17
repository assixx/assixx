/**
 * Profile-photo sync orchestrator — bridges Microsoft Graph to the local avatar.
 *
 * Called from `OAuthService.resolveLogin` (re-login) and
 * `SignupService.registerTenantWithOAuth` (initial signup) AFTER the user has
 * been identified. Reads the signed-in user's photo via Graph, compares the
 * `@odata.mediaEtag` against `user_oauth_accounts.photo_etag`, and on change
 * downloads the binary and writes it to `uploads/profile_pictures/` with a
 * new content-addressed filename — the existing avatar pipeline
 * (`SidebarUserCard` + `getProfilePictureUrl`) then renders it transparently.
 *
 * ## Invariants
 *
 * 1. **Best-effort** — this service NEVER throws. A Graph failure, filesystem
 *    error, or DB conflict logs a warning and returns. Login / signup must
 *    complete even if the photo path degrades.
 * 2. **Manual uploads win** — if `users.profile_picture` holds a path that
 *    does NOT start with the `oauth_` prefix, the sync is a no-op. The user
 *    set their own picture; OAuth must not overwrite it.
 * 3. **Token stays in-memory** — the Graph `access_token` arrives as a
 *    parameter and leaves with the stack. Nothing is persisted (ADR-046 §A4
 *    invariant; §A4 reversal is limited to calling Graph, not storing tokens).
 * 4. **Filename changes on update** — the stored path embeds `<uuid>_<etag8>`,
 *    so every photo change produces a new URL. The browser cache flushes
 *    naturally with no explicit cache-bust.
 *
 * ## Order of DB vs filesystem operations — deviation from masterplan
 *
 * Spec deviation D4 (from FEAT_OAUTH_PROFILE_PHOTO_MASTERPLAN.md pseudocode):
 *
 *   Plan pseudocode: `write tmp → DB update → rename tmp→final`.
 *   This file:       `write tmp → rename tmp→final → DB update`.
 *
 * Rationale: if the process crashes between DB update and rename (plan order),
 * `users.profile_picture` points at a path that does not yet exist — the
 * avatar 404s and the sync never self-heals because the next run sees a
 * matching ETag and skips. Writing the file FIRST means the DB reference is
 * always valid when set. A crash between rename and DB leaves an orphan file
 * (disk waste, no user impact); on the next run we re-download and overwrite
 * via a new content-addressed filename.
 *
 * @see docs/FEAT_OAUTH_PROFILE_PHOTO_MASTERPLAN.md (Phase 2, Step 2.3)
 * @see docs/infrastructure/adr/ADR-046-oauth-sign-in.md (Amendment §A4 — Phase 6)
 * @see https://learn.microsoft.com/en-us/graph/api/profilephoto-get?view=graph-rest-1.0
 */
import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import type { PoolClient } from 'pg';

import { getErrorMessage } from '../../common/utils/error.utils.js';
import { DatabaseService } from '../../database/database.service.js';
import { OAuthAccountRepository } from './oauth-account.repository.js';
import type { OAuthProviderId, PhotoMetadata } from './oauth.types.js';
import { MicrosoftProvider } from './providers/microsoft.provider.js';

/**
 * Root directory for profile-picture uploads (relative to process.cwd()).
 * Matches the convention used by manual uploads — the frontend
 * `getProfilePictureUrl` helper resolves both absolute and relative forms.
 */
const UPLOAD_DIR = 'uploads/profile_pictures';

/**
 * Filename prefix reserved for OAuth-sourced photos. Manually uploaded files
 * use a different naming convention and are protected from overwrite by
 * `isManuallyUploaded()`.
 */
const OAUTH_FILENAME_PREFIX = 'oauth_';

/** Static provider id for V1 — V2 will discriminate the caller's provider. */
const PROVIDER: OAuthProviderId = 'microsoft';

@Injectable()
export class ProfilePhotoService {
  private readonly logger = new Logger(ProfilePhotoService.name);

  constructor(
    private readonly provider: MicrosoftProvider,
    private readonly oauthRepo: OAuthAccountRepository,
    private readonly db: DatabaseService,
  ) {}

  /**
   * Orchestrates the full ETag-cached photo sync for one user.
   *
   * Top-level try/catch swallows every failure and logs a warning — the caller
   * (`OAuthService.resolveLogin`, `SignupService.registerTenantWithOAuth`)
   * continues the login / signup flow regardless. Masterplan R1.
   */
  async syncIfChanged(userId: number, tenantId: number, accessToken: string): Promise<void> {
    try {
      const current = await this.readProfilePicture(userId, tenantId);
      if (this.isManuallyUploaded(current)) {
        this.logger.debug(`user ${userId}: manual avatar present, skipping OAuth photo sync`);
        return;
      }

      const meta = await this.provider.fetchPhotoMetadata(accessToken);
      if (meta === null) {
        await this.clearOauthPhoto(userId, tenantId, current);
        return;
      }

      const storedEtag = await this.oauthRepo.getPhotoEtag(tenantId, userId, PROVIDER);
      if (storedEtag === meta.etag) {
        this.logger.debug(`user ${userId}: photo ETag unchanged, skip binary download`);
        return;
      }

      const bytes = await this.provider.fetchPhotoBinary(accessToken);
      if (bytes === null) {
        // Metadata said a photo exists but binary fetch failed — keep the old
        // cached copy (if any), do not clear. Try again next login.
        return;
      }

      await this.replacePhotoFile(userId, tenantId, current, bytes, meta);
    } catch (error: unknown) {
      this.logger.warn(`profile photo sync failed: ${getErrorMessage(error)}`);
    }
  }

  // === private helpers =====================================================

  /** True when the stored path is either missing or was placed there by this service. */
  private isManuallyUploaded(current: string | null): boolean {
    if (current === null || current === '') return false;
    // Normalize leading slash for comparison — DB stores relative paths but
    // older rows may be absolute (`/uploads/...`).
    const rel = current.startsWith('/') ? current.slice(1) : current;
    const expectedPrefix = `${UPLOAD_DIR}/${OAUTH_FILENAME_PREFIX}`;
    return !rel.startsWith(expectedPrefix);
  }

  /** Read `users.profile_picture` for the given user + tenant. */
  private async readProfilePicture(userId: number, tenantId: number): Promise<string | null> {
    const rows = await this.db.queryAsTenant<{ profile_picture: string | null }>(
      `SELECT profile_picture FROM users WHERE id = $1 LIMIT 1`,
      [userId],
      tenantId,
    );
    return rows[0]?.profile_picture ?? null;
  }

  /** Read `users.uuid`. Tenant-scoped query — RLS filters cross-tenant access. */
  private async readUserUuid(userId: number, tenantId: number): Promise<string | null> {
    const rows = await this.db.queryAsTenant<{ uuid: string }>(
      `SELECT uuid FROM users WHERE id = $1 LIMIT 1`,
      [userId],
      tenantId,
    );
    return rows[0]?.uuid ?? null;
  }

  /**
   * Graph reports "no photo" (404 or 1x1 placeholder): drop any cached OAuth
   * copy from both DB and disk. Manual uploads already passed the early-return
   * guard in `syncIfChanged`, so `current` here is either null or an
   * `oauth_*` file that we own.
   */
  private async clearOauthPhoto(
    userId: number,
    tenantId: number,
    current: string | null,
  ): Promise<void> {
    if (current === null) return;
    // Explicit tenantId → `transaction({ tenantId })` sets `app.tenant_id` for the
    // client. We cannot use `tenantTransaction` here: OAuth callbacks run pre-JWT
    // so CLS has no `tenantId` yet (ADR-019 decision tree).
    await this.db.transaction(
      async (client: PoolClient) => {
        await client.query('UPDATE users SET profile_picture = NULL WHERE id = $1', [userId]);
        await this.oauthRepo.updatePhotoEtag(client, userId, PROVIDER, null);
      },
      { tenantId },
    );
    await this.safeUnlink(current);
  }

  /**
   * Download committed: write file, activate via rename, then update DB.
   *
   * Order matters — see header note "Order of DB vs filesystem operations".
   * On DB failure the newly-renamed file is unlinked to avoid orphans.
   */
  private async replacePhotoFile(
    userId: number,
    tenantId: number,
    current: string | null,
    bytes: Buffer,
    meta: PhotoMetadata,
  ): Promise<void> {
    const uuid = await this.readUserUuid(userId, tenantId);
    if (uuid === null) {
      this.logger.warn(`user ${userId}: no uuid row — skipping photo sync`);
      return;
    }

    // `meta.etag` is already filtered to non-empty by `projectPhotoMetadata`, but
    // `normalizeEtag` could in theory produce an empty string for pathological
    // inputs like `W/""` — fall back to a literal marker rather than an empty
    // filename segment.
    const etagHead = meta.etag.slice(0, 8);
    const etagShort = etagHead !== '' ? etagHead : 'etagless';
    const newPath = `${UPLOAD_DIR}/${OAUTH_FILENAME_PREFIX}${uuid}_${etagShort}.jpg`;
    const tmpPath = `${newPath}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`;

    await fs.mkdir(dirname(join(process.cwd(), newPath)), { recursive: true });
    await fs.writeFile(join(process.cwd(), tmpPath), bytes);
    await fs.rename(join(process.cwd(), tmpPath), join(process.cwd(), newPath));

    try {
      // Explicit tenantId — see note in `clearOauthPhoto` above (pre-JWT, no CLS).
      await this.db.transaction(
        async (client: PoolClient) => {
          await client.query('UPDATE users SET profile_picture = $1 WHERE id = $2', [
            newPath,
            userId,
          ]);
          await this.oauthRepo.updatePhotoEtag(client, userId, PROVIDER, meta.etag);
        },
        { tenantId },
      );
    } catch (error: unknown) {
      // DB rejected — unlink the just-activated file so the next run retries
      // without stacking orphans. If unlink also fails, log and accept disk waste.
      await this.safeUnlink(newPath);
      throw error;
    }

    // Happy path: old OAuth file (if any, and different from newPath) is stale.
    if (current !== null && current !== newPath) {
      await this.safeUnlink(current);
    }
  }

  /** Best-effort file removal — missing / permission errors degrade to a debug log. */
  private async safeUnlink(relativePath: string): Promise<void> {
    try {
      const absolute =
        relativePath.startsWith('/') ?
          join(process.cwd(), relativePath.slice(1))
        : join(process.cwd(), relativePath);
      await fs.unlink(absolute);
    } catch (error: unknown) {
      this.logger.debug(`unlink failed for ${relativePath}: ${getErrorMessage(error)}`);
    }
  }
}

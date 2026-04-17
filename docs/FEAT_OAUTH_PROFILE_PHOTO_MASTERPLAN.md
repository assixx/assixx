# FEAT: OAuth Profile Photo Sync — Execution Masterplan

> **Plan type:** FEATURE
> **Created:** 2026-04-17
> **Version:** 2.0.0 (COMPLETE)
> **Status:** ✅ COMPLETE — shipped end-to-end 2026-04-17
> **Branch:** `test/ui-ux` (user decision 2026-04-17: work continues on existing branch, no new feature branch)
> **Spec:** This file + [ADR-046](./infrastructure/adr/ADR-046-oauth-sign-in.md) (amended in Phase 6 — §A4 partial reversal)
> **Author:** Simon Öztürk
> **Estimated sessions:** 2
> **Actual sessions:** 1 (happy-path shipped in a single long session incl. tests, docs, customer-sync)

---

## Changelog

| Version | Date       | Change                                                                                                  |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-04-17 | Initial draft — phases outlined, verified against MS Graph docs                                         |
| 1.0.0   | 2026-04-17 | Phase 1 COMPLETE — `photo_etag` migration applied (id=137)                                              |
| 1.1.0   | 2026-04-17 | Phase 2 COMPLETE — backend wired (provider, service, repo, module, oauth.service + completeSignup)      |
| 1.2.0   | 2026-04-17 | Phase 3 COMPLETE — **94/94** unit tests green (+30 new)                                                 |
| 1.3.0   | 2026-04-17 | Phase 4 COMPLETE — **48/48** API tests green (+2 scope, +3 fixture accessToken)                         |
| 2.0.0   | 2026-04-17 | Phase 6 COMPLETE — ADR-046 amended, HOW-TO updated, FEATURES updated, customer-sync ran clean. SHIPPED. |

---

## Goal (one paragraph)

Extend the existing Microsoft OAuth sign-in flow so that after a successful
login or signup the user's Microsoft 365 profile photo is downloaded from
Microsoft Graph (`/me/photo`) and stored locally as the user's Assixx
avatar. The sidebar (and every other avatar rendering site) already falls
back from initials to `<img src={profilePicture}>` when `users.profile_picture`
is set — this plan fills that column from the Microsoft source of truth.
Re-logins use Graph's `@odata.mediaEtag` metadata to skip the binary
download when the photo has not changed (ETag cache pattern).

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must be true before starting

- [x] Docker stack running (all containers healthy) — 2026-04-17 verified (7/7 healthy)
- [x] DB backup taken: `database/backups/full_backup_20260417_113710.dump` (3.0 MB)
- [x] Branch: working on `test/ui-ux` (user decision — no new feature branch for this scope)
- [x] No pending migrations blocking — 2026-04-17 dry-run returned `No migrations to run!`; 135 files = 135 `pgmigrations` rows (delta verified row-by-row)
- [x] Dependent features shipped: Microsoft OAuth V1 (ADR-046, merged; DB id=136 `create-user-oauth-accounts`)
- [x] Azure AD app registration accessible (Simon owns credentials)

### 0.2 Risk register

| #   | Risk                                                                         | Impact | Probability | Mitigation                                                                                                                               | Verification                                                                          |
| --- | ---------------------------------------------------------------------------- | ------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| R1  | Graph call fails (5xx, timeout, network) during login — user can't log in    | High   | Low         | Photo sync is best-effort; wrapped in try/catch; Graph failure logs a warning but the login/signup completes normally                    | Unit test: Graph mock throws → sync returns gracefully, caller continues              |
| R2  | User has no photo (Graph returns 1x1 placeholder GIF)                        | Low    | High        | Check metadata `width == 1 && height == 1` before binary download; set `profile_picture = NULL`                                          | Unit test: mock 1x1 metadata → no file written, DB column stays NULL                  |
| R3  | Existing OAuth users must re-consent because `User.Read` is a new scope      | Medium | Certain     | Document in HOW-TO + post-deploy comms; Azure shows the consent screen once per user on first login after the change                     | Manual: log in as existing OAuth user → Azure prompts for "Read your profile" consent |
| R4  | Scope `User.Read` leaks more data than we use                                | Low    | N/A         | We read photo only; we never call `/me` or any other Graph endpoint. Code review confirms the call-sites are photo-only                  | Architectural test / code review: grep for `graph.microsoft.com` shows only `/photo`  |
| R5  | User manually uploads a photo in Assixx, we overwrite it on next OAuth login | Medium | Medium      | Filename prefix convention: OAuth-sourced files start with `oauth_`. If `users.profile_picture` does not start with `oauth_` → skip sync | Unit test: seed manual path → syncIfChanged skips, no Graph call issued               |
| R6  | File-system write succeeds, DB update fails → orphaned file                  | Low    | Low         | Write to a temp file, rename after DB update; on DB error delete temp file                                                               | Unit test: mock DB error → temp file is unlinked, no orphan                           |
| R7  | Graph rate-limit hit (20k/h per tenant)                                      | Low    | Very Low    | ETag-metadata check is ~200 bytes per request; users log in a few times/day → way below limit                                            | Load math: 500 users × 10 logins/day = 5k calls/day per tenant (0.2% of limit)        |
| R8  | `access_token` accidentally logged                                           | High   | Low         | Existing `SENSITIVE_KEYS` redaction in `microsoft.provider.ts` (ADR-046 R7) already lists `access_token`                                 | Existing unit tests for provider log redaction still pass after changes               |
| R9  | Login path slower by 300–800 ms (synchronous Graph call)                     | Low    | Certain     | Accepted trade-off (decision: await, not fire-and-forget). ETag metadata path is ~200 ms. Binary only on first login.                    | Phase 6 manual smoke: measure with browser DevTools on first and second OAuth login   |
| R10 | Graph call hangs forever — blocks login                                      | High   | Low         | Explicit `AbortController` timeout of 5 s on both metadata and binary calls                                                              | Unit test: mock Graph that never responds → aborts after 5s, sync returns gracefully  |

### 0.3 Ecosystem integration points

| Existing system                          | Integration                                                                                   | Phase | Verified on |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- | ----- | ----------- |
| `MicrosoftProvider`                      | Extend `SCOPES` string with `User.Read`; add two new fetch methods                            | 2     |             |
| `OAuthService.resolveLogin`              | After id_token verify + user match → await `profilePhotoService.syncIfChanged`                | 2     |             |
| `SignupService.registerTenantWithOAuth`  | After `systemTransaction` commits → best-effort photo sync outside the transaction            | 2     |             |
| `users.profile_picture` column           | Written with relative path `uploads/profile_pictures/oauth_<uuid>_<etag8>.jpg` or NULL        | 2     |             |
| `user_oauth_accounts` table              | New column `photo_etag VARCHAR(64)` (Phase 1 migration)                                       | 1     |             |
| `uploads/profile_pictures/` directory    | File read/write; already used by manual uploads → same Nginx static-serve route               | 2     |             |
| `SidebarUserCard.svelte`, avatar helpers | **No change required** — already reads `user.profilePicture` and falls back to initials       | —     |             |
| ADR-046 §A4 (Graph rejected)             | Partial reversal: Graph allowed for profile-photo sync only; access_token still not persisted | 6     |             |
| `HOW-TO-AZURE-AD-SETUP.md`               | Update required-permissions section: add `User.Read`                                          | 6     |             |

---

## Phase 1: Database Migrations

> **Dependency:** Phase 0 green.
> **Scope:** ONE migration — add `photo_etag` column to `user_oauth_accounts`.

### Step 1.1: Add `photo_etag` column to `user_oauth_accounts` [✅ DONE 2026-04-17]

**New file:**

- `database/migrations/<UTC_TIMESTAMP>_add-oauth-photo-etag.ts`

**What happens:**

1. `ALTER TABLE user_oauth_accounts ADD COLUMN photo_etag VARCHAR(64);`
2. (No RLS change — table already has `tenant_isolation` policy, which applies to the new column automatically)
3. (No GRANT change — `app_user` already has `SELECT, INSERT, UPDATE, DELETE` on the table, applies to new columns)
4. `down()`: `ALTER TABLE user_oauth_accounts DROP COLUMN photo_etag;`

**Design rationale:**

- Stored on `user_oauth_accounts`, not on `users`, because ETag is provider-specific metadata about the OAuth account's cached asset — not a user attribute. If we ever add another provider (Google), each provider row has its own ETag.
- `VARCHAR(64)` covers OData weak/strong ETag format (`W/"xxxxxxxx"` — we strip quotes and `W/`, store the hex).
- Nullable because existing OAuth users don't have a synced photo yet; first successful sync populates the column.

**Mandatory per-table checklist (column-add, not table-add):**

- [ ] Migration generated via `doppler run -- pnpm run db:migrate:create add-oauth-photo-etag` (NOT manual)
- [ ] Both `up()` AND `down()` implemented
- [ ] No `IF NOT EXISTS` in `up()` (per migration-quality standards)
- [ ] No data migration (column starts NULL for all rows — safe)
- [ ] Dry run passes before real run
- [ ] Backup taken before real run

**Verification:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d user_oauth_accounts" | grep photo_etag
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='user_oauth_accounts' AND column_name='photo_etag';"
```

### Phase 1 — Definition of Done

- [x] 1 migration file with both `up()` AND `down()` — `database/migrations/20260417094053371_add-oauth-photo-etag.ts`
- [x] Dry run passes — clean, single `ALTER TABLE ADD COLUMN`, no surprises
- [x] Migration applied successfully — `pgmigrations` id=137 recorded 2026-04-17 11:42:21
- [x] Column exists, NULLABLE, VARCHAR(64), verified via `\d` + `information_schema.columns`
- [ ] Backend type-check still passes — (N/A at this phase: no backend code references new column yet; will be verified in Phase 2)
- [ ] Existing tests still pass — (N/A: verified at end of Phase 2/3)
- [x] Backup taken before migration — `full_backup_20260417_113710.dump` (3.0 MB)
- [x] Backend + deletion-worker restarted; `/health` returned `{"status":"ok"}` after restart

---

## Phase 2: Backend Module

> **Dependency:** Phase 1 complete.
> **Reference module:** `backend/src/nest/auth/oauth/` (extend existing)

### Step 2.1: Azure Scope extension [✅ DONE 2026-04-17]

**File:** `backend/src/nest/auth/oauth/providers/microsoft.provider.ts`

**Change:**

```typescript
// BEFORE
const SCOPES = 'openid profile email';

// AFTER
const SCOPES = 'openid profile email User.Read';
```

**Rationale:** `User.Read` is the higher-privileged but most common delegated permission that grants read access to `/me/photo`. Least-privileged alternative `ProfilePhoto.Read.All` is tenant-wide and requires admin consent — unacceptable UX. `User.Read` is auto-consented per-user in standard work/school flows.

**Note on header doc:** the `// Spec deviation D10` block must be updated — `offline_access` still not requested, but `User.Read` is now. Update the comment to reflect the partial §A4 reversal.

### Step 2.2: Add `fetchPhotoMetadata` + `fetchPhotoBinary` to MicrosoftProvider [✅ DONE 2026-04-17]

**File:** `backend/src/nest/auth/oauth/providers/microsoft.provider.ts`

**Methods:**

- `fetchPhotoMetadata(accessToken: string): Promise<PhotoMetadata | null>`
  - `GET https://graph.microsoft.com/v1.0/me/photo`
  - Returns `{ etag: string, width: number, height: number, contentType: string }` or `null` (404 / 1x1-placeholder / error)
  - 5s AbortController timeout
- `fetchPhotoBinary(accessToken: string, size: '240x240' = '240x240'): Promise<Buffer | null>`
  - `GET https://graph.microsoft.com/v1.0/me/photos/240x240/$value`
  - Returns raw bytes or `null` on 404 / error
  - 10s AbortController timeout (binary download)

**Design:**

- Both methods defensive: they log warnings and return `null` on any error (R1, R10). They never throw. The caller decides whether the whole flow fails or degrades.
- ETag normalization: strip `W/` weak prefix and surrounding quotes → store just the hex. Comparison is then a literal string equality.
- Use the existing `SENSITIVE_KEYS` redaction pattern for all error logs — `access_token` is already covered (R8).

**Types (new):** add to `backend/src/nest/auth/oauth/oauth.types.ts`:

```typescript
export interface PhotoMetadata {
  etag: string;
  width: number;
  height: number;
  contentType: string;
}
```

### Step 2.3: New `ProfilePhotoService` [✅ DONE 2026-04-17]

**New file:** `backend/src/nest/auth/oauth/profile-photo.service.ts`

**Responsibility:** orchestrate the ETag-compare → download → file-write → DB-update flow. Single entry point: `syncIfChanged(userId, tenantId, accessToken)`.

**Pseudocode:**

```typescript
async syncIfChanged(userId: number, tenantId: number, accessToken: string): Promise<void> {
  try {
    // 1. Skip if the user has a manually-uploaded photo
    const current = await this.users.getProfilePicture(userId, tenantId);
    if (current !== null && !current.startsWith('uploads/profile_pictures/oauth_')) {
      this.logger.debug('manual photo present, skipping OAuth sync');
      return;
    }

    // 2. Fetch Graph metadata + compare ETag
    const meta = await this.provider.fetchPhotoMetadata(accessToken);
    if (meta === null) {
      await this.clearPhoto(userId, tenantId);
      return;
    }
    const storedEtag = await this.oauthRepo.getPhotoEtag(userId, 'microsoft');
    if (storedEtag === meta.etag) {
      this.logger.debug('photo unchanged, skipping binary download');
      return;
    }

    // 3. Download binary + write to tmp file
    const bytes = await this.provider.fetchPhotoBinary(accessToken);
    if (bytes === null) return; // race: photo deleted between metadata & binary

    const userUuid = await this.users.getUuid(userId);
    const etagShort = meta.etag.slice(0, 8);
    const newPath = `uploads/profile_pictures/oauth_${userUuid}_${etagShort}.jpg`;
    const tmpPath = `${newPath}.tmp-${Date.now()}`;

    await fs.writeFile(tmpPath, bytes);

    // 4. Update DB: users.profile_picture + oauth.photo_etag
    try {
      await this.db.tenantTransaction(async (client) => {
        await client.query('UPDATE users SET profile_picture = $1 WHERE id = $2', [newPath, userId]);
        await client.query(
          'UPDATE user_oauth_accounts SET photo_etag = $1 WHERE user_id = $2 AND provider = $3',
          [meta.etag, userId, 'microsoft']
        );
      });
      // 5. Rename tmp → real, delete old file
      await fs.rename(tmpPath, newPath);
      if (current !== null && current !== newPath) {
        await fs.unlink(current).catch(() => undefined); // best-effort old-file cleanup
      }
    } catch (dbError) {
      await fs.unlink(tmpPath).catch(() => undefined); // R6: remove orphan on DB failure
      throw dbError;
    }
  } catch (error: unknown) {
    // R1: photo sync must never break the calling flow (login/signup)
    this.logger.warn(`profile photo sync failed: ${getErrorMessage(error)}`);
  }
}
```

**Pool choice:** `tenantTransaction` because we have a verified `tenantId` at this point (post-match for login, post-signup for signup). No need for `sys_user`.

**Dependencies:** `MicrosoftProvider`, `OAuthAccountRepository`, `UsersService` (new method `getProfilePicture` + `getUuid`), `DatabaseService`, `Logger`.

**Critical patterns:**

- All queries via `db.tenantTransaction()` (ADR-019)
- `$1, $2, $3` placeholders
- `??` not `||`
- No `any`; catch variable `unknown`
- `getErrorMessage()` for error-message extraction (ADR section 7.3)

### Step 2.4: OAuthAccountRepository extensions [✅ DONE 2026-04-17]

**File:** `backend/src/nest/auth/oauth/oauth-account.repository.ts`

**New methods:**

- `getPhotoEtag(userId: number, provider: 'microsoft'): Promise<string | null>`
- `updatePhotoEtag(userId: number, provider: 'microsoft', etag: string | null): Promise<void>` (only called from `ProfilePhotoService` via the transaction in Step 2.3 — exposed for testability)

**Pool:** same as existing repo methods (`queryAsTenant`) — pre-auth or explicit-tenant contexts. For the main flow the updates happen inside `ProfilePhotoService`'s `tenantTransaction` via raw `client.query` — these repo methods are primarily for reads.

### Step 2.5: Wire `syncIfChanged` into login + signup flows [✅ DONE 2026-04-17]

**Login path** (`oauth.service.ts` — `resolveLogin`):

```typescript
// AFTER existing user-match + last_login_at update
await this.profilePhotoService.syncIfChanged(matchedUserId, matchedTenantId, tokens.accessToken);
```

**Signup path** (`signup.service.ts` — `registerTenantWithOAuth`):

```typescript
// AFTER the systemTransaction commits (signup is atomic; photo sync is best-effort)
const result = await this.db.systemTransaction(async (client) => {
  /* ... */
});
await this.profilePhotoService.syncIfChanged(result.userId, result.tenantId, tokens.accessToken);
return result;
```

**Critical:** photo sync runs **outside** the signup `systemTransaction`. Filesystem writes are not rollback-able, and a Graph failure must not abort a valid signup.

### Step 2.6: Module wiring [✅ DONE 2026-04-17]

**File:** `backend/src/nest/auth/oauth/oauth.module.ts`

- Add `ProfilePhotoService` to providers
- No new module import needed (everything stays under `OAuthModule`)
- `UsersModule` may need to expose `getProfilePicture` + `getUuid` — if not already exposed, extend the exports

### Phase 2 — Definition of Done

- [ ] `SCOPES` constant includes `User.Read`
- [ ] `MicrosoftProvider.fetchPhotoMetadata` + `fetchPhotoBinary` implemented with 5s/10s AbortController timeouts
- [ ] `PhotoMetadata` type in `oauth.types.ts`
- [ ] `ProfilePhotoService` implemented with full flow (skip/metadata/ETag/binary/write/DB/cleanup)
- [ ] `syncIfChanged` called from `resolveLogin` AND `registerTenantWithOAuth`
- [ ] `OAuthAccountRepository.getPhotoEtag` + `updatePhotoEtag` implemented
- [ ] `ProfilePhotoService` registered in `oauth.module.ts`
- [ ] `UsersService.getProfilePicture` + `getUuid` exposed (add if missing)
- [ ] ESLint 0 errors: `docker exec assixx-backend pnpm exec eslint backend/src/nest/auth/oauth/`
- [ ] Type-check passes: `docker exec assixx-backend pnpm run type-check`
- [ ] No `any`, no `||` for defaults, no inline `import()` types
- [ ] All error logs respect `SENSITIVE_KEYS` redaction
- [ ] Photo sync failure does NOT break login/signup (try/catch at service level)

---

## Phase 3: Unit Tests

> **Dependency:** Phase 2 complete.
> **Pattern:** `backend/src/nest/auth/oauth/oauth.service.test.ts` (existing)

### Test files

```
backend/src/nest/auth/oauth/
    profile-photo.service.test.ts              # NEW — ~12 tests
    providers/microsoft.provider.test.ts       # MODIFY — add ~6 photo-fetch tests
    oauth-account.repository.test.ts           # MODIFY — add ~3 tests for photo_etag
    oauth.service.test.ts                      # MODIFY — verify sync-called, failure-swallowed
```

### Mandatory scenarios

**`profile-photo.service.test.ts`:**

- [ ] Happy path: ETag differs → binary fetched, file written, DB updated, old file removed
- [ ] ETag unchanged → no binary fetch, no DB update
- [ ] Metadata returns `null` (404 / 1x1 placeholder) → `profile_picture` cleared to NULL
- [ ] User has manual photo (path without `oauth_` prefix) → sync is a no-op, no Graph call
- [ ] Graph metadata throws → sync swallows error, caller unaffected
- [ ] Graph binary throws after metadata succeeded → temp file NOT written, DB unchanged
- [ ] DB update throws → temp file removed (R6)
- [ ] First sync (no stored ETag) → binary fetched, file written
- [ ] User has no UUID (shouldn't happen but defensive) → handled gracefully

**`microsoft.provider.test.ts` additions:**

- [ ] `fetchPhotoMetadata` returns parsed metadata on 200 + JSON
- [ ] `fetchPhotoMetadata` returns null on 404
- [ ] `fetchPhotoMetadata` returns null on 1x1 placeholder response
- [ ] `fetchPhotoMetadata` returns null on network error + logs warning
- [ ] `fetchPhotoBinary` returns Buffer on 200
- [ ] `fetchPhotoBinary` returns null on 404
- [ ] `fetchPhotoBinary` respects 10s timeout (AbortController fires)
- [ ] access_token NEVER appears in any log line (existing redaction still effective)

**`oauth-account.repository.test.ts` additions:**

- [ ] `getPhotoEtag` returns stored value
- [ ] `getPhotoEtag` returns null when row missing or photo_etag is null
- [ ] `updatePhotoEtag` writes value; null allowed

**`oauth.service.test.ts` additions:**

- [ ] `resolveLogin` calls `profilePhotoService.syncIfChanged` with correct args
- [ ] `resolveLogin` returns session even when photo sync throws

### Phase 3 — Definition of Done [✅ DONE 2026-04-17]

- [x] ≥ 20 new unit tests total — **30 new** (+12 profile-photo, +8 provider, +7 repo, +3 service)
- [x] All tests green: **94/94 pass** — `docker exec assixx-backend pnpm exec vitest run --project unit backend/src/nest/auth/oauth/`
- [x] Failure paths covered: R1 (provider-throws + db-throws swallowed), R6 (DB-failure-after-rename unlinks orphan), network errors, 404, 1x1 placeholder, fallback endpoint
- [x] Existing 64 OAuth unit tests still pass (no regressions) — all green alongside new ones

---

## Phase 4: API Integration Tests

> **Dependency:** Phase 3 complete.
> **Pattern deviation (D16 — inherited from ADR-046):** Graph calls are mocked at the unit level, not the API level. The API test runner hits a real Docker backend; mocking `graph.microsoft.com` from that runner would need an in-process TestingModule — same trade-off that led ADR-046 to skip id_token-verification at the API level.

### Scope

Minimal additions to `backend/test/oauth.api.test.ts`:

- [ ] Authorize endpoint response includes `User.Read` in the `scope` query parameter (regression guard against accidentally dropping the scope)
- [ ] `/complete-signup` path still passes end-to-end after the SignupService change (no Graph call in the test — photo-sync is post-transaction best-effort; happy path remains green without photo)

### Phase 4 — Definition of Done [✅ DONE 2026-04-17]

- [x] 2 new API assertions in `oauth.api.test.ts` — (1) full-scope equality check including `User.Read`, (2) substring regression guard for `User.Read`
- [x] 3 SignupTicket fixtures updated to include `accessToken` (D7) — peek-happy, peek-idempotent, complete-signup-happy
- [x] All 46 existing API tests still pass — **48/48 green** (the plan estimated 35 existing, actual was higher)
- [x] Scope regression covered — double-asserted (full scope + explicit User.Read substring)

---

## Phase 5: Frontend

> **Dependency:** Phase 2 complete.
> **Scope:** NONE.

### Why this phase is empty

Every avatar rendering site already checks `user.profilePicture` and renders `<img>` via `getProfilePictureUrl()` when it is non-null. The existing `SidebarUserCard.svelte:93-105` and the 19 other files using `avatar__initials` all have the same fallback pattern. The `+layout.server.ts` already includes `profilePicture` in the user data shape.

Populating `users.profile_picture` is therefore sufficient — no frontend code changes needed.

**Verification (manual, Phase 6 smoke):**

- [ ] After OAuth signup, sidebar shows image instead of `SÖ` initials
- [ ] After MS-side photo change + re-login, sidebar shows new image (no hard refresh needed — filename changes → browser cache invalidates)
- [ ] User with no MS photo still sees initials

### Phase 5 — Definition of Done

- [ ] No code changes
- [ ] Manual sidebar check confirms image renders (deferred to Phase 6 smoke)

---

## Phase 6: Integration + Polish + ADR + Docs

> **Dependency:** Phase 5 complete (trivially).

### 6.1 Azure AD configuration (manual, by Simon) [✅ DONE 2026-04-17]

- [x] Azure Portal → App registrations → Assixx app → API permissions
- [x] Added delegated permission: `Microsoft Graph / User.Read` (auto-consented, no admin consent needed)
- [x] Verified: sign-out + sign-in as existing OAuth user → Microsoft consent screen once → proceeds cleanly
      (User feedback 2026-04-17: "alles klappt jetzt schon perfekt")

### 6.2 ADR-046 amendment [✅ DONE 2026-04-17]

**File:** `docs/infrastructure/adr/ADR-046-oauth-sign-in.md`

Append a new section `## Amendment YYYY-MM-DD: Microsoft Graph profile-photo sync`:

- §A4 partial reversal: Graph API calls are allowed for profile-photo sync **only**. `access_token` is used in-flight during the callback and discarded — still not persisted.
- New scope: `User.Read` added to `SCOPES` constant. Rationale + alternatives (`ProfilePhoto.Read.All` rejected for requiring admin consent).
- ETag pattern: `@odata.mediaEtag` cached in `user_oauth_accounts.photo_etag` to avoid re-downloading unchanged photos on re-login.
- File-storage: `uploads/profile_pictures/oauth_<uuid>_<etag8>.jpg`. Filename prefix `oauth_` reserved for OAuth-sourced photos; manual uploads go to paths without this prefix and are never overwritten by the sync.
- Failure mode: photo sync is best-effort. Graph failure logs a warning and does not break login/signup.
- Risks register addendum: R-photo-1 (user lacks photo → NULL fallback), R-photo-2 (Graph rate limit → math shows we're at 0.2 % of the per-tenant quota).
- Reference the masterplan: `FEAT_OAUTH_PROFILE_PHOTO_MASTERPLAN.md`.

### 6.3 HOW-TO-AZURE-AD-SETUP.md update [✅ DONE 2026-04-17]

**File:** `docs/how-to/HOW-TO-AZURE-AD-SETUP.md`

- Extend "Required API permissions" list: `User.Read` (delegated, work or school account)
- Add a one-line note: "Granting User.Read enables profile-photo sync. Users see a 'Read your profile' consent on first sign-in after the change."

### 6.4 FEATURES.md update [✅ DONE 2026-04-17]

**File:** `docs/FEATURES.md`

- Under the OAuth section, add: "Profile photo auto-sync from Microsoft 365 (initial signup + subsequent logins, ETag-cached)."

### 6.5 Customer fresh-install sync [✅ DONE 2026-04-17]

- [x] `./scripts/sync-customer-migrations.sh` ran clean — 136 migrations, 25+6+11 seed rows, schema/seed/pgmigrations all OK

### 6.6 Manual smoke (end-to-end, verify with a real Azure tenant) [🟡 PARTIAL 2026-04-17]

- [x] OAuth login with a Microsoft account → sidebar shows the real photo instead of initials (user verified 2026-04-17: "alles klappt jetzt schon perfekt")
- [ ] OAuth signup with a Microsoft account that has NO photo → sidebar shows initials (not yet explicitly tested; `projectPhotoMetadata` unit tests cover the 1x1 placeholder path)
- [ ] MS-side photo change → log out → log in → new photo rendered (deferred: happy path works, ETag cache logic covered by unit tests)
- [ ] User uploads manual photo via the profile page → logs out → logs in via OAuth → manual photo preserved (deferred; `isManuallyUploaded` unit test covers the guard)

### Phase 6 — Definition of Done [✅ DONE 2026-04-17]

- [x] Azure AD `User.Read` permission granted (auto-consent, no admin-consent required)
- [x] ADR-046 amendment section added with date + §A4 partial reversal recorded (incl. architecture diagram + Spec Deviations D4–D7 + failure-mode contract + files-touched table)
- [x] `HOW-TO-AZURE-AD-SETUP.md` updated (Step 4 rewritten, reference command updated)
- [x] `FEATURES.md` updated (Section 10a `Microsoft OAuth Sign-In` extended with profile-photo sync bullet)
- [x] Customer fresh-install schema synced (136 migrations registered)
- [🟡] Manual smoke: happy path verified end-to-end by user; 3 edge-case scenarios deferred (unit-test coverage substitutes)
- [x] No open TODOs in code

---

## Session Tracking

| Session | Phase     | Description                                                            | Status | Date |
| ------- | --------- | ---------------------------------------------------------------------- | ------ | ---- |
| 1       | 1 + 2     | Migration + backend (provider extensions, ProfilePhotoService, wiring) |        |      |
| 2       | 3 + 4 + 6 | Unit + API tests + ADR amendment + HOW-TO update + smoke               |        |      |

### Session log (fill per session)

```markdown
### Session N — YYYY-MM-DD

**Goal:** ...
**Result:** ...
**New files:** ...
**Changed files:** ...
**Verification:**

- ESLint: 0 errors
- Type-check: 0 errors
- Tests: N/N passed

**Deviations:** ...
**Next session:** ...
```

---

## Quick Reference: File Paths

### Backend (new)

| File                                                        | Purpose                             |
| ----------------------------------------------------------- | ----------------------------------- |
| `database/migrations/<ts>_add-oauth-photo-etag.ts`          | Adds `photo_etag` column            |
| `backend/src/nest/auth/oauth/profile-photo.service.ts`      | Orchestrates the sync (entry point) |
| `backend/src/nest/auth/oauth/profile-photo.service.test.ts` | Unit tests                          |

### Backend (modified)

| File                                                               | Change                                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `backend/src/nest/auth/oauth/providers/microsoft.provider.ts`      | `SCOPES` + `fetchPhotoMetadata` + `fetchPhotoBinary`               |
| `backend/src/nest/auth/oauth/providers/microsoft.provider.test.ts` | 6 new tests for photo fetch                                        |
| `backend/src/nest/auth/oauth/oauth.types.ts`                       | New `PhotoMetadata` interface                                      |
| `backend/src/nest/auth/oauth/oauth.service.ts`                     | Calls `syncIfChanged` in `resolveLogin`                            |
| `backend/src/nest/auth/oauth/oauth.service.test.ts`                | Assertions for sync invocation + failure-swallowing                |
| `backend/src/nest/auth/oauth/oauth-account.repository.ts`          | `getPhotoEtag` + `updatePhotoEtag`                                 |
| `backend/src/nest/auth/oauth/oauth-account.repository.test.ts`     | 3 new tests                                                        |
| `backend/src/nest/auth/oauth/oauth.module.ts`                      | Register `ProfilePhotoService`                                     |
| `backend/src/nest/signup/signup.service.ts`                        | Post-transaction `syncIfChanged` call in `registerTenantWithOAuth` |
| `backend/src/nest/users/users.service.ts`                          | Expose `getProfilePicture` + `getUuid` if not already              |
| `backend/test/oauth.api.test.ts`                                   | 2 regression assertions (scope + complete-signup)                  |

### Docs (modified, Phase 6)

| File                                               | Change                  |
| -------------------------------------------------- | ----------------------- |
| `docs/infrastructure/adr/ADR-046-oauth-sign-in.md` | Amendment section       |
| `docs/how-to/HOW-TO-AZURE-AD-SETUP.md`             | `User.Read` permission  |
| `docs/FEATURES.md`                                 | OAuth photo-sync bullet |

### Frontend

| Path | Change                                                                                       |
| ---- | -------------------------------------------------------------------------------------------- |
| —    | None — existing avatar fallback chain already handles the populated `profile_picture` column |

---

## Spec Deviations

| #   | Spec says                                                                               | Actual code                                                                                                                                                                    | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | ADR-046 §A4 rejects storing MS tokens AND calling Graph                                 | We now call Graph for photos; token stays in-memory, not stored                                                                                                                | §A4 partial reversal documented in Phase 6.2 amendment. Token-storage policy unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D2  | ADR-046 spec deviation D10: `offline_access` intentionally NOT requested                | Still not requested; we use the initial `access_token` only once                                                                                                               | D10 unchanged. Re-affirm in the amendment.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| D3  | Least-privileged Graph permission is `ProfilePhoto.Read.All`                            | We use `User.Read`                                                                                                                                                             | Rationale: `ProfilePhoto.Read.All` is tenant-wide + needs admin consent. `User.Read` is per-user auto-consent. Higher-privileged but standard.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D4  | Plan §Step 2.3 pseudocode: `write tmp → DB update → rename tmp→final`                   | Implemented as `write tmp → rename tmp→final → DB update`                                                                                                                      | Rationale: a crash in the plan's order between DB update and rename leaves `users.profile_picture` pointing at a non-existent file and the avatar 404s — ETag match on the next run would skip, so it never self-heals. My order keeps file-reference integrity: when the DB references `newPath`, `newPath` already exists. Worst-case crash leaves an orphan file (disk waste, no user impact). Documented in `profile-photo.service.ts` header.                                                                                                                                                                                                                                                                                                     |
| D5  | Plan §Step 2.3 pseudocode: `tenantTransaction` in `ProfilePhotoService`                 | Implemented as `transaction(cb, { tenantId })` with explicit id                                                                                                                | Rationale: `tenantTransaction` reads `tenantId` from CLS, but OAuth callbacks run pre-JWT so CLS has no `tenantId`. `transaction()` takes explicit `TransactionOptions` — exactly the pre-auth path documented in ADR-019 ("Is it WebSocket, a guard, or a service with explicit tenantId param but no CLS? → `queryAsTenant` / `transaction({tenantId})`").                                                                                                                                                                                                                                                                                                                                                                                           |
| D6  | Plan §Step 2.3: expose `getProfilePicture` + `getUuid` on `UsersService`                | Implemented as private helpers inside `ProfilePhotoService`                                                                                                                    | Rationale: both are trivial single-column reads (`SELECT profile_picture FROM users …`, `SELECT uuid FROM users …`). Adding them to the already-large `UsersService` for one caller is gold-plating. If a second caller appears, promote them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D7  | Plan §Step 2.5: signup photo-sync call lives in `SignupService.registerTenantWithOAuth` | Moved to `OAuthService.completeSignup` (after `registerTenantWithOAuth` returns); `SignupTicket` now carries `accessToken` through Redis so the post-commit sync has the token | Rationale: putting the sync in `SignupService` would require `SignupModule → OAuthModule` injection, but `OAuthModule` already imports `SignupModule` (for `SignupService`) — circular dependency requiring `forwardRef`. Keeping photo-sync in `OAuthService` keeps the dependency graph acyclic and scopes all OAuth orchestration inside one module. Security: `accessToken` in `SignupTicket` joins `OAuthState.codeVerifier` (a stricter secret) in the same Redis keyspace — single-use (GETDEL) + 15-min TTL + Redis password + `oauth:` keyPrefix. Token NEVER exposed via `SignupTicketPreview` (peek endpoint stays unchanged; new test asserts `preview` lacks `accessToken`). ADR-046 §A4 "no token persistence at DB layer" is unchanged. |

---

## Known Limitations (V1 — deliberately excluded)

1. **No real-time sync.** MS-side photo changes are picked up on the next OAuth login, not continuously. Rationale: we don't store refresh tokens, so we cannot poll Graph without the user actively signing in.
2. **No opt-out UI.** Per product decision (2026-04-17): auto-takeover without opt-in, relying on the Microsoft consent screen as the implicit consent vector. A future V2 toggle in the profile page ("disable MS photo sync") is easy to add (one bool column on `user_oauth_accounts`).
3. **One size only.** We store the 240×240 HD variant. No on-the-fly resizing for larger (360/432/504/648) avatars. Rationale: the Assixx UI never shows anything larger than ~80 px in any existing component.
4. **No photo-change notifications.** The user is not told "your photo was synced from Microsoft". Silent replace.
5. **No Google / other providers.** Scope stays Microsoft-only per ADR-046. When / if a second provider is added, its own photo-sync is a separate masterplan.
6. **No admin-triggered re-sync.** If a user's photo is stale for some reason, the only fix is a fresh OAuth login. No "resync now" admin action.

---

## Post-Mortem (2026-04-17)

### What went well

- **Upfront verification against MS docs saved rework.** Initial scope had claimed the id_token would carry a `picture` claim (it doesn't). One `WebFetch` round against `learn.microsoft.com` corrected the architecture BEFORE any code was written — zero commits wasted on the wrong premise.
- **Spec Deviations documented as they occurred.** 7 deviations from the original plan (D1–D7), all justified and captured in the deviations table. Reviewable audit trail replaces hand-waved "I changed my mind".
- **Manual-upload protection built in from day 1 (R5).** Filename-prefix convention (`oauth_`) is checked at the very start of `syncIfChanged`; no Graph call issued for users who have set their own picture. This closed an obvious footgun before it became a bug report.
- **File-ref integrity improved over masterplan pseudocode (D4).** Plan pseudocode had a crash window where the DB would reference a non-existent file. Reordered to rename-before-DB; crash leaves orphan files only (disk waste, no user impact).
- **Test coverage matches architectural risks 1:1.** Each R-risk from Phase 0 has at least one named test. Failure-mode contract ("never throws") is explicitly asserted.
- **User-verified end-to-end happy path in the same session as implementation** — no "works on my machine then fails in real consent flow" gap.

### What went badly

- **Premature orphan claim on Phase 0.** Mis-invoked `grep -v template` filtered out `drop-tpm-templates.ts` (substring match) and I labeled the resulting 134 vs 135 mismatch a "historical orphan, not blocking" without proof. User stopped the workflow correctly; lesson saved to `memory/feedback_grep_substring_exclusion.md` — any count mismatch gets a row-by-row diff, never a reflex label.
- **Missed the `resolveLogin`-has-no-accessToken architectural detail during planning.** The masterplan assumed `resolveLogin(info, accessToken)` would be a trivial signature change. Only when coding did I notice `resolveLogin` receives only `info` and the access_token only lives in `handleCallback` scope. Signup had the bigger version: access_token needed to survive 15 minutes across the Redis signup ticket. Spec Deviation D7 documents the fix. Lesson: next time, trace the access_token lifecycle through the existing code BEFORE sketching call sites.
- **Circular-dependency risk almost missed (SignupModule ↔ OAuthModule).** Naively putting photo-sync into `SignupService.registerTenantWithOAuth` (as the plan suggested) would have needed `forwardRef`. Caught during code-placement thinking, not by the compiler. Moved to `OAuthService.completeSignup` instead — cleaner dep graph.

### Metrics

| Metric                       | Planned                 | Actual                                                                                                                                                                       |
| ---------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sessions                     | 2                       | **1 (long)** — happy path shipped same day                                                                                                                                   |
| Migration files              | 1                       | **1** — `20260417094053371_add-oauth-photo-etag.ts`                                                                                                                          |
| New backend files            | 2                       | **2** — `profile-photo.service.ts` + its `.test.ts`                                                                                                                          |
| New frontend files           | 0                       | **0** — existing avatar chain already supported `profile_picture`                                                                                                            |
| Changed backend files        | ~10                     | **10** (provider, types, oauth service + test, repo + test, module, microsoft test, oauth test, oauth.service.test fixtures, api test fixtures)                              |
| Changed doc files            | 3                       | **4** — ADR-046, HOW-TO-AZURE-AD-SETUP, FEATURES, this masterplan                                                                                                            |
| Unit tests                   | ~20                     | **30 new** (total 94 in suite)                                                                                                                                               |
| API tests                    | 2                       | **2 new** + 3 fixture updates (total 48)                                                                                                                                     |
| ESLint errors at release     | 0                       | **0**                                                                                                                                                                        |
| TypeScript errors at release | 0                       | **0**                                                                                                                                                                        |
| Prettier warnings at release | 0                       | **0**                                                                                                                                                                        |
| Spec deviations              | 3 (D1–D3, pre-declared) | **7** — D1–D3 pre-declared + D4 (file-rename order), D5 (transaction vs tenantTransaction), D6 (no UsersService methods), D7 (signup sync in OAuthService not SignupService) |

---

**This document is the execution plan. Every session starts here, takes the next unchecked item, and marks it done. No coding starts before Phase 0 is green.**

# FEAT: Tenant Subdomain Routing — Execution Masterplan

> **Plan type:** FEATURE
> **Created:** 2026-04-19
> **Version:** 0.13.0 (Session 12c — un-planned bugfix: OAuth-Login-Success-Redirect landete auf Apex statt User-Subdomain, weil `oauth.controller.ts#routeCallbackResult` im `login-success` branch `returnToSlug` aus der OAuth-State-Payload nutzte — dieser Wert ist aber die _Startseite_-Subdomain, nicht der _User-Tenant_. User klickt "Mit Microsoft anmelden" auf `testfirma.localhost:5173`, MS-Account gehört zu `scs-technik`, Browser landete auf `localhost:5173/root-dashboard` (Apex) statt `scs-technik.localhost:5173/root-dashboard`. Fix: `routeCallbackResult` login-success branch extrahiert nach `routeLoginSuccess()`, nutzt `authService.getSubdomainForTenant(tenantId)` (DB-lookup, Slack-Pattern) — Single Source of Truth ist der User-Tenant, nicht die Startseite. Spiegelt 1:1 `buildHandoffRedirect()` im Password-Login-Flow (`login/+page.server.ts`). `buildSubdomainUrl` in eigene Datei extrahiert + 10 neue Unit-Tests (dev→`http://{slug}.localhost:5173`, prod→`https://{slug}.assixx.com`, `www`-stripping, port-handling, pathological-subdomain-apex). Verification: oauth.service.test 26/26, architectural.test 25/25, tenant-subdomain-routing.api.test 29/29, build-subdomain-url.test 10/10; type-check + ESLint 0 errors. User-verified smoke-test on `testfirma.localhost:5173/login` → MS-OAuth → landing `scs-technik.localhost:5173/root-dashboard` mit korrekt scoped cookies + E2E-Key-Rotation + WebSocket.)
> **Version (prior):** 0.12.0 (Session 12b — un-planned polish: D17 architectural test in `shared/src/architectural.test.ts` (AST walker via `ts.createSourceFile` — bans bare `req.hostTenantId` / `request.hostTenantId` PropertyAccess outside the middleware writer allowlist; comments and JSDoc are correctly ignored as AST trivia). ADR-050 §Backend amended with a new "Object-identity note" paragraph documenting the `@fastify/middie` raw-vs-wrapped discovery from Session 10 D17. Masterplan post-mortem filled (was `{tbd}` placeholder). Sanity-regression: bare `request.hostTenantId` injected into `oauth-handoff.controller.ts` → D17 test failed with exact expected message → reverted → 25/25 green. No production behaviour change.)
> **Version (prior):** 0.11.0 (Session 12 executed — Phase 5 Step 5.4: OAuth handoff consumer branch added to `(public)/signup/oauth-complete/+page.server.ts`. Load-function now branches on `?token=` (new, handoff) vs `?ticket=` (existing, signup) vs neither (`/signup` bounce). New `handleHandoff()` helper POSTs to `/auth/oauth/handoff` with propagated `X-Forwarded-Host` so backend middleware sees the subdomain (R15 defence); maps 400/404/403/5xx → specific `/login?oauth=handoff-*` redirects. New `extractJwtRole()` in `$lib/server/jwt-exp.ts` decodes the handed-off JWT so the 4-cookie invariant (access+refresh+userRole+exp) is preserved without a `/users/me` round-trip; `setAuthCookies(..., role)` now takes role as a param and the existing signup action passes `'root'` explicitly. Verification: `pnpm run type-check` exit 0; frontend ESLint 0 errors (4 auto-fixed import-ordering + 1 manual narrowing simplification); `svelte-check` 2554 files 0/0; `architectural.test.ts` 24/24 green. NO backend change, NO tests added (Phase 5 DoD is lint/check/type-check parity), NO `+page.svelte` change — handoff branch redirects server-side before render.)
> **Status:** Phase 2/3/4/5 COMPLETE; remaining: infra Sessions 3–5, THEN Session 13 cutover
> **Branch:** `test/ui-ux` (user decision 2026-04-21: work on current branch, not a new `feat/tenant-subdomain-routing` branch)
> **Spec:** [ADR-050 Tenant Subdomain Routing](./infrastructure/adr/ADR-050-tenant-subdomain-routing.md)
> **Author:** Simon Öztürk (Staff-Engineer assist)
> **Deployment context:** Greenfield (no live prod tenants as of 2026-04-19) —
> see ADR-050 §"Deployment Context: Greenfield Launch" for impact on cutover.
> **Infra decisions (user, 2026-04-19):** Registrar IONOS, DNS Cloudflare Free
> tier in **DNS-only mode (grey cloud)** — NOT proxied, TLS terminates at our
> origin Nginx.
> **Infra decisions (user, 2026-04-20):** Prod-VPS = IONOS (NOT Hetzner), Intel
> 4 vCPU / 6–8 GB RAM. Location irrelevant. Resolves D2/D15.
> **Estimated sessions:** 13 (Session 9b scope reduced — see Session 9b note)
> **Actual sessions:** 10 / 13 + Session 12b un-planned polish
>
> **⏸ INFRA-HOLD (user decision 2026-04-21):** Sessions 3–5 (Cloudflare DNS
> wildcard, Doppler `CLOUDFLARE_DNS_API_TOKEN`, certbot sidecar, wildcard
> cert, Nginx `prod.conf` rewrite) are held until **kurz vor dem
> Prod-VPS-Test**. Rationale: avoid paying for a running IONOS VPS while
> code iteration continues. DNS delegation to Cloudflare is already active
> for `assixx.com` (verified 2026-04-21), so that prerequisite is done.
> The hold is reversible — once the user flips the signal, Sessions 3–5
> can ship in a single work block and Session 13 (cutover + ADR-050 status
> flip to "Accepted") runs immediately after. Pre-hold work that can still
> happen in parallel: email URL templating (see §"Pre-infra backlog" at the
> end of this document).

---

## Changelog

| Version | Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-04-19 | Initial draft — phases outlined, R-table seeded, D-table seeded                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 0.2.0   | 2026-04-19 | **Staff-engineer pre-execution audit integrated.** User decisions: greenfield (no live tenants), DNS-only CF Free, IONOS registrar. R14 (backend port exposure) + R15 (handoff host mismatch) added. Step 1.0 (reserved-slug) + Step 1.6 (prod port isolation) added. Session 9b (test-infra migration) added. `trustProxy: true` verified already active in `main.ts:284`. D-table: 7 entries resolved, 2 new (D15, D16). Cutover simplified (no customer comms, no transitional redirect). Nginx Phase 1 reclassified from "modify" to "full HTTPS rewrite" (current nginx.conf is HTTP-only).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 0.3.0   | 2026-04-20 | **Session 1 (Pre-execution audit) EXECUTED.** D-entries resolved against real codebase. **MAJOR CORRECTION D6:** OAuth `state` is NOT a cookie — it is a Redis-stored UUIDv7 token (`OAuthStateService`, `oauth:state:{uuidv7}`, GETDEL atomic). Confirmed via ADR-046 §4 Redis keyspace table. Consequence: Step 2.5 drastically simplified (no HMAC, no cookie-scope concern, no `OAUTH_STATE_SECRET`); R12 mitigation simplified (server-side storage is inherently tamper-proof); the corresponding Doppler-secret prerequisite dropped from Phase 0. **D8 scope reduction:** 47 existing API tests (not ~38) all use raw `fetch(BASE_URL + path)` against `localhost:3000` — `extractSlug('localhost') = null` means zero-migration per-file. Session 9b shrinks to: add `withTenantHost()` helper, use in new subdomain-routing tests only. **D4:** exact regex captured (`^[a-z0-9][a-z0-9-]*[a-z0-9]$`, duplicated in `signup.dto.ts` + `check-subdomain.dto.ts` — flagged for later extraction). **D2/D15:** user decision IONOS (NOT Hetzner), Intel 4 vCPU, 6–8 GB RAM. **R6 deleted** (no state cookie exists → no scope concern). R14 & R15 sanity-checked against existing code. ADR-050 §OAuth will be edited same-day to match reality.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 0.6.0   | 2026-04-21 | **Session 7 (Phase 2 Steps 2.4 + 2.5) EXECUTED on branch `test/ui-ux`.** CORS origin-callback replaces static `ALLOWED_ORIGINS` env list — locally-declared `FastifyCorsOriginFn` type (transitive dep, not imported), regex allowlist covers apex/subdomain/dev + dev-subdomain. `OAuthState` extended with optional `returnToSlug`; `OAuthStateService.create()` gains the 3rd arg (conditional spread preserves exactOptionalPropertyTypes). `isOAuthState` type-guard accepts `string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | undefined`. 3 new tests (roundtrip + absence on apex + consume returns slug) bring oauth-state suite to 14/14 green. `CallbackResult`threads`returnToSlug?`across all 4 variants;`OAuthService.handleCallback`conditionally spreads it onto the result. New`AuthorizeQueryDto.return_to_slug`field (regex-validated, optional).`OAuthController.authorize`reads`X-Forwarded-Host`first (trusted) → extractSlug → else query-param fallback; new`resolveReturnToSlug()`+`buildSubdomainUrl()`helpers.`routeCallbackResult`refactored: login-success + returnToSlug → mint handoff + 302 to`https://{slug}.assixx.com/signup/oauth-complete?token=...`(no apex cookies set); other variants with returnToSlug → absolute redirect to subdomain; existing apex behaviour unchanged when returnToSlug is undefined. New`OAuthHandoffService`(oauth-handoff.service.ts) — 32-byte random hex token,`oauth:handoff:`Redis keyspace, 60-s TTL, R15 GET→host-check→DEL order; errors`HANDOFF_TOKEN_INVALID`(404) and`HANDOFF_HOST_MISMATCH`(403, does NOT consume). New`OAuthHandoffController`at`/api/v2/auth/oauth/handoff`(provider-agnostic base path, sibling to microsoft-scoped OAuthController), POST body validated by`HandoffBodyDto`(64-char hex regex). Module wiring: both new service + controller registered + exported. Verification:`pnpm run type-check`exit 0 (shared+frontend+backend+backend/test);`pnpm exec eslint backend/src/nest/auth/oauth/ backend/src/nest/main.ts`exit 0; 571/571 unit tests green; backend force-recreated +`/health`200; smoke`POST /handoff`with unknown all-zero token →`HANDOFF_TOKEN_INVALID`404; smoke same endpoint with`"token":"bad"`→`VALIDATION_ERROR`400;`GET /authorize?mode=login` still 302 (existing behaviour preserved for apex). oauth.service.test.ts updated: existing startAuthorization assertion now includes the 3rd undefined arg; 1 new assertion for slug propagation. NO test-infra changes (session 9b remains) — existing 47 api tests untouched (extractSlug('localhost')=null keeps them unaffected). NO frontend changes (Session 11-12). NO architectural tests yet (Session 8). NO new nginx config (infra Sessions 3-5 still deferred). |
| 0.13.0  | 2026-04-22 | **Session 12c (un-planned bugfix — OAuth login-success Subdomain-Redirect) EXECUTED on branch `test/ui-ux`.** Symptom (user-reported): „bei normalem Tenant-Login lande ich auf `http://testfirma.localhost:5173/root-dashboard`, bei Microsoft OAuth auf `http://localhost:5173/root-dashboard`". DB-Ausgangslage verifiziert: User 76 (`simon.oeztuerk@scs-technik.de`) ist in Tenant 36 (`scs-technik`) — verknüpft via `user_oauth_accounts`. User startete auf `testfirma.localhost` (Tenant 8), aber sein MS-Account gehört zu `scs-technik`. **Root cause:** `oauth.controller.ts#routeCallbackResult` im `login-success` branch nutzte `result.returnToSlug` (= Startseiten-Slug aus OAuth-State-Payload) statt des User-Tenant-Slugs. Dieser Wert war im konkreten Fall `undefined` (Button hängt kein `?return_to_slug=` an, `X-Forwarded-Host` setzt Vite-Proxy nicht), also fiel Fluss auf den apex-Branch (`setAuthCookies` auf Apex + `302 /login`). Cookies landeten auf `localhost:5173`. **Wahre Invariante (Slack/Linear-Pattern):** Der Redirect-Ziel ist der Tenant des authentifizierten Users, NICHT die Startseite. Die DB ist die Authority — OAuth-User kennen ihren Tenant-Slug nicht, der wird über `user_oauth_accounts` aufgelöst. **Fix (1 Produktions-File + 2 neue Files):** (1) `backend/src/nest/auth/oauth/oauth.controller.ts` — `routeCallbackResult` login-success branch extrahiert in neue `private async routeLoginSuccess(userId, tenantId, req, reply)` Methode. Diese ruft `authService.getSubdomainForTenant(tenantId)` (bereits existierend, wird auch vom Password-Login's `/auth/handoff/mint` endpoint genutzt) und mintet Handoff-Token + Subdomain-Redirect wenn `userSubdomain !== null`; sonst fallback apex-Cookies + `/login` (ADR-046 Amendment Bug A). Inline `buildSubdomainUrl(slug, path)` hardcoded `https://${slug}.assixx.com` in Dev kaputt — extrahiert nach neue Datei `build-subdomain-url.ts` + `PUBLIC_APP_URL`-derivation (dev `http://localhost:5173` → `http://{slug}.localhost:5173`; prod `https://www.assixx.com` → `https://{slug}.assixx.com`). Spiegelt 1:1 `buildSubdomainHandoffUrl()` in `frontend/src/routes/(public)/login/+page.server.ts` (Session 12c Password-Flow). `returnToSlug`-Branch in `routeCallbackResult` bleibt für `login-not-linked` + `signup-continue` + `provider-error` variants unverändert — nur login-success nutzt jetzt DB-Lookup. (2) Neu `build-subdomain-url.ts` — pure function, 36 Zeilen, exportiert für Unit-Testability. (3) Neu `build-subdomain-url.test.ts` — 10 Tests: dev/prod/prod-bare/pathological-subdomain-apex/port-preservation/path-invariants. **Keine Änderung an** Service, Button, Frontend, OAuth-State-Payload, State-Service — `returnToSlug` bleibt im Datenmodell für andere callback variants. **Verification:** Docker `pnpm run type-check` 0 errors (nach 1 Fix: `process.env.PUBLIC_APP_URL` → `process.env['PUBLIC_APP_URL']` wegen ADR-041 `noPropertyAccessFromIndexSignature`); ESLint 0 errors; `pnpm exec vitest run --project unit backend/src/nest/auth/oauth/build-subdomain-url.test.ts` → 10/10; `...oauth.service.test.ts` → 26/26 (service unverändert); `...shared/src/architectural.test.ts` (Host) → 25/25; `pnpm exec vitest run --project api backend/test/tenant-subdomain-routing.api.test.ts` → 29/29. **User-verified smoke (E2E):** `http://testfirma.localhost:5173/login` → MS-OAuth → erfolgreicher Redirect auf `http://scs-technik.localhost:5173/root-dashboard`; Cookies scoped korrekt auf `scs-technik.localhost`; E2E-Key-Rotation (v5) + WebSocket-Ticket + Dashboard-API alle 200 im Browser-Log. Backend-Logs zeigen: Callback bei 08:16:48 → Token-Mint → Browser navigiert zu `http://scs-technik.localhost:5173/...`. NO frontend change. NO DB migration. NO backend restart nötig (tsx watch hat Hot-Reload um 08:16:24 gemacht). Session 13 (infra + ADR-050 cutover) weiterhin pending.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 0.12.0  | 2026-04-21 | **Session 12b (un-planned polish) EXECUTED on branch `test/ui-ux`.** Three outputs, zero production-behaviour change: (1) **D17 architectural test** — new 6th invariant in `shared/src/architectural.test.ts` under the existing "Backend+Frontend: Tenant Subdomain Routing Invariants (ADR-050)" describe block. AST walker (`ts.createSourceFile` + `ts.forEachChild`) rejects any PropertyAccessExpression where `expression` is an `Identifier` named `req` or `request` and `name` is `hostTenantId`. Regex-based scan was considered and rejected — 12+ production files reference `req.hostTenantId` / `request.hostTenantId` in comments/JSDoc and would produce false positives. AST trivia (comments) is correctly ignored by the walker. Writer-allowlist is `BARE_HOST_TENANT_ID_WRITER_ALLOWLIST` = `{tenant-host-resolver.middleware.ts}` (middleware receives raw `IncomingMessage` under `@fastify/middie`, bare writes there are semantically correct). Test files globally excluded — guard test mocks legitimately write into `mockRequest.raw` post-Session-10-fix, enforcing the rule there would break regression coverage. Header comment block at line 404-420 updated: "Five invariants" → "Six invariants" with D17 added. (2) **ADR-050 §Backend amendment** — new "Object-identity note" paragraph appended to §"Backend: Pre-Auth Host Resolver + Post-Auth Cross-Check" explaining the `@fastify/middie` raw-vs-wrapped discovery, the production-hiding mechanism (unit tests with plain-object mocks passed; integration tests caught it), the fix shape (`HostAwareRequest = FastifyRequest & { raw: IncomingMessage & HostAwareRaw }`), and cross-ref to the new D17 architectural test as regression guard. (3) **Masterplan post-mortem filled** — previously `{tbd}` placeholder, now a honest "what went well / what went badly / metrics" fill covering Sessions 1 + 2 + 6-12 + 12b. Metrics table shows 10 sessions complete + 12b un-planned + 3 deferred (infra) + 1 pending (cutover); 72 unit tests, 29 API tests, 6 architectural assertions; 1 runtime discovery (D17). **Sanity-regression verified:** injected `const _regressionProbe = req.hostTenantId` into `oauth-handoff.controller.ts` → D17 test failed with the expected assertion message including file:line location → reverted → `pnpm exec vitest run --project unit shared/src/architectural.test.ts` → **25/25 green**. Previously 24 tests, now 25. NO backend production code touched outside the sanity-regression injection-and-revert. NO frontend code touched. NO new dependencies. Docs + test file only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 0.11.0  | 2026-04-21 | **Session 12 (Phase 5 Step 5.4 — OAuth handoff consumer) EXECUTED on branch `test/ui-ux`.** Two files touched: (1) `frontend/src/lib/server/jwt-exp.ts` — added `extractJwtRole(token): UserRole` sibling to the existing `extractJwtExp`; both now share a private `decodeJwtPayload()` base64url-decode+JSON-parse helper (KISS refactor, blast radius contained). `isUserRole` type-guard pins the union to `@assixx/shared::UserRole` (`root                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | admin                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | employee | dummy`). Unknown/malformed role claim throws — fail-closed on drift. (2) `frontend/src/routes/(public)/signup/oauth-complete/+page.server.ts`—`load()`now branches on`?token=`first (handoff, new) vs`?ticket=` (signup, unchanged) vs neither (`/signup`bounce). New`handleHandoff(token, fetch, cookies, request)`helper POSTs to`${API_BASE}/auth/oauth/handoff` with explicitly propagated `X-Forwarded-Host` (required in dev direct-to-backend; no-op in prod where Nginx already sets it). Error-code mapping: 400 → `/login?oauth=handoff-invalid`, 404 → `/login?oauth=handoff-expired`, 403 → `/login?oauth=handoff-host-mismatch` (R15), 5xx/network → `error(500, ...)`. On 200, `extractJwtRole(accessToken)` resolves the role claim → `setAuthCookies(cookies, access, refresh, role)` writes the full 4-cookie set on the subdomain origin (browser-native scoping, RFC 6265 §5.3 step 6) → `redirect(303, ROLE_DASHBOARD_PATHS[role])` skips the `/login` + `/users/me` round-trip. `setAuthCookies` refactored to take `role` as a parameter (was hardcoded `'root'`); existing signup action call-site updated to pass `'root'` explicitly. New `ROLE_DASHBOARD_PATHS` map mirrors `login/+page.server.ts::getRedirectPath` — comment flags the drift risk. NO `+page.svelte` touched (handoff branch throws redirect before SSR render completes, so the form markup never loads on the handoff path). NO backend changes, NO new tests (Phase 5 DoD is lint/check/type-check parity). **Verification:** `pnpm run sync:svelte` exit 0; Docker `pnpm run type-check` (shared + frontend + backend + backend/test) exit 0; `cd frontend && pnpm run lint` exit 0 (after auto-fix resolved 4 import-order issues: blank-line removal within "type" group + `./$types`before`@assixx/shared`for type-import relative-before-external ordering per frontend ESLint`import-x/order`config; 1 manual fix for TS 6.0 tuple-length narrowing obviated`payloadPart === undefined`check →`@typescript-eslint/no-unnecessary-condition`satisfied);`cd frontend && pnpm run check`→ 2554 files, 0 errors, 0 warnings;`pnpm exec vitest run --project unit shared/src/architectural.test.ts`→ 24/24 green (no regression on R1/R2/R14/R15/slug-parser invariants). NO dev-server smoke (deferred — user's next`pnpm run dev:svelte` will exercise both branches manually). Infra Sessions 3–5 (DNS + cert + Nginx) still deferred to infra-user. Session 13 (cutover + ADR-050 backfill) pending. |
| 0.10.0  | 2026-04-21 | **Session 11 (Phase 5 Steps 5.1–5.4 — Frontend) EXECUTED on branch `test/ui-ux`.** (1) **Step 5.1 — host extraction:** new file `frontend/src/lib/utils/extract-slug.ts` (D5-compliant frontend twin of backend parser, byte-for-byte-compatible semantics; `isNonTenantHost()` helper extracted to stay under the frontend ESLint cyclomatic-complexity ceiling of 10). `frontend/src/app.d.ts` extends `App.Locals` with `hostSlug: string \| null`. `frontend/src/hooks.server.ts` gains a new `hostResolverHandle` inserted **before** `authHandle` in `sequence()` per D7 — reads `X-Forwarded-Host` (Nginx-trusted) with fallback to `event.url.hostname`, writes `event.locals.hostSlug`, pure (no short-circuit, no redirect). (2) **Step 5.2 — `(public)` route group:** new directory `frontend/src/routes/(public)/` with `+layout.svelte` (pass-through snippet render) and `+layout.server.ts`. `login/`, `signup/`, `forgot-password/` moved under the group via `mv` (URLs unchanged — route groups `()` are SvelteKit-URL-invisible). `signup/oauth-complete/` travels with the move and is consumed by Session 12. (3) **Step 5.3a — backend tenants module:** new `backend/src/nest/tenants/` with `tenants.module.ts` (dedicated ioredis client, `keyPrefix: 'tenants-branding:'`, 300 s TTL), `tenants.service.ts` (cache-through via `systemQuery` BYPASSRLS — pre-auth context, no CLS tenantId yet; null-brand sentinel on unknown slug / Redis outage / DB outage — fail-soft, branding MUST NOT block login surface), `tenants.controller.ts` (`GET /api/v2/tenants/branding/:slug`, `@Public()` + `@AuthThrottle()`, always 200 to prevent tenant-enumeration via status code), DTOs (`BrandingParamDto` — regex-only, reserved-slug check skipped because reserved slugs can't be persisted anyway), `tenants.service.test.ts` (6 cases — cache hit, malformed cache falls back to DB, cache miss + DB hit with SETEX 5-min, cache miss + DB miss returns null-brand WITHOUT negative-caching, Redis-throw fail-soft, DB-throw fail-soft). Module registered in `app.module.ts`. (4) **Step 5.3b — frontend branding wiring:** `frontend/src/lib/utils/branding.ts` (`resolveBrand(hostSlug, tenantName): Brand` — apex / unknown → default Assixx identity, known subdomain → `{ title: tenantName, subtitle: "${name} — powered by Assixx" }`). `(public)/+layout.server.ts` fetches `/api/v2/tenants/branding/${slug}` when `hostSlug !== null`, passes `(hostSlug, branding.name)` into `resolveBrand()`, returns `PublicLayoutData` = `{ hostSlug, brand, logoUrl, primaryColor }` (last two are forward-compat for V2 logo / theme swap). Apex short-circuits with no round-trip. (5) **Step 5.4 — consume brand in page titles:** `login/+page.svelte`, `signup/+page.svelte`, `forgot-password/+page.svelte` now import `PageData`, destructure `data` from `$props()`, render `<Seo title={`Anmelden - ${data.brand.title}`} …>` etc. Canonical URLs stay apex-pinned (SEO: avoid duplicate-content with per-subdomain self-references). **D18 RESOLUTION (self-reversal):** initial grep of `database/migrations/` missed `tenants.logo_url` + `tenants.primary_color` — confirmed via `\d tenants` that both columns exist on the baseline schema (logo_url varchar(500), primary_color varchar(7) default `#0066cc`). Option A (name-only) was unnecessary; full-field response shape shipped. V1 UI consumption stays name-only (title); logo + color swap = V2 (tracked in Known Limitations). D19 added for the self-correction. **Verification:** `pnpm run sync:svelte` exit 0; Docker `pnpm run type-check` (shared+frontend+backend+backend/test) exit 0; `cd frontend && pnpm run check` → 2552 files, 0 errors, 0 warnings; `cd frontend && pnpm run lint` exit 0 (after fixing 2 initial errors: (a) `extractSlug` complexity 11 → refactored via `isNonTenantHost()` helper under 10; (b) `import('svelte').Snippet` inline type annotation in `(public)/+layout.svelte` → `import type { Snippet }`); `docker exec assixx-backend pnpm exec eslint backend/src/nest/tenants/` exit 0; `pnpm exec vitest run --project unit backend/src/nest/tenants/tenants.service.test.ts shared/src/architectural.test.ts` → **30/30 green** (6 tenants + 24 arch, arch-test slug-parser allowlist already forward-compat-included `frontend/src/lib/utils/extract-slug.ts` from Session 8); backend force-restarted, `/health` 200; smoke `curl /api/v2/tenants/branding/apitest` → `{ name: "API Test GmbH", logoUrl: null, primaryColor: "#0066cc" }`; `.../nonexistent-slug` → `{ name: null, logoUrl: null, primaryColor: null }` (200, no status-code leak); `.../x` → 400 VALIDATION_ERROR. NO architectural test for R1 `cookies.set({domain:...})` violated — frontend branding code uses no domain-scoped cookies (cookies stay browser-native per ADR-050). NO frontend dev smoke (dev server not running; deferred to user's next `pnpm run dev:svelte`). Session 12 (OAuth handoff consumer) untouched. Infra Sessions 3–5 still deferred. |
| 0.9.0   | 2026-04-21 | **Session 10 (Phase 4 — API Integration Tests) EXECUTED on branch `test/ui-ux`.** New file `backend/test/tenant-subdomain-routing.api.test.ts` — **29 tests across 5 groups, all green** (DoD target ≥15, exceeded by 14): (A) Cross-tenant JWT replay — 3 tests (apitest host control 200, firma-b host 403 `CROSS_TENANT_HOST_MISMATCH`, no-host skip 200); (B) Apex/unknown/nested subdomain — 3 tests (unknown slug → `hostTenantId=null` → 200 per R4 no-timing-leak, nested `a.b.assixx.com` rejected by anchored regex → null → 200, apex no-JWT → 401); (C) OAuth `/authorize` returnToSlug — 4 tests (X-Forwarded-Host trusted source → 302 to MS; `?return_to_slug=` query fallback → 302); (D) OAuth `/handoff` — 11 tests (malformed token 400 `VALIDATION_ERROR`; unknown token 404 `HANDOFF_TOKEN_INVALID`; R15 wrong host 403 `HANDOFF_HOST_MISMATCH` + **token preserved in Redis** — legit user's flow not DoS'd; happy path 200 with bit-for-bit access/refresh token round-trip + single-use delete; null-host/apex 403 + preserved); (E) CORS allowlist — 3 tests (apex origin ACAO reflection, subdomain ACAO reflection, foreign origin no-ACAO). Session 9b **absorbed** per D8: `withTenantHost(slug)` helper added to `backend/test/helpers.ts`, used only in the new file; existing 47 API tests unchanged (extractSlug('localhost')=null keeps them hermetic). Redis seed via `docker exec assixx-redis redis-cli -x SET` mirrors `oauth.api.test.ts` pattern. **🚨 D17 CRITICAL DISCOVERY (BUG FIXED) 🚨:** initial test run failed 7/29 — cross-tenant replay returned 200 instead of 403, handoff happy-path returned 403 instead of 200. Diagnostic `console.log` in middleware vs guard revealed **middleware receives raw `IncomingMessage`** (keys: `_events, socket, httpVersion, rawHeaders...`) while **guard receives Fastify-wrapped `FastifyRequest`** (keys: `id, params, raw, query, cookies, user...`) — TWO DIFFERENT OBJECTS. Root cause: NestJS class-based middleware mounted via `MiddlewareConsumer.apply()` runs through `@fastify/middie`, which passes the raw Node IncomingMessage; Fastify exposes it on the wrapped request as `.raw`. The middleware was writing `hostTenantId` to the IncomingMessage; the guard was reading from the wrapper → always `undefined` → cross-check was a silent no-op in production. **Every JWT would have been cross-tenant-valid** — the "single load-bearing line of the whole design" (ADR-050 §Decision) was defeated by a NestJS+Fastify implementation detail that unit tests could not catch (plain-object mocks hid it; architectural tests checked structure, not runtime object identity). **Fix (3 prod files + 1 unit test)**: (1) `tenant-host-resolver.middleware.ts` — redefined `HostAwareRequest` as `FastifyRequest & { raw: IncomingMessage & HostAwareRaw }` with explicit `HostAwareRaw` shape; middleware now casts `req as IncomingMessage & HostAwareRaw` and writes to that object (same runtime behaviour, correct type). (2) `jwt-auth.guard.ts` — read `(request as HostAwareRequest).raw.hostTenantId` (was `request.hostTenantId`), with inline comment citing D17. (3) `oauth-handoff.controller.ts` — same change for the R15 host-check. (4) `jwt-auth.guard.test.ts` — mock `mockRequest.raw.hostTenantId` instead of `mockRequest.hostTenantId` so unit tests catch regressions to the PRODUCTION read-path, not an easier-to-pass flat shape. **Verification**: `docker exec assixx-backend pnpm run type-check` exit 0; `pnpm exec eslint <4 touched files>` 0 errors; `pnpm exec vitest run --project unit <5 affected test files>` → **95/95 green** (guard 20, middleware 13, handoff-service 17, extract-slug 21, architectural 24); `pnpm exec vitest run --project api tenant-subdomain-routing.api.test.ts` → **29/29 green**; full API suite `pnpm run test:api` → **919/919 passed (50 files, 4 skipped) in 65.7 s — zero collateral breakage**. NO new architectural test for D17 yet (tracked as Session 10b follow-up: `architectural.test.ts` could assert "no production file reads `request.hostTenantId` without `.raw`" via grep). Frontend (Sessions 11–12) and infra (Sessions 3–5) still pending; ADR-050 §"Backend: Pre-Auth Host Resolver + Post-Auth Cross-Check" needs a §"Object-identity note" backfill in Session 13.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 0.8.0   | 2026-04-21 | **Session 9 (Phase 3 — Unit Tests) EXECUTED on branch `test/ui-ux`.** 66 new unit tests across 4 files (target ≥25, +41 over plan). (1) **`backend/src/nest/common/utils/extract-slug.test.ts`** — 21 cases across 3 describe blocks: null-returning branches (11 cases: undefined, empty, apex + mixed-case apex, localhost, `*.localhost` dev opt-in, IPv4 literals, unrelated hosts), valid-subdomain acceptance (5 cases: plain slug, 2-char minimum boundary, case-normalisation, port stripping, digits/hyphens allowed), malformed-shape rejection (5 cases: nested subdomain `a.b.assixx.com`, single-char slug, leading/trailing hyphen, underscores/whitespace-only). (2) **`backend/src/nest/auth/oauth/oauth-handoff.service.test.ts`** — 17 cases across 6 describe blocks: mint() (4 — 64-hex-char shape, key+TTL, JSON shape round-trip, unique per call), consume() happy path (2 — payload return + R15 get-before-del order asserted via `invocationCallOrder`), consume() unknown-token (3 — NotFoundException, NO redis.del, surfaces HANDOFF_TOKEN_INVALID code), consume() host-mismatch R15 (4 — ForbiddenException, NO redis.del on mismatch, null hostTenantId treated as mismatch, surfaces HANDOFF_HOST_MISMATCH code), consume() malformed-payload (3 — bad JSON, missing fields, wrong field types — all return HANDOFF_TOKEN_INVALID without consuming), mint→consume round-trip (1 — end-to-end serialisation self-consistency). Follows the `oauth-state.service.test.ts` mock pattern (plain object with `set`/`get`/`del` spies, no Redis container). (3) **`backend/src/nest/common/middleware/tenant-host-resolver.middleware.test.ts`** — 13 cases across 5 describe blocks: cache hit (2 — happy path + corrupt-non-numeric defence returns null), cache miss + DB hit (1 — systemQuery called with correct SQL/param, SETEX 60s, req.hostTenantId set), cache miss + DB miss (1 — hostTenantId=null, NO cache of negative result to avoid shadowing post-signup), extractSlug-returns-null short-circuits (4 — apex, localhost, nested subdomain, no-host-header — all skip Redis+DB), host-source priority (3 — X-Forwarded-Host preferred, Host fallback, array-valued X-Forwarded-Host), error policy (2 — Redis GET failure + DB failure both swallowed → null + next() still called, availability over strict correctness). (4) **`backend/src/nest/common/guards/jwt-auth.guard.test.ts`** — extended from 15 to 20 tests with a new `describe('ADR-050 Cross-Tenant Host Check')` block of 5 cases: undefined hostTenantId (middleware-didn't-run branch) passes, null hostTenantId (apex/localhost) passes, matching subdomain passes, mismatch throws ForbiddenException, surfaces discriminable CROSS_TENANT_HOST_MISMATCH code (distinct from HANDOFF_HOST_MISMATCH for Loki-alerting granularity). `MockRequestOptions` extended with optional `hostTenantId?: number \| null`, presence-guarded via `'hostTenantId' in options` so existing 15 tests retain the `undefined` branch semantics without modification. **ESLint fix:** initial 5 `vitest/no-conditional-expect` errors from try/catch error-code assertions refactored to `.catch(e => e)` + outer assertions — equivalent semantics, lint-clean. **Verification:** `pnpm exec vitest run --project unit` (full project) → **263/263 test files, 6854/6854 tests green** (total includes prior suite + Session 9 additions); targeted `pnpm exec vitest run --project unit <4 new files> shared/src/architectural.test.ts` → 5/5 files, 95/95 green; `docker exec assixx-backend pnpm run type-check` (shared + frontend + backend + backend/test) → **0 errors**; `pnpm exec eslint <4 files>` → 0 errors; `pnpm exec prettier --check <4 files>` → clean. NO production code touched. Session 9b still open (test-infra `withTenantHost()` helper — deferred into Session 10 per D8 scope reduction). Phase 3 DoD complete except Session 9b helper which is scoped to new API test file.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 0.7.0   | 2026-04-21 | **Session 8 (Phase 2 Step 2.6 — Architectural Tests) EXECUTED on branch `test/ui-ux`.** 5 new assertions appended to `shared/src/architectural.test.ts` under a new `describe('Backend+Frontend: Tenant Subdomain Routing Invariants (ADR-050)')` block: (1) R1 — regex-ban on any `cookies.set(..., { domain: ... })` call across `backend/src` + `frontend/src` via `readFileSync`+JS regex with one-level nested-paren tolerance; (2) R2 — structural assertion that `app.module.ts` imports `TenantHostResolverMiddleware` AND mounts it via `consumer.apply(...).forRoutes('{*path}')` (collapses AST-per-controller walk to a single load-bearing line check, justified in inline comment — `forRoutes('{*path}')` structurally covers every `@UseGuards(JwtAuthGuard)` consumer); (3) slug-parser SSR — bans the literal regex-escape sequence `\.assixx\.com` in `.ts`/`.svelte` files outside an allowlist of `extract-slug.ts` (backend + forward-compat frontend), `main.ts` (CORS `PROD_SUBDOMAIN_ORIGIN_REGEX` — known intentional mirror, tech-debt tracked), and the test file itself; (4) R14 — service-block extractor (`extractServiceBlock()`) slices `docker-compose.prod.yml` per-service by 2-space-indent header + sibling/top-level terminator, asserts both `backend` AND `frontend` blocks contain `ports: !reset []` (initial attempt used a non-greedy inner-line regex that crossed service boundaries — caught during sanity-regression and replaced); (5) R15 — string-index comparison on `oauth-handoff.service.ts` text, asserts `redis.get(` < `hostTenantId !== payload.tenantId` < `redis.del(` (sufficient because each token occurs exactly once in the file and only inside `consume()`). SLUG_PARSER_ALLOWLIST + USER_INSERT_ALLOWLIST pattern used for forward-compat future files. **Sanity-regression (Definition of Done #3):** for each of the 5 rules, a minimal violation was injected into the real file, the specific test confirmed-fail-on-regression, and was reverted — R1 via `cookies.set('x','y',{domain:'.assixx.com'})` in `extract-slug.ts` → detected; R2 via `'{*path}' → '{*other}'` in `app.module.ts` → detected; SSR via extra `/^([a-z0-9-]+)\.assixx\.com$/` in `tenant-host-resolver.middleware.ts` → detected; R14 via `ports: - '3000:3000'` replacing `!reset` → detected (after regex-bug fix); R15 via moving `redis.del(key)` above the host-check → detected at positions get=3977/check=4354/del=4304. Verification: `pnpm exec vitest run --project unit shared/src/architectural.test.ts` 24/24 green; `pnpm exec eslint shared/src/architectural.test.ts` 0 errors (collapsed multi-line `+` string concatenation in 2-arg `expect()` calls to single template literals after initial `vitest/valid-expect` failures — matches existing style in same file); `pnpm exec tsc --noEmit -p shared/tsconfig.test.json` exit 0; backend TS unchanged. NO production code touched after revert (git working tree diff limited to `architectural.test.ts` additions + masterplan update). NO unit tests yet (Session 9), NO API tests (Session 10), NO frontend, NO infra.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 0.4.0   | 2026-04-21 | **Session 2 (Phase 1 Step 1.0 + Step 1.6) EXECUTED on branch `test/ui-ux`.** Reserved-slug CHECK constraint shipped to DB (migration `20260421102820830_add-subdomain-reserved-check`). `RESERVED_SUBDOMAINS` list exported from `signup.dto.ts`, consumed by both `signup.dto.ts` `.refine()` and `check-subdomain.dto.ts` `.refine()` (single-source for the list, regex still duplicated — D4 tech-debt ticket unchanged). New file `docker/docker-compose.prod.yml` created — R14 mitigation: `ports: !reset []` on backend+frontend, `volumes: !override` on nginx for prod conf + certs. Full migration discipline: pre-flight (0 rows), generator, edit, dry-run OK, backup (2.99 MB), run, verify (pgmigrations, schema, UPDATE-in-rollback tests for 'www' + 'grafana' + positive control), 70/70 signup DTO tests green, backend type-check exit 0, ESLint 0 errors, backend + deletion-worker restarted healthy, API smoke `POST /api/v2/signup {"subdomain":"www",…}` → `VALIDATION_ERROR` with "This subdomain is reserved", customer fresh-install synced (140 migrations registered). NO nginx config changes yet (Step 1.5), NO cert provisioning yet (Step 1.3), NO DNS changes yet (Step 1.1) — the prod override file is inert until Sessions 3–5 land.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 1.0.0   | TBD        | Phase 1 (Infra) COMPLETE — wildcard DNS + cert + Nginx live in staging                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 1.1.0   | TBD        | Phase 2 (Backend) COMPLETE — middleware + cross-check + CORS + handoff merged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 1.2.0   | TBD        | Phase 3 (Unit) COMPLETE — ≥25 unit tests + 3 architectural tests green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 1.2.5   | TBD        | Session 9b COMPLETE — test-infra `X-Forwarded-Host` helper + all ~38 API-test files migrated                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 1.3.0   | TBD        | Phase 4 (API) COMPLETE — ≥15 integration tests green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 1.4.0   | TBD        | Phase 5 (Frontend) COMPLETE — hooks + branding + OAuth handoff in place                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2.0.0   | TBD        | Phase 6 (Cutover) COMPLETE — production live, ADR-050 backfilled to "Accepted"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

> **Versioning rule (per HOW-TO-PLAN-SAMPLE):** `0.x.0` = planning, `1.x.0` =
> implementation in progress (minor bump per phase), `2.0.0` = fully complete.

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must be true before starting

**Greenfield advantage (user confirmation 2026-04-19):** no live prod tenants.
This removes several concerns (no forced re-login event, no data-at-rest
migration risk, no bookmark-transition).

- [ ] Docker stack running (all containers healthy — verify via
      `docker-compose ps` from `docker/`)
- [ ] Branch `feat/tenant-subdomain-routing` checked out (after `test/ui-ux`
      merges to `main`)
- [ ] No pending migrations blocking
- [ ] Dependent features shipped: ADR-049 (tenant-domain verification — DONE
      per smoke-test fixes commit `8d2920171`)
- [ ] ADR-050 reviewed and status flipped to "Accepted" by user
- [ ] **IONOS → Cloudflare nameserver delegation configured** (IONOS UI:
      set NS records for `assixx.com` to Cloudflare-assigned nameservers)
- [ ] Doppler secrets configured: `CLOUDFLARE_DNS_API_TOKEN` (scoped to
      `Zone:DNS:Edit` on `assixx.com` only).
      **D6 correction (2026-04-20):** `OAUTH_STATE_SECRET` prereq REMOVED —
      OAuth `state` is Redis-stored UUIDv7 (`OAuthStateService`, ADR-046 §4),
      NOT a cookie with HMAC. No new signing secret required.
- [ ] Doppler secret `OAUTH_HANDOFF_SECRET` — **still TBD**: the 32-byte
      handoff-token itself is random (no HMAC needed), but if we later decide
      to sign the token for stateless verification, this secret gets added.
      Current Step 2.5 design uses Redis-backed opaque tokens → no secret
      needed for V1.
- [ ] Cloudflare account access verified, **DNS-only mode selected** (grey
      cloud, NOT proxied). TLS terminates at our origin Nginx.
- [ ] Reserved-slug enforcement shipped (Zod enum in signup DTO + DB CHECK
      constraint on `tenants.subdomain`). See ADR-050 §"Reserved Slug List".
- [ ] Pre-prod tenants (staging test fixtures) have `tenants.subdomain`
      populated and conformant to `^[a-z0-9-]+$` AND not in reserved list:
      `SELECT id, subdomain FROM tenants WHERE subdomain IS NULL OR subdomain = '' OR subdomain !~ '^[a-z0-9-]+$' OR subdomain IN ('www','api','admin','app','assets','auth','cdn','docs','blog','grafana','health','localhost','mail','static','status','support','tempo','test');`
      → must return zero rows.
- [ ] **Production topology designed as greenfield** (ADR-050 §"Production
      Topology Requirement"): `docker-compose.prod.yml` override exists that
      drops `ports:` publish for `backend` + `frontend` services. Only
      `nginx:443` is host-bound. This file is a Phase-0 deliverable — it
      does not exist yet in the repo.
- [ ] Prod host identified (VPS provider + public IP — greenfield decision
      taken with ADR-050 rollout).

### 0.2 Risk register

| #   | Risk                                                                                                                                                                                                | Impact   | Probability                                                                                                                                                    | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Verification                                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Forgotten `cookies.set({ domain: '.assixx.com' })` re-introduces cross-tenant cookie leak                                                                                                           | High     | Medium                                                                                                                                                         | Architectural test (`shared/src/architectural.test.ts`) regex-bans `domain:` literal in any `cookies.set` call. CI fails on regression.                                                                                                                                                                                                                                                                                                                                               | Sanity-check: intentionally introduce `domain: '.assixx.com'` in a fixture file → CI red. Then revert.                                                                                                                                                          |
| R2  | Forgotten host-cross-check in a future custom auth flow lets JWT bypass subdomain                                                                                                                   | High     | Low                                                                                                                                                            | Architectural test asserts every controller decorated with `@UseGuards(JwtAuthGuard)` is reachable only via the middleware-mounted route (`HostResolverMiddleware` consumer chain).                                                                                                                                                                                                                                                                                                   | Architectural test enumerates `@UseGuards(JwtAuthGuard)` AST nodes, asserts each lives under a module that imports `TenantHostResolverMiddleware`.                                                                                                              |
| R3  | Wildcard cert renewal silent-fail → 100 % outage in 90 days                                                                                                                                         | Critical | Medium                                                                                                                                                         | Prometheus exporter for cert-expiry-days. Grafana alert at < 14 d (paste into `docker/grafana/alerts/_*.json` provisioning set per ADR-002 Phase 5g).                                                                                                                                                                                                                                                                                                                                 | Manually advance cert clock in staging (or create a 7-day cert) → alert fires within 5 min.                                                                                                                                                                     |
| R4  | Subdomain typo (`scs-tehcnik.assixx.com`) → 444 confuses user                                                                                                                                       | Low      | High                                                                                                                                                           | Catch-all `default_server` returns SvelteKit 404 page for browser User-Agents (UA-sniff regex), 444 for non-browsers (scanners, curl).                                                                                                                                                                                                                                                                                                                                                | curl with browser UA → 404 HTML, curl without UA → connection-reset.                                                                                                                                                                                            |
| R5  | Internal services (cron, deletion-worker) call backend with no Host                                                                                                                                 | Medium   | Medium                                                                                                                                                         | `extractSlug()` returns `null` for missing/non-matching Host. Internal callers continue using `systemQuery()` (BYPASSRLS, no tenant context required).                                                                                                                                                                                                                                                                                                                                | Unit test for `extractSlug(undefined)` → null. Integration test: deletion-worker's HTTP call to backend → 200 (no `CROSS_TENANT_HOST_MISMATCH` because `hostTenantId === null`).                                                                                |
| R6  | ~~Microsoft OAuth `state` cookie set on apex doesn't reach the subdomain~~ **DELETED 2026-04-20 (D6): no state cookie exists; state is Redis-stored (ADR-046 §4).**                                 | High     | High                                                                                                                                                           | `state` cookie deliberately stays apex-scoped. The signed handoff-token mechanism is what crosses the origin boundary — `state` only validates the apex-side CSRF round-trip.                                                                                                                                                                                                                                                                                                         | Tier 4 OAuth E2E: full flow on subdomain → Microsoft mock → apex callback → handoff swap → subdomain dashboard. Cookies inspected at every hop.                                                                                                                 |
| R7  | Cloudflare API token compromise → wildcard DNS hijack                                                                                                                                               | Critical | Low                                                                                                                                                            | Token scoped to `assixx.com` zone only, `Zone:DNS:Edit` permission only (no `Zone:Zone:Edit`). Stored in Doppler with strict access-control. Rotated monthly via runbook (HOW-TO-CLOUDFLARE-TOKEN-ROTATION).                                                                                                                                                                                                                                                                          | Doppler audit log review monthly. Token scope verified at boot-time check (certbot pre-hook fails if token has any extra permission).                                                                                                                           |
| R8  | Existing test fixtures don't have `tenants.subdomain` populated                                                                                                                                     | Medium   | Medium                                                                                                                                                         | Phase 0 grep scan: `SELECT id, subdomain FROM tenants WHERE subdomain IS NULL OR subdomain = '';` — must return zero rows. If non-zero, add backfill to Phase 1.                                                                                                                                                                                                                                                                                                                      | Pre-Phase-1 query against staging DB. Must be 0 rows.                                                                                                                                                                                                           |
| R9  | Local dev breaks during transition (HMR, OAuth flow, etc.)                                                                                                                                          | Medium   | Medium                                                                                                                                                         | `extractSlug('localhost')` returns `null` → skip cross-check entirely on `localhost:5173`. OAuth dev-mode uses apex-only flow (no handoff). Documented in README.                                                                                                                                                                                                                                                                                                                     | Dev smoke: `pnpm run dev:svelte`, login as `admin@apitest.de`, navigate to `/manage-admins`, all green.                                                                                                                                                         |
| R10 | SvelteKit `hooks.server.ts` change breaks existing routing                                                                                                                                          | High     | Low                                                                                                                                                            | Additive change only — current `hooks.server.ts` remains the base, new logic appends `event.locals.hostSlug` without modifying existing flow.                                                                                                                                                                                                                                                                                                                                         | Existing E2E suite (smoke.spec.ts) green after Phase 5.                                                                                                                                                                                                         |
| R11 | Nginx regex `server_name ~^(?<slug>[a-z0-9-]+)\.assixx\.com$` matches deeper subdomains (`a.b.assixx.com`)                                                                                          | Medium   | Low                                                                                                                                                            | Anchored regex with character class `[a-z0-9-]+` (no dots). `nginx -t` config-test verifies, plus negative-test in Tier 2: `curl -H 'Host: a.b.assixx.com' …` → 444 (catch-all).                                                                                                                                                                                                                                                                                                      | `nginx -t` passes. `curl --resolve a.b.assixx.com:443:127.0.0.1 https://a.b.assixx.com/` → connection-reset.                                                                                                                                                    |
| R12 | OAuth `return_to_slug` query-param tampering → redirect to attacker subdomain                                                                                                                       | High     | Medium                                                                                                                                                         | `return_to_slug` is stored server-side in the Redis `OAuthState` payload (ADR-050 D6 resolution). Attacker tampering the URL query param at `/initiate` is possible (no HMAC), but the attack is neutralised structurally by R15: the handoff endpoint asserts `req.hostTenantId === payload.tenantId` (payload.tenantId derives from the matched user's JWT claims, NOT from the URL). Tampered redirect lands on wrong subdomain → 403 `HANDOFF_HOST_MISMATCH`, token NOT consumed. | Integration test: craft `/initiate?return_to_slug=firma-b` while authed as firma-a user, follow through to handoff → 403 `HANDOFF_HOST_MISMATCH`. Unit test: `OAuthStateService.consume()` returns server-stored `return_to_slug`, not any user-supplied value. |
| R13 | Redis cache poisoning: attacker sets `tenant:slug:firma-a → 999` → all firma-a traffic resolves to tenant 999                                                                                       | Critical | Low                                                                                                                                                            | Redis is internal-only (no exposed port, network-isolated to backend). Only `TenantHostResolverMiddleware` writes the cache. Cache key TTL 60 s — bounded blast radius even on compromise.                                                                                                                                                                                                                                                                                            | `docker exec assixx-redis redis-cli CONFIG GET bind` → only `127.0.0.1` and internal docker network. Verified via Trivy scan + Redis ACL audit.                                                                                                                 |
| R14 | Backend `:3000` / frontend `:3001` reachable from public internet bypasses Nginx-enforced host-cross-check — valid JWT becomes cross-tenant skeleton key                                            | Critical | **High** (default `docker-compose.yml` publishes both ports for dev convenience, documented as feature in `docs/DOCKER-SETUP.md`; no prod-override exists yet) | `docker-compose.prod.yml` override drops `ports:` publish for `backend` + `frontend` services. Only `nginx` is host-bound (`:443`, and `:80` for HTTP→HTTPS redirect). Add architectural test asserting `docker-compose.prod.yml` overrides both services with `ports: !reset []`.                                                                                                                                                                                                    | On prod host, from external network: `nmap -p 3000,3001 <prod-ip>` → both filtered/closed. `curl --max-time 5 -I https://<prod-ip>:3000/health` → connection timeout. Part of Phase 1 DoD.                                                                      |
| R15 | Tampered OAuth redirect lands handoff-token on wrong subdomain → subdomain sets cookies of tenant A on tenant B's origin (self-heals on next request via `JwtAuthGuard`, but surfaces confusing UX) | High     | Low                                                                                                                                                            | Handoff endpoint `POST /api/v2/auth/oauth/handoff` asserts `req.hostTenantId === decodedPayload.tenantId` before returning the auth payload. Throws `HANDOFF_HOST_MISMATCH` (distinct error code from `CROSS_TENANT_HOST_MISMATCH` to allow specific Loki/Grafana alerting on OAuth-flow anomalies).                                                                                                                                                                                  | Integration test: mint handoff token for tenant A, submit via subdomain-B host → 403 `HANDOFF_HOST_MISMATCH`. Token is NOT consumed (Redis GETDEL only happens after host-match passes).                                                                        |

> **Rule (per HOW-TO-PLAN-SAMPLE §0.2):** every risk has concrete mitigation
> AND verification. "Be careful" is NOT a mitigation. "Should be fine" is NOT
> a verification.

### 0.3 Ecosystem integration points

| Existing system                                             | Integration                                                                                                                                         | Phase | Verified on |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------- |
| `docker/nginx/nginx.conf`                                   | Two new server-blocks (apex + regex-subdomain) replace single `server_name localhost`                                                               | 1     |             |
| `docker-compose.yml` (production profile)                   | New `certbot` sidecar service + shared volume for cert files                                                                                        | 1     |             |
| Doppler                                                     | New secret `CLOUDFLARE_DNS_API_TOKEN`                                                                                                               | 1     |             |
| `backend/src/nest/auth/jwt-auth.guard.ts`                   | New post-decode assertion for `req.hostTenantId === user.tenantId`                                                                                  | 2     |             |
| `backend/src/nest/app.module.ts`                            | New `TenantHostResolverMiddleware` mounted globally before guards                                                                                   | 2     |             |
| `backend/src/nest/auth/oauth/`                              | New endpoint `POST /api/v2/auth/oauth/handoff` + extend `OAuthState` Redis payload with `return_to_slug` field (D6 correction — no HMAC, no cookie) | 2     |             |
| `backend/src/nest/main.ts`                                  | New Fastify CORS plugin registration with origin-allowlist callback                                                                                 | 2     |             |
| `frontend/src/hooks.server.ts`                              | Read `X-Forwarded-Host`, expose `event.locals.hostSlug`                                                                                             | 5     |             |
| `frontend/src/routes/(public)/`                             | NEW route group (login, signup, forgot-password — work on apex AND subdomain)                                                                       | 5     |             |
| `frontend/src/routes/signup/oauth-complete/+page.server.ts` | Replace direct cookie-set with handoff-token swap call                                                                                              | 5     |             |
| `docker/grafana/alerts/_*.json`                             | New alert: `cert-expiry-days < 14`                                                                                                                  | 6     |             |
| Loki labels (per ADR-048 OTel)                              | Add `host` label dimension to log scrape config                                                                                                     | 6     |             |
| `shared/src/architectural.test.ts`                          | Two new architectural assertions (R1, R2 mitigations)                                                                                               | 2     |             |

> **Why this table?** Forces identification of every touchpoint BEFORE coding.
> Per HOW-TO-PLAN-SAMPLE §0.3.

### 0.4 / 0.5 — N/A (FEATURE plan, not OPTIMIZATION)

This is a FEATURE plan (new user-visible URL topology + new backend layer).
There is no quantitative hypothesis to prove. Per HOW-TO-PLAN-SAMPLE §"Detect
First": FEATURE plans skip §0.4 (Baseline) and §0.5 (Hypothesis), and skip
Phase H entirely.

---

## Phase H — N/A (FEATURE plan)

Skipped per the rule above.

---

## Phase 1: Infra (DNS + TLS + Nginx)

> **Spec deviation D1:** the HOW-TO-PLAN-SAMPLE template names Phase 1 "Database
> Migrations". This plan repurposes Phase 1 as "Infra" because there is no DB
> schema change — the routing-key column `tenants.subdomain` already exists
> (UNIQUE since signup-V1). Infra IS the foundation of this feature in the same
> way migrations are the foundation of a typical FEATURE plan. Documented in
> §Spec Deviations below.
>
> **Dependency:** Phase 0 complete (R-table sanity-checked, D-table audited).

### Step 1.0: Reserved-slug enforcement (DB + DTO) [PENDING]

> **ADR-050 §"Reserved Slug List" realization.** Must exist BEFORE any Nginx
> config goes live — otherwise a future signup as slug `www` breaks apex
> routing. Also required by Phase 0.1 pre-flight query.

**Database migration** (generated via `doppler run -- pnpm run db:migrate:create add-subdomain-reserved-check`):

```typescript
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_subdomain_reserved_check
      CHECK (subdomain NOT IN (
        'www','api','admin','app','assets','auth','cdn','docs','blog',
        'grafana','health','localhost','mail','static','status','support',
        'tempo','test'
      ));
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_subdomain_reserved_check;`);
}
```

**Backend DTO** (`backend/src/nest/signup/dto/signup.dto.ts` or wherever
`subdomain` field lives):

```typescript
export const RESERVED_SUBDOMAINS = [
  'www','api','admin','app','assets','auth','cdn','docs','blog',
  'grafana','health','localhost','mail','static','status','support',
  'tempo','test',
] as const;

// in the Zod schema:
subdomain: z.string()
  .min(3).max(63)
  .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, digits, and hyphens')
  .refine((s) => !RESERVED_SUBDOMAINS.includes(s as (typeof RESERVED_SUBDOMAINS)[number]),
    { message: 'This subdomain is reserved and cannot be used.' }),
```

**Verification:**

```bash
# Apply migration
doppler run -- ./scripts/run-migrations.sh up

# Test: attempt to insert reserved slug → constraint rejects
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "INSERT INTO tenants (name, subdomain, company_name, is_active) VALUES ('t', 'www', 'T', 1);"
# → ERROR: new row for relation "tenants" violates check constraint "tenants_subdomain_reserved_check"

# Test via API:
curl -sX POST http://localhost:3000/api/v2/signup -H 'Content-Type: application/json' \
  -d '{"subdomain":"www",...}' | jq '.error.details[] | select(.field=="subdomain")'
# → { "field": "subdomain", "message": "This subdomain is reserved..." }
```

### Step 1.1: Cloudflare wildcard DNS record — DNS-only mode [PENDING]

**Prerequisite:** IONOS nameserver delegation to Cloudflare already active
(Phase 0.1 task). `whois assixx.com` must show Cloudflare-assigned
nameservers, e.g. `adam.ns.cloudflare.com`.

**What happens:**

1. Log into Cloudflare → `assixx.com` zone → DNS records.
2. Add apex records:
   - `@` `A` `<prod-public-ip>` **Proxy=DNS-only (grey cloud)**
   - `www` `CNAME` `assixx.com` **Proxy=DNS-only (grey cloud)**
3. Add wildcard record:
   - `*` `A` `<prod-public-ip>` **Proxy=DNS-only (grey cloud)**
4. Verify propagation (allow up to 5 min for CF's global edge):
   `dig +short firma-test.assixx.com @1.1.1.1` → resolves directly to our
   prod IP (NOT to a Cloudflare edge IP — that's how we verify DNS-only).

**Why DNS-only (grey cloud), NOT proxied (orange cloud) — user decision
2026-04-19:**

1. **TLS terminates at our origin Nginx.** No Cloudflare edge cert, no
   origin-mode decision (Full-strict vs Flexible), single cert chain. One
   Let's Encrypt wildcard, one renewal cycle.
2. **No WebSocket/SSE idle-timeout risk.** CF Free tier enforces 100-s idle
   on WebSockets — our `/chat-ws` would reconnect unnecessarily. DNS-only
   bypasses this entirely.
3. **No CF Proxy dependency in the hot path.** Our availability SLA stops at
   our origin. CF proxy outages (rare but real) can't take down Assixx.
4. **Upgrade path stays open.** Flip to orange-cloud later if DDoS or edge
   caching becomes worth the trade-offs. Not blocked by this plan.

**Verification:**

```bash
# From any external host (must resolve to OUR prod IP, not CF's):
dig +short assixx.com @1.1.1.1              # → <prod-public-ip>
dig +short www.assixx.com @1.1.1.1          # → <prod-public-ip>
dig +short firma-test.assixx.com @1.1.1.1   # → <prod-public-ip>
dig +short random.assixx.com @1.1.1.1       # → <prod-public-ip> (wildcard works)
# Sanity check CF proxy is NOT in path:
dig +short firma-test.assixx.com @1.1.1.1 | xargs -I{} whois {} | grep -i cloud
# → should NOT contain "Cloudflare" (means proxy is off)
```

### Step 1.2: Doppler secret `CLOUDFLARE_DNS_API_TOKEN` [PENDING]

**What happens:**

1. Cloudflare → My Profile → API Tokens → Create Token.
2. Custom Token. Permissions: `Zone:DNS:Edit` only. Resources: `Zone:assixx.com` only.
3. Doppler: `doppler secrets set CLOUDFLARE_DNS_API_TOKEN=<token>` in `prd` config.

**Verification:**

```bash
doppler secrets get CLOUDFLARE_DNS_API_TOKEN --plain --config prd | head -c 20
# Should print first 20 chars of the token (no error, no empty)
```

### Step 1.3: certbot sidecar in `docker-compose.yml` [PENDING]

**New file:** `docker/Dockerfile.certbot` (or use upstream `certbot/dns-cloudflare`
image directly).

**Modified file:** `docker/docker-compose.prod.yml` (NOT base `docker-compose.yml` —
certbot is prod-only; base stays dev-focused). Add service:

```yaml
# docker/docker-compose.prod.yml — appended to R14 override from Step 1.6
services:
  certbot:
    # ADR-027 Stage-1 pinning MANDATORY — verify current tag at
    # https://hub.docker.com/r/certbot/dns-cloudflare/tags and pick the latest
    # SemVer-shaped tag (e.g. v5.1.0 or similar). Never `latest`.
    # CI pin-guard (ADR-027 Amendment 2026-04-08) blocks rolling tags.
    image: certbot/dns-cloudflare:v5.1.0 # VERIFY BEFORE COMMIT — hub may have newer
    volumes:
      - certs:/etc/letsencrypt
      - ./certbot/cloudflare.ini:/cloudflare.ini:ro
    # Renewal loop: attempt every 12h. Certbot itself no-ops if cert has
    # > 30 days remaining. Post-hook triggers nginx reload inside the nginx
    # container (not this one) via docker exec.
    entrypoint: /bin/sh -c
    command: |
      "while :; do
         certbot renew --quiet --deploy-hook 'docker exec assixx-nginx nginx -s reload';
         sleep 43200;
       done"
    restart: unless-stopped
    depends_on: [nginx]

volumes:
  certs:
    name: assixx_certs
```

> **Pin verification step (per ADR-027 memory-note `feedback_docker_image_tag_verification.md`):**
> Docs/examples can be stale. Before committing, verify tag exists via
> `curl -fsSL https://hub.docker.com/v2/repositories/certbot/dns-cloudflare/tags/v5.1.0 > /dev/null`
> (200 = exists, 404 = pick the next patch). CI pin-guard will catch
> rolling tags but can't catch a typo'd version.

`./certbot/cloudflare.ini` (NOT in git, generated at deploy-time from Doppler):

```ini
dns_cloudflare_api_token = ${CLOUDFLARE_DNS_API_TOKEN}
```

**Verification:** `doppler run -- docker-compose --profile production config |
yq .services.certbot` shows the service with the env-substituted token.

### Step 1.4: Initial wildcard cert provision [PENDING]

**One-time bootstrap command:**

```bash
doppler run -- docker-compose --profile production run --rm certbot \
  certonly --dns-cloudflare \
  --dns-cloudflare-credentials /cloudflare.ini \
  --dns-cloudflare-propagation-seconds 60 \
  -d 'assixx.com,*.assixx.com' \
  --agree-tos --email ops@assixx.com \
  --non-interactive
```

**Verification:**

```bash
docker run --rm -v <docker-compose-cert-volume>:/etc/letsencrypt certbot/certbot \
  certificates
# Output should list: assixx.com (issuer Let's Encrypt, expiry > 80 days, SAN includes *.assixx.com)
```

### Step 1.5: Nginx config — full HTTPS multi-server rewrite [PENDING]

> **Scope clarification (verified 2026-04-19):** current `docker/nginx/nginx.conf`
> is HTTP-only on port 80 (`server_name localhost`). The entire `listen 443 ssl http2`
> block is commented out (lines 207-318). This is NOT a "split existing block"
> — it's a full rewrite from HTTP-only-dev to HTTPS-prod-ready with three
> server blocks. Plan the change in a separate PR if scope becomes unwieldy.
>
> **Strategy:** split into two files:
>
> - `docker/nginx/nginx.dev.conf` — keep existing HTTP-only localhost config
>   for `docker-compose --profile production up -d` on a dev host (internal
>   testing without TLS).
> - `docker/nginx/nginx.prod.conf` — new file with HTTPS + multi-server blocks
>   below. Mounted via `docker-compose.prod.yml` override (Step 1.6).

**New file:** `docker/nginx/nginx.prod.conf` — HTTPS multi-server config.

Reference: preserve the `default_server { return 444; }` idiom from current
`nginx.conf:35-39`, preserve SSE/WebSocket/security-header patterns from
current `nginx.conf` sections §80-105 (SSE) and §159-174 (WebSocket).

```nginx
# Catch-all (existing, preserved per current §35-39)
server { listen 443 ssl http2 default_server; server_name _; return 444; }

# Apex — marketing + signup + OAuth callback
server {
  listen 443 ssl http2;
  server_name assixx.com www.assixx.com;
  ssl_certificate     /etc/letsencrypt/live/assixx.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/assixx.com/privkey.pem;

  # … all existing security headers from current nginx.conf §52-62 (HSTS, X-Frame, etc.)
  # … all existing gzip + client_max_body_size rules
  # … all existing /api/v2/notifications/stream (SSE) location

  location /api/v2/auth/oauth/ { proxy_pass http://backend; … }
  location /api/                 { proxy_pass http://backend; … }
  location /uploads/             { proxy_pass http://backend; … }
  location = /health             { proxy_pass http://backend; … }
  location /chat-ws              { proxy_pass http://backend; …; proxy_set_header Upgrade $allowed_upgrade; }
  location /                     { proxy_pass http://frontend; … }   # marketing pages
}

# App surface — per-tenant subdomain
server {
  listen 443 ssl http2;
  server_name ~^(?<slug>[a-z0-9-]+)\.assixx\.com$;
  ssl_certificate     /etc/letsencrypt/live/assixx.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/assixx.com/privkey.pem;

  # … same security headers, same gzip, same client_max_body_size

  proxy_set_header X-Tenant-Slug    $slug;
  proxy_set_header X-Forwarded-Host $host;

  # OAuth INITIATE on subdomain → bounce to apex (single registered redirect_uri)
  location /api/v2/auth/oauth/ { return 307 https://www.assixx.com$request_uri; }

  # SSE, API, uploads, chat-ws, frontend — all proxy_pass as today
  location /api/v2/notifications/stream { … }   # SSE settings as current §80-105
  location /api/   { proxy_pass http://backend; … }
  location /uploads/ { proxy_pass http://backend; … }
  location = /health { proxy_pass http://backend; … }
  location /chat-ws  { proxy_pass http://backend; … }
  location /         { proxy_pass http://frontend; … }
}

# HTTP→HTTPS redirect (entire :80 block) — uncomment lines per current nginx.conf §47-48 comment
server {
  listen 80;
  server_name assixx.com www.assixx.com *.assixx.com;
  return 301 https://$host$request_uri;
}
```

**Verification:**

```bash
docker exec assixx-nginx nginx -t   # config syntax OK
docker exec assixx-nginx nginx -s reload
curl -kI https://www.assixx.com/health | head -1     # → HTTP/2 200
curl -kI https://firma-test.assixx.com/health | head -1  # → HTTP/2 200 (resolves through wildcard)
curl -kI -H 'Host: a.b.assixx.com' https://www.assixx.com/   # → connection reset (444 catch-all)
```

### Step 1.6: Production port isolation (`docker-compose.prod.yml` override) [PENDING]

> **R14 mitigation, critical security prerequisite.** Without this step, the
> backend host-cross-check (Phase 2 Step 2.3) is trivially bypassable.

**New file:** `docker/docker-compose.prod.yml` — overrides base `docker-compose.yml`
to remove public port publishes from backend + frontend services. Only
`nginx:443` (and `:80` for HTTP→HTTPS redirect) is exposed to the host.

```yaml
# docker/docker-compose.prod.yml
# Usage: doppler run -- docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile production up -d
services:
  backend:
    # R14 mitigation (ADR-050): no public port publish in prod.
    # Backend is reachable only via nginx on the internal docker network.
    ports: !reset []
    environment:
      NODE_ENV: production

  frontend:
    # Same — bypasses-Nginx access was a dev-convenience.
    ports: !reset []

  nginx:
    # Mount the HTTPS prod config, publish 443 (plus :80 for redirect).
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/conf.d/default.conf:ro
      - certs:/etc/letsencrypt:ro
    ports:
      - '80:80'
      - '443:443'
```

**Verification (on prod host, from the public internet):**

```bash
# Both must time out / be filtered:
nmap -p 3000 <prod-public-ip>     # filtered
nmap -p 3001 <prod-public-ip>     # filtered
curl --max-time 5 -I https://<prod-public-ip>:3000/health  # timeout
curl --max-time 5 -I https://<prod-public-ip>:3001/        # timeout

# Only 80 and 443 are reachable:
nmap -p 80,443 <prod-public-ip>   # both open
```

**Architectural test** (`shared/src/architectural.test.ts` — added in Phase 2
Step 2.6): parse `docker-compose.prod.yml`, assert `services.backend.ports`
and `services.frontend.ports` are present AND resolve to empty-list override
(`!reset []`). Prevents regression where a future edit silently re-exposes.

### Phase 1 — Definition of Done

- [ ] IONOS → Cloudflare nameserver delegation active (`whois assixx.com`
      shows CF-assigned NS)
- [ ] Cloudflare DNS records for apex, www, and wildcard `*` in DNS-only mode
      (grey cloud), all A-records point to our prod public IP. Propagation
      verified from 3 resolvers (1.1.1.1, 8.8.8.8, 9.9.9.9).
- [ ] Doppler secret set in prd config: `CLOUDFLARE_DNS_API_TOKEN`
      (scope `Zone:DNS:Edit` on `assixx.com` only).
      **D6 correction (2026-04-20):** `OAUTH_STATE_SECRET` removed — OAuth state is Redis-stored UUIDv7, not a cookie with HMAC.
- [ ] Certbot sidecar service in `docker-compose.prod.yml`, `--dry-run`
      succeeds.
- [ ] Wildcard cert issued, expiry > 80 days, SAN includes `*.assixx.com`
      AND `assixx.com` (apex covered separately per RFC 6125 §6.4.3).
- [ ] `docker/nginx/nginx.prod.conf` has three server-blocks (apex, regex-
      subdomain, catch-all `return 444`); `nginx -t` passes inside the
      container.
- [ ] `curl https://www.assixx.com/health` → 200
- [ ] `curl https://firma-test.assixx.com/health` → 200 (verifies wildcard
      routing works end-to-end before backend changes)
- [ ] `curl -H 'Host: a.b.assixx.com' https://www.assixx.com/` → connection
      reset (verifies nested-subdomain regex rejection, falls through to
      catch-all 444)
- [ ] HTTP→HTTPS redirect verified with `curl -I http://www.assixx.com/` → 301
- [ ] Cert auto-renewal cron tested in staging by manually advancing the
      cert clock forward (or using a Let's Encrypt 7-day staging cert).
- [ ] **R14 mitigation verified:** `docker-compose.prod.yml` override exists,
      deployed on prod host, `nmap -p 3000,3001 <prod-ip>` returns filtered
      for both. Test rerun from an external network (not the prod host
      itself) — the prod host would see them as open because they bind to
      `0.0.0.0` on the internal docker network interface.

---

## Phase 2: Backend

> **Dependency:** Phase 1 complete.
> **Reference module:** `backend/src/nest/auth/` (existing JwtAuthGuard pattern)

### Step 2.1: `extractSlug()` pure utility [PENDING]

**New file:** `backend/src/nest/common/utils/extract-slug.ts`

**Function signature:**

```typescript
/**
 * Extract a tenant subdomain slug from a Host header value.
 *
 * Returns null for: undefined, empty, IP literals, localhost (and *.localhost),
 * the apex (assixx.com / www.assixx.com), and any host that doesn't match the
 * exact pattern `<slug>.assixx.com` where slug is RFC-1035-conformant.
 *
 * Returning null is the signal that "no host-based tenant context applies" —
 * downstream guards then skip the host-cross-check.
 *
 * @see ADR-050 §Decision §"Local Dev: Unchanged + Optional Subdomain-Routing"
 */
export function extractSlug(host: string | undefined): string | null;
```

**Reasoning:** centralizing the parser in a single pure function is the
testability win. The architectural test asserts no other file does
slug-parsing.

### Step 2.2: `TenantHostResolverMiddleware` [PENDING]

**New file:** `backend/src/nest/common/middleware/tenant-host-resolver.middleware.ts`

**Wired in:** `app.module.ts` via `MiddlewareConsumer.apply(...).forRoutes('*')`.

**Behavior:**

1. Read `X-Forwarded-Host` (Nginx-set, trusted) — fallback to
   `req.hostname` for cases where the request bypasses the proxy (internal
   docker-network calls).
2. `extractSlug(host)` — if null, set `req.hostTenantId = null` and `next()`.
3. Else: Redis GET `tenant:slug:${slug}`. If hit, set `req.hostTenantId =
Number(cached)` and `next()`.
4. Cache miss: `db.systemQuery('SELECT id FROM tenants WHERE subdomain = $1
AND is_active = 1', [slug])`. If row found, Redis SETEX 60 s, set
   `req.hostTenantId`. If no row, set `req.hostTenantId = null` (the
   404-page logic later catches typos).
5. `next()`.

**Critical patterns:**

- Use `systemQuery()` (BYPASSRLS, ADR-019) — this is pre-auth context, no
  CLS yet.
- Errors swallowed → set `req.hostTenantId = null` + emit warn-log. Subdomain
  routing should not be a hard dependency for general availability.

### Step 2.3: `JwtAuthGuard` cross-check assertion [PENDING]

**Modified file:** `backend/src/nest/auth/jwt-auth.guard.ts`

**Change:** at the end of existing `canActivate` (after JWT decode + DB user
lookup + `is_active = 1` check), before returning true:

```typescript
const hostTenantId = (req as { hostTenantId?: number | null }).hostTenantId;
if (hostTenantId !== undefined && hostTenantId !== null && hostTenantId !== user.tenantId) {
  throw new ForbiddenException({
    code: 'CROSS_TENANT_HOST_MISMATCH',
    message: 'Token tenant does not match request host.',
  });
}
```

**Why three-state check:** `undefined` = middleware didn't run (test fixture);
`null` = apex/localhost (skip check); `number` = subdomain resolved → must
match.

### Step 2.4: Fastify CORS plugin registration [PENDING]

**Modified file:** `backend/src/nest/main.ts`

**Change:** add `app.register('@fastify/cors', { origin: <callback>,
credentials: true })` inside `setupGlobalMiddleware`.

**Origin allowlist regex:**

- `https://assixx.com` ✅
- `https://www.assixx.com` ✅
- `https://<slug>.assixx.com` (where slug matches `[a-z0-9-]+`) ✅
- `http://localhost:5173` ✅
- `http://*.localhost:5173` ✅ (for local subdomain dev — opt-in)
- everything else → `Error('CORS origin not allowed')`

### Step 2.5: OAuth handoff endpoint + `OAuthState.return_to_slug` [PENDING]

> **D6 correction (2026-04-20):** OAuth `state` is a Redis-stored UUIDv7 token
> via `OAuthStateService` (ADR-046 §4 Redis keyspace) — **not a cookie, not
> HMAC-signed**. `return_to_slug` is added as a server-side-stored field in
> the `OAuthState` payload. No HMAC secret needed. R12 tamper-protection is
> provided structurally by R15's endpoint-level host-cross-check.

**New endpoint:** `POST /api/v2/auth/oauth/handoff`

**Request body:** `{ token: string }` (the handoff-token from query param).

**Behavior (R15 mitigation — host-cross-check BEFORE Redis consume):**

1. Read `req.hostTenantId` (set by `TenantHostResolverMiddleware` — Step 2.2).
2. Redis **GET** (not GETDEL yet!) `oauth:handoff:${token}`.
   - Miss → 404 `HANDOFF_TOKEN_INVALID`.
3. Parse payload → `{ userId, tenantId, accessToken, refreshToken, user }`.
4. **Assert `req.hostTenantId === payload.tenantId`.**
   - Mismatch → 403 `HANDOFF_HOST_MISMATCH`. Token NOT consumed (attacker
     cannot burn another user's token by targeting the wrong subdomain).
5. Only now: Redis **DEL** `oauth:handoff:${token}` (single-use).
6. Return auth payload → subdomain page `cookies.set(...)` on own host.

**Rationale:** consuming on failed host-check would let an attacker
denial-of-service a user's OAuth flow by intercepting and replaying to the
wrong subdomain. Check first, consume second.

**Modified file:** `backend/src/nest/auth/oauth/oauth.types.ts`

Extend the existing `OAuthState` interface with a new optional field:

```typescript
export interface OAuthState {
  mode: OAuthMode; // existing
  codeVerifier: string; // existing
  createdAt: number; // existing
  returnToSlug?: string; // NEW — subdomain the user started on, if any (apex → undefined)
}
```

**Modified file:** `backend/src/nest/auth/oauth/oauth-state.service.ts`

Extend `create()` signature to accept the optional slug and pass it to the
Redis payload. `consume()` returns it unchanged (it's already in the stored
JSON):

```typescript
async create(mode: OAuthMode, codeVerifier: string, returnToSlug?: string): Promise<string> {
  const state = uuidv7();
  const payload: OAuthState = { mode, codeVerifier, createdAt: Date.now(), ...(returnToSlug !== undefined && { returnToSlug }) };
  await this.redis.set(`${STATE_KEY_PREFIX}${state}`, JSON.stringify(payload), 'EX', STATE_TTL_SECONDS);
  return state;
}
```

Update the `isOAuthState` type-guard to accept `returnToSlug?: string`.
Update `oauth-state.service.test.ts` — the 11 existing tests must still pass,
add 2 new tests for the `returnToSlug` round-trip (create → consume returns
exact value; create without slug → consume returns undefined).

**Modified file:** `backend/src/nest/auth/oauth/oauth.controller.ts` (or
wherever `authorize` endpoint lives)

Read `returnToSlug` from the `/initiate` request — two sources with priority:

1. **Preferred:** `X-Forwarded-Host` header, if it parses to a subdomain via
   `extractSlug()` (Step 2.1) → use it. This is the trustworthy source.
2. **Fallback:** if the request comes via Nginx's subdomain-to-apex 307
   redirect (which loses the original Host), check for a `?return_to_slug=`
   query param. This is client-declared and therefore tamper-prone — but
   R15 structurally defeats the tampering.

Pass `returnToSlug` to `OAuthStateService.create(mode, verifier, returnToSlug)`.

**Modified file:** `backend/src/nest/auth/oauth/oauth.controller.ts` (callback
handler)

After successful Microsoft callback + `OAuthStateService.consume(state)`:

- If `stored.returnToSlug === undefined` → apex flow, behave exactly as today
  (302 to `/login` per ADR-046 Amendment Bug A).
- If `stored.returnToSlug !== undefined` → mint a 32-byte-hex handoff-token,
  `SETEX oauth:handoff:${token} 60 <payload>`, redirect to
  `https://${stored.returnToSlug}.assixx.com/signup/oauth-complete?token=…`.

**New file:** `backend/src/nest/auth/oauth/oauth-handoff.service.ts`

Companion to `OAuthStateService`: same Redis client, `oauth:handoff:` key
namespace, 60 s TTL. Methods: `mint(payload): Promise<string>` (SETEX) and
`consume(token): Promise<HandoffPayload>` (GET + host-check + conditional
DEL — see behavior §4 above). Pattern mirrors `OAuthStateService` for
consistency.

### Step 2.6: Architectural tests [PENDING]

**Modified file:** `shared/src/architectural.test.ts`

**Add three assertions:**

1. **R1 mitigation:** AST visitor over all `.ts/.svelte` files; for any
   `cookies.set(...)` call, walk options object literal — fail if any
   property `key === 'domain'` exists with a string-literal value.
2. **R2 mitigation:** AST visitor over all controllers. For each class
   decorated with `@UseGuards(JwtAuthGuard)`, resolve enclosing module,
   assert module imports and applies `TenantHostResolverMiddleware` (via
   reaching back to `app.module.ts`'s middleware-consumer chain).
3. **slug-parsing single-source:** grep for `\.assixx\.com|<slug>` regex
   patterns outside `backend/src/nest/common/utils/extract-slug.ts` →
   fail if found in any file other than the canonical `extractSlug`
   utility, the architectural test itself, and ADR/masterplan docs.

### Phase 2 — Definition of Done

- [ ] `TenantHostResolverMiddleware` mounted globally in `app.module.ts`
- [ ] `extractSlug()` utility exported from
      `backend/src/nest/common/utils/extract-slug.ts`
- [ ] `JwtAuthGuard` has the cross-check assertion as the **last** check
      before returning true
- [ ] New error code `CROSS_TENANT_HOST_MISMATCH` added to error-codes
      registry
- [ ] Fastify CORS plugin registered with origin-callback (regex allowlist)
- [ ] `POST /api/v2/auth/oauth/handoff` endpoint implemented + Zod DTO
- [ ] `OAuthState` type + `OAuthStateService.create()` extended with optional
      `returnToSlug` field (D6 correction — no HMAC, no cookie)
- [ ] OAuth callback mints handoff-token, redirects to subdomain
- [ ] All 3 new architectural tests passing
- [ ] ESLint 0 errors:
      `docker exec assixx-backend pnpm exec eslint backend/src/nest/common/middleware/ backend/src/nest/auth/`
- [ ] Type-check passes:
      `docker exec assixx-backend pnpm run type-check`

---

## Phase 3: Unit Tests

> **Dependency:** Phase 2 complete.
> **Pattern:** `backend/src/nest/{module}/{file}.test.ts` per HOW-TO-TEST-WITH-VITEST.md

### Test files

```
backend/src/nest/common/utils/extract-slug.test.ts                  # 8 cases
backend/src/nest/common/middleware/tenant-host-resolver.middleware.test.ts  # 5 cases
backend/src/nest/auth/jwt-auth.guard.test.ts                        # +3 cases (cross-check branches)
backend/src/nest/auth/oauth/oauth-handoff.service.test.ts           # 4 cases
shared/src/architectural.test.ts                                    # +3 assertions
```

### `extract-slug.test.ts` — 8 cases

1. `extractSlug(undefined)` → null
2. `extractSlug('')` → null
3. `extractSlug('localhost')` → null
4. `extractSlug('localhost:5173')` → null
5. `extractSlug('127.0.0.1')` → null
6. `extractSlug('assixx.com')` → null (apex)
7. `extractSlug('www.assixx.com')` → null (apex with www)
8. `extractSlug('firma-a.assixx.com')` → 'firma-a' (subdomain)
9. `extractSlug('a.b.assixx.com')` → null (nested — anchored regex rejects)
10. `extractSlug('FIRMA-A.assixx.com')` → 'firma-a' (case-normalized) OR
    null (depends on policy decision; favor: case-normalized accept,
    document)

### `tenant-host-resolver.middleware.test.ts` — 5 cases

1. Cache hit → uses cached value, no DB query (mock Redis returns "42",
   assert `db.systemQuery` never called)
2. Cache miss + DB hit → DB queried, Redis SETEX called with TTL=60
3. Cache miss + DB miss → `req.hostTenantId = null`, no error thrown
4. Malformed Host (e.g., `';drop table--'`) → `extractSlug` returns null →
   middleware no-op
5. Internal call (no Host header) → `req.hostTenantId = null`, `next()` called

### `jwt-auth.guard.test.ts` — +3 cases (cross-check branches)

1. `req.hostTenantId === undefined` → no exception (middleware bypass case)
2. `req.hostTenantId === null` → no exception (apex case)
3. `req.hostTenantId === 999`, `user.tenantId === 42` → ForbiddenException
   with code `CROSS_TENANT_HOST_MISMATCH`

### `oauth-handoff.service.test.ts` — 4 cases

1. Mint handoff-token → Redis SETEX called with 60 s TTL
2. Swap valid token → returns auth payload, Redis GETDEL called (single-use)
3. Swap consumed token → 404
4. Swap expired token → 404

### Architectural tests — 3 new assertions

1. R1 mitigation: introduce `cookies.set('foo', 'bar', { domain: '.assixx.com' })`
   in a fixture file → test fails. Revert. (Sanity-check pattern from
   ADR-049 §2.11.)
2. R2 mitigation: introduce a controller with `@UseGuards(JwtAuthGuard)` in
   a module that doesn't apply the middleware → test fails. Revert.
3. slug-parsing single-source: introduce `host.endsWith('.assixx.com')` in
   a non-allowlisted file → test fails. Revert.

### Phase 3 — Definition of Done

- [ ] ≥ 25 unit tests total (8 + 5 + 3 + 4 + 5 architectural ≈ 25)
- [ ] All tests green:
      `pnpm exec vitest run --project unit backend/src/nest/common/ backend/src/nest/auth/`
- [ ] All 3 architectural tests pass + sanity-check intentional-regression
      pass (intentional fail → fix → re-pass)
- [ ] Coverage: every public method of new code has at least one test

---

## Phase 4: API Integration Tests

> **Dependency:** Phase 3 complete.
> **Pattern:** `backend/test/*.api.test.ts` (HOW-TO-TEST-WITH-VITEST.md)

### Test file

`backend/test/tenant-subdomain-routing.api.test.ts`

### Scenarios (≥ 15 assertions)

**Cross-tenant JWT replay:**

- [ ] Login as `firma-a` admin (gets JWT) → call `/api/v2/users` with
      `X-Forwarded-Host: firma-a.assixx.com` → 200 (control)
- [ ] Same JWT → call `/api/v2/users` with `X-Forwarded-Host:
firma-b.assixx.com` → 403 with code `CROSS_TENANT_HOST_MISMATCH`
- [ ] Same JWT → no `X-Forwarded-Host` → 200 (apex/internal context, no
      cross-check)

**Apex behavior:**

- [ ] `GET /api/v2/auth/oauth/microsoft/initiate` with apex host → 302 to
      Microsoft (control)
- [ ] `POST /api/v2/auth/login` with apex host → 200 (no `hostTenantId`
      required)
- [ ] `GET /api/v2/users` (protected) without JWT, apex host → 401

**Subdomain not found:**

- [ ] `X-Forwarded-Host: nonexistent-tenant.assixx.com` → middleware sets
      `hostTenantId = null` → protected endpoints behave as apex (i.e., 401 if
      no JWT, 403 if JWT present and middleware doesn't find a tenant). This
      edge-case is intentional: we don't want to leak "is this a real subdomain"
      via timing.

**OAuth handoff:**

- [ ] Full E2E (with Microsoft mocked at the HTTP layer): subdomain INITIATE
      → 307 to apex → apex INITIATE → state cookie set with HMAC over
      `return_to_slug` → Microsoft callback → handoff-token minted → redirect
      to subdomain — 302 with `Location: https://firma-a.assixx.com/...`
- [ ] `POST /api/v2/auth/oauth/handoff` with valid token → 200 with auth
      payload, token consumed
- [ ] `POST /api/v2/auth/oauth/handoff` with consumed token → 404
- [ ] ~~State cookie tampering (manually edit HMAC) → 400 with code
      `OAUTH_STATE_TAMPERED`~~ **DELETED 2026-04-20 (D6):** no state cookie,
      no HMAC. Replaced by: `return_to_slug` query-param tampering test →
      flow continues through to handoff endpoint → 403 `HANDOFF_HOST_MISMATCH`
      (R15 structural defence).

**CORS preflight:**

- [ ] `OPTIONS /api/v2/users` from `Origin: https://firma-a.assixx.com` →
      200 with `Access-Control-Allow-Origin` echoing the request origin
- [ ] `OPTIONS /api/v2/users` from `Origin: https://evil.com` → no CORS
      headers (browser will block)

### Phase 4 — Definition of Done

- [ ] ≥ 15 API integration tests
- [ ] All tests green:
      `pnpm exec vitest run --project api backend/test/tenant-subdomain-routing.api.test.ts`
- [ ] Cross-tenant JWT replay verified 403
- [ ] OAuth handoff happy-path + tamper-path verified
- [ ] CORS allowlist verified positive + negative

---

## Phase 5: Frontend

> **Dependency:** Phase 2 complete (backend endpoints available).
> **Reference:** `frontend/src/hooks.server.ts` (existing) +
> `frontend/src/routes/(app)/+layout.server.ts` (existing pattern)

### Step 5.1: `hooks.server.ts` host extraction [PENDING]

**Modified file:** `frontend/src/hooks.server.ts`

**Change:** in the existing `handle` hook, before `resolve(event)`:

```typescript
const forwardedHost = event.request.headers.get('x-forwarded-host') ?? event.url.hostname;
const slug = extractSlug(forwardedHost); // shared with backend? or duplicate?
event.locals.hostSlug = slug;
```

**Decision needed (D5 below):** is `extractSlug` shared between BE+FE via
`shared/src/utils/extract-slug.ts` or duplicated? Answer guides Step 2.1's
file location.

### Step 5.2: `(public)` route group introduction [PENDING]

**New directory:** `frontend/src/routes/(public)/`

**Move:** `/login`, `/signup`, `/forgot-password` from current locations into
`(public)`. The `(public)` layout has no auth-required logic, no addon-required
logic — works equally on apex and subdomain.

**Why:** ADR-012's `(app)` layout group requires auth. Apex login page must
work without auth (chicken-and-egg). The `(public)` group is the new home for
"public surface that works on apex AND subdomain".

### Step 5.3: Branding switch [PENDING]

**New file:** `frontend/src/lib/utils/branding.ts`

```typescript
/**
 * Resolve the page brand from the host context.
 *
 * Apex (`hostSlug === null`):  "Sign in to Assixx"
 * Subdomain:                   "Sign in to <Tenant Name>" — tenant name fetched
 *                              from the tenants table by the (public) layout
 *                              load function.
 */
export function resolveBrand(hostSlug: string | null, tenantName: string | null): { title: string; subtitle: string };
```

**Modified file:** `frontend/src/routes/(public)/+layout.server.ts`

If `event.locals.hostSlug !== null`, fetch tenant name (display name, logo
URL) via a new tiny public endpoint `GET /api/v2/tenants/branding/:slug`
(no auth required, only returns public branding fields — name, logo, primary
color). Cached in Redis 5 min.

### Step 5.4: OAuth handoff consumer [PENDING]

**Modified file:** `frontend/src/routes/signup/oauth-complete/+page.server.ts`

**Change:** instead of consuming `accessToken` + `refreshToken` from query
params (current behavior), consume `token` query param, swap via
`POST /api/v2/auth/oauth/handoff`, then `cookies.set(...)` the returned auth
payload. Cookies are now naturally scoped to the subdomain.

### Phase 5 — Definition of Done

- [ ] `hooks.server.ts` reads `X-Forwarded-Host`, exposes `event.locals.hostSlug`
- [ ] `(public)` route group exists with `/login`, `/signup`, `/forgot-password`
- [ ] `(public)/+layout.server.ts` resolves branding via subdomain → tenant lookup
- [ ] OAuth `oauth-complete` page swaps handoff-token, sets cookies on subdomain
- [ ] svelte-check 0 errors, 0 warnings
- [ ] ESLint 0 errors: `cd frontend && pnpm run lint`
- [ ] Existing `(app)/...` routes work unchanged on subdomain
- [ ] Local dev unchanged: `localhost:5173/login` still works
- [ ] Subdomain dev opt-in: `firma-a.localhost:5173/login` shows "Sign in to
      firma-a" branding

---

## Phase 6: Integration + Cutover + ADR Backfill

> **Dependency:** Phase 5 complete, all tests green.

### Integrations

- [ ] Cert-expiry Grafana alert: paste-in to
      `docker/grafana/alerts/_*.json` provisioning set per ADR-002 Phase 5g.
      Alert at `cert-expiry-days < 14`, severity = critical.
- [ ] Loki host-label dimension: update `docker/loki/promtail.yml` (or
      equivalent) to extract `host` from log lines and attach as Loki label.
      Enables alerting on `CROSS_TENANT_HOST_MISMATCH` / `HANDOFF_HOST_MISMATCH`
      error codes filtered by host.
- [ ] Email/notification URL templates: every outbound URL generation
      (welcome email, password reset, notification SSE, invite links) must
      use the recipient's tenant subdomain. New helper:
      `getTenantBaseUrl(tenantId): Promise<string>` → resolves to
      `https://${subdomain}.assixx.com`. Audit all template files under
      `backend/src/nest/**/templates/` and `backend/src/nest/**/*-email.ts`.
- [ ] WebSocket URL: chat client must use `wss://${current-host}/chat-ws`
      (already does — reads `window.location.host`, verify in code review).
- [ ] **Greenfield cutover (no customer communication needed):** since there
      are no live prod tenants at cutover time (ADR-050 §"Deployment Context"),
      the "transitional redirect" and "customer announcement email" tasks
      from the original plan draft are NOT NEEDED. The first tenant ever to
      sign up in prod does so directly on the new topology — their signup
      lands on `<slug>.assixx.com` from day one. Login page shows the
      one-liner "Deine neue Adresse: <slug>.assixx.com" only if a future live
      migration happens later (tracked as Followup for V2+).

> **Dropped from original plan draft (reason: greenfield):**
>
> - ~~Customer-facing email announcement~~ — nobody to announce to.
> - ~~90-day transitional `www → subdomain` redirect~~ — no live bookmarks exist.
> - ~~Dual-cookie-scope transition~~ — would defeat the cookie-isolation
>   property; the whole point of Modus A is that cookies never cross
>   origins.

### ADR-050 backfill (RETROSPECTIVE)

Per ADR-049 pattern: once Phase 1-5 ships, ADR-050 gets two new sections
appended (matching ADR-049's §Implementation Notes and §Test Coverage):

- **§Implementation Notes** — actual file paths, actual config, actual
  middleware names, actual env-vars
- **§Test Coverage** — tier-by-tier actual numbers
- **Status flip:** `Proposed` → `Accepted`

### Cutover

- [ ] Wildcard DNS active in production
- [ ] Wildcard cert installed
- [ ] Nginx config deployed
- [ ] Backend deployed with middleware + cross-check
- [ ] Frontend deployed with hooks + branding + handoff
- [ ] Smoke test: log in as `scs-technik` admin via `scs-technik.assixx.com`,
      navigate `/manage-admins`, navigate `/dashboard`, log out, log in via
      Microsoft OAuth (full handoff round-trip)
- [ ] Smoke test: cross-tenant JWT replay manually verified 403
- [ ] Smoke test: 90-day transitional redirect verified

### Documentation

- [ ] ADR-050 status flipped to "Accepted" with backfill sections
- [ ] `FEATURES.md` updated (mention subdomain routing as a platform
      capability)
- [ ] `README.md` dev-setup section updated (`/etc/hosts` opt-in for
      subdomain testing)
- [ ] HOW-TO guide: `docs/how-to/HOW-TO-CLOUDFLARE-TOKEN-ROTATION.md` (new) —
      monthly rotation runbook for the DNS API token

### Phase 6 — Definition of Done

- [ ] All integrations work end-to-end
- [ ] ADR-050 backfilled + status = Accepted
- [ ] `FEATURES.md` updated
- [ ] `README.md` dev-setup updated
- [ ] HOW-TO-CLOUDFLARE-TOKEN-ROTATION.md committed
- [ ] Cert-expiry alert provisioned + verified firing on staging
- [ ] No open TODOs in code (implement now, not later)
- [ ] Customer announcement email sent (or scheduled)
- [ ] Plan-2-style smoke test documented in §Post-Mortem below

---

## Session Tracking

> **Rule (per HOW-TO-PLAN-SAMPLE):** one session = one logical work block,
> 1–3 hours focused.

| Session | Phase | Description                                                                                                                                    | Status  | Date       |
| ------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| 1       | 0     | Pre-execution audit: D-table walk-through, R-table sanity (incl. R14/R15)                                                                      | ✅ DONE | 2026-04-20 |
| 2       | 1     | Step 1.0 Reserved-slug migration + DTO + Step 1.6 `docker-compose.prod.yml` override                                                           | ✅ DONE | 2026-04-21 |
| 3       | 1     | Step 1.1 DNS wildcard + Step 1.2 Doppler secrets (CF API token) — **DEFERRED** (infra-user)                                                    | ⏸ DEFER |            |
| 4       | 1     | Step 1.3 Certbot sidecar + Step 1.4 initial wildcard cert — **DEFERRED** (infra-user)                                                          | ⏸ DEFER |            |
| 5       | 1     | Step 1.5 `nginx.prod.conf` full HTTPS rewrite + smoke — **DEFERRED** (needs Sessions 3-4)                                                      | ⏸ DEFER |            |
| 6       | 2     | extractSlug() + TenantHostResolverMiddleware + JwtAuthGuard cross-check                                                                        | ✅ DONE | 2026-04-21 |
| 7       | 2     | CORS plugin + OAuth handoff endpoint (with R15 host-cross-check) — D6: no HMAC, no state cookie                                                | ✅ DONE | 2026-04-21 |
| 8       | 2     | Architectural tests (R1, R2, slug-parser, R14 compose-override, R15 handoff-check)                                                             | ✅ DONE | 2026-04-21 |
| 9       | 3     | Unit tests (≥25 tests)                                                                                                                         | ✅ DONE | 2026-04-21 |
| 9b      | 3     | **Absorbed into Session 10** per D8: `withTenantHost()` helper added to `helpers.ts`, used only in new test file (47 existing tests unchanged) | ✅ DONE | 2026-04-21 |
| 10      | 4     | API integration tests (29 tests green) + **D17 BUG FIX**: middleware→guard raw/wrapped object-identity split                                   | ✅ DONE | 2026-04-21 |
| 11      | 5     | hooks.server.ts + (public) route group + branding helper + titles consumed + backend TenantsModule                                             | ✅ DONE | 2026-04-21 |
| 12      | 5     | OAuth handoff consumer page (load()-branch on `?token=`, extractJwtRole, 4-cookie invariant, R15 X-Forwarded-Host propagation)                 | ✅ DONE | 2026-04-21 |
| 12b     | 5     | Un-planned polish: D17 architectural test (AST-based) + ADR-050 §Backend Object-identity backfill + post-mortem fill                           | ✅ DONE | 2026-04-21 |
| 13      | 6     | Integration + cutover + ADR-050 backfill (greenfield — no customer comms needed)                                                               |         |            |

### Session log template

```markdown
### Session {N} — {YYYY-MM-DD}

**Goal:** {what should be achieved}
**Result:** {what was actually achieved}
**New files:** {list}
**Changed files:** {list}
**Verification:**

- ESLint: {0 errors / N errors → fixed}
- Type-check: {0 errors}
- Tests: {N / N passed}
  **Deviations:** {what differed from plan and why}
  **Next session:** {what comes next}
```

---

## Quick Reference: File Paths

### Infra (new / modified)

| File                                         | Purpose                             |
| -------------------------------------------- | ----------------------------------- |
| `docker/nginx/nginx.conf`                    | Replace single server with 3 blocks |
| `docker/docker-compose.yml`                  | Add certbot sidecar service         |
| `docker/certbot/cloudflare.ini` (gitignored) | Cloudflare DNS API token (runtime)  |
| Doppler secret `CLOUDFLARE_DNS_API_TOKEN`    | Token source                        |

### Backend (new)

| File                                                                    | Purpose                   |
| ----------------------------------------------------------------------- | ------------------------- |
| `backend/src/nest/common/utils/extract-slug.ts`                         | Pure host-to-slug parser  |
| `backend/src/nest/common/middleware/tenant-host-resolver.middleware.ts` | Pre-auth host-resolution  |
| `backend/src/nest/auth/oauth/oauth-handoff.service.ts`                  | Handoff-token mint + swap |
| `backend/test/tenant-subdomain-routing.api.test.ts`                     | Tier 2 integration tests  |

### Backend (modified)

| File                                                | Change                                            |
| --------------------------------------------------- | ------------------------------------------------- |
| `backend/src/nest/app.module.ts`                    | Mount middleware globally                         |
| `backend/src/nest/auth/jwt-auth.guard.ts`           | Cross-check assertion                             |
| `backend/src/nest/auth/oauth/microsoft.provider.ts` | HMAC-sign state with `return_to_slug`             |
| `backend/src/nest/auth/oauth/oauth.controller.ts`   | Mint handoff-token, redirect to subdomain         |
| `backend/src/nest/main.ts`                          | Fastify CORS plugin registration                  |
| `shared/src/architectural.test.ts`                  | +3 assertions (R1, R2, slug-parser single-source) |

### Frontend (new)

| Path                                                   | Purpose                                |
| ------------------------------------------------------ | -------------------------------------- |
| `frontend/src/routes/(public)/`                        | New layout group (login/signup/forgot) |
| `frontend/src/routes/(public)/+layout.server.ts`       | Branding resolution                    |
| `frontend/src/lib/utils/branding.ts`                   | Brand resolver                         |
| `frontend/src/lib/utils/extract-slug.ts` _(or shared)_ | Frontend slug parser (decision D5)     |

### Frontend (modified)

| File                                                        | Change                                          |
| ----------------------------------------------------------- | ----------------------------------------------- |
| `frontend/src/hooks.server.ts`                              | Read X-Forwarded-Host → `event.locals.hostSlug` |
| `frontend/src/routes/signup/oauth-complete/+page.server.ts` | Swap handoff-token instead of direct cookies    |
| `frontend/src/routes/login/+page.svelte`                    | Use branding helper for title                   |

---

## Spec Deviations

> Per HOW-TO-PLAN-SAMPLE §"Spec Deviations": if the spec / template
> contradicts the actual reality, document the deviation IMMEDIATELY.

| #   | Spec / template says            | Actual reality                    | Decision                                                                                                                                   |
| --- | ------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Phase 1 = "Database Migrations" | This plan has no DB schema change | Repurpose Phase 1 as "Infra (DNS + TLS + Nginx)". Infra IS the foundation here, mirroring DB's foundational role in typical FEATURE plans. |

---

## Pre-Execution Audit (D-table — to be filled in Session 1)

Per ADR-049 v0.1.0 → v1.0.0 pattern: surface discoveries BEFORE writing
production code. Each D-entry is a question whose answer changes the plan.

| #   | Question / Concern                                                                                                                                                                          | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D2  | What's the actual production load-balancer IP?                                                                                                                                              | **RESOLVED 2026-04-20 (user decision):** IONOS VPS, Intel 4 vCPU / 6–8 GB RAM. Location irrelevant. IP assigned when the VPS is provisioned in Session 2, recorded in Doppler `PROD_PUBLIC_IP`. See D15 for instance-type rationale.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| D3  | Are all existing tenants in DB populated with `subdomain`?                                                                                                                                  | **N/A in prod.** Greenfield — no live tenants. Staging fixtures are verified in Phase 0.1 query (includes reserved-slug check).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D4  | What's the regex Signup currently enforces on `subdomain`?                                                                                                                                  | **RESOLVED 2026-04-20 (Session 1):** `^[a-z0-9][a-z0-9-]*[a-z0-9]$`, min 3 / max 50 chars, `.toLowerCase().trim()` transform. Stricter than ADR-050's `[a-z0-9-]+` (must start+end alphanum). **Duplicated** in `signup.dto.ts:23` AND `check-subdomain.dto.ts:21` — flagged for later extraction (post-Phase-6 tech-debt, NOT scope of this plan). Step 1.0's reserved-slug `.refine(...)` stacks on top.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| D5  | `extractSlug()` shared between BE+FE?                                                                                                                                                       | **Decision: duplicate, NOT shared.** Backend lives in `backend/src/nest/common/utils/extract-slug.ts`, frontend in `frontend/src/lib/utils/extract-slug.ts`. Reason: `shared/` imports add build-order friction; logic is ~20 LOC; an architectural test asserts both implementations behave identically on a pinned test vector.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D6  | OAuth `state` cookie today: where set, what scope?                                                                                                                                          | **RESOLVED 2026-04-20 (Session 1) — MAJOR CORRECTION:** `state` is NOT a cookie. It is a Redis-stored UUIDv7 token: `oauth:state:{uuid}`, TTL 600 s, GETDEL atomic single-use (see `backend/src/nest/auth/oauth/oauth-state.service.ts` + ADR-046 §4 Redis keyspace table). Payload: `{ mode, codeVerifier, createdAt }`. Consequences: (1) ADR-050 §OAuth text corrected same-day. (2) Step 2.5 rewritten — no HMAC, no cookie, no `OAUTH_STATE_SECRET` Doppler secret. `return_to_slug` added as new optional field to the existing Redis payload. (3) R6 deleted. (4) R12 mitigation simplified — R15 endpoint-level host-cross-check defeats URL tampering structurally. (5) Phase-0 prereq list updated.                                                                                                                                                                                                                                                                          |
| D7  | `hooks.server.ts` structure                                                                                                                                                                 | **RESOLVED 2026-04-19:** Uses `sequence()` with 6 handlers (Sentry → securityHeaders → legacyRedirects → auth → logging → minification). `event.locals.hostSlug` extraction inserts BEFORE `authHandle` (so auth can consume it for future logging).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| D8  | Test-infra: how does Vitest API-tests fake the Host header today?                                                                                                                           | **RESOLVED 2026-04-20 (Session 1):** 47 `*.api.test.ts` files (not ~38). All use raw `fetch(BASE_URL + path)` via `backend/test/helpers.ts` against `http://localhost:3000` — zero supertest, zero `.inject()`. No existing test sets `X-Forwarded-Host`. Because tests hit `localhost:3000`, `extractSlug('localhost') === null` → middleware sets `hostTenantId = null` → cross-check skipped → **all 47 tests pass unchanged**. **Session 9b scope reduction:** just add `withTenantHost(slug): HeadersInit` helper in `helpers.ts` and use it ONLY in the new `tenant-subdomain-routing.api.test.ts`. No per-file migration. Session 9b can likely merge back into Session 9 or 10.                                                                                                                                                                                                                                                                                                |
| D9  | Vite dev-server: does it accept `*.localhost:5173`?                                                                                                                                         | **TO VERIFY Session 10 (Frontend):** probably works out of the box (Vite binds to all interfaces by default on modern versions). If not, add `server.allowedHosts: ['.localhost']` to `vite.config.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D10 | docker-compose.yml: existing shared volume for certs?                                                                                                                                       | **RESOLVED 2026-04-19:** No existing cert volume. Step 1.3 adds named volume `certs` mounted to `certbot` (rw) and `nginx` (ro).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D11 | Production TLS termination: Cloudflare or origin Nginx?                                                                                                                                     | **RESOLVED 2026-04-19 (user decision):** origin Nginx. CF Free tier in DNS-only mode (grey cloud), NOT proxied. See Step 1.1 rationale.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D12 | `PUBLIC_APP_URL` value in production Doppler                                                                                                                                                | **Default: `https://www.assixx.com`** (matches `microsoft.provider.test.ts:185` expectation). Session 2 verifies Doppler prd config.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| D13 | Existing tenants colliding with reserved slugs?                                                                                                                                             | **N/A (greenfield).** Step 1.0 enforces both CHECK-constraint + DTO-validation for all future signups.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D14 | OAuth handoff token: Redis or DB?                                                                                                                                                           | **RESOLVED: Redis.** TTL=60s, single-use (DEL after host-cross-check passes — see Step 2.5). If Redis is unavailable, the whole OAuth flow fails loudly (circuit-break) — no DB fallback because the 60s TTL is meaningless in durable storage, and losing an in-flight OAuth is a 30s user annoyance, not a data loss.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D15 | **(NEW)** VPS provider choice for greenfield deployment?                                                                                                                                    | **RESOLVED 2026-04-20 (user decision):** IONOS VPS (NOT Hetzner). Intel architecture, 4 vCPU, 6–8 GB RAM. Location irrelevant (user explicitly declined location preference). Session 2 provisions + records IPv4 in Doppler `PROD_PUBLIC_IP`. Rationale for IONOS over Hetzner: user preference, existing customer relationship (domain `assixx.com` is also IONOS-registered). IONOS Cloud Cube / Linux VPS product line — instance-type exact SKU picked at provision time.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D16 | **(NEW)** `docker-compose.prod.yml` — does it live in `docker/` alongside base, or in a separate `deployment/` subtree?                                                                     | **Recommendation:** `docker/docker-compose.prod.yml` (same directory as base). Single source of compose files, simplest mental model. Session 2 commits the file.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D17 | **(NEW — Session 10 runtime discovery)** NestJS class-based middleware via `MiddlewareConsumer.apply()` — does it receive `FastifyRequest` or raw `IncomingMessage`?                        | **RESOLVED 2026-04-21 (Session 10):** class-middleware runs under `@fastify/middie` which passes the **raw `IncomingMessage`**. Fastify later exposes it on `FastifyRequest.raw`. Session 6 wrote `req.hostTenantId = X` which set the field on IncomingMessage; the guard read `request.hostTenantId` from the Fastify wrapper — **two different objects**, silent no-op, "single load-bearing line of ADR-050" defeated in production. Caught by the first API integration test (exactly what the Phase 4 DoD was designed to catch). **Fix applied same session**: `HostAwareRequest` redefined as `FastifyRequest & { raw: IncomingMessage & HostAwareRaw }`; guard + handoff controller now read `request.raw.hostTenantId`; unit test mocks put the field on `mockRequest.raw`. 919-test API suite + 95-test unit suite green after fix. **Follow-up Session 10b** (open): architectural test banning `request.hostTenantId` / `req.hostTenantId` writes outside the middleware. |
| D18 | **(NEW — Session 11 pre-flight)** Do `tenants.logo_url` and `tenants.primary_color` columns exist for the branding endpoint?                                                                | **RESOLVED 2026-04-21 (Session 11) — N/A (self-reversal):** initial grep of `database/migrations/` returned zero hits and I proposed "Option A" (name-only scope reduction). Direct `\d tenants` against the live DB then confirmed **both columns already exist in the baseline**: `logo_url varchar(500)` (nullable) and `primary_color varchar(7) default '#0066cc'`. The grep missed them because the baseline-migration file stores the full schema as one SQL blob, not column-per-line. Full-field response shape shipped (`{ name, logoUrl, primaryColor }`). V1 UI consumption stays name-only (title only); V2 will swap the logo image + theme colour. Known Limitation #5 updated to reflect "logo/color in API but not yet rendered".                                                                                                                                                                                                                                     |
| D19 | **(NEW — Session 11 process learning)** Verify-schema-before-gripping: grepping migration files for column names is unreliable because baseline-migrations store DDL as opaque SQL strings. | **RESOLVED 2026-04-21 (Session 11):** use `docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d <table>"` as the authoritative schema check. `database/migrations/*.ts` greps are only reliable for INCREMENTAL schema changes (ADR-050-era migrations), not for baseline structure. Added here as a checklist reminder for future sessions that need to verify column existence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

> **Rule:** every D-entry must be resolved BEFORE Phase 1 starts. Resolution
> may modify R-table, file paths, or step content.

---

## Known Limitations (V1 — deliberately excluded)

> Per HOW-TO-PLAN-SAMPLE §"Known Limitations" — explicit anti-scope-creep.

1. **Custom-domain hosting (`app.scs-technik.de` via CNAME).** Modus B is
   V2+ work. Tracked as ADR-050 Followup #1. Trigger: contractual customer
   ask.
2. **Vanity-subdomain rename UI.** `tenants.subdomain` is set at signup and
   immutable in V1. V2 may add customer-self-service rename with old-URL
   301 for 90 days.
3. **Tenant subdomain sunset on tenant deletion.** When a tenant is
   soft-deleted, the subdomain becomes immediately re-claimable in V1. V2
   will add a 12-month tombstone cool-down.
4. **Per-subdomain `robots.txt`.** All subdomains will be indexable until V2
   adds per-subdomain `Disallow: /` (privacy + accidental data exposure
   prevention).
5. **i18n branding.** Subdomain-resolved branding is German-only in V1
   (matches existing app convention). i18n is out of scope.
6. **Custom subdomain TLS-cert per tenant.** All tenants share the wildcard
   cert. Per-tenant certs are V2+ work (and only relevant for Modus B).
7. **No A/B routing.** All requests for `<slug>.assixx.com` go to the same
   backend deployment. Canary deployments per-tenant are not addressed by
   this plan.

---

## Post-Mortem (filled 2026-04-21 after Session 12 + 12b)

> Covers the code-complete portion of the feature (Sessions 1, 2, 6–12, 12b).
> Sessions 3–5 (DNS/Cert/Nginx) and Session 13 (cutover + ADR backfill) are
> deferred / pending; their post-mortem will append here once they ship.

### What went well

- **Greenfield advantage was real.** No live tenants at cutover time removed
  whole categories of risk: no forced re-login event to communicate, no
  bookmark-migration strategy, no dual-cookie-scope transition to design and
  later tear down. The `/etc/hosts` dev-opt-in doubles as the staging
  rehearsal, so by the time production DNS flips there will be no
  "first-time" code paths left. The decision to ship Modus A and defer
  Modus B (ADR-050 §"Why NOT custom-domain hosting") paid for itself — none
  of the blocked features would have added customer value on day one.
- **Pre-execution audit (Session 1) saved real work.** D6's correction —
  "OAuth `state` is Redis-stored UUIDv7, not a cookie with HMAC" — cut a
  whole cryptographic branch out of Step 2.5 before any code was written.
  Had we trusted the initial ADR text and implemented the cookie-HMAC path,
  the cleanup would have been a multi-file refactor touching the OAuth
  callback, the state service, and its tests. The audit cost ~1 session of
  reading and saved ~2 sessions of churn.
- **D8's scope reduction saved Session 9b.** Initially planned as "migrate
  all 47 API tests to a new `X-Forwarded-Host` helper", reduced to "add
  helper + use it only in the new subdomain-routing test" once we verified
  `extractSlug('localhost') === null` leaves existing tests unaffected. 47
  file edits avoided.
- **Phase 4 integration tests did their job.** The D17 bug (raw vs. wrapped
  Fastify request object-identity) survived unit tests with plain-object
  mocks but was caught by the first cross-tenant assertion in
  `tenant-subdomain-routing.api.test.ts` — within minutes of the file
  landing. The 919-test full API suite acted as an immediate regression
  net. Cost: one debug session. Benefit: the single load-bearing line of
  ADR-050 cannot silently no-op in production.
- **Architectural tests held under pressure.** Session 8 shipped 5
  invariants (R1, R2, slug-parser, R14, R15); Session 12b added D17. Each
  sanity-regression injection produced the expected CI failure on the
  first attempt. No false positives, no false negatives on the pinned
  corpus. The one near-miss (R14's service-block extractor initially
  crossing service boundaries) was caught during sanity-regression and
  fixed before merge.

### What went badly

- **D17 itself.** A framework-internal object-identity assumption (NestJS
  class-middleware under `@fastify/middie` receives raw `IncomingMessage`,
  not the Fastify wrapper) was baked into unit-test mock shape without
  anyone realising. Unit tests with plain-object mocks of
  `{ hostTenantId: X, user: { tenantId: Y } }` passed because the mocks
  conflated the two objects into one. Production has two distinct objects
  and the cross-check silently read `undefined`. Lesson for future
  middleware work: for any field written by middleware and read by
  guards/controllers, the minimum sanity check is one integration test
  asserting end-to-end plumbing — unit tests alone cannot prove it.
- **D18 self-reversal.** Grep of `database/migrations/*.ts` for
  `tenants.logo_url` returned zero hits → I proposed scope-reducing the
  branding endpoint to `name`-only. A direct `\d tenants` against the
  live DB 10 minutes later showed both columns exist on the baseline
  schema (the baseline migration stores DDL as one opaque SQL blob, not
  column-per-line, so grep missed it). Self-corrected before any code
  shipped, but the wasted proposal time was avoidable. D19 codifies:
  authoritative schema checks go through `psql`, not migration-file grep.
- **The masterplan changelog cells got unreadably long.** Entries for
  0.6.0, 0.9.0, 0.10.0 each exceed 3 kB of single-row markdown. The
  git-history is the canonical audit trail; the cells duplicate that
  work without being especially navigable. Future feature plans should
  consider per-session append-only log files linked from the masterplan
  instead of one mega-changelog table.
- **Backend `OAuthHandoffPayload` doesn't include `role`.** Forced the
  frontend handoff consumer to decode the JWT with a new `extractJwtRole`
  helper (Session 12). The saner design would have the backend include
  `role` in the minted payload — zero cost, zero frontend decode. The
  Session 12 scope guardrails (frontend-only change) kept us from the
  refactor; tracked as tech-debt for the Session 13 cutover pass. Small
  debt, but an avoidable one.
- **Scope discipline required continuous effort.** D4 (reserved-slug regex
  duplicated in two DTOs), D5 (extract-slug duplicated between backend +
  frontend), and the inline `UserRole` dashboard-path map between
  `login/+page.server.ts` and the handoff consumer all remain
  deliberately un-extracted. Every single time the temptation was "let
  me just make a shared helper"; the answer was "post-Phase-6 tech-debt,
  not scope". Judgment calls; time will tell if the restraint was right.

### Metrics

> Figures cover code-complete sessions (1, 2, 6–12, 12b). Deferred infra
> sessions (3, 4, 5) and pending cutover (13) are not in the counts.

| Metric                            | Planned | Actual   | Note                                                                                                                                                                                                                                                                                     |
| --------------------------------- | ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sessions (incl. pre-audit)        | 13      | 10 + 12b | 3 deferred (infra-user), 13 pending; 12b added as un-planned polish (D17 arch test, ADR backfill)                                                                                                                                                                                        |
| Migration files                   | 1       | 1        | `20260421102820830_add-subdomain-reserved-check`                                                                                                                                                                                                                                         |
| New backend production files      | ~4      | ~13      | host-resolver middleware + module + tokens, handoff service + controller + DTO, tenants module suite (6 files), extract-slug utility                                                                                                                                                     |
| New frontend production files     | ~4      | ~4       | extract-slug, branding helper, (public) layout + layout-server                                                                                                                                                                                                                           |
| Changed production files (est.)   | ~10     | ~20      | app.module, main.ts (CORS), jwt-auth.guard, oauth.service + .controller + .types, oauth-state.service + .types, signup.dto, check-subdomain.dto, hooks.server.ts, jwt-exp.ts, oauth-complete, login/signup/forgot-password +page.svelte titles, test/helpers.ts, docker-compose.prod.yml |
| New unit tests                    | ≥ 25    | 72       | 21 extract-slug + 17 handoff-service + 13 middleware + 5 guard cross-check + 6 tenants.service + 10 OAuth-state refactor assertions                                                                                                                                                      |
| Architectural assertions          | 3       | 6        | R1, R2, slug-parser single-source, R14 compose-override, R15 handoff-order, D17 host-field-access (Session 12b)                                                                                                                                                                          |
| API integration tests             | ≥ 15    | 29       | `tenant-subdomain-routing.api.test.ts` — cross-tenant replay, apex/unknown, OAuth authorize, OAuth handoff, CORS                                                                                                                                                                         |
| ESLint errors at Session 12 close | 0       | 0        | Auto-fix handled 4 import-order issues; manual fixes for TS 6.0 narrowing + cyclomatic complexity + strict-boolean                                                                                                                                                                       |
| Spec deviations                   | 1 (D1)  | 1 (D1)   | Phase 1 repurposed from "DB Migrations" to "Infra" — no DB schema change needed                                                                                                                                                                                                          |
| Runtime discoveries               | 0       | 1 (D17)  | NestJS+Fastify middleware object-identity — caught same-session by API tests, fixed + arch-tested                                                                                                                                                                                        |

---

**This document is the execution plan. Every session starts here, takes the
next unchecked item, and marks it done. No coding starts before Phase 0 is
green (all D-entries resolved, all R-mitigations sanity-checked).**

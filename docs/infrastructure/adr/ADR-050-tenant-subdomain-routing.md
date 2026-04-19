# ADR-050: Tenant Subdomain Routing (`<tenant>.assixx.com`)

| Metadata                | Value                                                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**              | Proposed                                                                                                                                                                                |
| **Date**                | 2026-04-19                                                                                                                                                                              |
| **Decision Makers**     | Simon Öztürk (Staff-Engineer assist)                                                                                                                                                    |
| **Affected Components** | Infra (DNS, Nginx, TLS), Backend (`auth/`, new host-resolver middleware, `oauth/`), Frontend (`hooks.server.ts`, `(public)` layout group, OAuth-callback handoff)                       |
| **Supersedes**          | —                                                                                                                                                                                       |
| **Related ADRs**        | ADR-005 (Auth/JWT), ADR-006 (CLS Tenant-Context), ADR-012 (Frontend Route Security Groups), ADR-019 (RLS), ADR-044 (Security Headers), ADR-046 (OAuth Sign-In), ADR-049 (Domain Verify) |

---

## Context

### The Problem: Generic URL kills tenant identity

After ADR-049 every tenant proves DNS-ownership of its corporate domain
(`scs-technik.de`), but the application URL stays generic
(`https://www.assixx.com/login`). Multi-tenant SaaS platforms in the same
target market — Grafana Cloud (`<org>.grafana.net`), Slack
(`<workspace>.slack.com`), Linear (`<org>.linear.app`), GitHub Enterprise
Cloud, Vercel — all converged on **per-tenant subdomain under a
vendor-controlled apex**. The pattern solves four orthogonal problems at once:

1. **Identity & branding** — the URL itself signals which workspace the user is in.
2. **Cookie isolation by browser default** — `accessToken` cookie on
   `tenant-a.assixx.com` is automatically not sent to `tenant-b.assixx.com`
   (RFC 6265 §5.3 step 6). An entire class of cross-tenant cookie-leak bugs
   becomes architecturally impossible.
3. **OAuth/SSO scoping** — IdPs can restrict which tenant a user can sign
   into based on the request origin.
4. **Marketing/app split** — `www.assixx.com` (public, indexable, signup) is
   cleanly separated from the application surface (`<tenant>.assixx.com`).

### Requirements

1. Every tenant gets a stable subdomain: `<slug>.assixx.com`.
2. Routing-key is **`tenants.subdomain`** (already UNIQUE, already populated
   by signup), NOT `tenant_domains.domain` (ADR-049's customer corporate
   domain — different semantic).
3. **Bypass-proof at the auth layer:** a JWT minted for tenant A, replayed
   against `tenant-b.assixx.com`, must produce 403 — not silent success.
4. **Cookie isolation must be browser-native**, not application-coded.
5. **Marketing & signup stay on the apex.** No tenant context required.
6. **OAuth (ADR-046) keeps working** with a single registered redirect-URI
   in Azure AD.
7. **Local dev unchanged** — `localhost:5173` continues to work without
   `/etc/hosts` edits. Subdomain testing is opt-in.

### Why NOT custom-domain hosting (`app.scs-technik.de` via CNAME)

Modus B (Customer-Custom-Domain) was considered and rejected for V1. Three
converging reasons:

1. **TLS-cert lifecycle becomes an operational sub-system** — on-demand
   certs per customer-controlled hostname require either Caddy +
   `on_demand_tls` (new reverse-proxy stack) or `cert-manager` /
   `acme-companion` containers, plus an `ask`-endpoint guarding ACME against
   rate-limit abuse, plus a re-verification daemon to cap subdomain-hijacking
   blast-radius. None of that buys customer-visible value over Modus A until
   a customer has it as a contractual blocker.
2. **OAuth-redirect explosion** — Microsoft Entra requires every callback
   URL pre-registered. Per-customer-domain means either one Entra-app per
   tenant (admin nightmare) or a centralized callback on the apex with
   post-callback redirect.
3. **80/20 economics** — Modus A delivers ~80 % of the branding value for
   ~20 % of the engineering cost. Modus B is V2+ work, gated by a concrete
   customer ask. Tracked as Followup #1.

---

## Decision

**Wildcard-Subdomain Routing (Grafana-Cloud Pattern).** Five architectural
choices:

```
DNS   *.assixx.com  A → load-balancer-IP    (one wildcard record)
TLS   wildcard cert: CN=assixx.com, SAN=assixx.com,*.assixx.com
      via Let's Encrypt DNS-01 (Cloudflare API), 90-day rotation
Proxy Nginx — two server-blocks:
        apex (assixx.com, www.assixx.com) → marketing + signup + OAuth callback
        regex ~^(?<slug>[a-z0-9-]+)\.assixx\.com$ → app surface
      catch-all `default_server { return 444; }` preserved
BE    new pre-auth middleware: Host → tenants.subdomain lookup → req.hostTenantId
      JwtAuthGuard ASSERTs jwt.tenantId === req.hostTenantId else 403
FE    SvelteKit cookies stay scoped to current host (no `domain:` option)
      OAuth callback lands on apex, hands off to subdomain via short-lived token
```

### Routing-Key: `tenants.subdomain`, NOT `tenant_domains.domain`

These two columns answer different questions, and conflating them in V1
would make the future Modus B work harder, not easier.

| Column                  | Question it answers                             | Used by  |
| ----------------------- | ----------------------------------------------- | -------- |
| `tenants.subdomain`     | "What slug routes to this tenant in our app?"   | this ADR |
| `tenant_domains.domain` | "Does this tenant own a real corporate domain?" | ADR-049  |

The slug rules already enforced at signup (UNIQUE, RFC-1035 conformant
`[a-z0-9-]+`) are exactly what Nginx's regex matches. **No DB schema change.**

### TLS: Single Wildcard Cert, Let's Encrypt DNS-01

Wildcards are mandatory because HTTP-01 cannot validate `*.assixx.com`.
DNS-01 via Cloudflare API token (Doppler-managed
`CLOUDFLARE_DNS_API_TOKEN`). Certbot sidecar handles 90-day rotation; on
renewal Nginx reloads (`nginx -s reload`, zero-downtime).

The wildcard `*.assixx.com` covers `<slug>.assixx.com` per RFC 6125 §6.4.3
(one label deep, no nested wildcards). Apex (`assixx.com`) and
`www.assixx.com` are explicit SANs.

### Backend: Pre-Auth Host Resolver + Post-Auth Cross-Check

Two small additions to existing flow:

- **Pre-Auth middleware** reads `X-Forwarded-Host`, extracts slug via a
  pure utility (`extractSlug()`), looks up `tenants WHERE subdomain = $1`
  via `systemQuery()` (ADR-019 — bypasses RLS, this is pre-auth context).
  Caches in Redis 60 s. Result attached as `req.hostTenantId: number | null`.
  Apex requests have `hostTenantId = null` (intentional — public endpoints
  must accept this).
- **Post-Auth assertion** in `JwtAuthGuard`, after JWT decode + DB user
  lookup: if `req.hostTenantId !== null && req.hostTenantId !== user.tenantId`
  throw `ForbiddenException({ code: 'CROSS_TENANT_HOST_MISMATCH' })`. This
  is the **single load-bearing line of code in the whole design** —
  without it, a JWT becomes a cross-tenant skeleton key.

CLS context (ADR-006) source remains the JWT, unchanged. Host is a
_cross-check_, not a _source_.

### Cookies: Browser-Native Isolation, Zero Code Change

Today every `cookies.set()` call in `frontend/src/routes/login/+page.server.ts`
and `frontend/src/routes/signup/oauth-complete/+page.server.ts` omits the
`domain` option. SvelteKit's default scopes the cookie to the request-origin
host. That means cookie isolation is browser-policy, not application-coded —
the strongest guarantee available.

**No frontend cookie code changes required.** An architectural test bans any
future `domain: '.assixx.com'` literal — that single line would defeat the
entire isolation model.

### CORS: Origin-Allowlist via subdomain regex

Today's backend has no explicit CORS block (Fastify default = same-origin
only). Multi-subdomain future requires explicit Fastify CORS plugin with an
origin-callback that allows: apex (`assixx.com`, `www.assixx.com`), any
subdomain (`<slug>.assixx.com`), and `localhost:5173` for dev. Static
regex, not DB-driven — the regex shape IS the contract.

### OAuth (ADR-046): Centralized Callback, Post-Callback Handoff

`PUBLIC_APP_URL` stays `https://www.assixx.com` in production. The Microsoft
Entra registered redirect-URI continues to be a single value:
`https://www.assixx.com/api/v2/auth/oauth/microsoft/callback`. No
re-registration, no per-tenant Entra app sprawl.

When a user clicks "Sign in with Microsoft" on `tenant-a.assixx.com/login`,
Nginx 307-redirects the INITIATE call to the apex. The apex backend stores
`return_to_slug` in the signed `state` cookie alongside the CSRF nonce. After
Microsoft callback succeeds, the backend mints a 60-second single-use
`oauth_handoff_token`, redirects to
`https://${return_to_slug}.assixx.com/signup/oauth-complete?token=…`. The
subdomain page swaps the handoff-token for the real auth cookies (now
scoped to the subdomain) via a new endpoint `POST /api/v2/auth/oauth/handoff`.

The handoff-token is the only new piece of crypto: 32-byte random,
single-use, server-side TTL, Redis-backed. Pattern mirrors cross-domain SSO
flows used by every major B2B SaaS.

### Local Dev: Unchanged + Optional Subdomain-Routing

`extractSlug()` returns `null` for `localhost`, IP literals, and apex hosts —
host-cross-check is then skipped, JWT-tenantId is the sole source of truth,
exactly as today. Devs who want to test subdomain routing add to
`/etc/hosts`:

```
127.0.0.1 firma-a.localhost firma-b.localhost
```

…and use `http://firma-a.localhost:5173/login`. Vite resolves `*.localhost`
natively per RFC 6761. **Zero changes to dev-server config.** Opt-in per
developer.

---

## Alternatives Considered

### Alt 1: Modus B — Customer Custom Domain (CNAME)

`app.scs-technik.de` resolved via customer-controlled DNS. Rejected for V1
(see "Why NOT custom-domain hosting" above). Re-evaluation trigger: a
contractual customer ask. Tracked as Followup #1.

### Alt 2: Path-prefix Routing (`assixx.com/t/<slug>/...`)

`assixx.com/t/scs-technik/dashboard`. Rejected:

- Loses the cookie-isolation property (every tenant shares the same
  origin → cookies are not browser-isolated).
- Cross-tenant XSS in tenant A could read tenant B's cookies (same-origin
  policy doesn't help).
- No marketing benefit — URL is uglier, not prettier.
- All four wins from §Context disappear.

### Alt 3: Header-based tenant ID (`X-Tenant-ID: 42`)

API-only, no URL change. Rejected: doesn't solve the customer-facing branding
problem, and JWT already carries `tenantId` — nothing to gain.

### Alt 4: Reuse `tenant_domains.domain` as routing-key

Conflate ADR-049's verified-corporate-domain with the routing slug. Rejected
because the two concerns have different trust boundaries, lifecycles, and
failure modes. Conflating them in V1 makes the future Modus B work harder
(Modus B will _be_ the time `tenant_domains.domain` becomes the routing-key —
this ADR's slug then becomes the "fallback default tenant URL").

---

## Consequences

### Positive

- **URL signals identity.** `scs-technik.assixx.com/dashboard` is unambiguous.
  Recognition > recall (Nielsen heuristic #6).
- **Cookie-isolation is browser-native.** Cross-tenant cookie leak becomes a
  browser-bug class to attack, not an application-bug class.
- **Cross-tenant token replay is hard-blocked** with a discriminable error
  code (`CROSS_TENANT_HOST_MISMATCH`) — easy to alert on in Loki.
- **No DB schema change.** Migration risk surface is nginx-config + new
  middleware, both reversible in seconds.
- **Marketing/app split clean.** `www.assixx.com` becomes purely public;
  tenant subdomains are purely application surface. SEO improves.
- **Modus B path stays open.** No premature lock-in.
- **OAuth costs are bounded.** One Entra app, one registered redirect-URI,
  one apex callback. Per-subdomain handoff is a 60-second token swap.

### Negative

- **One new TLS cert lifecycle to operate.** Wildcard cert via Let's Encrypt
  DNS-01 means certbot in a sidecar, Cloudflare API token in Doppler, and a
  reload on rotation. Mature, automated, but new infra surface.
- **Local dev gets one optional new affordance** — `/etc/hosts` edit for
  subdomain testing. Documented, opt-in.
- **OAuth flow gains a handoff-token swap** — adds ~50 ms to a flow that
  already runs in seconds.
- **Backend hot-path adds one Redis GET per request** (60-s TTL keeps DB
  hits at most ~1/min/subdomain). Negligible vs. JWT-decode cost.

### Neutral

- **`tenants.subdomain` becomes a load-bearing public identifier.** Treated
  as immutable from launch. Already implicitly true (UNIQUE column, primary
  signup-form input).
- **Catch-all `default_server { return 444; }`** from today's `nginx.conf`
  §35–39 is preserved unchanged. Unknown Hosts continue to be TCP-RST'd.

---

## Architectural Risks

> Operational risks (cert renewal failure, DNS propagation lag, etc.) are
> tracked in the masterplan's R-table. Only architecture-level risks here.

| Risk                                                                                      | Mitigation                                                                                                                                                             |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Forgotten `cookies.set({ domain: '.assixx.com' })` re-introduces cross-tenant cookie leak | Architectural test (`shared/src/architectural.test.ts`) regex-bans `domain:` literal in any `cookies.set` call. Mirrors ADR-049 §2.11 architectural test pattern.      |
| Forgotten host-cross-check in a future custom auth flow lets JWT bypass subdomain         | Architectural test asserts every controller decorated with `@UseGuards(JwtAuthGuard)` is reachable only through the middleware-mounted path.                           |
| Subdomain typo (`scs-tehcnik.assixx.com`) returns 444 (no body), confuses user            | Catch-all returns a small SvelteKit 404 page for browser User-Agents (UA sniff in Nginx). Preserves 444 for non-browsers (scanners, curl).                             |
| Internal services (cron, deletion-worker) call backend with no Host                       | `extractSlug()` returns `null` for missing/non-matching Host. Internal callers continue using `systemQuery()` (BYPASSRLS) — no tenant context needed.                  |
| Microsoft OAuth `state` cookie set on apex doesn't reach the subdomain                    | `state` cookie deliberately stays apex-scoped. The handoff-token mechanism is what crosses the origin boundary — `state` only validates the apex-side CSRF round-trip. |

---

## Why a Single Wildcard, Not Per-Subdomain Certs

1. **Operational:** one cert, one renewal, one alert. Per-subdomain certs
   would mean N renewals, N alerts, N failure modes — each tenant becomes a
   potential outage source.
2. **Rate-limit:** Let's Encrypt's per-domain rate limit is 50 certs/week. A
   sudden signup burst could exhaust the budget in hours and lock new
   tenants out of TLS for a week. Wildcards are immune.

The downside (single cert compromise affects all subdomains) is mitigated by
short-lived certs (90-day rotation) and HSTS preload.

---

## Followups (V2+ work, not in scope)

1. **Modus B — Customer Custom Domain (`app.scs-technik.de` via CNAME).**
   Triggered by a contractual customer ask. Will reuse
   `tenant_domains.domain` as the routing-key.
2. **Vanity-subdomain rename UI.** Customer-self-service rename with
   old-URL 301 redirect for 90 days.
3. **Tenant subdomain sunset on tenant deletion.** 12-month tombstone
   cool-down to prevent accidental traffic to a different tenant's data.
4. **Per-subdomain `robots.txt`** returning `Disallow: /` so tenant
   subdomains don't get indexed (privacy + accidental-data-exposure
   prevention).

---

## References

- ADR-005 — Authentication Strategy (JWT, host-check piggybacks on existing guard)
- ADR-006 — Multi-Tenant CLS Context (CLS source remains JWT; host is cross-check)
- ADR-012 — Frontend Route Security Groups (`(public)` group for apex+subdomain dual-mount)
- ADR-019 — Multi-Tenant RLS (unchanged)
- ADR-044 — SEO and Security Headers (header set replicated into both new server-blocks)
- ADR-046 — OAuth Sign-In (centralized callback + handoff-token swap)
- ADR-049 — Tenant Domain Verification (sibling concern; routing is separate)
- Grafana Cloud subdomain pattern — public reference at scale
- RFC 6125 §6.4.3 — Wildcard certificate semantics
- RFC 6265 §5.3 step 6 — Cookie storage scoping by origin
- RFC 6761 — Special-Use Domain Names (`localhost` and subdomains)
- Nginx wildcard `server_name` regex: <https://nginx.org/en/docs/http/server_names.html#regex_names>
- Let's Encrypt DNS-01 for wildcards: <https://letsencrypt.org/docs/challenge-types/#dns-01-challenge>
- Execution masterplan: `docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md`

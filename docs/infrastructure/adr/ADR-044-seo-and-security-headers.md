# ADR-044: SEO Infrastructure & Security Headers

| Metadata                | Value                                                               |
| ----------------------- | ------------------------------------------------------------------- |
| **Status**              | Accepted                                                            |
| **Date**                | 2026-04-11                                                          |
| **Decision Makers**     | Simon Öztürk                                                        |
| **Affected Components** | Frontend (SvelteKit), hooks.server.ts, static assets, public routes |

---

## Context

Assixx is a B2B multi-tenant SaaS for industrial companies. The application has three public pages (`/`, `/login`, `/signup`) and all other routes require authentication. Prior to this ADR:

- **No robots.txt** — crawlers had no guidance; authenticated routes were discoverable
- **No sitemap.xml** — search engines had no URL inventory
- **No meta descriptions** — zero pages had `<meta name="description">`, reducing search snippet quality
- **No Open Graph / Twitter Card tags** — links shared on social media showed no preview
- **No structured data** — no JSON-LD schema for search engine rich results
- **No security headers** beyond CSP — missing HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **No X-Robots-Tag** — no HTTP-level indexing control for authenticated routes
- **Broken favicon.png** — 0 bytes, corrupt; no PWA manifest; no apple-touch-icon
- **Duplicate viewport meta** — defined in both `app.html` and `+layout.svelte`

The SCS website (Next.js) served as the reference implementation for SEO best practices.

## Decision

### 1. Dynamic robots.txt via SvelteKit Route

**File:** `frontend/src/routes/robots.txt/+server.ts`

- `Allow: /$`, `Allow: /login$`, `Allow: /signup$` — only public pages
- `Disallow: /` — block everything else (fail-closed)
- 9 AI training bots explicitly blocked (GPTBot, Claude-Web, Google-Extended, CCBot, anthropic-ai, Bytespider, PerplexityBot, Amazonbot, FacebookBot)
- Sitemap reference: `https://www.assixx.com/sitemap.xml`
- `export const prerender = true` — static at build time

**Why route-based, not static file:** Avoids duplicating bot lists; TypeScript ensures correctness; prerender produces a static file at build time anyway.

### 2. Dynamic sitemap.xml via SvelteKit Route

**File:** `frontend/src/routes/sitemap.xml/+server.ts`

- 3 URLs only: `/`, `/login`, `/signup`
- Standard sitemap XML with `lastmod`, `changefreq`, `priority`
- `export const prerender = true`

**Why only 3 URLs:** All other routes require authentication. Crawlers cannot access them, and indexing them would be a security concern.

### 3. Reusable `<Seo>` Component

**File:** `frontend/src/lib/components/Seo.svelte`

**Props:** `title`, `description`, `canonical?`, `ogImage?`, `ogType?`, `noindex?`, `jsonLd?`

**Renders in `<svelte:head>`:**

- `<title>`, `<meta name="description">`, `<meta name="robots">`
- `<link rel="canonical">`
- Open Graph: `og:title`, `og:description`, `og:url`, `og:image`, `og:type`, `og:locale`, `og:site_name`
- Twitter Card: `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
- Optional JSON-LD structured data via `{@html}`

**JSON-LD workaround:** Svelte parser interprets `</script>` in templates as closing the component's script block. Solution: build the tag name from a variable (`const LD_TAG = 'script'`) and use template literal interpolation.

### 4. Security Headers in hooks.server.ts

**New handle:** `securityHeadersHandle` in the `sequence()` chain (after Sentry, before auth).

| Header                    | Value                                        |
| ------------------------- | -------------------------------------------- |
| X-DNS-Prefetch-Control    | on                                           |
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload |
| X-Frame-Options           | SAMEORIGIN                                   |
| X-Content-Type-Options    | nosniff                                      |
| Referrer-Policy           | strict-origin-when-cross-origin              |
| Permissions-Policy        | camera=(), microphone=(), geolocation=()     |

**X-Robots-Tag:** `noindex, nofollow` on all routes NOT in `INDEXABLE_ROUTES` (`/`, `/login`, `/signup`). This is belt-and-suspenders alongside robots.txt — even if a crawler ignores robots.txt, the HTTP header blocks indexing.

### 5. Favicon Set & PWA Manifest

**Generated from** `new_favicon.png` (2000x2000, XX logo on black) via ImageMagick:

| File                 | Size    | Purpose         |
| -------------------- | ------- | --------------- |
| favicon.ico          | 32x32   | Browser tab     |
| favicon-32x32.png    | 32x32   | Modern browsers |
| apple-touch-icon.png | 180x180 | iOS home screen |
| favicon-192x192.png  | 192x192 | Android/PWA     |
| favicon-512x512.png  | 512x512 | PWA splash      |

**Manifest:** `frontend/static/site.webmanifest` — references 192x192 and 512x512 icons; theme/background `#121212`.

### 6. Public Routes in Auth Gate

`/robots.txt` and `/sitemap.xml` added to `PUBLIC_ROUTES` in hooks.server.ts to prevent the auth gate from redirecting crawlers to `/login`.

### 7. Decision: No Default `<meta name="robots" content="noindex">` in app.html

**Considered but rejected.** Google takes the most restrictive interpretation when conflicting `robots` directives exist. A default `noindex` in `app.html` would override the Seo component's `index, follow` on public pages. The X-Robots-Tag HTTP header handles blocking for non-public routes instead.

## Alternatives Considered

### Static robots.txt in `static/`

- **Pro:** Simpler, no route needed
- **Con:** Cannot use constants; bot list becomes a maintenance burden; no TypeScript
- **Decision:** Route-based with `prerender = true` gives the best of both worlds

### `svelte-meta-tags` NPM Package

- **Pro:** Battle-tested, handles edge cases
- **Con:** Extra dependency for 3 public pages; our Seo component is 50 lines
- **Decision:** Custom component — minimal, no dependency, full control

### CSP-based frame-ancestors Instead of X-Frame-Options

- **Pro:** CSP already has `frame-ancestors: 'none'`
- **Con:** X-Frame-Options is a defense-in-depth backup for older browsers
- **Decision:** Both — CSP is primary, X-Frame-Options is backup

### Cache Headers in hooks.server.ts

- **Considered** for static assets (`/_app/`, images)
- **Deferred:** In production, Nginx serves static assets directly and bypasses SvelteKit hooks entirely. Cache headers belong in `docker/nginx/nginx.conf`, not hooks.server.ts.

## Consequences

### Positive

- Public pages are discoverable by search engines with proper metadata
- Social media shares show rich previews (OG + Twitter Card)
- JSON-LD enables potential rich results in Google Search
- 7 security headers harden the application against common attacks
- AI training bots are explicitly blocked
- All authenticated routes are triple-protected: auth gate + robots.txt + X-Robots-Tag
- Favicon set covers all platforms (desktop, iOS, Android, PWA)
- Reusable Seo component makes adding meta tags to future public pages trivial

### Negative

- Base URL `https://www.assixx.com` is hardcoded in robots.txt, sitemap, canonical URLs, and OG tags. Environment-based URL configuration would be a future improvement.
- HSTS `preload` requires domain submission to hstspreload.org — not yet done
- Favicon PNGs add ~50 KB to the static directory

## References

- [Masterplan](../../FEAT_SEO_MASTERPLAN.md) — execution plan with session tracking
- [SvelteKit SEO Docs](https://svelte.dev/docs/kit/seo)
- [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Google Special Tags](https://developers.google.com/search/docs/crawling-indexing/special-tags)
- [SCS Website](../../../projects/website_scs) — Next.js reference implementation
- [MDN Security Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)

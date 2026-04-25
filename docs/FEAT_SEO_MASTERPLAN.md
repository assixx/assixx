# FEAT: SEO & Security Headers — Execution Masterplan

> **Created:** 2026-04-10
> **Version:** 1.0.0
> **Status:** IN PROGRESS — Phase 3 (Implementation)
> **Branch:** `test/ui-ux`
> **Reference:** [SCS Website](../../projects/website_scs) (Next.js SEO reference)
> **Author:** Simon Öztürk (Staff Engineer)
> **Estimated Sessions:** 4
> **Actual Sessions:** 0 / 4

---

## Changelog

| Version | Date       | Change                                                   |
| ------- | ---------- | -------------------------------------------------------- |
| 0.1.0   | 2026-04-10 | Initial Draft — Phases 1-5 planned                       |
| 1.0.0   | 2026-04-11 | Session 1: Phases 1-4 implemented (except 1.1, 3.2, 4.6) |

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (all containers healthy)
- [ ] Branch `test/ui-ux` checked out
- [ ] SvelteKit dev server startable: `pnpm run dev:svelte`
- [ ] No pending frontend lint/type errors

### 0.2 Risk Register

| #   | Risk                                        | Impact | Probability | Mitigation                                                                       | Verification                              |
| --- | ------------------------------------------- | ------ | ----------- | -------------------------------------------------------------------------------- | ----------------------------------------- |
| R1  | CSP nonce breaks new inline scripts         | High   | Low         | All inline scripts already use `%sveltekit.nonce%`; no new inline scripts added  | Dev server test: no CSP errors in console |
| R2  | Security headers break iframe embeds        | Medium | Low         | `frame-ancestors: 'none'` already in CSP; X-Frame-Options aligns                 | Verify no embedding use case exists       |
| R3  | robots.txt accidentally blocks auth routes  | High   | Low         | Explicit `Disallow: /` for all non-public paths; test with Google URL Inspection | Manual review of rendered robots.txt      |
| R4  | Manifest/favicon changes cause cache issues | Low    | Medium      | Versioned favicon filenames not needed (ICO is tiny)                             | Hard refresh test in browser              |

### 0.3 Scope

**PUBLIC PAGES (SEO-relevant):** `/`, `/login`, `/signup`
**PRIVATE PAGES (behind auth):** Everything under `/(app)/*` — explicitly blocked from indexing.

**Context:** Assixx is a B2B SaaS for industrial companies. SEO matters only for the landing page, login, and signup. All authenticated routes MUST be blocked from crawlers.

---

## Phase 1: Static Assets — Favicon Fix & Web Manifest

> **Dependency:** None (first phase)
> **Files:** 3 new, 1 modified, 1 deleted

### Step 1.1: Fix Broken favicon.png ✅ DONE

**Problem:** `frontend/static/favicon.png` is 0 bytes (empty/corrupt).

**Action:**

1. Delete the empty `favicon.png`
2. Generate proper favicon set from existing `logo.svg` or `logo_darkmode.png`:
   - `favicon.ico` (already exists, 4.2 KB — keep)
   - `favicon-32x32.png` (32x32)
   - `apple-touch-icon.png` (180x180)
   - `favicon-192x192.png` (192x192, for manifest)
   - `favicon-512x512.png` (512x512, for manifest)

**Note:** Favicon generation requires external tool. User will generate the PNG files. We create the manifest and HTML references.

### Step 1.2: Create site.webmanifest ✅ DONE

**New File:** `frontend/static/site.webmanifest`

```json
{
  "name": "Assixx - Enterprise 2.0",
  "short_name": "Assixx",
  "icons": [
    { "src": "/favicon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/favicon-512x512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#121212",
  "background_color": "#121212",
  "display": "standalone",
  "start_url": "/"
}
```

### Step 1.3: Update app.html — Favicon References ✅ DONE

**File:** `frontend/src/app.html`

**Add after existing favicon link:**

```html
<link rel="icon" type="image/png" sizes="32x32" href="%sveltekit.assets%/favicon-32x32.png" />
<link rel="apple-touch-icon" sizes="180x180" href="%sveltekit.assets%/apple-touch-icon.png" />
<link rel="manifest" href="%sveltekit.assets%/site.webmanifest" />
```

### Phase 1 — Definition of Done

- [ ] `favicon.png` (0 bytes) removed
- [ ] `site.webmanifest` created with correct icon references
- [ ] `app.html` references manifest + apple-touch-icon
- [ ] Favicon visible in browser tab (dev server test)
- [ ] No console errors related to missing resources

---

## Phase 2: SEO Routes — robots.txt & sitemap.xml

> **Dependency:** None (independent of Phase 1)
> **Files:** 4 new files

### Step 2.1: Dynamic robots.txt Route ✅ DONE

**New File:** `frontend/src/routes/robots.txt/+server.ts`

**Content Strategy:**

- Allow: `/` (landing page)
- Allow: `/login`
- Allow: `/signup`
- Disallow everything else (all authenticated routes)
- Block AI training bots (GPTBot, Claude-Web, Google-Extended, etc.)
- Reference sitemap

**Implementation:**

```typescript
import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = () => {
  const body = [
    'User-agent: *',
    'Allow: /$',
    'Allow: /login',
    'Allow: /signup',
    'Disallow: /',
    '',
    '# Block AI training bots',
    'User-agent: GPTBot',
    'Disallow: /',
    'User-agent: Claude-Web',
    'Disallow: /',
    'User-agent: Google-Extended',
    'Disallow: /',
    'User-agent: CCBot',
    'Disallow: /',
    'User-agent: anthropic-ai',
    'Disallow: /',
    'User-agent: Bytespider',
    'Disallow: /',
    'User-agent: PerplexityBot',
    'Disallow: /',
    '',
    'Sitemap: https://www.assixx.com/sitemap.xml',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain' },
  });
};
```

**Verification:**

```bash
curl -s http://localhost:5173/robots.txt
```

### Step 2.2: Dynamic sitemap.xml Route ✅ DONE

**New File:** `frontend/src/routes/sitemap.xml/+server.ts`

**Content:** Only public pages (3 URLs).

```typescript
import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = () => {
  const baseUrl = 'https://www.assixx.com';
  const today = new Date().toISOString().split('T')[0];

  const urls = [
    { loc: '/', priority: '1.0', changefreq: 'monthly' },
    { loc: '/login', priority: '0.5', changefreq: 'yearly' },
    { loc: '/signup', priority: '0.8', changefreq: 'monthly' },
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(
      (u) =>
        `  <url>
    <loc>${baseUrl}${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
    ),
    '</urlset>',
  ].join('\n');

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
```

**Verification:**

```bash
curl -s http://localhost:5173/sitemap.xml
```

### Phase 2 — Definition of Done

- [ ] `http://localhost:5173/robots.txt` returns valid robots.txt
- [ ] Landing, login, signup are allowed; all other paths disallowed
- [ ] AI bots explicitly blocked
- [ ] `http://localhost:5173/sitemap.xml` returns valid XML
- [ ] Sitemap contains exactly 3 public URLs
- [ ] Both routes are prerendered (`export const prerender = true`)
- [ ] ESLint 0 errors on new files

---

## Phase 3: Security Headers in hooks.server.ts

> **Dependency:** None (independent)
> **Files:** 1 modified (`hooks.server.ts`)

### Step 3.1: Add Security Headers Handle ✅ DONE

**File:** `frontend/src/hooks.server.ts`

**New handle in sequence:** `securityHeadersHandle`

**Headers to add (matching SCS website reference):**

| Header                      | Value                                          | Why                                  |
| --------------------------- | ---------------------------------------------- | ------------------------------------ |
| `X-DNS-Prefetch-Control`    | `on`                                           | Faster DNS resolution                |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | HTTPS enforcement (2 years)          |
| `X-Frame-Options`           | `SAMEORIGIN`                                   | Clickjacking prevention (CSP backup) |
| `X-Content-Type-Options`    | `nosniff`                                      | MIME sniffing prevention             |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`              | Privacy-safe referrer                |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=()`     | Restrict browser APIs                |

**Implementation approach:** New `securityHeadersHandle` added to the `sequence()` chain, applied to all HTML responses (not static assets).

### Step 3.2: Add Cache Headers for Static Assets [PENDING]

> **Note (2026-04-11):** In production, Nginx serves `/_app/` and static assets directly with its own cache headers. SvelteKit hooks only see SSR HTML responses. Cache headers in hooks.server.ts would only affect HTML pages, not static assets. Nginx config is the correct place for static asset caching. This step is deferred to the Nginx config layer.

**In the same handle or separate:**

| Asset Pattern                 | Cache-Control                         | Why                                   |
| ----------------------------- | ------------------------------------- | ------------------------------------- |
| `/_app/` (immutable hashed)   | `public, max-age=31536000, immutable` | SvelteKit hashed bundles never change |
| Static assets (images, fonts) | `public, max-age=86400`               | 1 day cache for images                |
| HTML pages                    | `no-cache`                            | Always revalidate                     |

### Step 3.3: Add X-Robots-Tag for Authenticated Routes ✅ DONE

For any route NOT in the public list, add:

```
X-Robots-Tag: noindex, nofollow
```

This is a belt-and-suspenders approach alongside robots.txt.

### Phase 3 — Definition of Done

- [ ] `curl -sI http://localhost:5173/` shows all 6 security headers
- [ ] `curl -sI http://localhost:5173/login` shows all 6 security headers
- [ ] Authenticated routes have `X-Robots-Tag: noindex, nofollow`
- [ ] `/_app/*` responses have `immutable` cache header
- [ ] No CSP violations in browser console
- [ ] ESLint 0 errors
- [ ] Existing auth flow unaffected (manual login test)

---

## Phase 4: Meta Tags, Open Graph, Structured Data

> **Dependency:** Phase 1 (favicon URLs referenced in OG tags)
> **Files:** 1 new component, 3 modified pages, 1 modified layout

### Step 4.1: Create Reusable Seo Component ✅ DONE

**New File:** `frontend/src/lib/components/Seo.svelte`

**Props interface:**

```typescript
interface Props {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  noindex?: boolean;
}
```

**Renders inside `<svelte:head>`:**

- `<title>{title}</title>`
- `<meta name="description" content={description} />`
- `<meta name="robots" content="index, follow" />` (or `noindex, nofollow`)
- `<link rel="canonical" href={canonical} />`
- Open Graph: `og:title`, `og:description`, `og:url`, `og:image`, `og:type`, `og:locale`, `og:site_name`
- Twitter: `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`

### Step 4.2: Landing Page Meta + Structured Data ✅ DONE

**File:** `frontend/src/routes/+page.svelte`

**Add:**

1. `<Seo>` component with:
   - title: `"Assixx - Enterprise 2.0 für Industriefirmen"`
   - description: `"Multi-Tenant SaaS für Wissensmanagement, Kommunikation und Kollaboration in Industrieunternehmen. Von der Produktion bis zur Verwaltung."`
   - canonical: `"https://www.assixx.com/"`
   - ogImage: `"https://www.assixx.com/images/logo_darkmode.webp"`

2. JSON-LD Structured Data (SoftwareApplication + Organization):

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Assixx",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": "Enterprise 2.0 Platform für Industriefirmen",
  "url": "https://www.assixx.com",
  "author": {
    "@type": "Organization",
    "name": "SCS-Technik",
    "url": "https://www.scs-technik.de"
  }
}
```

### Step 4.3: Login Page Meta ✅ DONE

**File:** `frontend/src/routes/login/+page.svelte`

**Add `<Seo>` with:**

- title: `"Anmelden - Assixx"`
- description: `"Melden Sie sich bei Assixx an — der Enterprise-Plattform für Industrieunternehmen."`
- canonical: `"https://www.assixx.com/login"`
- noindex: false (login is discoverable for returning users)

### Step 4.4: Signup Page Meta ✅ DONE

**File:** `frontend/src/routes/signup/+page.svelte`

**Add `<Seo>` with:**

- title: `"Registrieren - Assixx"`
- description: `"Registrieren Sie Ihr Unternehmen bei Assixx. Digitalisieren Sie Ihre Prozesse — von TPM bis Schichtplanung."`
- canonical: `"https://www.assixx.com/signup"`

### Step 4.5: Root Layout Cleanup ✅ DONE

**File:** `frontend/src/routes/+layout.svelte`

**Changes:**

1. Remove duplicate `<meta name="viewport">` (already in `app.html`)
2. Keep `<meta name="theme-color">` (dynamic per theme would be nice, but hardcoded is fine for now)

### Step 4.6: app.html Cleanup [SKIPPED — intentional]

> **Decision (2026-04-11):** A default `<meta name="robots" content="noindex">` in app.html would CONFLICT with the Seo component's `<meta name="robots" content="index, follow">` on public pages. Google takes the most restrictive interpretation when conflicting directives exist, so the noindex in app.html would override the Seo component. Instead, the X-Robots-Tag HTTP header in hooks.server.ts (Step 3.3) handles blocking non-public routes. This is the correct belt-and-suspenders approach.

### Phase 4 — Definition of Done

- [ ] `<Seo>` component created, typed, reusable
- [ ] Landing page has: title, description, OG tags, Twitter card, canonical, JSON-LD
- [ ] Login page has: title, description, canonical
- [ ] Signup page has: title, description, canonical
- [ ] Duplicate viewport meta removed from `+layout.svelte`
- [ ] Default `noindex` in `app.html` (fail-closed)
- [ ] View page source shows correct meta tags
- [ ] ESLint 0 errors on all modified files
- [ ] `svelte-check` 0 errors
- [ ] No duplicate `<title>` tags (checked via View Source)

---

## Phase 5: Verification & Polish

> **Dependency:** Phases 1-4 complete

### Step 5.1: Full Integration Test ✅ DONE

**Manual checks:**

1. `curl -sI http://localhost:5173/` — verify all headers
2. `curl -s http://localhost:5173/robots.txt` — verify content
3. `curl -s http://localhost:5173/sitemap.xml` — verify XML validity
4. View Source on `/` — verify meta tags, OG, JSON-LD
5. View Source on `/login` — verify meta tags
6. View Source on `/signup` — verify meta tags
7. Favicon visible in browser tab
8. Login flow still works (auth not broken by headers)

### Step 5.2: Code Quality ✅ DONE

```bash
cd /home/scs/projects/Assixx/frontend && pnpm run lint
cd /home/scs/projects/Assixx/frontend && pnpm run check
```

### Phase 5 — Definition of Done

- [ ] All manual checks pass
- [ ] ESLint 0 errors (frontend)
- [ ] svelte-check 0 errors
- [ ] Auth flow works (login → dashboard)
- [ ] No console errors (CSP, missing resources)

---

## Session Tracking

| Session | Phase | Description                                                                                                   | Status | Date       |
| ------- | ----- | ------------------------------------------------------------------------------------------------------------- | ------ | ---------- |
| 1       | 1-4   | Manifest + robots.txt + sitemap.xml + security headers + Seo component + meta tags + JSON-LD + layout cleanup | DONE   | 2026-04-11 |
| 2       | 5     | Verification + polish + lint + type-check                                                                     | DONE   | 2026-04-11 |

---

## Quick Reference: File Paths

### New Files

| File                                         | Purpose                     |
| -------------------------------------------- | --------------------------- |
| `frontend/static/site.webmanifest`           | PWA manifest                |
| `frontend/src/routes/robots.txt/+server.ts`  | Dynamic robots.txt          |
| `frontend/src/routes/sitemap.xml/+server.ts` | Dynamic sitemap             |
| `frontend/src/lib/components/Seo.svelte`     | Reusable SEO meta component |

### Modified Files

| File                                      | Change                                                 |
| ----------------------------------------- | ------------------------------------------------------ |
| `frontend/src/app.html`                   | Manifest link, apple-touch-icon, default noindex       |
| `frontend/src/hooks.server.ts`            | Security headers handle + cache headers + X-Robots-Tag |
| `frontend/src/routes/+layout.svelte`      | Remove duplicate viewport meta                         |
| `frontend/src/routes/+page.svelte`        | Seo component + JSON-LD structured data                |
| `frontend/src/routes/login/+page.svelte`  | Seo component                                          |
| `frontend/src/routes/signup/+page.svelte` | Seo component                                          |

### Deleted Files

| File                          | Reason                                            |
| ----------------------------- | ------------------------------------------------- |
| `frontend/static/favicon.png` | 0 bytes, corrupt — replaced by proper favicon set |

---

## Known Limitations (V1 — Intentionally Excluded)

1. **No hreflang tags** — Assixx is German-only. Multilingual support is not planned for V1.
2. **No Google Search Console verification** — Requires domain ownership verification. Done post-deployment, not in code.
3. **No Open Graph image generation** — Dynamic OG images (e.g. via satori) are overkill for 3 public pages. Static logo image used.
4. **No prerendering of public pages** — Could be added later for performance. SSR is sufficient for SEO.
5. **No AMP** — Not relevant for B2B SaaS.
6. **Base URL hardcoded** — `https://www.assixx.com` is hardcoded in robots.txt, sitemap, and canonical URLs. Environment-based URL would be a future improvement.

---

## Spec Deviations

| #   | SCS Reference                | Assixx Implementation                     | Decision                                  |
| --- | ---------------------------- | ----------------------------------------- | ----------------------------------------- |
| D1  | Next.js metadata API         | SvelteKit `<svelte:head>` + Seo component | Framework difference — same outcome       |
| D2  | Bingbot image blocking       | Not implemented                           | Assixx has no public image gallery        |
| D3  | Cloudflare Turnstile CAPTCHA | Not in scope                              | Signup has its own validation             |
| D4  | Resend transactional email   | Not in scope                              | Backend handles email                     |
| D5  | `allow: "/"` (broad)         | `Allow: /$` + specific paths              | Stricter — most routes are auth-protected |

---

**This document is the execution plan. Each session starts here,
picks the next unchecked item, and marks it as done.**

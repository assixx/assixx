import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Preprocessor für TypeScript und PostCSS
  preprocess: vitePreprocess(),

  kit: {
    // Node Adapter für NestJS Backend Kompatibilität
    adapter: adapter({
      out: 'build',
      precompress: true,
    }),

    // Aliases für saubere Imports
    alias: {
      $components: 'src/lib/components',
      $ui: 'src/lib/components/ui',
      $layout: 'src/lib/components/layout',
      $features: 'src/lib/components/features',
      $stores: 'src/lib/stores',
      $utils: 'src/lib/utils',
      $types: 'src/lib/types',
      $styles: 'src/styles',
      '$design-system': 'src/design-system',
    },

    // CSP Headers für Sicherheit
    // nonce-based: SvelteKit generates per-request cryptographic nonce for inline SSR scripts
    // This is strictly better than unsafe-inline — only scripts with the correct nonce execute
    // @see docs/plans/IMPLEMENT-E2E-ENCRYPTION.md (Section 6.6)
    csp: {
      mode: 'nonce',
      directives: {
        'default-src': ['self'],
        // nonce added automatically by SvelteKit for inline scripts (SSR hydration)
        // Cloudflare Turnstile widget loads from challenges.cloudflare.com
        'script-src': ['self', 'https://challenges.cloudflare.com'],
        // Allow styles: self + inline + Google Fonts
        'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
        // Allow fonts: self + Google Fonts
        'font-src': ['self', 'https://fonts.gstatic.com'],
        // Allow connections: Sentry + WebSocket (dev + prod) + Microsoft OAuth
        // + cross-origin within the ADR-050 tenant trust family.
        //
        // login.microsoftonline.com is whitelisted defensively per
        // FEAT_MICROSOFT_OAUTH_MASTERPLAN §0.3 / §5.6. V1's actual flow does
        // NOT require it — browser JS never fetch()es Microsoft directly; all
        // provider traffic is server-side (backend exchanges the code + verifies
        // id_token). The 302 redirects from backend → Microsoft → backend are
        // top-level navigations governed by default-src, not connect-src.
        //
        // Keeping it listed prevents future drift: when V2 adds client-side
        // Microsoft Graph calls (Teams sync, calendar sync) or a JS-triggered
        // re-auth, this directive is already correct. Whitelisting a non-used
        // origin is zero-harm — CSP is an allow-list, nothing else relies on
        // the domain being blocked.
        //
        // ADR-050 Amendment (Logout → Apex) — cross-origin HTTP access inside
        // the `*.assixx.com` + `*.localhost` trust family:
        //   - dev  `http://localhost:*` + `http://*.localhost:*` so a tenant
        //     subdomain page can fetch() the apex (e.g. prefetch apex `/login`
        //     before logout hard-nav to warm Vite's compile cache — without
        //     this, the prefetch fails silently on CSP and the user sees a
        //     500–1000 ms blank frame during cross-origin navigation).
        //   - prod `https://assixx.com` + `https://*.assixx.com` so the same
        //     prefetch works against the prod apex from any tenant subdomain.
        // Cross-tenant data leak risk is structurally blocked elsewhere
        // (ADR-050 §Decision R15 `CROSS_TENANT_HOST_MISMATCH` rejects any
        // JWT whose tenant_id doesn't match the request host — opening
        // connect-src only lets JS reach the apex, which is the public /
        // marketing / signup surface with no tenant data).
        'connect-src': [
          'self',
          '*.ingest.de.sentry.io',
          '*.sentry.io',
          // Dev (Vite dev server + optional subdomain routing via /etc/hosts)
          'http://localhost:*',
          'http://*.localhost:*',
          'ws://localhost:*',
          // Prod (wildcard TLS cert covers apex + all tenant subdomains)
          'https://assixx.com',
          'https://*.assixx.com',
          'wss://*.assixx.com',
          'https://login.microsoftonline.com',
          // Turnstile bot-detection telemetry: the widget POSTs to
          // /cdn-cgi/challenge-platform/h/g/flow/... and GETs PAT challenges
          // from challenges.cloudflare.com. Without this entry those XHRs
          // are blocked by connect-src, the widget falls back to a degraded
          // path, and the console fills with CSP violations.
          // @see https://developers.cloudflare.com/turnstile/reference/content-security-policy/
          'https://challenges.cloudflare.com',
        ],
        // Allow Web Workers (CryptoWorker uses blob: in dev, self in prod)
        'worker-src': ['self', 'blob:'],
        // Allow images: self + data URIs (for inline SVGs, etc.)
        'img-src': ['self', 'data:', 'blob:'],
        // Cloudflare Turnstile renders challenge in an iframe
        'frame-src': ['https://challenges.cloudflare.com'],
        // Security: block object embeds and frame ancestors
        'object-src': ['none'],
        'base-uri': ['self'],
        'frame-ancestors': ['none'],
      },
    },

    // Experimental features for Sentry instrumentation
    experimental: {
      // Required for Sentry server-side tracing
      instrumentation: {
        server: true,
      },
    },
  },
};

export default config;

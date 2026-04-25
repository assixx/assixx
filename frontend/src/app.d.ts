// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { UserRole } from '@assixx/shared';

/**
 * User data stored in locals after RBAC check
 */
interface LocalsUser {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  tenantId: number;
  hasFullAccess?: boolean;
}

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      /** Authenticated user data (set by RBAC hook) */
      user: LocalsUser | null;
      /**
       * Tenant subdomain slug extracted from the request host by the
       * `hostResolverHandle` in `hooks.server.ts`.
       *
       * - `string` → request came in on `<slug>.assixx.com`; `(public)`
       *             layout should fetch per-tenant branding.
       * - `null`   → apex / localhost / IP / nested subdomain / garbage;
       *             use the default Assixx brand.
       *
       * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md
       * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 5 Step 5.1
       */
      hostSlug: string | null;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  /**
   * Build-time version constant, injected by Vite `define` from
   * `frontend/package.json`. Syncs automatically with Changesets
   * (`pnpm changeset:version` bumps the field → rebuild picks it up).
   * See `frontend/vite.config.ts` and docs/how-to/HOW-TO-USE-CHANGESETS.md.
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention -- Vite define convention uses __SCREAMING_SNAKE__
  const __APP_VERSION__: string;

  /** Cloudflare Turnstile Widget render options */
  interface TurnstileRenderOptions {
    sitekey: string;
    callback?: (token: string) => void;
    'expired-callback'?: () => void; // eslint-disable-line @typescript-eslint/naming-convention -- Cloudflare Turnstile API
    'error-callback'?: () => void; // eslint-disable-line @typescript-eslint/naming-convention -- Cloudflare Turnstile API
    theme?: 'auto' | 'light' | 'dark';
    // 'invisible' is NOT a valid value — Cloudflare API rejects it.
    // Invisible widget mode is configured in the Cloudflare Dashboard, not here.
    size?: 'normal' | 'flexible' | 'compact';
    action?: string;
    language?: string;
  }

  /** Cloudflare Turnstile Widget API */
  interface TurnstileApi {
    render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
    reset: (widgetId: string) => void;
    remove: (widgetId: string) => void;
  }

  interface Window {
    turnstile?: TurnstileApi;
    onTurnstileLoad?: () => void;
  }
}

/**
 * Module augmentation: adds a string overload for resolve().
 *
 * SvelteKit's generic resolve<T>() only accepts generated Pathname/RouteId
 * literal types. Runtime-computed paths (variables, template literals from
 * config objects) can't satisfy that constraint.
 *
 * This overload lets resolve() accept plain strings as a fallback while
 * keeping full type safety for string literals (matched by the generic first).
 */
declare module '$app/paths' {
  export function resolve(pathname: string): string;
}

export {};

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
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

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

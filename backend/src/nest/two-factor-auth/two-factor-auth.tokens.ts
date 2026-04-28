/**
 * Dependency-Injection tokens for the Two-Factor Authentication module.
 *
 * WHY a leaf file: services that consume the token must not import the
 * module file (would create a service<->module cycle and trip
 * `import-x/no-cycle` in eslint.config.mjs). Mirrors the same split used
 * by `auth/oauth/oauth.tokens.ts`.
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.2)
 */

/**
 * Provider key for the dedicated ioredis client used by the 2FA module.
 *
 * The client is configured with `keyPrefix: '2fa:'` so every command is
 * automatically scoped to the 2FA namespace, isolating it from `throttle:`
 * and `oauth:` keyspaces.
 */
export const TWO_FA_REDIS = Symbol('TWO_FA_REDIS');

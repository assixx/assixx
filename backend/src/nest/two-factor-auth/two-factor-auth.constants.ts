/**
 * Two-Factor Authentication (Email-Based) — Configuration Constants.
 *
 * WHY: Single source of truth for all time windows, retry limits, and code
 * format settings used by `TwoFactorCodeService` (Step 2.2) and
 * `TwoFactorAuthService` (Step 2.3). Centralization lets a security review
 * audit every TTL/cap in one file instead of greping through services.
 *
 * Decision references — see docs/FEAT_2FA_EMAIL_MASTERPLAN.md §0.4:
 *   - DD-1 / DD-12 (v0.3.1): 6-char Crockford-Base32 subset, no confusables (0/1/I/L/O).
 *   - DD-2: Code TTL = 10 min (NIST 800-63B AAL1+).
 *   - DD-5: Max wrong attempts per challenge = 5.
 *   - DD-6: User lockout duration = 15 min.
 *   - DD-9: Resend cooldown = 60 s; resend extends challenge TTL.
 *   - DD-21: Max resends per challenge = 3 (anti-SMTP-spam-trap).
 */

/** Code time-to-live in Redis (10 minutes per DD-2). */
export const CODE_TTL_SEC = 600;

/** Max wrong code attempts per challenge before lockout (DD-5). */
export const MAX_ATTEMPTS = 5;

/** User lockout duration after MAX_ATTEMPTS exceeded (DD-6, 15 minutes). */
export const LOCKOUT_SEC = 900;

/** Cooldown between resend requests on the same challenge (DD-9, 60 seconds). */
export const RESEND_COOLDOWN_SEC = 60;

/** Hard cap on resends per challenge token (DD-21). */
export const MAX_RESENDS_PER_CHALLENGE = 3;

/**
 * Crockford-Base32 alphabet subset (v0.3.1) — 31 characters.
 * Excludes confusables 0/1/I/L/O (DD-1) for screen-glare environments
 * common in industrial settings (factory shop-floor displays).
 * Keyspace: 31^6 ≈ 887 M permutations (R2 brute-force mitigation).
 */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Code length in characters (DD-1). */
export const CODE_LENGTH = 6;

/**
 * Per-user wrong-code streak TTL — 24 hours.
 *
 * The fail streak is the brute-force detector that survives resends
 * (DD-9 explicitly opts out of resetting it). It catches "rapid retry across
 * freshly-issued challenges" which the per-challenge MAX_ATTEMPTS cap misses.
 *
 * TTL is anchored to the FIRST failure: `INCR` sets the counter, `EXPIRE`
 * seeds the 24 h window exactly once on the 0→1 transition; subsequent
 * INCRs do not extend it. See `TwoFactorCodeService.incrementFailStreak`.
 */
export const FAIL_STREAK_TTL_SEC = 86_400;

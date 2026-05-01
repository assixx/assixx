/**
 * Two-Factor Authentication — Crypto + Redis Primitives.
 *
 * STATUS: Phase 2 Step 2.2 (masterplan v0.6.0).
 *
 * Layer position: this is the LOWEST layer of the 2FA stack — only Node
 * `crypto` and Redis I/O. Orchestration (issue / verify / resend / clear-
 * lockout) lives in `TwoFactorAuthService` (Step 2.3). The split lets unit
 * tests (Phase 3, ≥ 25 tests) fake the Redis client cleanly without dragging
 * in the email module, audit trail, or DB writes.
 *
 * Redis keyspace (full keys = client `keyPrefix='2fa:'` + sub-key below):
 *
 *   2fa:challenge:{token}     ChallengeRecord JSON, TTL CODE_TTL_SEC (10 min)
 *   2fa:lock:{userId}         empty value, TTL LOCKOUT_SEC      (15 min)
 *   2fa:fail-streak:{userId}  integer counter, TTL FAIL_STREAK_TTL_SEC (24 h)
 *   2fa:resend:{token}        empty value, TTL RESEND_COOLDOWN_SEC (60 s)
 *
 * Pattern reference: `auth/oauth/oauth-state.service.ts` — same Redis-via-
 * DI-token style. The project does NOT use a `RedisService` wrapper.
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.2, table of methods)
 * @see DD-3 (sha256 at rest, never plaintext)
 * @see DD-4 (challenge token = opaque base64url(32 bytes), single-use)
 * @see DD-9 (resend extends challenge TTL + resets attemptCount, NOT failStreak)
 * @see R7  (race "two parallel resend": single key, SET overwrites — by design)
 * @see R8  (challenge-token theft: single-use enforcement via consumeChallenge)
 * @see R10 (timing attack: hash compare via `crypto.timingSafeEqual`)
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import {
  CODE_TTL_SEC,
  FAIL_STREAK_TTL_SEC,
  LOCKOUT_SEC,
  RESEND_COOLDOWN_SEC,
} from './two-factor-auth.constants.js';
import { TWO_FA_REDIS } from './two-factor-auth.tokens.js';
import type { ChallengePurpose, ChallengeRecord } from './two-factor-auth.types.js';

// Sub-key prefixes — the leading '2fa:' is supplied by the ioredis client's
// `keyPrefix` (set in `two-factor-auth.module.ts`). Keeping the sub-prefixes
// here as constants prevents typos at call-sites.
const CHALLENGE_KEY = 'challenge:';
const LOCK_KEY = 'lock:';
const FAIL_STREAK_KEY = 'fail-streak:';
const RESEND_KEY = 'resend:';

/** 32 random bytes → ~43 chars base64url, matches DD-4 (≥ 256 bits entropy). */
const TOKEN_BYTES = 32;

@Injectable()
export class TwoFactorCodeService {
  constructor(@Inject(TWO_FA_REDIS) private readonly redis: Redis) {}

  // -------------------------------------------------------------------------
  // Challenge lifecycle
  // -------------------------------------------------------------------------

  /**
   * Mint a new challenge token and persist the record at
   * `2fa:challenge:{token}` with TTL `CODE_TTL_SEC`.
   *
   * The caller (TwoFactorAuthService.issueChallenge) computes `record.codeHash`
   * via {@link hashCode} BEFORE calling this method — the plaintext code never
   * crosses this layer (DD-3).
   */
  async createChallenge(record: ChallengeRecord): Promise<string> {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    await this.redis.set(`${CHALLENGE_KEY}${token}`, JSON.stringify(record), 'EX', CODE_TTL_SEC);
    return token;
  }

  /**
   * Read + parse the challenge record. Returns `null` on:
   *   - missing key (expired, never existed, or already consumed)
   *   - corrupted payload (defense against tampered Redis dumps)
   *
   * Step 2.3 only ever writes valid `ChallengeRecord` JSON, so a Zod
   * re-validation on every read would be paranoid overhead — the parse
   * try/catch is enough to fail-safe to "no challenge".
   */
  async loadChallenge(token: string): Promise<ChallengeRecord | null> {
    const raw = await this.redis.get(`${CHALLENGE_KEY}${token}`);
    if (raw === null) {
      return null;
    }
    try {
      return JSON.parse(raw) as ChallengeRecord;
    } catch {
      return null;
    }
  }

  /**
   * Atomically delete the challenge key — single-use enforcement (R8).
   * Called on successful verify and from the SMTP-failure cleanup path.
   */
  async consumeChallenge(token: string): Promise<void> {
    await this.redis.del(`${CHALLENGE_KEY}${token}`);
  }

  /**
   * Overwrite the challenge record with two distinct TTL behaviors:
   *   - `extendTtl=true`  → resend path (DD-9): TTL reset to full CODE_TTL_SEC.
   *   - `extendTtl=false` → failed-attempt bookkeeping: keep remaining TTL via
   *                         `SET … KEEPTTL` (Redis 6.0+; project runs 8.x).
   *
   * Single Redis key per challenge — `SET` overwrites previous (R7 by design:
   * two parallel resends → second wins, only one valid code at a time).
   */
  async updateChallenge(token: string, record: ChallengeRecord, extendTtl: boolean): Promise<void> {
    const key = `${CHALLENGE_KEY}${token}`;
    const value = JSON.stringify(record);
    if (extendTtl) {
      await this.redis.set(key, value, 'EX', CODE_TTL_SEC);
    } else {
      await this.redis.set(key, value, 'KEEPTTL');
    }
  }

  // -------------------------------------------------------------------------
  // Crypto
  // -------------------------------------------------------------------------

  /**
   * `sha256(userId + ':' + code + ':' + purpose)` — DD-3.
   *
   * `purpose` is salted in so the same plaintext code that happens to be
   * issued for both a login and a signup challenge to the same user produces
   * DIFFERENT hashes. This blocks "purpose-confusion" attacks (using a signup
   * code on the login challenge or vice-versa).
   */
  hashCode(userId: number, code: string, purpose: ChallengePurpose): string {
    return createHash('sha256').update(`${userId}:${code}:${purpose}`).digest('hex');
  }

  /**
   * Constant-time hash comparison via `crypto.timingSafeEqual` (R10).
   *
   * Returns `false` if the decoded hex buffers differ in length —
   * `timingSafeEqual` would otherwise throw (it does not handle mismatched
   * lengths internally because doing so would itself leak length via timing).
   * Both operands derive from sha256 → both are 32 bytes in practice; the
   * length guard is defense against a truncated/corrupted `record.codeHash`.
   */
  verifyCode(record: ChallengeRecord, code: string): boolean {
    const computed = this.hashCode(record.userId, code, record.purpose);
    const stored = Buffer.from(record.codeHash, 'hex');
    const candidate = Buffer.from(computed, 'hex');
    if (stored.length !== candidate.length) {
      return false;
    }
    return timingSafeEqual(stored, candidate);
  }

  // -------------------------------------------------------------------------
  // Per-user fail streak (24 h, NOT reset by resend per DD-9)
  // -------------------------------------------------------------------------

  /**
   * Increment the per-user wrong-code counter and return the new value.
   *
   * On the 0→1 transition, set the 24 h TTL exactly once. Subsequent
   * `INCR`s do not extend the TTL — the rolling 24 h window is anchored
   * to the FIRST failure (intentional: prevents an attacker from spreading
   * 5+ wrong codes over multiple days to evade the cap).
   *
   * Tiny window (sub-millisecond) between `INCR` and `EXPIRE` on the first
   * hit is acceptable per the plan; if the process dies in between, the key
   * persists without TTL — caught by the next legitimate INCR on the same
   * user (which sees newCount > 1, leaves TTL alone) or by Redis maxmemory
   * policy. Plan does NOT require a Lua script for this.
   */
  async incrementFailStreak(userId: number): Promise<number> {
    const key = `${FAIL_STREAK_KEY}${userId}`;
    const newCount = await this.redis.incr(key);
    if (newCount === 1) {
      await this.redis.expire(key, FAIL_STREAK_TTL_SEC);
    }
    return newCount;
  }

  /** Read current fail-streak (0 if no key, 0 on parse error). */
  async getFailStreak(userId: number): Promise<number> {
    const raw = await this.redis.get(`${FAIL_STREAK_KEY}${userId}`);
    if (raw === null) {
      return 0;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  /** Wipe the streak — called on successful verify and on root lockout-clear. */
  async clearFailStreak(userId: number): Promise<void> {
    await this.redis.del(`${FAIL_STREAK_KEY}${userId}`);
  }

  // -------------------------------------------------------------------------
  // Lockout (15 min, per user)
  // -------------------------------------------------------------------------

  /**
   * Place the user into a 15-minute lockout (DD-6).
   * Empty value — only key existence matters.
   */
  async setLockout(userId: number): Promise<void> {
    await this.redis.setex(`${LOCK_KEY}${userId}`, LOCKOUT_SEC, '');
  }

  /** True if the user is currently locked out. */
  async isLocked(userId: number): Promise<boolean> {
    const exists = await this.redis.exists(`${LOCK_KEY}${userId}`);
    return exists === 1;
  }

  /**
   * Clear the lockout — called by the root `clear-lockout` endpoint (DD-8).
   * Note: this does NOT bypass 2FA; the user must still pass a fresh
   * challenge on the next login attempt. The orchestrator (Step 2.3) is
   * responsible for also calling {@link clearFailStreak} alongside this.
   */
  async clearLockout(userId: number): Promise<void> {
    await this.redis.del(`${LOCK_KEY}${userId}`);
  }

  // -------------------------------------------------------------------------
  // Resend cooldown (60 s, per challenge token)
  // -------------------------------------------------------------------------

  /** Mark the challenge as on resend-cooldown for `RESEND_COOLDOWN_SEC`. */
  async setResendCooldown(token: string): Promise<void> {
    await this.redis.setex(`${RESEND_KEY}${token}`, RESEND_COOLDOWN_SEC, '');
  }

  /** True if the cooldown key still exists for this challenge token. */
  async isResendOnCooldown(token: string): Promise<boolean> {
    const exists = await this.redis.exists(`${RESEND_KEY}${token}`);
    return exists === 1;
  }
}

/**
 * Shift Handover — DI Tokens.
 *
 * Collects unique-symbol tokens for test-mockable dependencies. Keeping
 * the clock behind a token (rather than calling `Date.now()` in services)
 * is a hard rule in plan §2.3 — tests substitute a fixed `nowUtc` so the
 * active-shift window, 24 h auto-lock, and Europe/Berlin edge cases are
 * deterministic.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2.3 (clock-injection rule)
 */

/**
 * Clock provider for time-sensitive logic. Shape: a zero-arg function
 * that returns a fresh `Date` in UTC. Production binding returns
 * `new Date()`; test binding returns a frozen instant.
 */
export const SHIFT_HANDOVER_CLOCK = Symbol('SHIFT_HANDOVER_CLOCK');
export type ShiftHandoverClock = () => Date;

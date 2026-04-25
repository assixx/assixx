/**
 * Unit tests for `ShiftHandoverCronService` — Plan §2.8 (auto-lock shim).
 *
 * The service is a thin scheduling adapter around
 * `ShiftHandoverEntriesService.runAutoLockSweep(nowUtc)`. This test covers
 * the entire shim contract:
 *
 *  - Forwards `new Date()` as `nowUtc` so the §2.5 purity contract is
 *    preserved end-to-end (tests can pin the sweep at fixed instants).
 *  - Uses `Logger.log()` on non-empty sweeps, `Logger.debug()` on empty
 *    sweeps — operations grep for the count; empty debug keeps the
 *    success log clean.
 *  - Caps the id-list dump at `MAX_LOGGED_IDS = 10` with `…` suffix on
 *    overflow (unbounded-line defense; original id list recoverable via
 *    `audit_trail`).
 *  - Catches and logs any throw from `runAutoLockSweep` via
 *    `getErrorMessage()` (TS-Standards §7.3) — a `@Cron` handler MUST NOT
 *    throw (NestJS does not retry; the next 6 h tick is the natural
 *    retry per plan §2.8).
 *
 * Out of unit scope:
 *  - That the `@Cron(...)` decorator is wired (framework responsibility;
 *    verified when SchedulerRegistry boots the module in real runs).
 *  - The Europe/Berlin TZ math — delegated to `runAutoLockSweep`, tested
 *    in `shift-handover-entries.service.test.ts`.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §2.8 + Product Decision #5
 * @see ./shift-handover-cron.service.ts
 */
import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShiftHandoverCronService } from './shift-handover-cron.service.js';
import type { ShiftHandoverEntriesService } from './shift-handover-entries.service.js';

// =============================================================
// Mock factory
// =============================================================

function createMockEntries() {
  return {
    runAutoLockSweep: vi.fn(),
  } as unknown as ShiftHandoverEntriesService & {
    runAutoLockSweep: ReturnType<typeof vi.fn>;
  };
}

// =============================================================
// ShiftHandoverCronService
// =============================================================

describe('ShiftHandoverCronService', () => {
  let service: ShiftHandoverCronService;
  let mockEntries: ReturnType<typeof createMockEntries>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  // Pinned instant — matches the convention in sibling tests
  // (entries.service.test.ts, active-shift-resolver.service.test.ts).
  const FIXED_NOW = new Date('2026-04-23T18:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);

    mockEntries = createMockEntries();
    service = new ShiftHandoverCronService(mockEntries);

    // Silence Nest logger noise + allow call-count assertions.
    // spyOn on the prototype because the instance holds `private readonly logger`.
    logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    debugSpy = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------
  // Purity contract — nowUtc forwarded verbatim
  // ---------------------------------------------------------------

  it('forwards `new Date()` as nowUtc to runAutoLockSweep', async () => {
    mockEntries.runAutoLockSweep.mockResolvedValueOnce({ lockedCount: 0, lockedIds: [] });

    await service.runScheduledAutoLockSweep();

    expect(mockEntries.runAutoLockSweep).toHaveBeenCalledTimes(1);
    const passed = mockEntries.runAutoLockSweep.mock.calls[0]?.[0] as Date;
    expect(passed).toBeInstanceOf(Date);
    expect(passed.toISOString()).toBe(FIXED_NOW.toISOString());
  });

  // ---------------------------------------------------------------
  // Empty sweep — debug level, no info log
  // ---------------------------------------------------------------

  it('logs at debug level (no info log) when zero drafts are locked', async () => {
    mockEntries.runAutoLockSweep.mockResolvedValueOnce({ lockedCount: 0, lockedIds: [] });

    await service.runScheduledAutoLockSweep();

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    const debugMessages = debugSpy.mock.calls.map((c) => c[0] as string);
    expect(debugMessages.some((m) => m.includes('No drafts to lock'))).toBe(true);
  });

  // ---------------------------------------------------------------
  // Non-empty sweep — info log with count + id head
  // ---------------------------------------------------------------

  it('logs lockedCount + full id list at info level when ≤ 10 drafts locked', async () => {
    mockEntries.runAutoLockSweep.mockResolvedValueOnce({
      lockedCount: 3,
      lockedIds: ['a', 'b', 'c'],
    });

    await service.runScheduledAutoLockSweep();

    expect(logSpy).toHaveBeenCalledTimes(1);
    const message = logSpy.mock.calls[0]?.[0] as string;
    expect(message).toContain('Locked 3 abandoned draft(s)');
    expect(message).toContain('ids=a,b,c');
    // No ellipsis — list is not truncated.
    expect(message).not.toContain('…');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('caps the id-list dump at 10 with "…" suffix when more drafts are locked', async () => {
    const ids = Array.from({ length: 15 }, (_, i) => `id-${String(i)}`);
    mockEntries.runAutoLockSweep.mockResolvedValueOnce({
      lockedCount: ids.length,
      lockedIds: ids,
    });

    await service.runScheduledAutoLockSweep();

    const message = logSpy.mock.calls[0]?.[0] as string;
    expect(message).toContain('Locked 15 abandoned draft(s)');
    expect(message).toContain('id-0,id-1,id-2,id-3,id-4,id-5,id-6,id-7,id-8,id-9');
    expect(message).toContain('…');
    // 11th id onward MUST NOT appear — defense against unbounded log lines.
    expect(message).not.toContain('id-10');
  });

  // ---------------------------------------------------------------
  // Error contract — a @Cron handler MUST NOT throw (plan §2.8)
  // ---------------------------------------------------------------

  it('swallows `Error` throws from runAutoLockSweep and logs at error level', async () => {
    mockEntries.runAutoLockSweep.mockRejectedValueOnce(new Error('sys_user pool exhausted'));

    await expect(service.runScheduledAutoLockSweep()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const errorMessage = errorSpy.mock.calls[0]?.[0] as string;
    expect(errorMessage).toContain('Sweep failed');
    // getErrorMessage() extracts `Error.message` (TS-Standards §7.3 —
    // never `(error as Error).message`).
    expect(errorMessage).toContain('sys_user pool exhausted');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('handles non-Error throws via getErrorMessage (raw string, unknown)', async () => {
    mockEntries.runAutoLockSweep.mockRejectedValueOnce('raw string thrown');

    await expect(service.runScheduledAutoLockSweep()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const errorMessage = errorSpy.mock.calls[0]?.[0] as string;
    expect(errorMessage).toContain('Sweep failed');
    // getErrorMessage() stringifies non-Error values safely —
    // no "[object Object]" leakage into logs.
    expect(errorMessage).toContain('raw string thrown');
  });

  // ---------------------------------------------------------------
  // Architectural guard — success + error paths are mutually exclusive
  // ---------------------------------------------------------------

  it('does NOT emit a success log when the sweep fails (no double-log)', async () => {
    mockEntries.runAutoLockSweep.mockRejectedValueOnce(new Error('db down'));

    await service.runScheduledAutoLockSweep();

    // Error path is the terminal branch: no info log, no "locked N" noise.
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});

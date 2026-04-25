/**
 * Handover-button visibility filter — Smoke-test refinement (2026-04-25).
 *
 * Hides the 📋 button on grid cells where clicking would only produce an
 * error/warning toast — i.e. the previously-reachable "Bearbeitung nicht
 * mehr möglich …" (backend `outside_window`) and "Für diese Schicht wurde
 * keine Übergabe angelegt." (frontend warning in `page-actions.ts`)
 * paths. Quiet UI: icon visible iff there is something to do.
 *
 * Decision (cell has no entry yet):
 *   1. dateKey === today (browser-local TZ ≈ Europe/Berlin) → visible
 *   2. shiftKey === 'night' AND dateKey === yesterday AND
 *      now < shift_end clock-time → visible (last night still running)
 *   3. otherwise → hidden
 *
 * Plus assignee/manager gate: even within window, an employee who isn't on
 * the shift and can't manage handovers does NOT see the button.
 *
 * Browser-local TZ is an acceptable approximation of Europe/Berlin — the
 * backend resolver is the authority and will reject any out-of-window
 * POST. This filter is purely a UX-quietness layer.
 *
 * @see backend/src/nest/shift-handover/active-shift-resolver.service.ts#checkWriteWindow
 * @see ./page-actions.ts#handleHandoverOpen — paths previously toasted
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §5.1
 * @see docs/infrastructure/adr/ADR-052-shift-handover-protocol.md
 */
import type { HandoverButtonStatus, HandoverSlot } from './shift-handover-types';
import type { ShiftTimesMap } from './types';

export interface HandoverButtonContext {
  /** Result of `handover.getStatus(dateKey, shiftKey)`. */
  rawStatus: HandoverButtonStatus;
  dateKey: string;
  shiftKey: HandoverSlot;
  /** ADR-045 Layer-1 manage flag (Root / admin+full / any-Lead). */
  canManage: boolean;
  /** Assignees for `(dateKey, shiftKey)`. */
  assignees: number[];
  /** Logged-in user id, or null if not yet hydrated. */
  currentUserId: number | null;
  /** Tenant-configured shift times — needed for the night-shift end check. */
  shiftTimesMap: ShiftTimesMap;
  /** YYYY-MM-DD of "today" in browser-local TZ. */
  todayKey: string;
  /** YYYY-MM-DD of "yesterday" in browser-local TZ. */
  yesterdayKey: string;
  /** Browser-now Date instance. Injected for testability. */
  now: Date;
}

/**
 * Decide what to render for the 📋 button on a single grid cell.
 * Returns `null` when the button should NOT be rendered at all.
 */
export function resolveHandoverButtonStatus(
  ctx: HandoverButtonContext,
): HandoverButtonStatus | null {
  // Existing entries are always visible — read or edit, regardless of status.
  if (ctx.rawStatus !== 'none') return ctx.rawStatus;
  // No entry yet — only show if the user could actually create one now.
  if (!isInWriteWindow(ctx)) return null;
  if (!isAssigneeOrManager(ctx)) return null;
  return 'none';
}

function isInWriteWindow(ctx: HandoverButtonContext): boolean {
  if (ctx.dateKey === ctx.todayKey) return true;
  if (ctx.shiftKey !== 'night') return false;
  if (ctx.dateKey !== ctx.yesterdayKey) return false;
  return isNightShiftStillActive(ctx);
}

/**
 * Night shift dated yesterday is writable until its end clock-time today.
 * Extracted to keep `isInWriteWindow` flat (cyclomatic complexity cap).
 */
function isNightShiftStillActive(ctx: HandoverButtonContext): boolean {
  if (!(ctx.shiftKey in ctx.shiftTimesMap)) return false;
  const endTimeStr = ctx.shiftTimesMap[ctx.shiftKey].end;
  const colonAt = endTimeStr.indexOf(':');
  if (colonAt < 1) return false;
  const endHour = Number.parseInt(endTimeStr.slice(0, colonAt), 10);
  const endMin = Number.parseInt(endTimeStr.slice(colonAt + 1), 10);
  if (Number.isNaN(endHour) || Number.isNaN(endMin)) return false;
  const nowHour = ctx.now.getHours();
  const nowMin = ctx.now.getMinutes();
  return nowHour < endHour || (nowHour === endHour && nowMin < endMin);
}

function isAssigneeOrManager(ctx: HandoverButtonContext): boolean {
  if (ctx.canManage) return true;
  if (ctx.currentUserId === null) return false;
  return ctx.assignees.includes(ctx.currentUserId);
}

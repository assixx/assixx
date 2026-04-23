<!--
  ShiftHandoverButton — 📋 icon button rendered per shift cell.

  Visual states map to entry lifecycle (Plan §5.1):
   - grey   : no entry exists for (team, date, shift_key)
   - yellow : draft exists
   - green  : submitted
   - red border : draft with missing required fields past shift-end
     (V1 approximation — we only flag the missing-required case when the
     caller passes `hasRequiredGap=true`; the exact post-shift-end cutoff
     is owned by the backend auto-lock cron in §2.8, so the red hint is
     purely advisory here.)

  Tooltip (`title` attribute) announces the state so admins scanning a
  multi-week grid can see status without clicking. Accessible name via
  `aria-label`.

  Click → `onopen(context)` — the parent page translates this into
  `goto('/shift-handover/[uuid]')` (existing entry) or `/shift-handover/new`
  (idempotent create trampoline). The in-grid modal was removed in
  Session 15 (2026-04-23) because it flashed + inlined alerts instead
  of using the global toast component.

  @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §5.1
-->
<script lang="ts">
  import type { HandoverButtonStatus, HandoverContext } from './shift-handover-types';

  interface Props {
    status: HandoverButtonStatus;
    hasRequiredGap?: boolean;
    context: HandoverContext;
    onopen: (ctx: HandoverContext) => void;
  }

  const { status, hasRequiredGap = false, context, onopen }: Props = $props();

  const ariaLabel = $derived.by(() => {
    if (status === 'submitted') return 'Übergabe ansehen (abgeschlossen)';
    if (status === 'draft') return 'Übergabe bearbeiten (Entwurf)';
    return 'Übergabe erstellen';
  });

  const tooltip = $derived.by(() => {
    if (status === 'submitted') return 'Übergabe abgeschlossen';
    if (status === 'draft' && hasRequiredGap) return 'Entwurf — Pflichtfelder fehlen';
    if (status === 'draft') return 'Entwurf vorhanden';
    return 'Übergabe erstellen';
  });
</script>

<button
  type="button"
  class="handover-btn"
  class:handover-btn--draft={status === 'draft'}
  class:handover-btn--submitted={status === 'submitted'}
  class:handover-btn--missing-required={status === 'draft' && hasRequiredGap}
  aria-label={ariaLabel}
  title={tooltip}
  onclick={(event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    onopen(context);
  }}
>
  <i
    class="fas fa-clipboard-list"
    aria-hidden="true"
  ></i>
</button>

<style>
  .handover-btn {
    display: inline-flex;

    position: absolute;
    top: 4px;
    left: 4px;
    z-index: 5;
    justify-content: center;
    align-items: center;

    transition: all 150ms ease;
    cursor: pointer;
    border: 1px solid var(--color-glass-border);
    border-radius: 50%;

    background: var(--glass-bg-hover);
    padding: 0;

    width: 22px;
    height: 22px;
    color: var(--text-secondary);

    font-size: 11px;
  }

  .handover-btn:hover {
    transform: scale(1.1);
    border-color: var(--color-primary);
    background: color-mix(in oklch, var(--color-primary) 20%, transparent);

    color: var(--color-primary);
  }

  .handover-btn--draft {
    border-color: var(--color-warning);
    background: color-mix(in oklch, var(--color-warning) 20%, transparent);
    color: var(--color-warning);
  }

  .handover-btn--submitted {
    border-color: var(--color-success);
    background: color-mix(in oklch, var(--color-success) 20%, transparent);

    color: var(--color-success);
  }

  .handover-btn--missing-required {
    box-shadow: 0 0 0 1px var(--color-danger);
  }
</style>

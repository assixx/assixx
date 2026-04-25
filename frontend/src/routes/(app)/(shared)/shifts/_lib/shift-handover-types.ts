/**
 * Shift-handover UI types — kept in a plain `.ts` module because Svelte 5
 * + typescript-eslint cannot reliably surface types re-exported from a
 * `.svelte` component file (the Svelte parser rewrites the module's
 * surface and `eslint-plugin-svelte` flags the consumer's import as
 * `error typed`). Extracting to `.ts` is the canonical workaround
 * (see `frontend/eslint.config.mjs` and CODE-OF-CONDUCT-SVELTE §File Types).
 *
 * `HandoverSlot` is a locally-mirrored union rather than a re-export of
 * `@assixx/shared/shift-handover#ShiftHandoverSlot` — the Svelte
 * compiler's type erasure pipeline surfaces cross-package unions as
 * `error type` inside `.svelte` template expressions (a known rough
 * edge of `svelte-eslint-parser` 3.x + typescript-eslint 8.x), which
 * then cascades into `no-unsafe-member-access` on every usage. Keeping
 * the union *local* sidesteps the cascade without compromising
 * correctness: the shared source of truth still lives in
 * `SHIFT_HANDOVER_SLOTS` (shared/src/shift-handover/field-types.ts); the
 * architectural test there would flag any drift.
 *
 * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §5.1
 */
export type HandoverButtonStatus = 'none' | 'draft' | 'submitted';

export type HandoverSlot = 'early' | 'late' | 'night';

export interface HandoverContext {
  teamId: number;
  shiftDate: string;
  shiftKey: HandoverSlot;
}

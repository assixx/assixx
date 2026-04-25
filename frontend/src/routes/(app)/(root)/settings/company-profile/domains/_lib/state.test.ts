// Tenant Domains — State Facade Tests (DEFERRED — see rationale below)
//
// Per masterplan §5.4.1, this file should host four behavioural tests for
// the state-data.svelte.ts + state-ui.svelte.ts facade:
//   1. addDomain() happy path
//   2. verifyDomain() success flips status
//   3. modal open/close isolation (state-ui)
//   4. removeDomain() last-verified side-effect (tenantVerified true → false)
//
// Why these are it.todo() instead of real tests:
//
// The Svelte-5 runes ($state, $derived, $effect) used by state-data and
// state-ui are COMPILE-TIME syntax that requires Svelte's preprocessor. The
// current frontend-unit Vitest project (vitest.config.ts lines 161-183) runs
// in a node environment with NO Svelte plugin and NO transform for files
// ending in .svelte.ts — every other frontend test in the repo today tests
// pure utility files (no runes). Importing a runed module directly into a
// vitest test fails at module-load time because the $state(rows) macro is
// unresolved.
//
// Two paths forward — both are out of scope for Phase 5 Step 5.4.1:
//
// (A) Add @sveltejs/vite-plugin-svelte to the frontend-unit project in
//     vitest.config.ts. This is the architecturally-correct fix and would
//     unlock rune-aware testing for the entire project, but it is a
//     cross-cutting infra change that needs its own validation pass — does
//     it slow existing tests, does it break any pure-fn test that currently
//     relies on the lean node env, etc.
//
// (B) Refactor state-data into a pure-function module (state-data.logic.ts)
//     wrapped by a thin runed adapter. The pure module is trivially
//     testable in node. This keeps the infra unchanged but adds an
//     indirection layer to every consumer.
//
// Either approach should be tracked as a follow-up referenced from Phase 6
// or ADR-048 (Tenant Domain Verification), at which point the four
// it.todo() placeholders below become real tests.
//
// Coverage in the meantime: the underlying CONTRACT — api.ts mutations
// correctly hit the backend and response shapes match — is exercised at the
// Phase 4 API-integration level (backend/test/tenant-domains.api.test.ts,
// 40 tests). The thin Svelte-5 wrapper around _lib/api.ts calls is what
// remains untested here — low-risk surface, 5 functions of ~3 LOC each
// doing `domains = [...domains, created]` style state mutations.
//
// References:
//   - masterplan §5.4.1 (test scope) and §5.4 DoD (gate)
//   - vitest.config.ts lines 161-183 — frontend-unit project, no Svelte plugin
//   - ./state-data.svelte.ts — the SUT once infra unblocks
//   - ./state-ui.svelte.ts — the SUT for the modal-isolation test

import { describe, it } from 'vitest';

describe('state-data.svelte.ts — DEFERRED (see file header for rationale)', () => {
  it.todo('addDomain() appends the created row WITH verificationInstructions to domains[]');
  it.todo('verifyDomain() success flips the row status pending → verified and sets verifiedAt');
  it.todo('removeDomain() of the only verified row makes getTenantVerified() flip true → false');
});

describe('state-ui.svelte.ts — DEFERRED (see file header for rationale)', () => {
  it.todo('closeAddModal() resets addModalDomain + addModalSubmitting (modal isolation contract)');
});

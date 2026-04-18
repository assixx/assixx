# ADR-047: Claude Code Hook Strategy — Catalog Injection over Token Matching

| Metadata                | Value                                                        |
| ----------------------- | ------------------------------------------------------------ |
| **Status**              | Accepted                                                     |
| **Date**                | 2026-04-18                                                   |
| **Decision Makers**     | Simon Öztürk                                                 |
| **Affected Components** | `.claude/hooks/pre-edit-adr-context.sh`, Claude Code harness |

---

## Context

Claude Code supports a `PreToolUse` hook that can inject `additionalContext` into the agent's conversation before a tool call fires. For file edits (`Edit | Write | NotebookEdit`) we use this hook to surface relevant architectural documentation (ADRs, HOW-TOs) before Claude modifies a file.

The original implementation tried to **guess** which docs are relevant by extracting tokens from the target file path and substring-matching them against ADR/HOW-TO filenames. Example: editing `backend/src/nest/inventory/items.service.ts` would surface `ADR-040-inventory-addon-architecture.md` because both contain the token `inventory`.

This approach had a systematic class of failures documented in `.claude/hooks/HOOKS.md`:

- Editing `manage-areas/` files did **not** surface `ADR-034-hierarchy-labels-propagation.md`, because the filename shares no substring with the ADR name (the ADR describes the system that renames `area` to "Abteilung", but the string `area` does not appear in the ADR filename).
- Editing `blackboard/` files did **not** surface `ADR-045-permission-visibility-design.md` even though permission logic is central to blackboard access.
- Any ADR whose filename is phrased in domain-abstract terms (e.g. "permission-visibility-design") was structurally invisible to a token-based hook scanning concrete feature paths.

The root cause is **lexical ≠ semantic**: filename similarity is a weak proxy for topic relevance. Extending the token list could only paper over individual cases; it cannot close the class of bugs.

Meanwhile, the LLM on the other end of the hook is exactly the component that _does_ understand semantic relevance. The hook was doing the one job the LLM is better at than a Bash script.

## Decision

**Invert the responsibility.** The hook no longer tries to pick the relevant docs. Instead, on every file edit it injects the **full ADR index and HOW-TO catalog** (extracted from the two README indexes) as `additionalContext`, together with a mandatory reminder instructing Claude to scan the catalogs and read whichever docs are semantically relevant before proceeding.

Concretely:

- **Trigger:** every `Edit`, `Write`, or `NotebookEdit` against a file inside `$CLAUDE_PROJECT_DIR`.
- **Skip:** self-edits under `docs/infrastructure/adr/`, `docs/how-to/`, `.claude/`; paths outside the project; invalid input (fail-open).
- **Payload:** `awk`-extracted tables from `docs/infrastructure/adr/README.md` (the `## Index` section) and `docs/how-to/README.md` (the `## Guide Catalog` section), prefixed with a MANDATORY reminder line.
- **No dedup.** The catalog is re-injected on every edit so the reminder stays fresh and resilient to cache-eviction later in the session.
- **Budget guard.** The test harness asserts the emitted payload stays below 25 KB (currently ~13 KB). If a README bloats or a section heading is renamed (breaking the `awk` range), the guard fires before it ships.

Regression coverage: 19 test cases in `.claude/hooks/pre-edit-adr-context.test.sh` covering catalog presence, no-dedup semantics, all guards, JSON output shape, and the byte budget.

## Alternatives Considered

### A. Catalog only on the first edit per session (dedup), reminder-only afterwards

- **Pro:** minimal token overhead (~13 KB once per session).
- **Con:** if Claude's attention window evicts the catalog mid-session, later edits have no reliable reference. The hook's one job — _guarantee_ the docs are visible — becomes probabilistic.
- **Rejected.** Variance in reliability was the main problem we were fixing.

### B. Catalog on every edit, no dedup _(chosen)_

- **Pro:** simplest possible contract. Every edit sees the catalog. No session-state files, no dedup logic, no race conditions.
- **Con:** measurable token overhead — ~13 KB per edit. On a 100-edit session that is ~1.3 MB of repeated index text.
- **Accepted.** Claude Code uses prompt caching, so repeated identical catalog content is cheap to send. The mental-model simplicity and reliability improvement outweigh the cost.

### C. Keep token matching + add catalog as fallback

- **Pro:** preserves the "targeted hint" when it works.
- **Con:** keeps all the fragility of option (A) while adding the cost of (B). Worst of both worlds.
- **Rejected.**

### D. Hand-maintained path → ADR mapping

- **Pro:** explicit, auditable.
- **Con:** every new feature requires a mapping update. Drift is guaranteed. Ops burden grows with the project.
- **Rejected.**

### E. Load catalog once via `SessionStart` hook instead of `PreToolUse`

- **Pro:** one injection per session, not per edit.
- **Con:** no per-edit reminder. Claude can still edit without re-consulting the catalog because there is no trigger tied to the action.
- **Rejected.** The per-edit reminder is load-bearing — it is the moment where Claude has the opportunity to pause and check.

## Consequences

### Positive

- **Zero false negatives.** The catalog always contains every ADR and HOW-TO listed in the README indexes. Claude's semantic reasoning decides which to read.
- **Self-healing.** New ADRs and HOW-TOs appear in the catalog automatically — no hook edit required when a new doc lands.
- **Simpler code.** The hook dropped from ~140 lines of token filtering and dedup bookkeeping to ~50 lines of `awk`-extract + `jq`-emit.
- **Simpler mental model.** "Does the hook fire? → Is the catalog in the context? → Yes." No per-file, per-session, per-token state to reason about.
- **Simpler tests.** 28 token-matching cases collapsed to 19 semantically-grounded cases, with a new byte-budget guard that catches drift.

### Negative

- **Token cost.** ~13 KB of repeated catalog text per edit. Mitigated by Anthropic prompt caching for identical content, but not free.
- **Catalog depends on README hygiene.** If `docs/infrastructure/adr/README.md` misses a new ADR, the hook also misses it. ADR-046 is currently not in the README — a follow-up fix, not an ADR-047 regression.
- **No targeted nudge.** Claude must actively scan the catalog every time. The MANDATORY reminder text is the only incentive — if Claude treats it as noise, the hook cannot help.

### Neutral

- The hook still exits 0 with no output on all failure modes (missing README, invalid JSON, outside project, self-edit). Fail-open behaviour is unchanged.

## References

- `.claude/hooks/pre-edit-adr-context.sh` — implementation
- `.claude/hooks/pre-edit-adr-context.test.sh` — regression suite
- `.claude/hooks/HOOKS.md` §3 — operator-facing documentation
- Claude Code hooks reference: <https://code.claude.com/docs/en/hooks>
- Superseded approach: pre-ADR-047 token-matching logic (see `git log` on the hook)

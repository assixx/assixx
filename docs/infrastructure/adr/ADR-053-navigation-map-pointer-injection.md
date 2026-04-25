# ADR-053: Navigation Map Pointer Injection via UserPromptSubmit

| Metadata                | Value                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                            |
| **Date**                | 2026-04-23                                                                          |
| **Decision Makers**     | Simon Öztürk                                                                        |
| **Affected Components** | `.claude/hooks/pre-prompt-arch-map.sh`, Claude Code harness, `docs/ARCHITECTURE.md` |
| **Related ADRs**        | ADR-047 (Catalog Injection for ADR/HOW-TO on edit) — methodological precedent       |

---

## Context

Assixx ships a curated navigation map at `docs/ARCHITECTURE.md §1` — a concept → `file:line` table with linked ADRs, covering core architecture, authentication/permissions, organizational hierarchy, feature modules, frontend, data layer, and infrastructure. The map is the fastest path for both humans and Claude Code to answer "where is X implemented?".

Without automation, the map only helps when Claude (or the user) remembers to consult it. A slash command `/concept <query>` was built to surface the map on demand, but it requires the user to type it — a habit many questions skip past. Requests phrased as "how does auth work?" or "fix the permission guard" end up answered via `Grep` or `Agent(Explore)` instead of the map, wasting tokens and latency on information that already lives in a curated row.

### Constraint

`additionalContext` emitted by a Claude Code hook is capped at **10,000 characters** per the official documentation (<https://code.claude.com/docs/en/hooks>). The full navigation map is ~30 KB. Injecting it wholesale triggers the overflow-to-file fallback, which defeats the point: Claude sees only a preview plus a temp-file path and must `Read` the file to get the full content.

ADR-047 established a catalog-injection pattern for ADRs and HOW-TOs on every file edit. That catalog fits under the cap (~13 KB payload against a 25 KB local-harness budget). The navigation map does not.

### Requirements

1. The map must be **primed into Claude's attention** without user effort — no `/concept` required.
2. Injection must fit under the **10 KB `additionalContext` cap**.
3. Must **survive cache eviction** mid-session (the reasoning from ADR-047 applies: SessionStart-only injection degrades as the session grows).
4. Must **fail open** — if the hook breaks, Claude's normal flow continues.
5. Must **not** interfere with slash-commands (`/concept`, `/fast`, `/model`) that already carry their own context.

---

## Decision

**Inject a short pointer reminder on every `UserPromptSubmit`, not the full map.** The reminder (~800 bytes) tells Claude that the authoritative map lives at `docs/ARCHITECTURE.md §1`, lists the seven sub-sections, and explicitly forbids spawning `Grep`/`Agent(Explore)` for concept-lookups before consulting the map. Claude reads the map on demand via its normal `Read` tool when the reminder signals relevance.

Concretely:

- **Trigger:** `UserPromptSubmit` (fires on every user message, before Claude processes it).
- **Skip conditions:** prompts starting with `/`; empty prompts; invalid JSON stdin; missing `docs/ARCHITECTURE.md`; missing `## 1. Navigation Map` heading (heading-drift guard).
- **Payload:** ~800-byte text reminder emitted as `hookSpecificOutput.additionalContext` with `hookEventName: "UserPromptSubmit"`.
- **No dedup:** identical reminder on every non-skipped prompt. Anthropic prompt-caching absorbs the repetition cost.
- **Fail-open:** any unexpected input returns `exit 0` with no stdout.

Regression coverage: 19 test cases in `.claude/hooks/pre-prompt-arch-map.test.sh` — reminder emission, slash-command skip, empty/missing prompt skip, invalid JSON fail-open, missing map fail-open, heading-drift fail-open, byte-budget guard (< 2 KB sanity, < 10 KB hard cap), prompt-independence, and JSON parseability.

---

## Alternatives Considered

### A. Inject the full map on every user prompt

- **Pro:** zero on-demand `Read`; map is in Claude's attention immediately.
- **Con:** the map is ~30 KB. The 10 KB `additionalContext` cap triggers the overflow-to-file fallback, which replaces the content with a preview + temp-file path — Claude still has to `Read` to get the full content, so we gain nothing and lose simplicity.
- **Con:** even if the cap were higher, 30 KB × N prompts would balloon session context, and repeated identical content is only partially mitigated by prompt-caching.
- **Rejected.**

### B. Pointer on every prompt _(chosen)_

- **Pro:** fits under the cap with a 10× margin.
- **Pro:** Claude decides whether the map is relevant for this particular prompt — semantic routing is the LLM's job, per the ADR-047 philosophy.
- **Pro:** identical payload on every prompt → prompt-cache absorbs the cost.
- **Con:** one extra `Read` tool call when the map is consulted. Cheap (~150 tokens) relative to a mis-directed `Agent(Explore)` roundtrip (~5 KB + 10 s).
- **Accepted.**

### C. Pointer on `SessionStart` only

- **Pro:** one injection per session.
- **Con:** per the ADR-047 analysis, one-shot session-level injection cannot survive context eviction in long sessions. The reminder becomes probabilistic.
- **Con:** no per-prompt nudge — the moment where Claude decides whether to consult the map has no trigger attached to it.
- **Rejected.**

### D. Smart filter: inject only when the prompt contains "where"/"how does"/concept-style phrasing

- **Pro:** targeted injection, lowest token overhead.
- **Con:** repeats the exact class of bug ADR-047 called out — lexical matching cannot reliably approximate semantic relevance. Requests like "fix the permission guard" would miss the hook and lose the map benefit.
- **Rejected.**

### E. Replace the map with per-query RAG over the repo

- **Pro:** semantic retrieval scales with repo growth.
- **Con:** 2-day build, ongoing maintenance, embedding API cost, duplicates `Agent(Explore)` with marginal ROI for a solo-dev Claude Code use case. This was the alternative considered and rejected in the session that produced `docs/ARCHITECTURE.md` — the curated map was the cheap-win that made RAG unnecessary.
- **Rejected** (out of scope here; mentioned for traceability).

---

## Consequences

### Positive

- **Zero user effort.** The map is primed on every non-slash prompt — no slash command to remember.
- **Cache-resilient.** Per-prompt reinjection survives context compaction inside long sessions.
- **Cheap.** ~800 bytes × prompt-cached ≈ rounding-error token cost per session.
- **Self-healing.** The hook extracts no content from the map body — only checks the §1 heading exists. Adding rows or subsections to the map does not require a hook update.
- **Methodologically consistent.** Same "inject, let Claude route" philosophy as ADR-047 — the hook does not guess relevance.
- **Regression-covered.** 19-case test harness catches drift in skip rules, byte budget, JSON shape, and heading renames.

### Negative

- **Reminder may be ignored.** Claude could treat the reminder as noise and `Grep` anyway. Mitigated by MANDATORY wording and an explicit "Do NOT spawn Explore" clause; the ADR-047 precedent shows Claude respects these reminders reliably in practice.
- **One extra `Read` call when the map is consulted.** This is the pointer approach's core cost — cheaper than the alternatives it replaces.
- **Map freshness depends on PR hygiene.** If a file moves and `ARCHITECTURE.md` is not updated in the same PR, the pointer serves stale info. `ARCHITECTURE.md §10` documents the maintenance rules; no hook can compensate for broken discipline.

### Neutral

- **`/concept` slash command kept.** Zero overhead when unused, useful as an explicit force-map-consult trigger or as a fallback if the hook ever breaks.
- **No change to ADR-047's hook.** The two hooks are orthogonal: `pre-edit-adr-context.sh` handles ADR/HOW-TO on edit, `pre-prompt-arch-map.sh` handles the navigation map on prompt.

---

## References

- `.claude/hooks/pre-prompt-arch-map.sh` — implementation
- `.claude/hooks/pre-prompt-arch-map.test.sh` — regression suite (19 cases)
- `.claude/hooks/HOOKS.md` §4 — operator documentation
- `docs/ARCHITECTURE.md` — the navigation map itself
- `.claude/commands/concept.md` — explicit slash command (preserved as fallback)
- `ADR-047` — catalog-injection methodology precedent
- Claude Code hooks reference: <https://code.claude.com/docs/en/hooks>

# How to Fallow - Dead Code Analysis (Complementary to Knip)

**Version:** Fallow 2.14.x | **Last Updated:** 2026-04-06

Fallow is a Rust-based dead code analyzer used alongside Knip. It is significantly faster (~150ms for 2000+ files) and uses a different detection strategy (syntactic analysis via Oxc instead of the TypeScript compiler). Both tools together cover more ground than either one alone.

## Quick Start

```bash
# Run analysis (no install needed, uses .fallowrc.json)
pnpm dlx fallow dead-code

# Run a specific category only
pnpm dlx fallow dead-code --unused-exports
pnpm dlx fallow dead-code --unused-files
pnpm dlx fallow dead-code --circular-dependencies

# JSON output (for automated processing)
pnpm dlx fallow dead-code --format json > /tmp/fallow-results.json

# Health check (cyclomatic/cognitive complexity)
pnpm dlx fallow health
pnpm dlx fallow health --score
pnpm dlx fallow health --hotspots
```

## Files

| File              | Purpose                                      |
| ----------------- | -------------------------------------------- |
| `/.fallowrc.json` | Configuration (entry points, ignores, rules) |
| `.fallow/`        | Cache directory (in .gitignore)              |

## Fallow vs Knip

| Aspect                | Fallow            | Knip                        |
| --------------------- | ----------------- | --------------------------- |
| Language              | Rust (Oxc Parser) | TypeScript                  |
| Speed                 | ~150ms            | ~15s                        |
| Unused Exports        | Very good         | Good (more FPs with NestJS) |
| Unused Dependencies   | Good              | Better (more plugins)       |
| Circular Dependencies | Yes               | No                          |
| Duplicate Exports     | Yes               | No                          |
| Health/Complexity     | Yes               | No                          |
| NestJS DI             | Limitation (off)  | Limitation                  |
| SvelteKit $types      | Bug (158 FPs)     | Fixed via config            |

**Recommendation:** Use Knip for dependency cleanup, Fallow for unused exports + health analysis.

## Understanding Fallow Output

```
Unused files (5)              <- Files unreachable from any entry point
Unused exports (751)          <- Exported symbols that nothing imports
Unused types (295)            <- Type aliases and interfaces with no references
Unused dependencies (0)       <- Packages in package.json with no imports
Unresolved imports (159)      <- Imports that cannot be resolved
Duplicate exports (390)       <- Same-named exports across different files
Circular dependencies (4)     <- Circular import chains
```

## --trace: The Most Important Debug Tool

Before classifying any finding as "false positive" or "valid", ALWAYS verify with --trace:

```bash
# Trace a specific export
pnpm dlx fallow dead-code --trace frontend/src/lib/utils/auth.ts:isAdmin

# Trace an entire file
pnpm dlx fallow dead-code --trace-file frontend/src/lib/utils/auth.ts

# Trace a dependency
pnpm dlx fallow dead-code --trace-dependency lodash
```

The output shows exactly:

- `is_used: true/false` — whether fallow considers the export used
- `direct_references` — which files import the export
- `re_export_chains` — barrel files with `reference_count`
- `reason` — human-readable explanation

## Svelte Parsing: What Works and What Does Not

Fallow correctly parses `<script>` blocks in `.svelte` files and tracks named imports. This was verified using `--trace`: exports like `showErrorAlert` from `toast.ts` showed 49 direct references from `.svelte` files. SvelteKit route files (`+page.svelte`, `+page.server.ts`) are correctly recognized as entry points.

The only Svelte-specific limitation is that fallow cannot distinguish between component props (`export let`) and utility exports within `.svelte` files themselves. This may cause false negatives (missed unused props), not false positives.

**The unused export detection for `.ts` files imported by `.svelte` is accurate.** Most "unused export" findings are genuinely unused code, not Svelte parsing failures.

## Known False Positives

### 1. SvelteKit `$types` Unresolved Imports (~158)

Every SvelteKit route that imports `./$types` is reported as "unresolved". The maintainer confirmed the fix should exist since v2.10.0, but it does not work with route groups using parentheses like `(app)`, `(admin)`, etc.

**Status:** Bug report open at fallow-rs/fallow#54. Confirmed by maintainer as a known issue with parenthesized route groups.

**Workaround:** Ignore. These findings are false positives without exception.

### 2. `import type` Circular Dependencies

Fallow does not (yet) distinguish between `import type` and `import`. Type-only imports are erased at compile time and cannot cause runtime cycles.

**Verification:** Open the file and read the import statement. If it says `import type { ... }`, it is a false positive.

**Status:** Fix confirmed by maintainer, will ship in the next release.

### 3. Route-Scoped Duplicate Exports (~350)

SvelteKit routes commonly define local types like `Area`, `ApiResponse`, `API_ENDPOINTS` per page module. Fallow flags these as duplicates even though they have different shapes and serve different modules.

**Verification:** Are the "duplicates" in different route directories? Then they are intentional, not actual duplicates.

**Status:** Fix confirmed by maintainer (will only flag when a common importer exists), shipping in next release.

### 4. NestJS Class Members (disabled)

`onModuleInit()`, DI-injected repository methods, and provider methods are invoked by the framework, not via direct imports. The rule is set to `off` in `.fallowrc.json`.

### 5. Pino Dynamic Transports

Pino loads transports via string-based configuration (`transport: { target: 'pino-loki' }`). Static analysis cannot detect this. Configured via `ignoreDependencies` in `.fallowrc.json`.

## IMPORTANT: Verification Methodology

### Correct verification

```bash
# Trace the export using fallow itself
pnpm dlx fallow dead-code --trace path/to/file.ts:exportName

# Check: WHO imports this EXACT export?
grep -rn "import.*{[^}]*exportName" frontend/src backend/src --include="*.ts" --include="*.svelte"
```

### Wrong verification (our earlier mistake!)

```bash
# DO NOT DO THIS — searches for the WORD, not for IMPORTS:
grep -r "formatDate" frontend/src --include="*.svelte"
# Finds: props, getters, local functions with the same name, comments
# These are NOT imports of the flagged export!
```

**Lesson learned:** A grep for a function name also matches:

- Local functions with the same name in other files
- Component props (`isAdmin={state.isAdmin}`)
- Class getters (`get isAdmin() {}`)
- Methods on unrelated classes (`this.logout()`)
- Comments and string literals

Only an import statement (`import { name } from 'module'`) or `--trace` proves actual usage.

## Verification Workflow

### Before removing an export:

```bash
# 1. Run --trace
pnpm dlx fallow dead-code --trace file.ts:exportName

# 2. Is is_used: false AND direct_references empty?
#    -> Then check if it is a barrel re-export

# 3. Is the export re-exported through a barrel (index.ts)?
#    -> Check if anyone imports that specific export through the barrel

# 4. Check SUBDIRECTORIES too (not just the immediate route directory)
#    SvelteKit routes have nested [param] directories that may re-export from parent _lib/
#    Example: blackboard/[uuid]/_lib/utils.ts re-exports from blackboard/_lib/utils.ts
grep -rn "exportName" "frontend/src/routes/.../parent-route/" --include="*.ts" --include="*.svelte"

# 5. Check if the function is called by OTHER functions in the same file
grep -c "\bexportName\b" path/to/file.ts
#    If count > 1: function is used internally, only remove `export`, not the function

# 6. Only after --trace confirmation + subdirectory check: remove the export or delete the function
```

### Before deleting a file:

Same workflow as Knip — see [HOW-TO-KNIP.md](./HOW-TO-KNIP.md#verification-workflow---pflicht).

## Health Analysis

Fallow can also measure code quality:

```bash
# Overall score (0-100, grade A-F)
pnpm dlx fallow health --score

# Most complex functions
pnpm dlx fallow health --complexity --top 20

# Hotspots (high complexity + frequent changes)
pnpm dlx fallow health --hotspots

# Refactoring suggestions
pnpm dlx fallow health --targets --effort low

# CI quality gate
pnpm dlx fallow health --min-score 70
```

Our configuration:

- `maxCyclomatic: 10` (project standard, see CODE-OF-CONDUCT.md)
- `maxCognitive: 15`

## Current Baseline (2026-04-06, v2.14.1)

| Category              | Count | Real FPs                    | Accuracy  |
| --------------------- | ----- | --------------------------- | --------- |
| Unused files          | 5     | 0                           | Very high |
| Unused exports        | 751   | ~50-100 (barrel re-exports) | ~85-93%   |
| Unused types          | 295   | ~30-50                      | ~83-90%   |
| Unresolved imports    | 159   | 158 ($types bug)            | ~1%       |
| Duplicate exports     | 390   | ~350 (route-scoped)         | ~10%      |
| Circular dependencies | 4     | 4 (import type)             | 0%        |
| Unused dependencies   | 0     | 0                           | 100%      |

**Important:** Unused exports and unused types are highly accurate. Most findings are genuinely unused code, not false positives. The barrel re-export FPs occur when a barrel file re-exports a symbol that nobody imports through the barrel, even though the original source file export is correctly tracked.

After our initial cleanup session we removed ~60 genuinely dead items (functions, constants, exports) identified by fallow. Re-run fallow after cleanup to get updated numbers.

These numbers serve as a comparison baseline for future releases.

## Troubleshooting

### "workspaces discovered count=3" but plugin missing

Fallow detects workspaces from `pnpm-workspace.yaml`. Plugins are activated per workspace. Check:

```bash
pnpm dlx fallow list --plugins
```

### Verify entry points

```bash
pnpm dlx fallow list --entry-points
```

If SvelteKit routes are missing: extend the `entry` array in `.fallowrc.json`.

### Cache issues

```bash
rm -rf .fallow/
pnpm dlx fallow dead-code
```

## GitHub Issue

Bug report and corrected analysis: [fallow-rs/fallow#54](https://github.com/fallow-rs/fallow/issues/54)

Maintainer response (2026-04-06):

- `import type` circular dependency fix confirmed, shipping in next release
- Duplicate export scoping fix confirmed, shipping in next release
- `$types` fix should exist since v2.10.0 but does not work with parenthesized route groups

Re-test when new fallow releases ship and compare numbers against the baseline.

#!/usr/bin/env tsx
/**
 * Load-Test Regression Diff
 *
 * Compares two k6 `--summary-export` JSON files (baseline vs current) and
 * fails if any tracked metric regressed by more than the configured budget.
 *
 * Designed for CI: deterministic, no network, no Grafana-API dependency.
 * The baseline JSON is checked into `load/baselines/` and updated only when
 * an intentional perf change is approved — otherwise every PR run diffs
 * against the last-known-good profile.
 *
 * Tracked metrics (k6 summary JSON shape — see
 * https://grafana.com/docs/k6/latest/results-output/end-of-test/custom-summary/):
 *   - http_req_duration                 (global, p95 + p99)
 *   - http_req_duration{op:read}        (per-tag, p95 + p99)
 *   - http_req_duration{op:write}       (per-tag, p95 + p99)
 *   - http_req_failed                   (rate)
 *
 * Why 20% default budget?
 *   Tighter than 50% (would mask real regressions) but not so tight it
 *   flakes on cold-cache variance (first run after deploy can have a 10-15%
 *   cold-disk hit). Tunable via --budget=<percent> for tighter or looser
 *   acceptance. Error-rate uses absolute delta (0.5 percentage points) since
 *   relative-% is meaningless near zero.
 *
 * Usage:
 *   tsx scripts/load-diff.ts --baseline=path --current=path [--budget=20]
 *   pnpm exec tsx scripts/load-diff.ts \
 *     --baseline=load/baselines/baseline-light.json \
 *     --current=load/results/baseline-latest.json
 *
 * Exit codes:
 *   0 — all metrics within budget (CI passes)
 *   1 — at least one regression detected
 *   2 — usage error (missing arg / file not found / parse fail)
 *
 * @see load/tests/baseline.ts — produces compatible summary JSON
 */
import { readFileSync } from 'node:fs';
import { argv, exit } from 'node:process';

/**
 * k6 ≥ 1.x `--summary-export` emits each metric as a FLAT struct: trend
 * percentiles (`'p(95)'`, `'avg'`, …) and rate fields (`'value'`, `'passes'`,
 * `'fails'`) sit directly on the metric — there is NO `{ type, values: { … } }`
 * wrapper anymore. The earlier shape was dropped between k6 0.55 and 1.x;
 * this script's prior wrapper-based types were a latent bug from before that
 * change ever exercised the diff path end-to-end (verified 2026-05-01:
 * both `load/baselines/baseline-light.json` and `load/results/baseline-latest.json`
 * carry the flat shape — neither side has ever conformed to the old wrapper).
 *
 * Verified shape (excerpt from `baseline-latest.json`):
 *   "http_req_duration":          { "avg": 17.42, "p(95)": 35.74, … }
 *   "http_req_duration{op:read}": { "p(95)": 28.38, "thresholds": {…}, … }
 *   "http_req_failed":            { "passes": 0, "fails": 987, "value": 0 }
 *
 * `MetricCheck.field` keeps the call-site convention `'rate'`; `getValue`
 * maps it to the JSON key `'value'` (the computed rate). Trend percentile
 * fields pass through unchanged.
 */
interface TrendMetric {
  avg: number;
  med: number;
  min: number;
  max: number;
  'p(90)'?: number;
  'p(95)'?: number;
  'p(99)'?: number;
}

interface RateMetric {
  passes: number;
  fails: number;
  /** k6 emits the computed rate under `value`, NOT `rate`. */
  value: number;
  thresholds?: Record<string, boolean>;
}

type K6Metric = TrendMetric | RateMetric;

interface K6Summary {
  metrics: Record<string, K6Metric>;
}

interface MetricCheck {
  /** k6 metric name (incl. tag-suffix like `{op:read}`). */
  key: string;
  /** Trend percentile field, or 'rate' for rate metrics. */
  field: keyof TrendMetric | 'rate';
  /** Comparison mode: relative-% for trends, absolute pp for failure rates. */
  mode: 'relative' | 'absolute-pp';
  /** Human-readable label for the report. */
  label: string;
}

const TRACKED_METRICS: MetricCheck[] = [
  { key: 'http_req_duration', field: 'p(95)', mode: 'relative', label: 'global p95' },
  { key: 'http_req_duration', field: 'p(99)', mode: 'relative', label: 'global p99' },
  { key: 'http_req_duration{op:read}', field: 'p(95)', mode: 'relative', label: 'read p95' },
  { key: 'http_req_duration{op:read}', field: 'p(99)', mode: 'relative', label: 'read p99' },
  { key: 'http_req_duration{op:write}', field: 'p(95)', mode: 'relative', label: 'write p95' },
  { key: 'http_req_duration{op:write}', field: 'p(99)', mode: 'relative', label: 'write p99' },
  { key: 'http_req_failed', field: 'rate', mode: 'absolute-pp', label: 'error rate' },
];

const ABSOLUTE_PP_BUDGET = 0.005; // 0.5 percentage points for error rate

function parseArgs(args: string[]): { baseline: string; current: string; budget: number } {
  let baseline = '';
  let current = '';
  let budget = 20;
  for (const arg of args) {
    if (arg.startsWith('--baseline=')) baseline = arg.slice('--baseline='.length);
    else if (arg.startsWith('--current=')) current = arg.slice('--current='.length);
    else if (arg.startsWith('--budget=')) budget = Number(arg.slice('--budget='.length));
  }
  if (baseline === '' || current === '' || !Number.isFinite(budget) || budget <= 0) {
    console.error('Usage: load-diff.ts --baseline=<path> --current=<path> [--budget=<percent>]');
    exit(2);
  }
  return { baseline, current, budget };
}

function loadSummary(path: string): K6Summary {
  try {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw) as K6Summary;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to read/parse ${path}: ${msg}`);
    exit(2);
  }
}

function getValue(summary: K6Summary, check: MetricCheck): number | null {
  const metric = summary.metrics[check.key];
  if (metric === undefined) return null;
  // k6 ≥ 1.x summary-export: values flat on the metric (see TrendMetric/
  // RateMetric header above). The call-site field `'rate'` maps to the JSON
  // key `'value'` (computed rate = passes / (passes + fails)); trend
  // percentile keys (`'p(95)'`, `'avg'`, …) pass through unchanged.
  const jsonField = check.field === 'rate' ? 'value' : check.field;
  // `as unknown as Record<...>` — `K6Metric` is a discriminated union of
  // structurally-distinct interfaces; TS rejects the direct cast under
  // ADR-041 strict mode. Routing through `unknown` is the canonical idiom
  // for "I know better than the type system" runtime indexing (same
  // pattern used in `load/lib/auth.ts:88` for k6's `JSONValue` narrowing).
  const v = (metric as unknown as Record<string, unknown>)[jsonField];
  return typeof v === 'number' ? v : null;
}

interface DiffRow {
  label: string;
  baseline: number | null;
  current: number | null;
  delta: number | null; // percent for relative, pp for absolute
  mode: MetricCheck['mode'];
  regressed: boolean;
}

function diff(baseline: K6Summary, current: K6Summary, budgetPercent: number): DiffRow[] {
  return TRACKED_METRICS.map((check) => {
    const b = getValue(baseline, check);
    const c = getValue(current, check);
    if (b === null || c === null) {
      return {
        label: check.label,
        baseline: b,
        current: c,
        delta: null,
        mode: check.mode,
        regressed: false,
      };
    }
    if (check.mode === 'relative') {
      // Trend metrics: regression = current got slower (higher number).
      // Avoid division-by-zero (b can be 0 only on impossible perfect runs).
      const delta = b === 0 ? 0 : ((c - b) / b) * 100;
      const regressed = delta > budgetPercent;
      return { label: check.label, baseline: b, current: c, delta, mode: check.mode, regressed };
    }
    // absolute-pp: regression = error-rate increased by >0.5pp.
    const delta = c - b;
    const regressed = delta > ABSOLUTE_PP_BUDGET;
    return { label: check.label, baseline: b, current: c, delta, mode: check.mode, regressed };
  });
}

function fmt(value: number | null, mode: MetricCheck['mode']): string {
  if (value === null) return 'n/a';
  if (mode === 'absolute-pp') return (value * 100).toFixed(3) + '%';
  return value.toFixed(2) + 'ms';
}

function fmtDelta(delta: number | null, mode: MetricCheck['mode']): string {
  if (delta === null) return 'n/a';
  if (mode === 'absolute-pp') {
    const pp = (delta * 100).toFixed(3);
    return `${delta >= 0 ? '+' : ''}${pp}pp`;
  }
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
}

function report(rows: DiffRow[], budget: number): boolean {
  const regressions = rows.filter((r) => r.regressed);
  console.info('');
  console.info(
    `Load-Diff Report  (budget: relative ${budget}%, error-rate ${ABSOLUTE_PP_BUDGET * 100}pp)`,
  );
  console.info('─'.repeat(78));
  console.info('  metric          baseline       current        delta');
  for (const r of rows) {
    const marker =
      r.regressed ? 'FAIL'
      : r.delta === null ? 'skip'
      : 'ok  ';
    console.info(
      `  ${marker} ${r.label.padEnd(12)} ${fmt(r.baseline, r.mode).padStart(12)} ${fmt(r.current, r.mode).padStart(12)} ${fmtDelta(r.delta, r.mode).padStart(12)}`,
    );
  }
  console.info('─'.repeat(78));
  if (regressions.length === 0) {
    console.info(`PASS — all ${rows.length} tracked metrics within budget.`);
    return true;
  }
  console.info(`FAIL — ${regressions.length} regression(s):`);
  for (const r of regressions) {
    console.info(`  - ${r.label}: ${fmtDelta(r.delta, r.mode)} (over budget)`);
  }
  return false;
}

function main(): void {
  const { baseline, current, budget } = parseArgs(argv.slice(2));
  const baselineSummary = loadSummary(baseline);
  const currentSummary = loadSummary(current);
  const rows = diff(baselineSummary, currentSummary, budget);
  const ok = report(rows, budget);
  exit(ok ? 0 : 1);
}

main();

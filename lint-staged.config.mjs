// lint-staged: pattern → command map.
//
// WHY this file exists:
// `pnpm validate:changed` runs prettier/eslint/stylelint only on files changed
// vs. main, instead of the whole repo. Prettier-Doku Option 1 explicitly
// recommends lint-staged when combining Prettier with ESLint + Stylelint —
// see https://prettier.io/docs/precommit and https://github.com/lint-staged/lint-staged.
//
// Path semantics: lint-staged passes ABSOLUTE paths to commands by default.
// All three tools (prettier, eslint, stylelint) accept absolute paths.
//
// Concurrency: tasks across DIFFERENT patterns run concurrently;
// commands within the SAME pattern (array form) run sequentially.
// We exploit this: prettier writes BEFORE eslint reads, so eslint sees
// already-formatted code → no double-fix churn.
//
// Frontend ESLint + Stylelint MUST run with cwd=frontend/, because:
// - Root eslint.config.mjs:19 ignores `frontend/**` (intentional — Svelte
//   needs its own parser/plugin chain in frontend/eslint.config.mjs).
// - frontend/eslint.config.mjs uses `tsconfigRootDir: import.meta.dirname`
//   + `projectService: true` — relies on cwd-based config resolution.
// - Stylelint config lives in frontend/.
// We use `pnpm --filter assixx-frontend exec <cmd>` to set cwd correctly —
// same idiom already used by the root "stylelint" script in package.json.

export default {
  // Universal Prettier targets (no ESLint config covers these extensions).
  '*.{json,jsonc,md,yaml,yml}': 'prettier --write --ignore-unknown',

  // Backend + shared TS/JS: prettier first, then ESLint reads formatted output.
  // Runs from workspace root (root eslint.config.mjs covers these paths).
  '{backend,shared,scripts,database,load}/**/*.{ts,tsx,js,mjs,cjs}': [
    'prettier --write',
    'eslint --fix --no-error-on-unmatched-pattern',
  ],

  // Frontend TS/Svelte/JS: prettier (root config) + ESLint (frontend config via --filter).
  'frontend/**/*.{ts,svelte,js}': [
    'prettier --write',
    'pnpm --filter assixx-frontend exec eslint --fix --no-error-on-unmatched-pattern',
  ],

  // Frontend CSS + Svelte (style block): stylelint via --filter.
  // Note: a `.svelte` file matches BOTH this pattern AND the one above —
  // intentional: it goes through ESLint (script/template) AND stylelint (style).
  'frontend/**/*.{css,svelte}':
    'pnpm --filter assixx-frontend exec stylelint --fix --allow-empty-input',
};

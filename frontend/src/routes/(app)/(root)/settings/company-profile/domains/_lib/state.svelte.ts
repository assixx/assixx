/**
 * Tenant Domains — State Facade (barrel)
 *
 * Re-exports `state-data.svelte.ts` (domains[] + mutations) and
 * `state-ui.svelte.ts` (modal/UI state) under one path so consumers
 * (`+page.svelte`, child components) import from a single module.
 *
 * The `.svelte.ts` extension is required even for pure re-exports because
 * Svelte's preprocessor uses the extension to decide whether the module
 * runs in the rune-aware compilation context. Without it, downstream
 * `import { ... } from './state.svelte.js'` would resolve to a stripped
 * module with the `$state` calls erased.
 *
 * @see masterplan §5.1
 */
export * from './state-data.svelte.js';
export * from './state-ui.svelte.js';

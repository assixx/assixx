# Moving .storybook/ into frontend/.storybook/

**Date:** 2026-02-09
**Status:** Completed

## Why

The root directory had two frontend-tooling directories (`.storybook/`, `design-system/`) that didn't belong there. Moving `.storybook/` into `frontend/` groups all frontend concerns under one directory — cleaner monorepo root.

## What Changed

### Directory Move

```
BEFORE                          AFTER
Assixx/                         Assixx/
├── .storybook/                 └── frontend/
│   ├── main.js                     ├── .storybook/
│   ├── preview.js                  │   ├── main.js
│   ├── preview-head.html           │   ├── preview.js
│   └── stories/                    │   ├── preview-head.html
└── ...                             │   ├── vite.config.js  ← NEW (shield)
                                    │   └── stories/
                                    └── ...
```

### Config Files Updated

| File                                 | Change                                                  |
| ------------------------------------ | ------------------------------------------------------- |
| `package.json`                       | Added `-c frontend/.storybook` to storybook scripts     |
| `frontend/.storybook/main.js`        | Added `viteConfigPath`, `config.root`, absolute aliases |
| `frontend/.storybook/preview.js`     | Import path: `../src/app.css`                           |
| `frontend/.storybook/vite.config.js` | **New file** — empty Vite config as shield              |
| `eslint.config.mjs`                  | `.storybook/**` → `frontend/.storybook/**`              |
| `knip.json`                          | Updated entry + ignore paths                            |
| `tsconfig.json`                      | Updated exclude path                                    |
| `.dockerignore`                      | `.storybook/` → `frontend/.storybook/`                  |

## The Trap: SvelteKit Vite Config Auto-Loading

This was the hardest part. Moving `.storybook/` into `frontend/` triggers a Storybook builder behavior that causes SvelteKit to hijack Vite's configuration.

### How Storybook Resolves Vite Config

`@storybook/builder-vite` (v10.2.7) has this logic:

```js
// node_modules/@storybook/builder-vite/dist/index.js:1632
let projectRoot = resolve(options.configDir, '..');
await loadConfigFromFile(configEnv, viteConfigPath, projectRoot);
```

| configDir              | projectRoot          | Finds vite.config?                  |
| ---------------------- | -------------------- | ----------------------------------- |
| `.storybook/`          | `./` (monorepo root) | **No** — no vite.config at root     |
| `frontend/.storybook/` | `frontend/`          | **Yes** — `frontend/vite.config.ts` |

When Storybook finds `frontend/vite.config.ts`, it loads everything inside:

- `sveltekit()` — overrides Vite's `root` and `base`, adds SSR modules
- `sentrySvelteKit()` — adds source map upload plugins
- `visualizer()` — adds bundle analyzer

SvelteKit's plugin then overrides Vite's `root`, breaking all path resolution. CSS imports fail, Svelte dependencies can't resolve, SSR modules crash.

### Symptoms

```
No Svelte config file found in /home/scs/projects/Assixx
The following Vite config options will be overridden by SvelteKit: root, base
Failed to resolve dependency: svelte (x18 warnings)
Failed to load url /frontend/src/app.css — Does the file exist?
Cannot find module 'svelte/store'
```

### The Fix: viteConfigPath Shield

Two-part fix:

**1. Empty Vite config as shield** (`frontend/.storybook/vite.config.js`):

```js
// Prevents Storybook from loading frontend/vite.config.ts
export default {};
```

**2. Explicit builder option** (`frontend/.storybook/main.js`):

```js
framework: {
  name: '@storybook/html-vite',
  options: {
    builder: {
      viteConfigPath: 'frontend/.storybook/vite.config.js',
    },
  },
},
```

**3. Force project root** (in `viteFinal`):

```js
async viteFinal(config) {
  // Storybook sets root to resolve(configDir, '..') = frontend/
  // Force it back to the monorepo root
  config.root = process.cwd();

  // Use absolute paths for aliases (immune to root changes)
  const frontendSrc = path.resolve(process.cwd(), 'frontend/src');
  // ...
}
```

### Result

| Metric             | Before Fix | After Fix |
| ------------------ | ---------- | --------- |
| SvelteKit warnings | 5+         | 0         |
| Svelte dep errors  | 18         | 0         |
| CSS load errors    | 1          | 0         |
| Preview build time | 2-3s       | 304ms     |

## Lesson Learned

In a monorepo where Storybook uses `@storybook/html-vite` (NOT `@storybook/sveltekit`), never place `.storybook/` as a child of a directory that has its own `vite.config.ts` with framework plugins. The builder's `resolve(configDir, '..')` logic will pick up that config and load all plugins — including ones that break Storybook.

If you must place `.storybook/` inside a framework directory, use `viteConfigPath` to point to a dedicated Storybook-only Vite config.

---
'assixx-backend': patch
'assixx-frontend': patch
'@assixx/shared': patch
---

chore(docker): backend production image switches to `pnpm deploy` pattern (closes ADR-027 §3 deferred); cuts `assixx-backend:prod` image size from 1.27 GB to 614 MB (-52%) by mirroring `Dockerfile.frontend`. Moves frontend-only devDeps (Storybook, Stylelint suite, postcss-html, prettier-plugin-css-order) and 4 duplicates (vite, @tailwindcss/vite, prettier-plugin-svelte, prettier-plugin-tailwindcss) out of root `package.json` into `frontend/package.json` (single source of truth). Root scripts (`storybook`, `build-storybook`, `stylelint*`) now wrap to `pnpm --filter assixx-frontend run …`. Removes dead `eslint-plugin-storybook` import from root `eslint.config.mjs`. Fixes `docs/ARCHITECTURE.md` map drift (`Dockerfile.prod` → `Dockerfile`).

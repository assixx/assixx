/**
 * /versioninfo — Server load.
 *
 * Renders the aggregated root CHANGELOG.md as sanitized HTML and ships the
 * build-time app version to the page. The markdown source is imported via
 * Vite's `?raw` suffix so it's bundled at build time — rebuild after
 * `pnpm changeset:version` picks up new entries automatically.
 *
 * Why the ROOT CHANGELOG, not a per-package one:
 *   `scripts/aggregate-changelog.mjs` merges backend + frontend + shared
 *   CHANGELOGs into a single root file, stripping Changesets' auto-generated
 *   dependency noise and deduplicating bullets that repeat across packages.
 *   Prior to this the page read `shared/CHANGELOG.md`, which was almost
 *   always empty (shared rarely receives direct changesets in the Fixed
 *   Group) — so users saw ghost version headers.
 *
 * @see docs/how-to/HOW-TO-USE-CHANGESETS.md
 * @see scripts/aggregate-changelog.mjs — generator for the imported file
 * @see frontend/vite.config.ts — `define: { __APP_VERSION__ }`
 */
import { marked } from 'marked';

// Vite ?raw import — aggregated CHANGELOG.md bundled at build time.
// Path: versioninfo → (app) → routes → src → frontend → <workspace root>/CHANGELOG.md (5× ..).
import changelogRaw from '../../../../../CHANGELOG.md?raw';

import type { PageServerLoad } from './$types';

// Configure marked once per module load.
// GFM = GitHub-Flavoured Markdown (tables, strikethrough). `breaks: false` keeps
// standard paragraph behaviour — empty lines create paragraphs, single newlines don't.
// We intentionally do NOT disable raw HTML here because the CHANGELOG is a
// trusted, project-owned artefact and DOMPurify on the client is the hardening layer.
marked.setOptions({
  gfm: true,
  breaks: false,
});

export const load: PageServerLoad = () => {
  const changelogHtml = marked.parse(changelogRaw, { async: false });
  return {
    changelogHtml,
  };
};

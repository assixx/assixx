/**
 * /versioninfo — Server load.
 *
 * Renders the shared workspace CHANGELOG.md as sanitized HTML and ships the
 * build-time app version to the page. The markdown source is imported via
 * Vite's `?raw` suffix so it's bundled at build time — rebuild after
 * `pnpm changeset:version` picks up new entries automatically.
 *
 * @see docs/how-to/HOW-TO-USE-CHANGESETS.md
 * @see frontend/vite.config.ts — `define: { __APP_VERSION__ }`
 */
import { marked } from 'marked';

// Vite ?raw import — CHANGELOG.md bundled at build time from the workspace.
// Path resolution (5 segments up): versioninfo → (app) → routes → src → frontend → <workspace root>.
// Plus `shared/CHANGELOG.md` lands us at the file.
import changelogRaw from '../../../../../shared/CHANGELOG.md?raw';

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

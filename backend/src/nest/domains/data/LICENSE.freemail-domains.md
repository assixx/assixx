# `freemail-domains.json` — Third-Party Attribution

## Upstream source

This file is sourced from [`Kikobeats/free-email-domains`](https://github.com/Kikobeats/free-email-domains) (`master/domains.json`), an MIT-licensed curated list of freemail / personal-email providers derived from HubSpot's own list.

**Snapshot fetched:** 2026-04-17 via `curl -fsSL https://raw.githubusercontent.com/Kikobeats/free-email-domains/master/domains.json`.

**Sync cadence:** monthly, via `pnpm run sync:freemail` (see `scripts/sync-freemail-list.ts`). The sync script fetches upstream, prints a diff, and **never auto-commits** — a human reviews before landing changes.

## Assixx additions (post-upstream)

During Phase 0 Step 0.4 of the Tenant Domain Verification feature (`docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md`, v0.3.8 D34), 3 German-market / privacy-focused freemail providers were found missing from the upstream snapshot and added directly:

| Domain         | Why                                                 |
| -------------- | --------------------------------------------------- |
| `mailbox.org`  | German privacy-focused freemail; target-market risk |
| `tutanota.com` | German encrypted freemail (primary `.com` domain)   |
| `tutanota.de`  | German encrypted freemail (German-language variant) |

An upstream PR to `Kikobeats/free-email-domains` should be opened proposing the same additions so future syncs converge back to a single source of truth. Until then, the monthly sync will report these as "local-only" entries — this is intentional.

**Verified NOT missing (upstream already contains them despite an earlier review-pass miscount):** `mac.com`, `me.com`, `yandex.ru` — all three are present in the upstream snapshot as of 2026-04-17. Ground-truth via `Set`-based diff of the downloaded JSON, not text-scanning.

## License (upstream)

```
MIT License

Copyright (c) Kiko Beats <josefrancisco.verdu@gmail.com> (https://kikobeats.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Why committed JSON and not a runtime dependency

See `docs/infrastructure/adr/ADR-048-tenant-domain-verification.md` (pending, to be written at Phase 6) and `FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md` §0.2.5 #12 — summary: `company-email-validator` (the npm wrapper) was rejected for license concerns (`Unlicense`), staleness (last GitHub release 2021), and supply-chain surface. A direct JSON commit of the upstream list gives one runtime dependency less, git-reviewable diffs, and MIT-clean provenance.

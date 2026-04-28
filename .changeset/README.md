# Changesets

Dieses Verzeichnis wird von `@changesets/cli` verwaltet. Hier landen Changeset-Dateien, die beschreiben **was sich geändert hat** und **welcher Semver-Bump** nötig ist.

> **Volle Anleitung:** [`docs/how-to/HOW-TO-USE-CHANGESETS.md`](../docs/how-to/HOW-TO-USE-CHANGESETS.md)

---

## Quick Workflow

```bash
pnpm changeset                  # 1. Changeset erstellen (interaktiv)
pnpm changeset:lint             # 2. Lokal prüfen (CI macht das auch)
# PR mergen → Release Manager macht später:
pnpm changeset:version          # bumpt + generiert CHANGELOGs
pnpm changeset:tag              # erstellt v-Tag
git push --follow-tags          # GH-Action erstellt Release auto
```

---

## Pflicht-Format (seit 2026-04-28)

**Erste Zeile** des Bodies MUSS Conventional-Commits-Prefix tragen:

```
feat(scope): kurze Beschreibung
```

| Prefix                        | KaC-Sektion  | Beispiel                                |
| ----------------------------- | ------------ | --------------------------------------- |
| `feat:`                       | Added        | `feat: add inventory list management`   |
| `fix:`                        | Fixed        | `fix(auth): cross-origin escrow fix`    |
| `refactor:`                   | Changed      | `refactor: extract permission service`  |
| `perf:`                       | Performance  | `perf: cache org-scope per request`     |
| `docs:`                       | Docs         | `docs: clarify ADR-019 RLS-strict mode` |
| `chore:`                      | Maintenance  | `chore: bump grafana to v13`            |
| `style:`                      | Maintenance  | `style: align design-tokens spacing`    |
| `test:`                       | Maintenance  | `test: add KVP delegation API coverage` |
| `ci:`                         | Maintenance  | `ci: pin trivy to v0.69.3`              |
| `build:`                      | Maintenance  | `build: switch to pnpm deploy pattern`  |
| `<prefix>!:` oder `BREAKING:` | **Breaking** | `refactor!: drop V1 API surface`        |

`scripts/changeset-formatter.cjs` strippt den Prefix, taggt die Sektion automatisch, hängt PR-Link an wenn `(#NNN)` im Text steht, **und konvertiert das erste Wort vom Imperativ in Past-Tense** (`add` → `Added`, `bump` → `Bumped`, `fix` → `Fixed`, etc.). Du schreibst weiter `feat: add foo` — der Formatter macht daraus `Added foo` (claude-code-Style).

Der Aggregator hängt zusätzlich das **ISO-Release-Datum** an den Version-Header (`## 0.4.13 — 2026-04-28`) — gezogen aus `git log -1 --format=%aI v<version>`, Fallback auf heutiges Datum wenn der Tag noch nicht existiert (in-progress Release).

---

## Lint-Regeln (CI-erzwungen)

`scripts/lint-changesets.mjs` blockt PR bei:

1. Fehlende Front-Matter (`---` Block am Anfang)
2. Erste Zeile ohne valid Conv-Commits-Prefix
3. Erste Zeile > **100 Zeichen** (atomare Beschreibungen, keine Run-on-Paragraphs!)
4. Body komplett leer
5. Mehr als **3 Top-Level-Bullets** im Body — splitte in separate Changesets

---

## Beispiele

### Gut

```md
---
'assixx-backend': minor
---

feat: add inventory list management

Tenants können jetzt eigene Equipment-Inventare mit Tags, Categories
und Per-Asset-Photos pflegen. Closes ADR-040.
```

```md
---
'assixx-backend': patch
---

fix(auth): cross-origin first-escrow bootstrap (#219)

Apex-Login erstellt jetzt automatisch den ersten Escrow-Blob beim
Subdomain-Handoff. Closes ADR-022 §"New-user scenario".
```

### Schlecht (würde von Lint geblockt)

```md
---
'assixx-backend': patch
---

chore(docker): backend production image switches to pnpm deploy pattern (closes ADR-027 §3 deferred); cuts assixx-backend:prod image size from 1.27 GB to 614 MB (-52%) by mirroring Dockerfile.frontend
```

→ Erste Zeile 167 Zeichen (max 100), 6 Fakten in einem Satz. Lösung: 3 separate Changesets (image-size-cut, devDep-Move, ARCHITECTURE-Map-Fix), jeweils 1 Fakt.

---

## Regeln

- **Nicht jeder Commit braucht ein Changeset** — nur Änderungen die Nutzer betreffen
- **Fixed Versioning** — alle Packages (root, backend, frontend, shared) werden zusammen gebumpt
- **Eine Sache pro Changeset** — splitte große PRs in mehrere Changesets, eine pro Concern
- Changeset-Dateien sind editierbar — Markdown mit YAML-Frontmatter
- Docs: <https://github.com/changesets/changesets>

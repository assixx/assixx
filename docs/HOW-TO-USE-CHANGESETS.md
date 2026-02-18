# How to Changesets - Versionierung & Changelog

> **Tool:** `@changesets/cli` v2.29.8 | **Stand:** 2026-02-19
> **Docs:** <https://github.com/changesets/changesets>

---

## Was ist Changesets?

Changesets erfasst **was sich geändert hat** und **welcher Semver-Bump nötig ist** — zum Zeitpunkt der Änderung, nicht erst beim Release. Ein Changeset ist eine Markdown-Datei mit YAML-Frontmatter in `.changeset/`.

**Warum:** Git-Commit-Messages sind für Changelogs ungeeignet. Changesets entkoppeln die Versionierungsentscheidung vom Release-Prozess.

---

## Dateien

| Datei/Verzeichnis               | Zweck                                                                 |
| ------------------------------- | --------------------------------------------------------------------- |
| `.changeset/config.json`        | Konfiguration (Fixed Versioning, baseBranch, etc.)                    |
| `.changeset/README.md`          | Erklärung für Contributors                                            |
| `.changeset/*.md`               | Ausstehende Changesets (temporär, werden bei Version-Bump konsumiert) |
| `scripts/sync-root-version.mjs` | Synct Root-Version nach `changeset version`                           |
| `CHANGELOG.md`                  | Wird automatisch generiert/aktualisiert                               |

---

## Quick Start

```bash
# 1. Changeset erstellen (nach Feature-Arbeit)
pnpm changeset

# 2. Versionen bumpen (vor Release)
pnpm changeset:version

# 3. Git-Tag erstellen
pnpm changeset:tag

# 4. Pushen mit Tags
git push --follow-tags
```

---

## Workflow im Detail

### Schritt 1: Changeset erstellen

Nach einer relevanten Änderung (Feature, Bugfix, Breaking Change):

```bash
pnpm changeset
```

Interaktiver Prompt:

1. **Welche Packages?** — Entfällt bei uns (Fixed Group → alle werden zusammen gebumpt)
2. **Semver-Bump?** — `patch` / `minor` / `major`
3. **Beschreibung** — Wird zum CHANGELOG-Eintrag (Markdown erlaubt)

Das erzeugt eine Datei wie `.changeset/brave-lions-roar.md`:

```markdown
---
'assixx-backend': minor
---

TPM-Modul: Wartungspläne und Kamishibai-Board implementiert
```

**Diese Datei wird mit dem PR committed.**

### Schritt 2: Versionen bumpen (Release vorbereiten)

```bash
pnpm changeset:version
```

Was passiert:

- Alle `.changeset/*.md` Dateien werden **konsumiert** (gelöscht)
- `package.json` Versionen werden gebumpt (alle 4 synchron durch Fixed Group)
- `CHANGELOG.md` wird generiert/aktualisiert aus den Changeset-Beschreibungen
- Root `package.json` wird automatisch via `sync-root-version.mjs` synchronisiert

**Ergebnis committen.**

### Schritt 3: Git-Tag erstellen

```bash
pnpm changeset:tag
```

Erstellt Tags wie `assixx-backend@0.4.0`, `assixx-frontend@0.4.0`, etc.

> **Hinweis:** Du taggst zusätzlich manuell `v0.4.0` für den Docker-Build-Workflow.

### Schritt 4: Pushen

```bash
git push --follow-tags
```

Der `v*`-Tag triggert den Docker-Build in `.github/workflows/docker-build.yml`.

---

## Semver-Regeln

| Bump    | Wann                                            | Beispiel          |
| ------- | ----------------------------------------------- | ----------------- |
| `patch` | Bugfix, kleine Verbesserung, keine API-Änderung | `0.3.2` → `0.3.3` |
| `minor` | Neues Feature, rückwärtskompatibel              | `0.3.2` → `0.4.0` |
| `major` | Breaking Change, Migrationsbedarf               | `0.3.2` → `1.0.0` |

**Bei Unsicherheit:** `minor` für Features, `patch` für alles andere.

---

## Konfiguration

Datei: `.changeset/config.json`

```json
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [["assixx-backend", "assixx-frontend", "@assixx/shared"]],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "privatePackages": { "version": true, "tag": true }
}
```

| Option            | Wert                       | Bedeutung                                                |
| ----------------- | -------------------------- | -------------------------------------------------------- |
| `fixed`           | Alle 3 Workspace-Packages  | Lockstep — immer gleiche Version                         |
| `commit`          | `false`                    | Changesets committed nicht automatisch                   |
| `access`          | `restricted`               | Kein npm-Publish (privates Projekt)                      |
| `baseBranch`      | `main`                     | Basis-Branch für Vergleiche                              |
| `privatePackages` | `version: true, tag: true` | Private Packages werden trotzdem versioniert und getaggt |

---

## Alle Befehle

```bash
pnpm changeset                 # Neues Changeset erstellen (interaktiv)
pnpm changeset --empty         # Leeres Changeset (CI-Pflicht, aber nichts Versionswürdiges)
pnpm changeset:status          # Ausstehende Changesets anzeigen
pnpm changeset:version         # Versionen bumpen + CHANGELOG generieren
pnpm changeset:tag             # Git-Tags erstellen
```

---

## Häufige Szenarien

### Feature-Branch mit mehreren Änderungen

```bash
# Erste Änderung
git commit -m "feat(tpm): add maintenance plan service"
pnpm changeset
# → minor, "TPM: Wartungsplan-Service implementiert"

# Zweite Änderung (gleicher Branch)
git commit -m "feat(tpm): add card execution"
pnpm changeset
# → minor, "TPM: Kartendurchführung implementiert"

# Beide Changesets werden beim nächsten `changeset version` aggregiert
# → Ergebnis: EIN minor-Bump mit beiden Einträgen im CHANGELOG
```

### Bugfix

```bash
git commit -m "fix(auth): token refresh race condition"
pnpm changeset
# → patch, "Auth: Race Condition beim Token-Refresh behoben"
```

### Keine versionswürdige Änderung

Für Änderungen die keinen Release rechtfertigen (Docs, CI, Refactoring ohne externe Wirkung):

```bash
pnpm changeset --empty
# Oder: Einfach kein Changeset erstellen
```

### Changeset nachträglich bearbeiten

Changesets sind normale Markdown-Dateien. Einfach öffnen und bearbeiten:

```bash
# Datei finden
ls .changeset/*.md

# Bearbeiten (Beschreibung ändern, Bump-Level anpassen)
code .changeset/brave-lions-roar.md
```

### Mehrere Changesets aggregieren

Wenn mehrere Changesets denselben Bump-Typ haben, wird der **höchste** genommen:

- 3x `patch` → `patch`
- 2x `patch` + 1x `minor` → `minor`
- 1x `minor` + 1x `major` → `major`

Alle Beschreibungen landen als separate Einträge im CHANGELOG.

---

## Release-Checkliste

```
[ ] Alle Feature-Branches gemerged
[ ] `pnpm changeset:status` zeigt alle erwarteten Changesets
[ ] `pnpm changeset:version` ausgeführt
[ ] CHANGELOG.md geprüft (Einträge korrekt?)
[ ] Alle 4 package.json Versionen identisch
[ ] Änderungen committed
[ ] `pnpm changeset:tag` ausgeführt
[ ] Manueller v-Tag erstellt (z.B. `git tag v0.4.0`)
[ ] `git push --follow-tags`
[ ] Docker-Build-Workflow durch v-Tag getriggert
```

---

## Fixed Group — was bedeutet das?

Alle 3 Workspace-Packages (`assixx-backend`, `assixx-frontend`, `@assixx/shared`) sind in einer **Fixed Group**. Das heißt:

- Ein Changeset für **ein** Package bumpt **alle drei** auf die gleiche Version
- Versionen driften nie auseinander
- Das Root-Package (`assixx`) wird via `scripts/sync-root-version.mjs` automatisch nachgezogen

**Warum:** Assixx ist ein deployables Produkt, keine Library-Sammlung. Eine Version = ein Release-Stand.

---

## Troubleshooting

### "Some packages have been changed but no changesets were found"

```bash
# Erwarteter Fehler wenn Änderungen existieren aber kein Changeset
# Lösung: Changeset erstellen oder leeres Changeset
pnpm changeset
# oder
pnpm changeset --empty
```

### CHANGELOG.md sieht falsch aus

- Changeset-Dateien sind editierbar — Beschreibung vor `changeset version` anpassen
- Nach `changeset version` kann `CHANGELOG.md` direkt bearbeitet werden (vor dem Commit)

### Version stimmt nicht

```bash
# Alle Versionen prüfen
node -e "
import {readFileSync} from 'fs';
['package.json','backend/package.json','frontend/package.json','shared/package.json']
  .forEach(f => {
    const p = JSON.parse(readFileSync(f, 'utf8'));
    process.stdout.write(p.name.padEnd(20) + ' -> ' + p.version + '\n');
  });
"
```

### js-yaml Fehler

Die `pnpm.overrides` in `package.json` enthält einen eingeschränkten Override für `js-yaml`:

```json
"js-yaml@>=4.0.0 <4.1.1": ">=4.1.1"
```

Dieser Override darf **nicht** auf `"js-yaml@<4.1.1"` erweitert werden — das bricht `read-yaml-file` (Changeset-Dependency), die js-yaml 3.x mit `safeLoad` braucht.

---

## Architektur-Entscheidung

| Aspekt               | Entscheidung                                     | Begründung                                |
| -------------------- | ------------------------------------------------ | ----------------------------------------- |
| Tool                 | Changesets (nicht semantic-release, nicht lerna) | KISS, Markdown-basiert, pnpm-nativ        |
| Versioning-Strategie | Fixed Group                                      | Ein Produkt = eine Version                |
| npm Publish          | Nein (`access: restricted`)                      | Privates SaaS, kein öffentliches Package  |
| Auto-Commit          | Nein (`commit: false`)                           | Manuelle Kontrolle über Commits           |
| CHANGELOG-Format     | Default (`@changesets/cli/changelog`)            | Einfach, funktional, erweiterbar          |
| Root-Sync            | `scripts/sync-root-version.mjs`                  | Changesets managed nur Workspace-Packages |

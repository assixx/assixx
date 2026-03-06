# Changesets

Dieses Verzeichnis wird von `@changesets/cli` verwaltet. Hier landen Changeset-Dateien, die beschreiben **was sich geändert hat** und **welcher Semver-Bump** nötig ist.

## Workflow

### 1. Changeset erstellen (bei jeder relevanten Änderung)

```bash
pnpm changeset
```

Interaktiver Prompt fragt:

- Welcher Semver-Bump? (`major` / `minor` / `patch`)
- Beschreibung der Änderung (wird zum CHANGELOG-Eintrag)

### 2. Version bumpen (vor Release)

```bash
pnpm changeset version
```

Konsumiert alle Changesets, bumpt `package.json` Versionen, generiert `CHANGELOG.md`.

### 3. Git-Tag erstellen

```bash
pnpm changeset tag
```

Erstellt Git-Tags basierend auf den neuen Versionen.

## Regeln

- **Nicht jeder Commit braucht ein Changeset** — nur Änderungen die Nutzer betreffen
- **Fixed Versioning** — alle Packages (root, backend, frontend, shared) werden immer zusammen gebumpt
- Changeset-Dateien sind editierbar — Markdown mit YAML-Frontmatter
- Docs: <https://github.com/changesets/changesets>

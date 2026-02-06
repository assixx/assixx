# Linting & Code Quality Guide

## Quick Reference

| Was                  | Root-Befehl              | Was wird gelintet                                           |
| -------------------- | ------------------------ | ----------------------------------------------------------- |
| **Alles auf einmal** | `pnpm run validate:all`  | Backend + Frontend: ESLint, TypeScript, Prettier, Stylelint |
| ESLint Backend       | `pnpm run lint`          | `backend/**/*.ts`                                           |
| ESLint Frontend      | `pnpm run lint:frontend` | `frontend/**/*.{ts,svelte}`                                 |
| TypeScript Check     | `pnpm run type-check`    | Backend + Frontend                                          |
| Prettier             | `pnpm run format`        | Alles                                                       |
| Stylelint            | `pnpm run stylelint`     | `**/*.{css,scss}`                                           |

---

## main-Befehl: Alles auf einmal

```bash
# Aus Root-Verzeichnis - läuft OHNE abzubrechen bei Fehlern
pnpm run validate:all
```

Dieser Befehl führt aus:

1. Prettier (Auto-Fix)
2. ESLint Backend (Auto-Fix)
3. ESLint Frontend (Auto-Fix)
4. TypeScript Check (Backend + Frontend)
5. Svelte Check (Frontend-spezifisch)
6. Stylelint (Auto-Fix)

**Wichtig:** Bricht NICHT ab wenn Fehler gefunden werden - zeigt ALLE Fehler an!

---

## ESLint Konfiguration

### Zwei separate Configs

| Datei                        | Scope         | Besonderheiten               |
| ---------------------------- | ------------- | ---------------------------- |
| `/eslint.config.js`          | Backend only  | PostgreSQL, NestJS, Security |
| `/frontend/eslint.config.js` | Frontend only | Svelte 5, TypeScript strict  |

### ESLint Befehle

```bash
# Backend (aus Root)
pnpm run lint              # Nur prüfen
pnpm run lint:fix          # Mit Auto-Fix

# Frontend (aus Root)
pnpm run lint:frontend     # Nur prüfen
pnpm run lint:frontend:fix # Mit Auto-Fix

# Beides
pnpm run lint:all          # Nur prüfen
pnpm run lint:all:fix      # Mit Auto-Fix
```

### In Docker (Backend)

```bash
# Für Backend im Container
docker exec assixx-backend pnpm run lint
docker exec assixx-backend pnpm run lint:fix
```

---

## TypeScript Check

```bash
# Backend + Frontend zusammen (aus Root)
pnpm run type-check

# Nur Frontend mit Svelte-spezifischen Checks
cd frontend && pnpm run check

# In Docker (nur Backend)
docker exec assixx-backend pnpm run typecheck
```

---

## Prettier (Formatierung)

```bash
# Auto-Fix (aus Root)
pnpm run format

# Nur prüfen (CI)
pnpm run format:check

# Nur Frontend
cd frontend && pnpm run format
```

---

## Stylelint (CSS/SCSS)

```bash
# Prüfen (aus Root)
pnpm run stylelint

# Mit Auto-Fix
pnpm run stylelint:fix
```

**Hinweis:** Stylelint prüft `**/*.{css,scss}` in beiden Projekten.

---

## Docker-Workflow

Wenn Backend im Docker-Container läuft:

```bash
# Kompletter Check im Container
docker exec assixx-backend sh -c "pnpm run lint:fix && pnpm run typecheck"

# Oder einzeln
docker exec assixx-backend pnpm run lint:fix
docker exec assixx-backend pnpm run typecheck
docker exec assixx-backend pnpm run prettier:fix
```

---

## Wo wird was gelintet?

### Backend (`/eslint.config.js`)

- `backend/**/*.ts` - TypeScript strict + Security
- `backend/**/*.tsx` - Falls vorhanden
- Ignoriert: `frontend/**`, `node_modules/**`, `dist/**`

### Frontend (`/frontend/eslint.config.js`)

- `frontend/src/**/*.ts` - TypeScript strict
- `frontend/src/**/*.svelte` - Svelte 5 mit Runes
- Ignoriert: `build/**`, `.svelte-kit/**`, `node_modules/**`

---

## CI/CD Befehle

```bash
# Nur prüfen, keine Änderungen (für CI)
pnpm run format:check && pnpm run lint:all && pnpm run type-check && pnpm run stylelint

# Lokale Entwicklung mit Auto-Fix
pnpm run validate:all
```

---

## Troubleshooting

### ESLint findet keine Dateien

```bash
# Debug: Zeige welche Dateien gelintet werden
pnpm run lint -- --debug 2>&1 | grep "Linting"
```

### TypeScript Fehler nur in IDE, nicht in CLI

```bash
# IDE Cache löschen
rm -rf frontend/.svelte-kit
cd frontend && pnpm run check
```

### Stylelint ignoriert Dateien

Prüfe `.stylelintignore` und `/.stylelintrc.json`

---

## Alle verfügbaren Scripts

### Root (`/package.json`)

| Script              | Beschreibung                    |
| ------------------- | ------------------------------- |
| `lint`              | ESLint Backend                  |
| `lint:fix`          | ESLint Backend + Fix            |
| `lint:frontend`     | ESLint Frontend                 |
| `lint:frontend:fix` | ESLint Frontend + Fix           |
| `lint:all`          | ESLint Backend + Frontend       |
| `lint:all:fix`      | ESLint Backend + Frontend + Fix |
| `format`            | Prettier Auto-Fix               |
| `format:check`      | Prettier Check                  |
| `type-check`        | TypeScript Backend + Frontend   |
| `stylelint`         | CSS/SCSS Check                  |
| `stylelint:fix`     | CSS/SCSS Fix                    |
| `validate:all`      | **ALLES** (ohne Abbruch)        |

### Frontend (`/frontend/package.json`)

| Script     | Beschreibung              |
| ---------- | ------------------------- |
| `lint`     | ESLint                    |
| `lint:fix` | ESLint + Fix              |
| `format`   | Prettier Auto-Fix         |
| `check`    | svelte-check (TypeScript) |
| `validate` | format + lint + check     |

### Backend (`/backend/package.json`)

| Script         | Beschreibung          |
| -------------- | --------------------- |
| `lint`         | ESLint (via Root)     |
| `lint:fix`     | ESLint Fix (via Root) |
| `typecheck`    | TypeScript            |
| `prettier:fix` | Prettier Fix          |

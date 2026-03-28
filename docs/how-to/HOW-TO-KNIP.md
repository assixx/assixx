# How to Knip - Dead Code & Unused Dependencies Finder

**Version:** Knip 6.x | **Stand:** 2026-03-20

## Quick Start

```bash
# Analyse starten (nur Report, löscht nichts)
pnpm run knip

# Mit Auto-Fix (VORSICHT - nur für Dependencies)
pnpm run knip:fix
```

## Dateien

| Datei           | Zweck                       |
| --------------- | --------------------------- |
| `/knip.json`    | Konfiguration für Monorepo  |
| `/package.json` | Scripts: `knip`, `knip:fix` |

## Knip Output verstehen

```
Unused files (3)           ← Wichtigste Kategorie — manuell verifizieren
backend/src/utils/helpers.ts
frontend/src/lib/types/api.types.ts

Unused dependencies (2)    ← Spart Bundle Size
lodash
clsx

Unused devDependencies (1)
ts-node

Unlisted binaries (4)      ← Meist false positives (System-Binaries)
svelte-kit
docker-compose

Unresolved imports (5)     ← SvelteKit ./$types sind via Config ignoriert
./some-missing-module

Unused exports (553)       ← VORSICHT: fast alle false positives (siehe unten)
```

## Bekannte False Positives

### 1. Unused Exports (~553) — NestJS DTOs & Zod Schemas

**Das ist der größte Block und fast ausschließlich False Positives.** Knip kann NestJS Dependency Injection nicht tracken.

Betroffen:

- **DTO-Klassen** (`*ParamDto`, `*QueryDto`) — von NestJS via Decorators (`@Body()`, `@Query()`, `@Param()`) injiziert
- **Zod Schemas** (`*Schema`) — exportiert für DTO-Validierung via `nestjs-zod`
- **Type-Exports** — Interfaces/Types die nur in `.d.ts` oder generischen Kontexten genutzt werden

**Regel:** `Unused exports` bei NestJS DTOs/Schemas IGNORIEREN. Nur prüfen wenn es KEINE DTO/Schema-Datei ist.

Die `enumMembers`-Regel ist bereits auf `"off"` gesetzt.

### 2. SvelteKit Virtual Imports (`./$types`, `$app/*`, `$env/*`, `$lib/*`)

SvelteKit generiert `./$types` zur Build-Zeit — existiert nicht auf der Platte.

**Lösung:** In `knip.json` mit Regex-Escaping ignoriert (wichtig: `$` muss escaped werden):

```json
"ignoreUnresolved": ["./\\$types", "\\$app/.+", "\\$env/.+", "\\$lib/.+"]
```

> **Achtung:** Vor Knip v6 funktionierte `"./$types"` als Literal. Ab v6 wird `$` als Regex-Anker interpretiert → `"./\\$types"` nötig.

### 3. System-Binaries

Binaries die vom System, Docker oder CI bereitgestellt werden:

```json
"ignoreBinaries": ["svelte-kit", "docker-compose", "only-allow", "type-coverage"]
```

### 4. Docker Entry Points

Dateien die von Docker gestartet werden, nicht im Code importiert:

```bash
# IMMER prüfen vor Löschen:
grep -r "filename" docker/docker-compose*.yml
```

**Beispiel:** `deletion-worker.ts` wird NUR von Docker gestartet.

### 5. Runtime Dependencies

Packages die zur Runtime dynamisch geladen werden:

```json
"ignoreDependencies": [
  "reflect-metadata",  // NestJS DI
  "pino-pretty",       // Logger transport
  "pino-loki"          // Logger transport
]
```

### 6. Storybook Dependencies

`@tailwindcss/vite` wird im Root-Workspace für Storybook benötigt (läuft aus Root-Kontext), ist aber auch im Frontend-Workspace deklariert. Root-Kopie ist KEIN Duplikat.

### 7. Barrel Exports (index.ts)

Knip meldet oft `index.ts` als unused — ignoriert via:

```json
"ignore": ["**/index.ts"]
```

### 8. Svelte Config Warning

```
No Svelte config file found in /home/scs/projects/Assixx
```

**Kosmetisch, kein Impact.** Das SvelteKit-Plugin sucht `svelte.config.js` im Root-Verzeichnis, findet aber nur `frontend/svelte.config.js`. Die Svelte/SvelteKit-Plugins sind im Root-Workspace deaktiviert (`"svelte": false, "sveltekit": false`). Der Warning kommt vom Svelte-Compiler selbst.

## Verification Workflow - PFLICHT

### Bevor eine Datei gelöscht wird:

```bash
# 1. Wird die Datei irgendwo importiert?
grep -r "from.*filename" backend/src/ frontend/src/

# 2. Wird sie in Docker verwendet?
grep -r "filename" docker/

# 3. Wird sie in Config referenziert?
grep -r "filename" *.json *.yml *.yaml

# 4. NestJS: Ist es ein Provider/Controller?
# Prüfe ob die Klasse in einem *.module.ts unter providers/controllers registriert ist
grep -r "KlassenName" backend/src/**/*.module.ts

# 5. Svelte: Wird die Komponente im Template genutzt?
grep -r "<KomponentenName" frontend/src/
grep -r "import.*KomponentenName" frontend/src/
```

### Bevor eine Dependency entfernt wird:

```bash
# 1. Wird sie im Code verwendet?
grep -r "from ['\"]package-name" backend/src/ frontend/src/

# 2. Ist sie in ALLEN Workspaces deklariert? (Root-Kopie könnte redundant sein)
grep -r "package-name" package.json backend/package.json frontend/package.json

# 3. Wird sie zur Runtime geladen? (Transports, Plugins)
grep -r "package-name" backend/src/ --include="*.ts"

# 4. Wird sie von Storybook oder CI benötigt?
grep -r "package-name" frontend/.storybook/ .github/
```

## Knip v6 Migration (von v5)

Wichtige Änderungen bei v5 → v6:

| Änderung                            | Was tun                                 |
| ----------------------------------- | --------------------------------------- |
| `classMembers` Rule entfernt        | Aus `rules` in `knip.json` entfernen    |
| `$schema` URL                       | `knip@5` → `knip@6`                     |
| `--isolate-workspaces` ist Standard | Workspace-spezifische Config prüfen     |
| `ignoreUnresolved` erkennt Regex    | `$` in Patterns escapen: `"./\\$types"` |
| Node.js >= 20.19.0                  | Version prüfen                          |

## Troubleshooting

### "Cannot find module" nach Löschen

```bash
# 1. Datei wiederherstellen
git checkout -- path/to/deleted/file.ts

# 2. Prüfen wer sie importiert
grep -r "from.*filename" .

# 3. Import entfernen ODER Datei behalten
```

### Docker Container startet nicht nach Cleanup

```bash
# Prüfe Entry Points
grep -E "command:|entrypoint:" docker/docker-compose*.yml

# Prüfe ob referenzierte Dateien existieren
ls -la backend/src/workers/
```

## Best Practices

1. **NIE `knip:fix` für Files verwenden** — Nur manuell löschen nach Verification
2. **Batch von 3-5 Dateien** — Dann validieren mit `pnpm run validate:all`
3. **Docker Entry Points checken** — Werden nicht als Import erkannt
4. **Dead Code Chains** — Wenn A nur von B importiert wird und B unused ist, sind beide unused
5. **Unused Exports bei NestJS ignorieren** — DTOs/Schemas sind fast immer false positives
6. **Nach Cleanup:** `pnpm run validate:all` ausführen

## Cleanup Checkliste

- [ ] `pnpm run knip` ausführen
- [ ] Output analysieren (Files, Deps, Exports)
- [ ] False Positives identifizieren (siehe Liste oben)
- [ ] Jede Datei einzeln verifizieren (grep, Docker, Config, Module)
- [ ] In Batches löschen (3-5 Dateien)
- [ ] Nach jedem Batch: `pnpm run validate:all`
- [ ] Backend neu starten und testen
- [ ] Fertig

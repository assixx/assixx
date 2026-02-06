# How to Knip - Dead Code & Unused Dependencies Finder

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
Unused files (3)
backend/src/utils/helpers.ts
frontend/src/lib/types/api.types.ts

Unused dependencies (2)
lodash
clsx

Unused devDependencies (1)
ts-node

Unlisted dependencies (5)    ← Meist false positives
$app/environment
$lib/types

Unused exports (50+)         ← Vorsicht, viele false positives
```

## False Positives - Häufige Fälle

### 1. SvelteKit Virtual Imports

```
Unlisted: $types, $app/*, $env/*, $lib/*
```

**Lösung:** Bereits in `knip.json` ignoriert:

```json
"ignoreUnresolved": ["./$types", "$app/*", "$env/*", "$lib/*"]
```

### 2. Docker Entry Points

Dateien die von Docker gestartet werden, nicht im Code importiert:

```bash
# IMMER prüfen vor Löschen:
grep -r "filename" docker/docker-compose*.yml
```

**Beispiel:** `deletionWorker.ts` wird NUR von Docker gestartet:

```yaml
command: ['pnpm', 'exec', 'tsx', '/app/backend/src/workers/deletionWorker.ts']
```

### 3. NestJS Dependency Injection

Module, Services, Guards etc. werden oft nicht direkt importiert:

```json
"entry": [
  "src/**/*.module.ts",
  "src/**/*.service.ts",
  "src/**/*.guard.ts"
]
```

### 4. Barrel Exports (index.ts)

Knip meldet oft `index.ts` als unused - ignoriert via:

```json
"ignore": ["**/index.ts"]
```

### 5. Runtime Dependencies

Packages die zur Runtime geladen werden:

```json
"ignoreDependencies": [
  "reflect-metadata",  // NestJS DI
  "pino-pretty",       // Logger transport
  "pino-loki"          // Logger transport
]
```

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
# Prüfe ob @Injectable(), @Controller() etc. vorhanden
```

### Bevor eine Dependency entfernt wird:

```bash
# 1. Wird sie im Code verwendet?
grep -r "from ['\"]package-name" backend/src/ frontend/src/

# 2. Ist sie eine Peer Dependency?
cat node_modules/some-package/package.json | grep peerDep

# 3. Wird sie zur Runtime geladen? (Transports, Plugins)
grep -r "package-name" backend/src/ --include="*.ts"
```

## Troubleshooting

### "Cannot find module" nach Löschen

```bash
# 1. Datei wiederherstellen
git checkout -- path/to/deleted/file.ts

# 2. Prüfen wer sie importiert
grep -r "from.*filename" .

# 3. Import entfernen ODER Datei behalten
```

### Knip findet zu viele Unused Exports

Normal bei großen Projekten. Fokus auf:

1. **Unused files** - Wichtigste Kategorie
2. **Unused dependencies** - Spart Bundle Size
3. **Unused exports** - Niedrige Priorität, viele false positives

### Docker Container startet nicht nach Cleanup

```bash
# Prüfe Entry Points
grep -E "command:|entrypoint:" docker/docker-compose*.yml

# Prüfe ob referenzierte Dateien existieren
ls -la backend/src/workers/
```

## Best Practices

1. **NIE `knip:fix` für Files verwenden** - Nur manuell löschen nach Verification
2. **Batch von 3-5 Dateien** - Dann validieren mit `pnpm run validate:all`
3. **Docker Entry Points checken** - Werden nicht als Import erkannt
4. **Dead Code Chains** - Wenn A nur von B importiert wird und B unused ist, sind beide unused
5. **Nach Cleanup:** `pnpm run validate:all` ausführen

## Knip Konfiguration erweitern

```json
// knip.json - Neue Ignore Patterns hinzufügen:
{
  "ignore": ["**/generated/**", "**/mocks/**"],
  "ignoreDependencies": ["new-runtime-package"]
}
```

## Cleanup Checkliste

- [ ] `pnpm run knip` ausführen
- [ ] Output analysieren (Files, Deps, Exports)
- [ ] False Positives identifizieren
- [ ] Jede Datei einzeln verifizieren (grep, Docker, Config)
- [ ] In Batches löschen (3-5 Dateien)
- [ ] Nach jedem Batch: `pnpm run validate:all`
- [ ] Backend neu starten und testen
- [ ] Fertig

# 🎯 Neue Test-Strategie für Assixx

## Übersicht

Nach der Erfahrung mit Schema-Drift und Mock-Wartungsproblemen haben wir eine neue Test-Strategie:

### 1. **Lokale Tests (mit Docker)**
- Alle Integration-Tests die eine Datenbank benötigen
- Nutzt die echte lokale MySQL-Datenbank
- Ausführung über `./scripts/test-local.sh`
- Keine Schema-Sync-Probleme, da lokale DB immer aktuell

### 2. **GitHub Actions (ohne DB)**
- Nur Unit-Tests die KEINE Datenbank benötigen
- Utility-Tests (errorHandler, etc.)
- Code-Qualität (TypeScript, ESLint, Prettier)
- Docker Build Tests

## Warum diese Trennung?

1. **Schema-Drift vermeiden**: GitHub Actions hatte Probleme mit DB-Schema-Synchronisation
2. **Mock-Wartung reduzieren**: Keine komplexen DB-Mocks mehr nötig
3. **Schnellere CI/CD**: Unit-Tests laufen schneller ohne DB
4. **Einfachere Wartung**: Klare Trennung zwischen Unit und Integration Tests

## Test-Ausführung

### Lokal (Entwickler)
```bash
# Alle Tests mit echter DB
./scripts/test-local.sh

# Optionen:
# 1. Alle Tests
# 2. Nur Unit Tests
# 3. Nur Integration Tests
# 4. Einzelner Test
# 5. Mit Coverage
```

### GitHub Actions
- Automatisch bei Push/PR
- Nur Unit-Tests ohne DB-Abhängigkeit
- Workflow: `.github/workflows/unit-tests.yml`

## Test-Kategorien

### Unit Tests (GitHub Actions ✅)
- `errorHandler.test.ts`
- `health.test.ts`
- Weitere reine Utility-Tests

### Integration Tests (Nur Lokal 🏠)
- `auth.test.ts`
- `users.test.ts`
- `teams.test.ts`
- Alle anderen Route-Tests
- Alle Model-Tests
- Alle Service-Tests

## Migration Status

- ✅ Test-Script erstellt: `./scripts/test-local.sh`
- ✅ GitHub Actions für Unit-Tests: `.github/workflows/unit-tests.yml`
- ❌ Alte test.yml deaktivieren/anpassen
- ❌ Schema-Export automatisieren
- ❌ Problematische Tests fixen (documents.test.ts)

## Nächste Schritte

1. **Schema Export Script** erstellen falls nicht vorhanden
2. **Alte GitHub Actions** anpassen oder deaktivieren
3. **Dokumentation** in README.md aktualisieren
4. **Entwickler informieren** über neue Test-Strategie
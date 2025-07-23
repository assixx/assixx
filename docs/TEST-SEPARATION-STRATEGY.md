# 🎯 KLARE TRENNUNG: GitHub Actions vs Lokale Tests

## 🚨 WICHTIG: Strikte Trennung der Test-Umgebungen

### 🌐 GitHub Actions (CI/CD)
**Was läuft dort:** NUR Tests OHNE Datenbank-Abhängigkeiten

#### Unit Tests (KEINE DB):
- ✅ `errorHandler.test.ts` - Utility Funktion
- ✅ `health.test.ts` - Simple Endpoint Test

#### Code Quality Checks:
- ✅ TypeScript Compilation
- ✅ ESLint
- ✅ Prettier
- ✅ Docker Build Test

#### Was läuft NICHT auf GitHub:
- ❌ KEINE Integration Tests
- ❌ KEINE Tests mit `pool.execute()`
- ❌ KEINE Tests mit `createTestDatabase()`
- ❌ KEINE MySQL/Redis Services
- ❌ KEIN Schema-Sync

---

### 🏠 Lokale Tests (Docker Environment)
**Was läuft dort:** ALLE Tests MIT Datenbank-Abhängigkeiten

#### Integration Tests (MIT DB):
- ✅ `auth.test.ts`
- ✅ `auth-refactored.test.ts`
- ✅ `users.test.ts`
- ✅ `teams.test.ts`
- ✅ `departments.test.ts`
- ✅ `shifts.test.ts`
- ✅ `calendar.test.ts`
- ✅ `chat.test.ts`
- ✅ `notifications.test.ts`
- ✅ `surveys.test.ts`
- ✅ `kvp.test.ts`
- ✅ `signup.test.ts`
- ✅ `blackboard.test.ts`
- ✅ `blackboard.integration.test.ts`
- ✅ `tenantDeletion.integration.test.ts`
- ✅ `tenantDeletion.service.test.ts`
- ✅ `documents.test.ts`

#### Vorteile:
- ✅ Echte MySQL Datenbank
- ✅ Kein Schema-Drift
- ✅ Keine Mock-Wartung
- ✅ Test = Production

---

## 📁 Datei-Struktur

### GitHub Workflows:
```
.github/workflows/
├── unit-tests.yml     # ✅ NUR Unit Tests ohne DB
└── test.yml          # ❌ DEAKTIVIERT/GELÖSCHT
```

### Lokale Scripts:
```
scripts/
├── test-local.sh      # ✅ Alle DB-Tests
├── dev-status.sh      # ✅ Erweitert mit Test-Status
└── export-schema.sh   # ✅ Schema für Tests
```

---

## 🔧 Implementierung

### 1. GitHub Actions anpassen:
- Alte `test.yml` → `test.yml.disabled` umbenennen
- Nur `unit-tests.yml` aktiv lassen
- KEINE DB Services in GitHub Actions

### 2. Lokale Test-Umgebung:
- `test-local.sh` für alle DB-Tests
- Nutzt Docker MySQL direkt
- Keine Schema-Sync nötig

### 3. Entwickler-Workflow:
```bash
# Vor dem Commit - Lokal testen:
./scripts/test-local.sh

# GitHub Actions prüft automatisch:
- Unit Tests
- Code Quality
- Docker Build
```

---

## ⚠️ WARNUNG

**NIEMALS** folgendes in GitHub Actions:
- MySQL/Redis Services hinzufügen
- Schema-Sync versuchen
- Integration Tests aktivieren
- Mock-Datenbanken erstellen

**IMMER** folgendes beachten:
- DB-Tests NUR lokal
- GitHub nur für schnelle Checks
- Klare Trennung beibehalten

---

## 📊 Status

| Test Type | GitHub Actions | Lokal | Anzahl |
|-----------|---------------|-------|---------|
| Unit Tests | ✅ | ✅ | 2 |
| Integration Tests | ❌ | ✅ | 18 |
| Code Quality | ✅ | ✅ | 3 |
| Docker Build | ✅ | ❌ | 1 |
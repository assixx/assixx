# Blackboard Feature Tests

## Überblick

Diese Test-Suite stellt sicher, dass das Blackboard-Feature vollständig funktioniert und alle Edge-Cases abgedeckt sind.

## Test-Struktur

### 1. Unit Tests für Routes (`routes/__tests__/blackboard.test.ts`)

- Testet alle API-Endpunkte isoliert
- Mockt Datenbank-Zugriffe
- Validiert Request/Response-Formate
- Prüft Berechtigungen und Validierungen

### 2. Unit Tests für Models (`models/__tests__/blackboard.test.ts`)

- Testet Datenbank-Operationen
- Validiert Business-Logik
- Prüft Datenkonvertierungen (z.B. Buffer zu String)
- Testet Error-Handling

### 3. Integration Tests (`__tests__/blackboard.integration.test.ts`)

- Testet den kompletten Flow von API bis Datenbank
- Prüft realistische Szenarien
- Validiert Multi-Tenant-Isolation
- Testet Berechtigungssystem end-to-end

## Getestete Szenarien

### ✅ Verschiedene org_level Einträge

- Company-level (org_id = null)
- Department-level (org_id = department_id)
- Team-level (org_id = team_id)

### ✅ Prioritäts-Handling

- Mapping von `priority_level` zu `priority`
- Default-Werte
- Sortierung nach Priorität

### ✅ Berechtigungen

- Admins können alle Einträge erstellen
- Mitarbeiter können keine company-wide Einträge erstellen
- Department Heads können Department-Einträge erstellen
- Team Leaders können Team-Einträge erstellen

### ✅ Validierungen

- Pflichtfelder werden geprüft
- org_id ist nur für company-level optional
- Ungültige Werte werden abgelehnt

### ✅ Spezialfälle

- Buffer-Konvertierung für content
- Sehr lange Inhalte
- Leere Tags-Arrays
- Null-Werte für optionale Felder

## Test-Befehle

```bash
# Alle Tests ausführen
npm test

# Nur Blackboard-Tests
npm test blackboard

# Mit Coverage
npm test:coverage

# Im Watch-Modus (für Entwicklung)
npm test:watch

# Integration Tests
npm test:integration

# Spezifische Test-Datei
npm test -- routes/__tests__/blackboard.test.ts
```

## Test-Datenbank

Die Integration-Tests verwenden eine separate Test-Datenbank. Stelle sicher, dass:

1. Eine Test-Datenbank verfügbar ist
2. Die Umgebungsvariablen für Tests gesetzt sind
3. Die Test-Datenbank nach den Tests bereinigt wird

## Erwartete Test-Ergebnisse

```
PASS  src/routes/__tests__/blackboard.test.ts
  Blackboard API Routes
    GET /api/blackboard
      ✓ should fetch all blackboard entries
      ✓ should handle query parameters correctly
    POST /api/blackboard
      ✓ should create a company-level entry
      ✓ should create a department-level entry
      ✓ should create a team-level entry
      ✓ should handle missing required fields
      ✓ should set default values correctly
    ...

PASS  src/models/__tests__/blackboard.test.ts
  Blackboard Model
    createEntry
      ✓ should create a company-level entry successfully
      ✓ should reject when org_id missing for department level
    ...

Test Suites: 3 passed, 3 total
Tests:       45 passed, 45 total
```

## Wartung

Bei Änderungen am Blackboard-Feature:

1. Führe alle Tests aus
2. Aktualisiere Tests bei neuen Features
3. Stelle sicher, dass Coverage > 80% bleibt
4. Dokumentiere neue Test-Szenarien hier

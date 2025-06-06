# Unit-Test Strategie für Assixx

## 📋 Übersicht

Dieses Dokument beschreibt die empfohlene Unit-Test-Strategie für das Assixx-Projekt, priorisiert nach Kritikalität und Geschäftswert.

## 🎯 Test-Prioritäten

### 🔴 Priorität 1: Sicherheitskritische Tests

Diese Tests sind ESSENTIELL für die Sicherheit der Multi-Tenant-Architektur.

#### 1. Auth-System Tests (`auth.test.ts`)
**Warum kritisch:** JWT-Tokens und Passwort-Sicherheit sind fundamentale Sicherheitsbausteine.

**Was testen:**
- Passwort-Hashing mit bcrypt
- Passwort-Verifikation
- JWT Token-Generierung
- Token-Validierung und Expiration
- Session-Management
- Benutzer-Authentifizierung (Username/Email)
- Token-Refresh-Logik

**Beispiel-Testfälle:**
```typescript
- sollte Passwörter sicher hashen
- sollte gehashte Passwörter verifizieren können
- sollte JWT-Tokens mit korrekten Claims generieren
- sollte abgelaufene Tokens ablehnen
- sollte manipulierte Tokens erkennen
```

#### 2. Multi-Tenant Middleware Tests (`middleware/tenant.test.ts`)
**Warum kritisch:** Verhindert Datenlecks zwischen Mandanten.

**Was testen:**
- Tenant-Isolation bei Datenbankzugriffen
- Subdomain-Parsing (z.B. "firma1.assixx.de" → tenant_id: 1)
- Cross-Tenant Access Prevention
- Tenant-Context Propagation durch Request-Pipeline
- Fehlerbehandlung bei ungültigen Tenants

**Beispiel-Testfälle:**
```typescript
- sollte Tenant aus Subdomain extrahieren
- sollte Requests ohne gültige Subdomain ablehnen
- sollte Tenant-DB-Connection isolieren
- sollte Cross-Tenant-Zugriffe verhindern
```

#### 3. Zugriffskontrolle Tests (RBAC) (`middleware/auth.test.ts`)
**Warum kritisch:** Stellt sicher, dass nur berechtigte Benutzer auf Ressourcen zugreifen.

**Was testen:**
- Role-Based Access Control (root, admin, employee)
- Admin vs Employee Berechtigungen
- Root-User Spezialrechte
- API-Endpoint Protection
- Cascading Permissions (Firma → Abteilung → Team)

**Beispiel-Testfälle:**
```typescript
- Employee sollte keine Admin-Endpoints aufrufen können
- Admin sollte nur eigene Tenant-Daten sehen
- Root sollte Zugriff auf alle Tenants haben
- Inaktive Benutzer sollten keinen Zugriff haben
```

### 🟡 Priorität 2: Geschäftskritische Tests

Diese Tests sichern wichtige Geschäftsfunktionen ab.

#### 4. Input Validation Tests (`utils/validators.test.ts`)
**Warum wichtig:** Verhindert Sicherheitslücken und Datenkorruption.

**Was testen:**
- Email-Format Validierung
- Subdomain-Format (nur alphanumerisch + bindestrich)
- XSS-Prevention (HTML-Tags erkennen)
- SQL-Injection Prevention
- Telefonnummer-Format
- Datenlängen-Limits

**Beispiel-Testfälle:**
```typescript
- sollte gültige Email-Adressen akzeptieren
- sollte XSS-Versuche in Input-Feldern erkennen
- sollte SQL-Injection-Versuche blockieren
- sollte zu lange Eingaben ablehnen
```

#### 5. Document Service Tests (`services/document.service.test.ts`)
**Warum wichtig:** Dokumente enthalten sensible Daten (Gehalt, Verträge).

**Was testen:**
- File-Upload Validierung
- Erlaubte Dateitypen (PDF, DOC, etc.)
- Dateigrößen-Limits
- Virus-Scan Integration (falls vorhanden)
- Zugriffsrechte-Prüfung
- Speicherpfad-Isolation pro Tenant

**Beispiel-Testfälle:**
```typescript
- sollte nur erlaubte Dateitypen akzeptieren
- sollte Dateien über 10MB ablehnen
- sollte Dokumente im richtigen Tenant-Ordner speichern
- sollte Zugriff nur für berechtigte User erlauben
```

#### 6. Survey Tool Tests (`services/survey.service.test.ts`)
**Warum wichtig:** Umfragen müssen anonym und manipulationssicher sein.

**Was testen:**
- Umfrage-Erstellung mit Validierung
- Anonyme Antwort-Sammlung
- Ergebnis-Aggregation
- Mehrfach-Teilnahme-Verhinderung
- Deadline-Enforcement

**Beispiel-Testfälle:**
```typescript
- sollte anonyme Antworten speichern
- sollte Mehrfach-Teilnahme verhindern
- sollte Ergebnisse korrekt aggregieren
- sollte abgelaufene Umfragen blockieren
```

### 🟢 Priorität 3: Feature-Tests

Diese Tests verbessern die Zuverlässigkeit von Features.

#### 7. Email Service Tests (`utils/emailService.test.ts`)
**Warum nützlich:** Email-Fehler frustrieren Benutzer.

**Was testen:**
- Template-Rendering
- SMTP-Fehlerbehandlung
- Retry-Logik bei Fehlern
- Unsubscribe-Token-Generierung
- Email-Queue-Verarbeitung

#### 8. Calendar Tests (`services/calendar.service.test.ts`)
**Warum nützlich:** Kalender-Bugs können zu verpassten Terminen führen.

**Was testen:**
- Event-Erstellung und Validierung
- Termin-Überschneidungen
- Recurring Events (täglich, wöchentlich, etc.)
- Timezone-Konvertierung
- iCal-Export

#### 9. Shift Planning Tests (`services/shift.service.test.ts`)
**Warum nützlich:** Schichtplanung ist kritisch für Produktion.

**Was testen:**
- Schicht-Zuordnung
- Konflikt-Erkennung
- Verfügbarkeits-Prüfung
- Überstunden-Berechnung

## 📁 Empfohlene Test-Struktur

```
backend/src/__tests__/
├── unit/
│   ├── auth/
│   │   ├── auth.test.ts          # Hauptauthentifizierung
│   │   ├── jwt.test.ts           # JWT-spezifische Tests
│   │   └── password.test.ts      # Passwort-Hashing
│   ├── middleware/
│   │   ├── tenant.test.ts        # Multi-Tenant-Isolation
│   │   ├── rbac.test.ts          # Role-Based Access Control
│   │   └── validation.test.ts    # Input-Validierung
│   ├── services/
│   │   ├── document.service.test.ts
│   │   ├── survey.service.test.ts
│   │   ├── email.service.test.ts
│   │   └── calendar.service.test.ts
│   └── utils/
│       ├── validators.test.ts    # Validierungs-Funktionen
│       └── helpers.test.ts       # Hilfsfunktionen
├── integration/
│   ├── auth-flow.test.ts         # Login → API-Call → Logout
│   ├── tenant-isolation.test.ts  # Multi-Tenant End-to-End
│   └── document-workflow.test.ts # Upload → Access → Delete
└── e2e/
    └── critical-paths.test.ts    # Geschäftskritische Workflows
```

## 🚀 Implementierungs-Reihenfolge

1. **Woche 1:** Auth-System + Multi-Tenant Tests (Priorität 1)
2. **Woche 2:** Input Validation + Document Service (Priorität 2)
3. **Woche 3:** Survey Tool + Email Service (Priorität 2-3)
4. **Woche 4:** Calendar + Shift Planning (Priorität 3)

## ✅ Bereits implementiert

- ✅ Blackboard Simple Tests (7 Tests)
- ✅ Blackboard Integration Tests (9 Tests)
- ✅ Test-Setup mit Jest
- ✅ Mock-Struktur etabliert

## 📊 Erwartete Test-Abdeckung

- **Kritische Sicherheitsfunktionen:** 90%+
- **Geschäftslogik:** 80%+
- **Utility-Funktionen:** 70%+
- **Gesamt-Ziel:** 75%+ Code Coverage

## 🛠️ Tools und Frameworks

- **Test-Runner:** Jest
- **Mocking:** Jest Mocks
- **Assertions:** Jest Matchers
- **Coverage:** Jest Coverage Reports
- **TypeScript:** ts-jest

## 📝 Best Practices

1. **AAA-Pattern:** Arrange, Act, Assert
2. **Isolierte Tests:** Keine Abhängigkeiten zwischen Tests
3. **Descriptive Names:** Test-Namen beschreiben das erwartete Verhalten
4. **Mock External Dependencies:** Datenbank, APIs, File System
5. **Test Edge Cases:** Null, undefined, leere Arrays, etc.

## 🎯 Nächste Schritte

Nach Simon's Tests mit dem aktuellen System:
1. Feedback zu gefundenen Bugs sammeln
2. Auth-System Tests als erstes implementieren
3. Schrittweise weitere Tests nach Priorität hinzufügen
4. Continuous Integration (CI) Pipeline aufsetzen
# Debugging Workflow - Wichtige Lektionen

## 🎯 Goldene Regeln

### 1. One-by-One Approach

- **IMMER** ein Problem nach dem anderen lösen
- Workflow: Fix → Test → Gut? → Nächstes Problem
- Niemals mehrere Probleme gleichzeitig angehen

### 2. Test = Produktion

- Code MUSS identisch funktionieren in Test und Produktion
- `NODE_ENV === 'test'` Checks sind eine **KATASTROPHALE Anti-Pattern**
- Umgebungen anpassen, nicht den Code!

### 3. Erst verstehen, dann handeln

- **NIEMALS** blind loslegen ohne Logs/Fehlermeldungen
- Workflow:
  1. Problem verstehen (Logs analysieren)
  2. Root Cause identifizieren
  3. Fix planen und abstimmen
  4. Implementieren
  5. Lokal UND in CI/CD testen

### 4. Abstimmung ist Pflicht

- Jede Änderung muss lokal funktionieren
- Vor Änderungen fragen: "Funktioniert das auch lokal?"
- Tests sind wertlos wenn sie anderen Code testen

### 5. Mock-Setup ist kritisch

- Mocks MÜSSEN vor Imports definiert werden
- Environment Variables vor Imports setzen
- Mock-Funktionen explizit in Return-Object definieren

## ❌ Anti-Patterns

```typescript
// NIEMALS SO:
if (process.env.NODE_ENV === "test") {
  // Anderer Code für Tests
} else {
  // Produktions-Code
}
```

## ✅ Best Practice

```typescript
// Code der IMMER gleich funktioniert
// Unterschiede nur in Konfiguration (DB-Name, URLs, etc.)
```

## 🔍 Debug-Checkliste

1. [ ] GitHub Actions Logs analysiert?
2. [ ] Problem lokal reproduzierbar?
3. [ ] Fix funktioniert lokal?
4. [ ] Fix funktioniert in Tests?
5. [ ] Kein environment-spezifischer Code?

## 📝 Vor jedem Commit/Push

**IMMER diese Befehle ausführen:**

```bash
# TypeScript Check
docker exec assixx-backend pnpm run type-check

# ESLint + Prettier
docker exec assixx-backend pnpm run lint:fix

# Nochmal TypeScript zur Sicherheit
docker exec assixx-backend pnpm run type-check
```

Erst wenn ALLE grün sind → committen und pushen!

## 📚 Konkrete Lösungen aus der Praxis

### Jest Mock Problem gelöst (auth-refactored Tests)

**Problem:** Mocks funktionierten nicht, Tests versuchten echte DB-Verbindung
**Symptom:** 8 von 12 Tests scheiterten, ReferenceError nach Test-Ende

**Lösung:**

```javascript
// 1. DB Connection verhindern VOR allen Imports
process.env.DB_HOST = "mock";
process.env.NODE_ENV = "test";

// 2. Mock mit expliziter Funktion
jest.mock("../../database", () => {
  const mockExecuteQuery = jest.fn();
  return {
    executeQuery: mockExecuteQuery,
    pool: {
      end: jest.fn().mockResolvedValue(undefined),
    },
  };
});

// 3. ERST DANN imports
import { authenticateToken } from "../auth-refactored";
```

**Lessons Learned:**

- Mock-Setup MUSS vor Imports stehen
- Environment Variables verhindern DB-Init beim Import
- Mock-Funktionen explizit definieren, nicht nur `jest.fn()` returnen
- Response-Format muss exakt stimmen (error vs message)

### GitHub Actions vs Lokal

**Problem:** Tests liefen lokal aber nicht in CI
**Ursache:** Unterschiedliche DB-Schemas (main vs main_test)

**Lösung:**

- NIEMALS Code an Environment anpassen
- Immer gleicher Code für Test und Produktion
- Mock-Strategie statt echte Test-DB für Unit Tests
- Integration Tests separat mit echter DB

### Jest console.info Debugging (22.07.2025)

**Problem:** console.info zeigt nichts in Jest Tests
**Symptom:** Keine Ausgabe trotz `--silent=false` oder `--verbose`

**Lösung mit Error Throwing:**

```javascript
// STATT console.info (wird oft unterdrückt):
console.info("Response:", response.status, response.body);

// BESSER - Error werfen (wird IMMER angezeigt):
if (response.status !== 201) {
  throw new Error(`Status: ${response.status}, Body: ${JSON.stringify(response.body)}`);
}
```

**Alternative Debugging-Methoden:**

1. **Error Throwing** (empfohlen):

   ```javascript
   throw new Error(`Debug Info: ${JSON.stringify(data)}`);
   ```

2. **Absichtlich falscher Expect**:

   ```javascript
   expect(response.body).toBe("DEBUG: " + JSON.stringify(response.body));
   ```

3. **console.error statt console.info**:

   ```javascript
   console.error("DEBUG:", data); // Wird manchmal angezeigt
   ```

4. **Jest Flags kombinieren**:

   ```bash
   npm test -- --verbose --runInBand --detectOpenHandles
   ```

5. **DEBUG Environment Variable**:
   ```bash
   DEBUG=* npm test
   ```

**Lessons Learned:**

- Jest unterdrückt console.info standardmäßig
- Errors werden IMMER in der Ausgabe gezeigt
- Bei kritischem Debugging: Error werfen statt loggen
- Verschiedene Jest-Versionen verhalten sich unterschiedlich
  siehe: https://stackoverflow.com/questions/48695717/console-log-statements-output-nothing-at-all-in-jest

# 📋 TypeScript Standards & Best Practices für Assixx

> **Zweck:** Vermeidung häufiger TypeScript-Fehler und Sicherstellung konsistenter Code-Qualität  
> **Erstellt:** 08.06.2025  
> **Status:** ✅ Aktiv

## 🎯 Übersicht

Dieses Dokument definiert verbindliche TypeScript-Standards für das Assixx-Projekt, basierend auf häufigen Fehlern und Best Practices.

## 📁 1. TypeScript Konfiguration

### 1.1 Separate Konfigurationen

**Regel:** Jeder Hauptordner mit TypeScript-Code benötigt eine eigene `tsconfig.json`

```
/backend/tsconfig.json    → Node.js spezifisch
/frontend/tsconfig.json   → Browser spezifisch
/tsconfig.json           → Root für gemeinsame Settings
```

### 1.2 Library-Definitionen

**Backend tsconfig.json:**

```json
{
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["node", "jest"]
  }
}
```

**Frontend tsconfig.json:**

```json
{
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  }
}
```

### 1.3 Strict Mode Settings

**Pflicht für alle tsconfig.json:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## 🚫 2. Type-Safety Regeln

### 2.1 Niemals `any` ohne Begründung

❌ **Falsch:**

```typescript
function processData(data: any) {
  return data.value;
}
```

✅ **Richtig:**

```typescript
function processData(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return String(data.value);
  }
  throw new Error('Invalid data format');
}
```

### 2.2 Explizite Return Types

❌ **Falsch:**

```typescript
function calculateTotal(items: Item[]) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

✅ **Richtig:**

```typescript
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

### 2.3 Ungenutzte Variablen

❌ **Falsch:**

```typescript
function handleClick(event: MouseEvent, index: number): void {
  // index wird nicht verwendet
  console.log('Clicked!');
}
```

✅ **Richtig:**

```typescript
function handleClick(event: MouseEvent, _index: number): void {
  // Prefix mit _ für bewusst ungenutzte Parameter
  console.log('Clicked!');
}
```

## 🌐 3. Globale Erweiterungen

### 3.1 Window-Objekt Erweiterungen

**Datei:** `/frontend/src/types/global.d.ts`

```typescript
declare global {
  interface Window {
    // Assixx-spezifische Funktionen
    openEntryForm?: (entryId?: number) => void;
    viewEntry?: (entryId: number) => void;
    editEntry?: (entryId: number) => void;
    deleteEntry?: (entryId: number) => Promise<void>;

    // Dashboard UI
    DashboardUI?: {
      openModal: (modalId: string) => void;
      closeModal: (modalId: string) => void;
      showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
    };
  }
}

export {};
```

### 3.2 Express Request Erweiterungen

**Datei:** `/backend/src/types/express.d.ts`

```typescript
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        role: string;
        tenant_id: number;
      };
    }
  }
}

export {};
```

## 📝 4. Interface & Type Definitionen

### 4.1 Zentrale Type-Definitionen

**Struktur:**

```
/types/
  ├── api.types.ts      # API Request/Response Types
  ├── models.types.ts   # Datenbank-Modelle
  ├── auth.types.ts     # Authentication Types
  └── shared.types.ts   # Gemeinsame Types (Frontend & Backend)
```

### 4.2 Namenskonventionen

- **Interfaces:** PascalCase mit Prefix `I` nur bei Konflikten
- **Type Aliases:** PascalCase
- **Enums:** PascalCase für Name, UPPER_CASE für Werte

```typescript
// Interface
interface User {
  id: number;
  username: string;
}

// Type Alias
type UserRole = 'admin' | 'employee' | 'root';

// Enum
enum Status {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
}
```

### 4.3 Vermeidung von Duplikaten

❌ **Falsch:**

```typescript
// admin.ts
interface Admin {
  id: number;
  email: string;
}

// manage-admins.ts
interface Admin {
  id: number | string;
  email: string;
  first_name?: string;
}
```

✅ **Richtig:**

```typescript
// types/models.types.ts
export interface Admin {
  id: number | string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
}

// admin.ts & manage-admins.ts
import { Admin } from '@/types/models.types';
```

## 🔄 5. Async/Promise Konsistenz

### 5.1 Async Function Return Types

❌ **Falsch:**

```typescript
async function loadData() {
  const data = await fetch('/api/data');
  return data.json();
}
```

✅ **Richtig:**

```typescript
async function loadData(): Promise<DataType> {
  const response = await fetch('/api/data');
  return response.json() as Promise<DataType>;
}
```

### 5.2 Void vs Promise<void>

❌ **Falsch (inkonsistent):**

```typescript
interface Actions {
  syncAction: () => void;
  asyncAction: () => void; // Aber ist eigentlich async!
}
```

✅ **Richtig:**

```typescript
interface Actions {
  syncAction: () => void;
  asyncAction: () => Promise<void>;
}
```

## 🛠️ 6. Entwicklungs-Workflow

### 6.1 Pre-Commit Checkliste

Vor jedem Commit MUSS ausgeführt werden:

```bash
# TypeScript Type-Check
npm run type-check

# ESLint
npm run lint

# Format Check
npm run format:check
```

### 6.2 Neue Features Workflow

1. **Types First:** Erst Interfaces/Types definieren
2. **Implementation:** Code schreiben mit definierten Types
3. **Documentation:** JSDoc für öffentliche APIs
4. **Testing:** Type-Tests mit `tsd` oder `dtslint`

### 6.3 Code Review Checkliste

- [ ] Keine `any` ohne `// eslint-disable-line` mit Begründung
- [ ] Alle Funktionen haben explizite Return Types
- [ ] Keine ungenutzten Variablen/Imports
- [ ] Interfaces sind in zentralen Type-Files
- [ ] Globale Erweiterungen in `.d.ts` Files
- [ ] Async Funktionen returnen `Promise<T>`

## 📊 7. ESLint Konfiguration

**Erforderliche Rules in `.eslintrc.json`:**

```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": [
      "warn",
      {
        "allowExpressions": true,
        "allowTypedFunctionExpressions": true
      }
    ],
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }
    ],
    "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
    "@typescript-eslint/no-non-null-assertion": "error",
    "@typescript-eslint/strict-boolean-expressions": "error"
  }
}
```

## 🚨 8. Häufige Fehler & Lösungen

### 8.1 "Cannot find name 'document'"

**Problem:** Frontend-Code ohne DOM Types  
**Lösung:** `"lib": ["DOM"]` in tsconfig.json

### 8.2 "Property does not exist on type 'Window'"

**Problem:** Globale Funktion nicht deklariert  
**Lösung:** In `global.d.ts` hinzufügen

### 8.3 "All declarations must have identical modifiers"

**Problem:** Mehrfache inkonsistente Deklarationen  
**Lösung:** Eine zentrale Definition verwenden

### 8.4 "Type 'void' is not assignable to type 'Promise<void>'"

**Problem:** Sync/Async Inkonsistenz  
**Lösung:** Konsistente async/await Verwendung

## 📚 9. Dokumentation

### 9.1 JSDoc für öffentliche APIs

```typescript
/**
 * Lädt Benutzerdaten vom Server
 * @param userId - Die ID des Benutzers
 * @returns Promise mit Benutzerdaten
 * @throws {Error} Wenn Benutzer nicht gefunden
 * @example
 * const user = await loadUser(123);
 */
export async function loadUser(userId: number): Promise<User> {
  // Implementation
}
```

### 9.2 Type Documentation

```typescript
/**
 * Repräsentiert einen Benutzer im System
 * @since 1.0.0
 */
export interface User {
  /** Eindeutige Benutzer-ID */
  id: number;

  /** Benutzername (3-50 Zeichen) */
  username: string;

  /** Benutzerrolle */
  role: UserRole;

  /** Zeitstempel der Erstellung */
  created_at: Date;
}
```

## 🔄 10. Migration Guidelines

### 10.1 Bei Type-Änderungen

1. **Deprecation Notice:** Alte Types mit `@deprecated` markieren
2. **Migration Guide:** In CHANGELOG.md dokumentieren
3. **Übergangszeit:** Mindestens 1 Sprint für Migration
4. **Clean-up:** Alte Types nach Migration entfernen

### 10.2 Breaking Changes

```typescript
/**
 * @deprecated Seit v2.0.0 - Verwende `AdminUser` statt `Admin`
 * @see AdminUser
 */
export interface Admin {
  // ...
}

/**
 * Neue Admin-Schnittstelle mit erweiterten Feldern
 * @since 2.0.0
 */
export interface AdminUser extends Admin {
  permissions: Permission[];
  lastActivity: Date;
}
```

## ✅ 11. Checkliste für neue Dateien

Beim Erstellen neuer TypeScript-Dateien:

- [ ] Passende `tsconfig.json` wird verwendet
- [ ] Keine `any` Types
- [ ] Explizite Return Types
- [ ] Imports aus zentralen Type-Definitionen
- [ ] JSDoc für exportierte Funktionen/Interfaces
- [ ] ESLint zeigt keine Fehler
- [ ] Type-Check läuft erfolgreich durch

---

**Letzte Aktualisierung:** 08.06.2025  
**Maintainer:** Assixx Development Team

Diese Standards sind verbindlich für alle TypeScript-Entwicklungen im Assixx-Projekt und werden regelmäßig überprüft und aktualisiert.

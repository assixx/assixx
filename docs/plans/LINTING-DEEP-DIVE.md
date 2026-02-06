# 🔍 ESLint & Prettier Empfehlungen - Detaillierte Erklärung

## 1. TypeScript Strictness Rules - Warum sie wichtig sind

### `@typescript-eslint/strict-boolean-expressions`

```javascript
// ❌ SCHLECHT - Kann zu unerwarteten Bugs führen
if (userName) {
  // Was wenn userName = "" oder 0?
  console.info(userName);
}

// ✅ GUT - Explizit und klar
if (userName !== undefined && userName !== null && userName !== '') {
  console.info(userName);
}

// ✅ ODER mit der Regel:
if (userName != null && userName.length > 0) {
  console.info(userName);
}
```

**Warum:** JavaScript's "truthy/falsy" Verhalten kann tricky sein:

- `""` (leerer String) ist falsy
- `0` ist falsy
- `[]` ist truthy (!)
- `{}` ist truthy (!)

Diese Regel zwingt dich, explizit zu sein und verhindert Bugs.

### `@typescript-eslint/no-floating-promises`

```javascript
// ❌ SCHLECHT - Promise wird nicht behandelt
async function deleteUser(id: number) {
  await database.delete(id);
}

deleteUser(123); // Vergessen await/then - Error wird verschluckt!

// ✅ GUT
await deleteUser(123);
// oder
deleteUser(123).catch(console.error);
// oder
void deleteUser(123); // Explizit ignorieren
```

**Warum:** Unbehandelte Promises können zu:

- Verschluckten Errors führen
- Race Conditions verursachen
- Memory Leaks in manchen Fällen

### `@typescript-eslint/no-unnecessary-condition`

```javascript
// ❌ SCHLECHT - TypeScript weiß dass dies immer true ist
const user: User = getUser();
if (user) { // User kann nie null sein laut Type!
  console.info(user.name);
}

// ✅ GUT
const user: User | null = getUser();
if (user) { // Jetzt macht die Prüfung Sinn
  console.info(user.name);
}
```

**Warum:** Hilft tote Code-Pfade zu finden und zeigt oft Typ-Fehler auf.

## 2. Import/Export Organisation - Strukturierter Code

### Warum Import-Reihenfolge wichtig ist

```javascript
// ❌ SCHLECHT - Chaotische Imports
import { useState } from "react";
import { User } from "../types";
import fs from "fs";
import "./styles.css";
import { Button } from "@mui/material";
import { formatDate } from "./utils";

// ✅ GUT - Organisierte Imports
// 1. Node built-ins
import fs from "fs";
import path from "path";

// 2. External packages
import { useState } from "react";
import { Button } from "@mui/material";

// 3. Internal modules
import { User } from "../types";
import { formatDate } from "./utils";

// 4. Side-effect imports
import "./styles.css";
```

**Vorteile:**

- **Lesbarkeit:** Sofort sehen woher Dependencies kommen
- **Merge Conflicts:** Weniger Konflikte bei gleichzeitigen Änderungen
- **Performance:** Built-ins zuerst kann minimal schneller sein
- **Debugging:** Einfacher Dependencies zu tracken

### Import Cycle Detection

```javascript
// ❌ SCHLECHT - Zirkuläre Abhängigkeit
// user.ts
import { Permission } from './permission';
export class User {
  permissions: Permission[];
}

// permission.ts
import { User } from './user';
export class Permission {
  user: User;
}

// ✅ GUT - Gemeinsame Types extrahieren
// types.ts
export interface IUser {
  permissions: IPermission[];
}
export interface IPermission {
  user: IUser;
}
```

**Warum:** Circular dependencies können zu:

- Runtime Errors führen
- Schwer zu debuggende Probleme
- Build-Performance Probleme

## 3. Security Rules - Häufige Schwachstellen vermeiden

### `security/detect-object-injection`

```javascript
// ❌ GEFÄHRLICH - Object Injection
function getValue(obj: any, key: string) {
  return obj[key]; // key könnte "__proto__" sein!
}

// ✅ SICHER
function getValue(obj: Record<string, unknown>, key: string) {
  if (!Object.prototype.hasOwnProperty.call(obj, key)) {
    return undefined;
  }
  return obj[key];
}

// ✅ ODER noch besser
const allowedKeys = ['name', 'email', 'age'] as const;
function getValue(obj: any, key: typeof allowedKeys[number]) {
  return obj[key];
}
```

**Gefahr:** Prototype Pollution Attacks können das ganze Objekt-System manipulieren.

### `security/detect-unsafe-regex`

```javascript
// Bei Input wie "aaaa@aaaa@aaaa@..." kann exponentiell lange dauern!
// ✅ SICHER - Einfachere Regex oder Library nutzen
import validator from 'validator';

// ❌ GEFÄHRLICH - ReDoS (Regular Expression Denial of Service)
const emailRegex = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;

if (validator.isEmail(email)) {
  // ...
}
```

**Warum:** Bestimmte Regex-Patterns können bei speziellen Inputs extrem lange Laufzeiten haben.

## 4. Prettier Erweiterte Optionen

### `quoteProps: "as-needed"`

```javascript
// ❌ Unnötige Quotes
const obj = {
  name: "John",
  age: 30,
  "valid-key": true,
};

// ✅ Nur wo nötig
const obj = {
  name: "John",
  age: 30,
  "valid-key": true, // Nur hier nötig wegen Bindestrich
};
```

### `htmlWhitespaceSensitivity: "css"`

```html
<!-- Behandelt Whitespace wie CSS display: inline-block -->
<!-- Verhindert unerwartete Leerzeichen in HTML -->
<span>Hello</span>
<span>World</span>
<!-- Wird NICHT zu Hello World mit Leerzeichen -->
```

## 5. Pre-commit Hooks - Automatische Qualitätssicherung

### Wie es funktioniert

```bash
# Wenn du committest:
git add .
git commit -m "feat: new feature"

# Husky triggert automatisch:
# 1. ESLint --fix auf geänderte Dateien
# 2. Prettier --write auf geänderte Dateien
# 3. TypeScript type-check
# 4. Nur wenn alles passt, wird committed
```

**Vorteile:**

- **Keine kaputten Commits:** Fehlerhafte Code kommt nicht ins Repo
- **Automatische Fixes:** Formatting wird automatisch korrigiert
- **Team-Konsistenz:** Jeder committed sauberen Code
- **Zeit sparen:** Keine manuellen Checks nötig

### Typisches Setup

```json
// .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Nur geänderte Dateien prüfen
npx lint-staged

# Optional: Tests nur für geänderte Module
npm run test:changed
```

## 6. VS Code Integration Details

### Warum diese Settings?

```json
{
  "editor.formatOnSave": true,
  // Formatiert automatisch beim Speichern - nie wieder vergessen!

  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  // ESLint Fixes werden automatisch angewendet
  // z.B. unused imports entfernen, const statt let, etc.

  "typescript.tsdk": "node_modules/typescript/lib"
  // Nutzt die Projekt-TypeScript Version statt globale
  // Wichtig für konsistente Type-Checks
}
```

## 7. Performance Regeln - Code Complexity begrenzen

### `complexity: ['warn', 10]`

```javascript
// ❌ ZU KOMPLEX - Schwer zu verstehen und testen
function processUser(user: User, action: string) {
  if (user.isActive) {
    if (action === 'delete') {
      if (user.role === 'admin') {
        if (user.subordinates.length > 0) {
          // ... 6 mehr verschachtelte ifs
        }
      }
    }
  }
}

// ✅ BESSER - Aufgeteilt in kleinere Funktionen
function canDeleteUser(user: User): boolean {
  return user.isActive && user.role === 'admin';
}

function hasSubordinates(user: User): boolean {
  return user.subordinates.length > 0;
}

function processUser(user: User, action: string) {
  if (action === 'delete' && canDeleteUser(user)) {
    if (hasSubordinates(user)) {
      handleUserWithSubordinates(user);
    }
  }
}
```

### `max-lines: ['warn', 500]`

**Warum:**

- Große Dateien = Schwer zu navigieren
- Zeichen dass die Datei zu viel macht (Single Responsibility)
- Schwieriger zu testen

## Praktische Umsetzung - Schritt für Schritt

### Phase 1: Basis-Verbesserungen (1 Tag)

1. EditorConfig ✅ (schon erledigt)
2. Prettier erweiterte Optionen
3. Basis TypeScript strict rules

### Phase 2: Import Organisation (2-3 Stunden)

1. eslint-plugin-import installieren
2. Import order rules aktivieren
3. Einmal durchs Projekt mit --fix

### Phase 3: Pre-commit Hooks (1 Stunde)

1. Husky + lint-staged setup
2. Team informieren
3. Dokumentation

### Phase 4: Security & Performance (Optional)

1. Nach Bedarf aktivieren
2. Warnings zuerst, dann errors

## Häufige Einwände und Antworten

**"Das ist zu strikt!"**

- Start mit 'warn' statt 'error'
- Schrittweise erhöhen
- Team-Konsens finden

**"Das verlangsamt Development!"**

- Pre-commit hooks nur auf staged files
- VS Code integration spart Zeit
- Weniger Bugs = weniger Debugging

**"Wir haben keine Zeit dafür!"**

- 1-2 Stunden Investment
- Spart langfristig viel mehr Zeit
- Kann schrittweise gemacht werden

## Zusammenfassung

Die wichtigsten Quick Wins:

1. **TypeScript strict-boolean-expressions** - Verhindert viele Bugs
2. **Import ordering** - Bessere Code Organisation
3. **Pre-commit hooks** - Automatische Qualität
4. **VS Code settings** - Developer Experience

Nicht alles muss sofort gemacht werden - aber jede Verbesserung hilft!

# Phase 2 Migration Guide: Middleware Refactoring

## ✅ Abgeschlossene Arbeiten

### Neue Middleware-Dateien

1. **`/middleware/auth-refactored.ts`** - Typsichere Authentication
2. **`/middleware/validation.ts`** - Validation Schemas mit express-validator
3. **`/middleware/security.ts`** - Kombinierte Security Stacks
4. **`/routes/users-refactored.example.ts`** - Beispiel-Migration

### Vorteile der neuen Implementierung

- ✅ Keine `as any` mehr nötig
- ✅ Automatische Rate Limiting
- ✅ Type-safe Request/Response
- ✅ Konsistente Error Responses
- ✅ Wiederverwendbare Validation Schemas

## 🔄 Migration Steps für bestehende Routes

### 1. Import Updates

**ALT:**

```typescript
import { authenticateToken } from "../middleware/auth";
// @ts-ignore
import { validationResult, body } from "express-validator";
```

**NEU:**

```typescript
import { AuthenticatedRequest, ParamsRequest, BodyRequest } from "../types";
import { security } from "../middleware/security";
import { validationSchemas } from "../middleware/validation";
import { successResponse, errorResponse } from "../types/response.types";
```

### 2. Route Handler Updates

**ALT:**

```typescript
router.get("/me", authenticateToken as any, async (req: any, res: any) => {
  // ...
});
```

**NEU:**

```typescript
router.get("/me", ...security.user(), async (req: AuthenticatedRequest, res) => {
  // req.user ist jetzt typsicher verfügbar
});
```

### 3. Validation Updates

**ALT:**

```typescript
router.post(
  "/create",
  authenticateToken as any,
  [body("email").isEmail(), body("name").notEmpty()],
  async (req: any, res: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  },
);
```

**NEU:**

```typescript
router.post("/create", ...security.user(validationSchemas.createUser), async (req: BodyRequest<CreateUserDto>, res) => {
  // Validation wird automatisch durchgeführt
  // req.body ist typsicher
});
```

## 📋 Checkliste für Route-Migration

Für jede Route-Datei:

- [ ] Imports aktualisieren
- [ ] `as any` entfernen
- [ ] Security Stack anwenden (public/user/admin)
- [ ] Request Type spezifizieren
- [ ] Response Helpers verwenden
- [ ] Validation Schema verwenden oder erstellen
- [ ] Error Handling vereinheitlichen
- [ ] Tests aktualisieren

## 🚀 Migrations-Reihenfolge

1. **Kritische Auth Routes** (Woche 1)
   - [ ] auth.ts
   - [ ] login.ts
   - [ ] signup.ts

2. **User Management** (Woche 1)
   - [ ] users.ts
   - [ ] profile.ts
   - [ ] settings.ts

3. **Core Features** (Woche 2)
   - [ ] documents.ts
   - [ ] blackboard.ts
   - [ ] calendar.ts
   - [ ] chat.ts

4. **Admin Routes** (Woche 2)
   - [ ] admin.ts
   - [ ] tenants.ts
   - [ ] features.ts

5. **Remaining Routes** (Woche 3)
   - [ ] Alle anderen Routes

## 🛠️ Hilfreiche Commands

### Type Check einzelner Dateien

```bash
npx tsc --noEmit src/routes/users.ts
```

### Finde alle 'as any' Vorkommen

```bash
grep -r "as any" src/routes/
```

### ESLint für spezifische Datei

```bash
npx eslint src/routes/users.ts
```

## ⚠️ Häufige Fehler vermeiden

1. **Request Type vergessen**

   ```typescript
   // ❌ FALSCH
   async (req, res) => {
     const userId = req.user.id; // TypeScript Error!
   };

   // ✅ RICHTIG
   async (req: AuthenticatedRequest, res) => {
     const userId = req.user.id; // OK!
   };
   ```

2. **Spread Operator vergessen**

   ```typescript
   // ❌ FALSCH
   router.get("/users", security.admin(), handler);

   // ✅ RICHTIG
   router.get("/users", ...security.admin(), handler);
   ```

3. **Validation Result nicht mehr manuell prüfen**

   ```typescript
   // ❌ FALSCH (alte Methode)
   const errors = validationResult(req);
   if (!errors.isEmpty()) {
     /* ... */
   }

   // ✅ RICHTIG (automatisch durch Middleware)
   // Validation wird automatisch in security.user(validation) geprüft
   ```

## 📊 Fortschritt Tracking

Erstelle ein Issue in GitHub:

```
Title: [TypeScript] Remove all 'as any' from routes
Description:
- [ ] Phase 1: Type Infrastructure ✅
- [ ] Phase 2: Middleware Refactoring ✅
- [ ] Phase 3: Route Migration (0/18 files)
- [ ] Phase 4: Testing & Validation
```

## 🎯 Erfolgskriterien

- Keine `as any` in Routes
- Alle Routes haben explizite Rate Limiting
- GitHub Security Warnings reduziert
- TypeScript Compile ohne Errors
- Alle Tests bestehen

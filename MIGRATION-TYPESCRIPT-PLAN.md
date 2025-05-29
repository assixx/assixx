# 📋 TypeScript & ES Modules Migration Plan für Assixx

> **Erstellt:** 29.01.2025  
> **Ziel:** Sichere, schrittweise Migration zu TypeScript und ES Modules  
> **Geschätzte Dauer:** 2-3 Wochen

## 🎯 Ziele der Migration

1. **Type-Safety** für weniger Runtime-Fehler
2. **Bessere Developer Experience** mit IntelliSense
3. **Moderne Codebasis** mit ES Modules
4. **Keine Breaking Changes** für bestehende Features

## 📊 Phase 1: TypeScript Migration (10-14 Tage)

### Woche 1: Basis-Setup & Core Types

#### Tag 1-2: TypeScript Setup

```bash
# 1. Dependencies installieren
npm install --save-dev typescript @types/node @types/express @types/bcrypt
npm install --save-dev @types/jsonwebtoken @types/mysql2 @types/multer
npm install --save-dev ts-node nodemon

# 2. tsconfig.json erstellen
```

**tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs", // Erst CommonJS, später ES Modules
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": false, // Beginne mit false, dann schrittweise true
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowJs": true, // Wichtig für schrittweise Migration
    "checkJs": false
  },
  "include": ["backend/**/*", "frontend/src/**/*"],
  "exclude": ["node_modules", "dist", "frontend/dist"]
}
```

#### Tag 3-4: Core Type Definitions

Erstelle `backend/src/types/` Verzeichnis:

1. **models.d.ts** - Datenbank Models

```typescript
export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'employee' | 'root';
  tenantId: number | null;
  isActive: boolean;
  createdAt: Date;
}

export interface Tenant {
  id: number;
  name: string;
  subdomain: string;
  isActive: boolean;
  features: string[];
}

export interface Document {
  id: number;
  filename: string;
  category: string;
  uploadedBy: number;
  tenantId: number;
}
```

2. **api.d.ts** - API Request/Response Types

```typescript
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
```

3. **express.d.ts** - Express Erweiterungen

```typescript
import { User } from './models';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      tenant?: Tenant;
      tenantId?: number;
    }
  }
}
```

#### Tag 5-7: Kritische Module migrieren

**Priorität 1: Authentication & Security**

- `backend/src/services/auth.service.js` → `.ts`
- `backend/src/middleware/auth.js` → `.ts`
- `backend/src/middleware/tenant.js` → `.ts`

**Beispiel Migration:**

```typescript
// auth.service.ts
import { User, LoginRequest } from '../types/models';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export class AuthService {
  async authenticateUser(
    username: string,
    password: string
  ): Promise<User | null> {
    // Type-safe implementation
  }
}
```

### Woche 2: Schrittweise Migration

#### Tag 8-10: Models & Services

- Alle Models zu TypeScript
- Alle Services zu TypeScript
- Unit Tests anpassen

#### Tag 11-12: Controllers & Routes

- Controllers mit Request/Response Types
- Route Handlers typisieren

#### Tag 13-14: Frontend Scripts

- Kritische Frontend-Scripts
- API Service Layer

## 📊 Phase 2: ES Modules Migration (5-7 Tage)

### Vorbereitung (Tag 1)

1. **package.json anpassen:**

```json
{
  "type": "module",
  "engines": {
    "node": ">=18.0.0"
  }
}
```

2. **tsconfig.json Update:**

```json
{
  "compilerOptions": {
    "module": "ES2022",
    "moduleResolution": "node"
  }
}
```

### Migration (Tag 2-5)

**Automatisiertes Script für Basis-Konvertierung:**

```bash
# Tool installieren
npm install -g cjs-to-esm

# Oder manuell mit Regex
# require() → import
# module.exports → export
# exports.xyz → export
```

**Manuelle Anpassungen:**

1. `__dirname` → `import.meta.url`
2. Dynamic imports anpassen
3. JSON imports fixen

### Testing & Fixes (Tag 6-7)

- Alle Tests durchlaufen
- Import-Pfade korrigieren
- Build-Process testen

## 🛡️ Risiko-Minimierung

### 1. Feature-Branch Strategie

```bash
git checkout -b feature/typescript-migration
# Nach jedem erfolgreichen Schritt committen
```

### 2. Rollback-Plan

- Täglich Backups
- Git Tags für funktionierende Zustände
- Parallele Entwicklung möglich

### 3. Test-Strategie

```json
// package.json
{
  "scripts": {
    "test:migration": "npm run build && npm test",
    "dev:ts": "nodemon --exec ts-node backend/src/server.ts",
    "dev:parallel": "npm run dev" // Alte Version parallel
  }
}
```

## 📈 Migrations-Reihenfolge

### Priorität 1 (Security-kritisch)

1. Auth System (auth.service, auth.middleware)
2. Tenant Isolation (tenant.middleware)
3. Input Validation (validators)
4. Database Layer

### Priorität 2 (Feature-kritisch)

1. Document Management
2. Chat System
3. Survey System
4. KVP System

### Priorität 3 (Nice-to-have)

1. Admin Features
2. Utility Functions
3. Email Services

## ✅ Success Criteria

### Nach TypeScript Migration:

- [ ] Keine `any` Types in kritischen Bereichen
- [ ] 100% Type Coverage für Models
- [ ] Alle Tests grün
- [ ] Build ohne Fehler

### Nach ES Modules Migration:

- [ ] Keine require() Statements
- [ ] Import Maps funktionieren
- [ ] Performance gleich oder besser
- [ ] Production Build läuft

## 🚀 Quick Wins

### Sofort umsetzbar:

1. JSDoc zu TypeScript Types
2. Neue Features direkt in TypeScript
3. Kritische Bugs mit Types verhindern

### Tools & Helpers:

```bash
# Type Coverage Report
npx type-coverage

# Finde any-Types
npx tsc --noEmit | grep "any"

# Migration Helper
npx ts-migrate
```

## 📅 Zeitplan

| Woche | Phase                | Fokus                        |
| ----- | -------------------- | ---------------------------- |
| 1     | TypeScript Setup     | Core Types, Auth, Models     |
| 2     | TypeScript Migration | Services, Controllers, Tests |
| 3     | ES Modules           | Migration & Testing          |

## 🎯 Nächste Schritte

1. **Backup erstellen**
2. **Feature-Branch anlegen**
3. **TypeScript installieren**
4. **Mit Auth-System beginnen**

---

**Bereit?** Der erste Schritt ist immer der schwerste, aber es lohnt sich!

# TypeScript Security Best Practices für Assixx

## 🎯 Ziel

Eliminierung aller Security Warnings durch korrekte TypeScript-Typisierung und explizite Security-Patterns.

## 🚨 Häufige Security Warnings und deren Lösung

### 1. **"Missing rate limiting on authentication endpoint"**

```typescript
// ❌ Triggert Security Warning
router.post('/login', async (req, res) => {
  // Login logic
});

// ✅ Korrekt mit Rate Limiting
router.post('/login', ...security.auth(loginValidation), async (req: Request, res: Response): Promise<void> => {
  // Login logic
});
```

### 2. **"Potential authorization bypass"**

```typescript
// ❌ Triggert Warning - `as any` versteckt fehlende Auth
router.delete('/user/:id', authenticateToken as any, async (req: any, res: any) => {
  // Keine Rollenprüfung!
});

// ✅ Korrekt mit expliziter Authorisierung
router.delete('/user/:id', ...security.admin(), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Admin-only operation
});
```

### 3. **"Response splitting vulnerability"**

```typescript
// ❌ Direktes Setzen von Headers
res.setHeader('Location', req.query.redirect);

// ✅ Validierte Redirects
const allowedDomains = ['localhost:3000'];
if (allowedDomains.includes(new URL(redirect).host)) {
  res.redirect(redirect);
}
```

## 📋 Best Practices

### 1. **Request/Response Typisierung**

```typescript
// ✅ RICHTIG - Verwende zentrale Types
import { AuthenticatedRequest } from '../types/request.types';
import { Response } from 'express';

router.get('/me', authenticateToken, rateLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // req.user ist jetzt typsicher verfügbar
  const userId = req.user.id;
});
```

```typescript
// ❌ FALSCH - Vermeide 'as any'
router.get('/me', authenticateToken as any, async (req: any, res: any) => {
  // TypeScript kann nicht validieren
});
```

### 2. **Security Middleware Stack**

```typescript
// ✅ RICHTIG - Explizite Security Layer
import { securityMiddleware } from '../middleware/security';
import { rateLimiter } from '../middleware/rateLimiter';
import { authenticateToken } from '../auth';
import { validateInput } from '../middleware/validation';

// Definiere Security-Stack für verschiedene Szenarien
const publicRouteStack = [rateLimiter.public, validateInput];

const authenticatedRouteStack = [rateLimiter.authenticated, authenticateToken, validateInput];

const adminRouteStack = [rateLimiter.admin, authenticateToken, requireRole('admin'), validateInput];

// Anwendung
router.get('/public', ...publicRouteStack, handler);
router.get('/user', ...authenticatedRouteStack, handler);
router.post('/admin', ...adminRouteStack, handler);
```

### 3. **Rate Limiting Strategie**

```typescript
// config/rateLimits.ts
export const rateLimits = {
  // Öffentliche Endpoints
  public: {
    windowMs: 15 * 60 * 1000, // 15 Minuten
    max: 100, // 100 Requests pro IP
  },

  // Login/Signup
  auth: {
    windowMs: 15 * 60 * 1000,
    max: 5, // Nur 5 Versuche
    skipSuccessfulRequests: true,
  },

  // API für authentifizierte User
  authenticated: {
    windowMs: 15 * 60 * 1000,
    max: 1000,
    keyGenerator: (req) => req.user?.id || req.ip,
  },

  // Admin-Operationen
  admin: {
    windowMs: 15 * 60 * 1000,
    max: 2000,
  },
};
```

### 4. **Type Guards für Runtime-Sicherheit**

```typescript
// Type Guard Functions
function isAuthenticatedRequest(req: Request): req is AuthenticatedRequest {
  return 'user' in req && req.user != null;
}

// Verwendung in Routes
router.get('/profile', authenticateToken, async (req: Request, res: Response) => {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // TypeScript weiß jetzt, dass req.user existiert
  const profile = await getUserProfile(req.user.id);
});
```

### 5. **Zentralisierte Error Types**

```typescript
// types/errors.types.ts
export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

export class AuthenticationError extends Error implements ApiError {
  code = 'AUTHENTICATION_ERROR';
  statusCode = 401;
}

export class RateLimitError extends Error implements ApiError {
  code = 'RATE_LIMIT_EXCEEDED';
  statusCode = 429;
}
```

## 🔧 Migration Plan

### Phase 1: Type Infrastructure (1 Woche)

1. [ ] Erweitere `types/request.types.ts` mit allen benötigten Request-Varianten
2. [ ] Erstelle `types/response.types.ts` für standardisierte Responses
3. [ ] Definiere Security-spezifische Types in `types/security.types.ts`

### Phase 2: Middleware Refactoring (1 Woche)

1. [ ] Refactor `authenticateToken` mit korrekten Types
2. [ ] Erstelle typsichere Rate Limiter für verschiedene Szenarien
3. [ ] Implementiere Type Guards für Runtime-Checks

### Phase 3: Route Migration (2-3 Wochen)

1. [ ] Migriere Routes alphabetisch
2. [ ] Entferne alle `as any` Casts
3. [ ] Füge explizite Rate Limiting zu allen Endpoints hinzu
4. [ ] Teste jeden migrierten Endpoint

### Phase 4: Validation & Documentation (1 Woche)

1. [ ] GitHub Security Scan erneut ausführen
2. [ ] Dokumentiere Security-Patterns
3. [ ] Erstelle Linting Rules gegen `as any`
4. [ ] Team-Schulung

## 📊 Metriken für Erfolg

- **0** `as any` Casts im Backend-Code
- **100%** der Endpoints mit explizitem Rate Limiting
- **0** Security Warnings von GitHub
- **100%** Type Coverage in Routes

## 🔍 Konkrete Beispiele aus der Migration

### Vorher (mit `as any`):

```typescript
// ❌ users.ts - Unsicher
router.get('/profile/:id', authenticateToken as any, rateLimiter as any, async (req: any, res: any) => {
  const userId = req.user.id; // TypeScript kann nicht validieren
});
```

### Nachher (typsicher):

```typescript
// ✅ users.ts - Sicher
router.get('/profile/:id', ...security.admin(), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user.id; // TypeScript validiert req.user
  // ...
  res.json(successResponse(userProfile));
});
```

### Multi-Tenant Security Fix:

```typescript
// ❌ Vorher - Sicherheitslücke
const user = await User.update(userId, data);

// ✅ Nachher - Tenant-isoliert
const user = await User.update(userId, data, req.user.tenant_id);
```

## 🛡️ Langfristige Vorteile

1. **Automatische Security-Validierung**: GitHub Scanner erkennt Security-Patterns
2. **Type Safety**: Compile-Time Fehler statt Runtime-Bugs
3. **Bessere IDE-Unterstützung**: Autocomplete und Refactoring
4. **Wartbarkeit**: Neue Entwickler verstehen Security-Anforderungen sofort
5. **Compliance**: Nachweisbare Security-Maßnahmen für Audits

## 🚀 Quick Wins

Starte mit diesen einfachen Änderungen:

1. **ESLint Rule** gegen `as any`:

```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error"
  }
}
```

2. **Template für neue Routes**:

```typescript
// templates/route.template.ts
import { Router } from 'express';
import { AuthenticatedRequest } from '../types/request.types';
import { authenticateToken } from '../auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get(
  '/',
  rateLimiter.authenticated,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Implementation
  }
);

export default router;
```

3. **Pre-commit Hook** für Type-Checking:

```bash
#!/bin/bash
# .husky/pre-commit
npm run type-check
```

# URL Security Plan - Assixx

> **Status:** PLAN | **Best Practice 2025** | **NestJS+Fastify kompatibel**

## TL;DR - Was brauchen wir wirklich?

| Situation                     | CSRF nötig? | Grund                                      |
| ----------------------------- | ----------- | ------------------------------------------ |
| JWT im `Authorization` Header | **NEIN**    | Externe Seiten können Header nicht setzen  |
| JWT im Cookie                 | **JA**      | Browser sendet Cookies automatisch         |
| Wir aktuell                   | **NEIN**    | JWT im Header (siehe `auth.middleware.ts`) |

**OWASP 2025:** "Placing a token in the Authorization header provides protection against CSRF"

## Aktueller Zustand (Express - TEMPORÄR)

```
✅ JWT Bearer Token im Header     → CSRF-immun
✅ CORS Whitelist                 → Origin-Schutz
✅ Helmet CSP/HSTS                → Header-Sicherheit
✅ Rate Limiting                  → Brute-Force-Schutz
❌ CSRF Middleware                → STUB (macht nur next())
```

**Warum STUB ok ist:** JWT im Header schützt bereits. Express wird bald durch NestJS ersetzt.

## Zukünftiger Zustand (NestJS + Fastify + SvelteKit)

### 1. Backend: @fastify/csrf-protection

```bash
# Wird bei NestJS-Migration installiert
pnpm add @fastify/cookie @fastify/csrf-protection
```

```typescript
// backend/src/main.ts (NestJS + Fastify)
import fastifyCookie from '@fastify/cookie';
import fastifyCsrf from '@fastify/csrf-protection';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  // Cookie + CSRF (Double Submit Cookie Pattern)
  await app.register(fastifyCookie, { secret: process.env.COOKIE_SECRET });
  await app.register(fastifyCsrf, { cookieOpts: { signed: true, sameSite: 'strict' } });

  await app.listen(3000, '0.0.0.0');
}
```

### 2. Frontend: SvelteKit Built-in CSRF

```typescript
// svelte.config.js (bereits in OPTIMAL-SETUP.md geplant)
export default {
  kit: {
    csrf: {
      checkOrigin: true, // Built-in Origin-Validierung
    },
  },
};
```

### 3. Origin Validation Guard (Defense-in-Depth)

**Was ist das?** Extra Prüfung: "Kommt die Anfrage von unserer eigenen Seite?"

**Was ist Defense-in-Depth?** Mehrere Sicherheitsebenen - falls eine versagt, fängt die nächste ab:

```
Anfrage kommt rein
       ↓
   [CORS Check]        ← Erste Ebene: Browser blockt fremde Domains
       ↓
   [JWT Validation]    ← Zweite Ebene: Ohne gültigen Token = 401
       ↓
   [Origin Check]      ← Dritte Ebene: Kommt von assixx.com?
       ↓
   API antwortet

→ Wie ein Schloss mit 3 Türen statt 1
```

**Code (NestJS Guard):**

```typescript
// backend/src/common/guards/origin.guard.ts
const ALLOWED_ORIGINS = ['localhost', 'assixx.com', 'assixx.de'];

export const validateOrigin = (req: Request, res: Response, next: NextFunction): void => {
  const origin = req.headers.origin ?? req.headers.referer ?? '';

  if (origin && !ALLOWED_ORIGINS.some((d) => origin.includes(d))) {
    res.status(403).json({ error: 'Invalid origin' });
    return;
  }
  next();
};
```

## Implementierungs-Strategie

| Phase                   | Was                          | Wann     | Aufwand |
| ----------------------- | ---------------------------- | -------- | ------- |
| **Jetzt**               | Origin Validation in Express | Optional | 15min   |
| **NestJS Migration**    | @fastify/csrf-protection     | Phase 1  | 30min   |
| **SvelteKit Migration** | checkOrigin: true            | Phase 3  | 5min    |

**KISS-Prinzip:** Keine Express CSRF-Library installieren - Migration zu NestJS steht bevor!

## Was wir NICHT brauchen

| Feature                      | Warum nicht                                |
| ---------------------------- | ------------------------------------------ |
| URL-Token wie Google (sxsrf) | Für Cookie-Sessions, wir nutzen JWT Header |
| iflsig Signatur              | Für öffentliche Suchmaschinen              |
| csrf-csrf Package            | Express-only, wir migrieren zu Fastify     |
| Signed URLs                  | Nur für öffentliche Download-Links nötig   |

## Env Variables (bei NestJS-Migration hinzufügen)

```env
COOKIE_SECRET=random-32-char-string-for-signed-cookies
```

## Quellen

- [OWASP CSRF Prevention 2025](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [@fastify/csrf-protection](https://github.com/fastify/csrf-protection)
- [NestJS CSRF Docs](https://docs.nestjs.com/security/csrf)
- [SvelteKit CSRF Config](https://svelte.dev/docs/kit/configuration#csrf)
- [JWT Best Practices 2025](https://jwt.app/blog/jwt-best-practices/)
- [Stateless CSRF for SPAs](https://rojas.io/stateless-csrf-protection-in-an-spa/)

---

_Plan erstellt: 2025-12-12 | Kompatibel mit: OPTIMAL-SETUP.md_

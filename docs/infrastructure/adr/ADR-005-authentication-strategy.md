# ADR-005: Authentication Strategy

| Metadata                | Value                                      |
| ----------------------- | ------------------------------------------ |
| **Status**              | Accepted                                   |
| **Date**                | 2026-01-14                                 |
| **Decision Makers**     | SCS Technik                                |
| **Affected Components** | Backend Guards, JWT, Database, CLS Context |

---

## Context

Das Assixx-Backend benötigt eine robuste Authentication-Strategie für:

1. **Multi-Tenant SaaS** - Strikte Isolation zwischen Tenants
2. **Role-based Access** - admin, employee, root mit unterschiedlichen Rechten
3. **Role-Switching** - Admins können als Employee agieren
4. **Multiple Token-Quellen** - Browser (Cookie), API (Header), WebSocket (Query)
5. **Security** - Token-Invalidierung wenn User deaktiviert wird

### Anforderungen

- JWT-basierte stateless Authentication
- Sofortige Invalidierung bei User-Deaktivierung (nicht erst bei Token-Expiry)
- Tenant-Context für alle downstream Services
- Support für HttpOnly Cookies (CSRF-Schutz)
- WebSocket-Kompatibilität

### Bestehendes Setup

- Backend: NestJS 11 + Fastify 5
- Database: PostgreSQL 17
- Context: nestjs-cls für Request-Scope

---

## Decision

### Custom JwtAuthGuard statt Passport.js

Wir implementieren einen **Custom JwtAuthGuard** ohne Passport.js:

```
backend/src/nest/common/guards/jwt-auth.guard.ts
```

### Architektur-Entscheidungen

| Entscheidung            | Gewählt                   | Begründung                                 |
| ----------------------- | ------------------------- | ------------------------------------------ |
| **Auth Library**        | Custom Guard              | Volle Kontrolle, kein Passport.js Overhead |
| **Token Storage**       | 3 Quellen                 | Header + Cookie + Query für alle Use-Cases |
| **User Validation**     | DB-Lookup pro Request     | Sofortige Invalidierung möglich            |
| **Context Propagation** | CLS (nestjs-cls)          | Request-Scope ohne Parameter-Drilling      |
| **Token Type**          | Explicit `type: 'access'` | Verhindert Refresh-Token-Missbrauch        |

### Token-Extraktion (Reihenfolge)

```typescript
1. Authorization: Bearer <token>  // API-Clients
2. Cookie: accessToken            // Browser (HttpOnly)
3. Query: ?token=<token>          // WebSocket Handshake
```

### Validierungsschritte

```
1. Token aus Request extrahieren
2. JWT-Signatur verifizieren
3. Token-Type = 'access' prüfen
4. User aus DB laden (frische Daten!)
5. is_active = 1 prüfen
6. Rolle validieren (root | admin | employee)
7. CLS Context setzen (tenantId, userId, userRole)
8. User an Request anhängen
```

### Warum DB-Lookup bei jedem Request?

| Szenario         | Nur JWT                          | Mit DB-Lookup       |
| ---------------- | -------------------------------- | ------------------- |
| User deaktiviert | Zugriff bis Token-Expiry (15min) | Sofort gesperrt     |
| Rolle geändert   | Alte Rolle bis Token-Expiry      | Sofort aktualisiert |
| User gelöscht    | Zugriff bis Token-Expiry         | Sofort 401          |

**Trade-off:** ~1ms Latenz pro Request vs. sofortige Invalidierung

---

## Alternatives Considered

### 1. Passport.js (@nestjs/passport)

| Pro               | Contra                               |
| ----------------- | ------------------------------------ |
| Weit verbreitet   | Overhead für einfache JWT-Validation |
| Viele Strategien  | Abstraction Layer nicht nötig        |
| Community Support | Passport-Session nicht gebraucht     |
|                   | Schwieriger zu debuggen              |

**Entscheidung:** Abgelehnt - Wir brauchen nur JWT, nicht OAuth/SAML/etc.

### 2. Nur JWT ohne DB-Lookup

| Pro              | Contra                           |
| ---------------- | -------------------------------- |
| Schneller (~1ms) | Keine sofortige Invalidierung    |
| Stateless        | User-Änderungen verzögert        |
| Weniger DB-Load  | Security-Lücke bei Deaktivierung |

**Entscheidung:** Abgelehnt - Security > Performance für Auth.

### 3. Token Blacklist in Redis

| Pro               | Contra                       |
| ----------------- | ---------------------------- |
| Schneller als DB  | Zusätzliche Komplexität      |
| Stateless-ähnlich | Sync zwischen Redis/DB nötig |
|                   | Blacklist kann wachsen       |

**Entscheidung:** Abgelehnt - DB-Lookup ist einfacher und ausreichend schnell.

### 4. Short-lived Tokens (1min) ohne DB-Lookup

| Pro                    | Contra                      |
| ---------------------- | --------------------------- |
| Stateless              | Sehr häufige Token-Refreshs |
| Schnelle Invalidierung | Mehr Load auf Auth-Endpoint |
|                        | UX bei Offline/Slow Network |

**Entscheidung:** Abgelehnt - 15min Token + DB-Lookup ist besserer Kompromiss.

---

## Consequences

### Positive

1. **Sofortige Invalidierung** - Deaktivierte User sind sofort gesperrt
2. **Einfache Architektur** - Kein Passport.js, kein Redis-Blacklist
3. **Volle Kontrolle** - Custom Logic für Multi-Tenant, Role-Switching
4. **Debuggability** - Klarer Code-Flow, keine Magic
5. **Flexible Token-Quellen** - Browser, API, WebSocket alle unterstützt
6. **CLS Integration** - Tenant-Context automatisch in allen Services

### Negative

1. **DB-Load** - Ein SELECT pro authentifiziertem Request
2. **Latenz** - ~1ms zusätzlich pro Request
3. **Keine Social Login** - Passport.js Strategien nicht verfügbar (nicht benötigt)

### Mitigations

| Problem | Mitigation                                  |
| ------- | ------------------------------------------- |
| DB-Load | Connection Pooling, Query ist indexed (PK)  |
| Latenz  | Query < 1ms, akzeptabel für Security-Gewinn |

---

## Implementation Details

### Files

```
backend/src/nest/common/
├── guards/
│   └── jwt-auth.guard.ts       # Custom JWT Guard
├── decorators/
│   ├── public.decorator.ts     # @Public() bypass auth
│   ├── current-user.decorator.ts # @CurrentUser() param
│   └── tenant.decorator.ts     # @TenantId() param
└── interfaces/
    └── auth.interface.ts       # NestAuthUser, JwtPayload types
```

### Global Registration

```typescript
// app.module.ts
{
  provide: APP_GUARD,
  useClass: JwtAuthGuard,  // Applied to ALL routes
}
```

### @Public() Decorator

```typescript
// Bypasses JwtAuthGuard
@Public()
@Get('health')
getHealth() { ... }
```

---

## Verification

| Scenario           | Expected                  | Status |
| ------------------ | ------------------------- | ------ |
| Valid Token        | 200 + User attached       | ✅     |
| No Token           | 401 Unauthorized          | ✅     |
| Expired Token      | 401 Unauthorized          | ✅     |
| Refresh Token used | 401 Invalid token type    | ✅     |
| User deactivated   | 401 User inactive         | ✅     |
| Invalid Role       | 401 Invalid role          | ✅     |
| @Public() endpoint | 200 without token         | ✅     |
| CLS Context        | tenantId/userId available | ✅     |

---

## References

- [NestJS Guards](https://docs.nestjs.com/guards)
- [JWT Best Practices](https://auth0.com/blog/jwt-security-best-practices/)
- [nestjs-cls](https://github.com/Papooch/nestjs-cls)
- [ADR-001: Rate Limiting](./ADR-001-rate-limiting.md) - Related security measure

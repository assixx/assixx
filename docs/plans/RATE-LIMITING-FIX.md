# Rate Limiting Fix - 12.09.2025

## Problem

Dashboard löste Rate Limit Error (429) aus und landete in Redirect-Loop zur `/rate-limit` Page.

### Symptome

- Nach 10-12 API Calls → HTTP 429
- Redirect zu `/rate-limit` Page
- Weitere API Calls scheiterten → Loop

### Ursache

```javascript
// ALT - ZU NIEDRIG!
apiLimiter: 100 req/min (Production)
searchLimiter: 30 req/min
publicLimiter: 20 req/min
```

Dashboard macht beim Laden **15+ API Calls gleichzeitig**:

- Blackboard, Users, Documents, Teams, Departments
- Chat unread, KVP stats, Calendar events
- Navigation badges

## Lösung

### Geänderte Dateien (nur diese 2!)

1. `/backend/src/middleware/security-enhanced.ts`
2. `/backend/src/middleware/rateLimiter.ts`

### Neue Limits

```javascript
// NEU - DASHBOARD-TAUGLICH
apiLimiter: 5000 req/min (Production)
searchLimiter: 200 req/min
publicLimiter: 100 req/min
```

### Resultat

✅ Dashboard lädt ohne Rate Limit Errors
✅ Alle API Calls erfolgreich (Status 200)
✅ Keine Redirects mehr

## Commands

```bash
docker-compose restart backend
```

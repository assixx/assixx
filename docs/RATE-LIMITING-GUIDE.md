# Rate Limiting Guide für Assixx

## Übersicht

Das Assixx-System implementiert ein mehrschichtiges Rate-Limiting-System zum Schutz vor DoS-Attacken und Missbrauch.

## Rate Limiting Strategie

### 1. Globales Rate Limiting
- **Alle Routen**: Basis-Schutz mit `generalLimiter`
- **Limit**: 1000 Requests pro 15 Minuten pro IP
- **Angewendet auf**: Alle HTML und API Endpoints

### 2. Spezifische Rate Limits

#### Public Endpoints
- **Limit**: 100 Requests pro 15 Minuten
- **Anwendung**: Öffentliche Seiten (index, login, signup)

#### Auth Endpoints
- **Limit**: 5 Requests pro 15 Minuten
- **Anwendung**: Login/Signup Versuche
- **Feature**: Skip successful requests

#### Authenticated Users
- **Limit**: 1000 Requests pro 15 Minuten pro User
- **Key**: User ID statt IP

#### Admin Endpoints
- **Limit**: 2000 Requests pro 15 Minuten
- **Key**: Admin User ID

#### Upload Endpoints
- **Limit**: 20 Uploads pro Stunde
- **Anwendung**: Datei-Uploads

## Implementation

### HTML Routes
```typescript
// Beispiel: HTML Route mit Rate Limiting
router.get('/dashboard', 
  rateLimiter.authenticated, 
  authenticateToken, 
  servePage('dashboard')
);
```

### API Routes mit Security Middleware
```typescript
// Beispiel: API Route mit integriertem Rate Limiting
router.get('/api/users',
  ...security.user(),  // Enthält bereits rateLimiter.authenticated
  async (req, res) => {
    // Handler code
  }
);
```

### Best Practices

1. **Immer Rate Limiting verwenden**
   - Jede Route sollte mindestens das globale Rate Limiting haben
   - Spezifische Limits für sensitive Endpoints

2. **Richtige Limiter wählen**
   - `rateLimiter.auth` für Login/Signup
   - `rateLimiter.authenticated` für User-Endpoints
   - `rateLimiter.admin` für Admin-Funktionen
   - `rateLimiter.upload` für Datei-Uploads

3. **Security Middleware nutzen**
   - `security.user()` statt manuelles Setup
   - Integriert Authentication + Rate Limiting + Validation

4. **Monitoring**
   - Rate Limit Headers beachten
   - Logs für geblockte Requests überwachen

## Konfiguration

Die Rate Limits sind in `/backend/src/middleware/rateLimiter.ts` definiert und können bei Bedarf angepasst werden.

## Testing

```bash
# Test Rate Limiting
for i in {1..10}; do curl -X GET http://localhost:3000/api/test; done
```

## Troubleshooting

- **429 Too Many Requests**: Rate Limit erreicht
- **X-RateLimit-Remaining Header**: Zeigt verbleibende Requests
- **X-RateLimit-Reset Header**: Zeigt Reset-Zeitpunkt
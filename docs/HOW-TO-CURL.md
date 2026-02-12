# How to curl - Assixx API Login

## Das Problem

Bash escaped `!` (History Expansion) auch in Single Quotes. Das macht JSON mit Passwörtern wie `ApiTest12345!` kaputt:

```
# Bash sendet: ApiTest123\!  → Fastify: "Body is not valid JSON"
```

## Lösung: JSON-Datei verwenden

```bash
# 1. JSON-Datei anlegen (einmalig)
cat > /tmp/login.json << 'EOF'
{"email":"admin@apitest.de","password":"ApiTest12345!"}
EOF

# 2. Login
curl -s -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: apitest" \
  -d @/tmp/login.json | jq '.'
```

## Response

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "user": {
      "id": 1,
      "email": "admin@apitest.de",
      "firstName": "Bruno",
      "lastName": "Tester",
      "role": "root",
      "tenantId": 1
    }
  }
}
```

## Token weiterverwenden

```bash
# Token aus Login-Response extrahieren
TOKEN=$(curl -s -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: apitest" \
  -d @/tmp/login.json | jq -r '.data.accessToken')

# Authentifizierte Requests
curl -s http://localhost:3000/api/v2/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: apitest" | jq '.'
```

## Schnelltest: Token aus Browser kopieren

Einfachster Weg — Token aus Browser DevTools (Network Tab) kopieren und direkt verwenden:

```bash
# Beliebigen Endpoint testen (Token aus Browser einfügen)
curl -s http://localhost:3000/api/v2/notifications/stream \
  -H "Authorization: Bearer <TOKEN>" \
  -H "X-Tenant-ID: testfirma" -m 5

# Beispiel: User-Profil abfragen
curl -s http://localhost:3000/api/v2/users/me \
  -H "Authorization: Bearer <TOKEN>" \
  -H "X-Tenant-ID: testfirma" | jq '.'
```

**Wo Token finden:** Browser → F12 → Network Tab → beliebiger API Request → Headers → `Authorization: Bearer eyJ...` kopieren.

**Hinweis:** `-m 5` setzt ein 5-Sekunden-Timeout (nützlich bei SSE-Streams wie `/notifications/stream`).

## Credentials (apitest Tenant)

| Feld     | Wert             |
| -------- | ---------------- |
| Email    | admin@apitest.de |
| Passwort | ApiTest12345!    |
| Tenant   | apitest          |

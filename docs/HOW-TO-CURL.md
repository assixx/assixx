# How to curl - Assixx API Login

## Das Problem

Bash escaped `!` (History Expansion) auch in Single Quotes. Das macht JSON mit Passwörtern wie `BrunoTest123!` kaputt:

```
# Bash sendet: BrunoTest123\!  → Fastify: "Body is not valid JSON"
```

## Lösung: JSON-Datei verwenden

```bash
# 1. JSON-Datei anlegen (einmalig)
cat > /tmp/login.json << 'EOF'
{"email":"admin@brunotest.de","password":"BrunoTest123!"}
EOF

# 2. Login
curl -s -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: brunotest" \
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
      "email": "admin@brunotest.de",
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
  -H "X-Tenant-ID: brunotest" \
  -d @/tmp/login.json | jq -r '.data.accessToken')

# Authentifizierte Requests
curl -s http://localhost:3000/api/v2/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: brunotest" | jq '.'
```

## Credentials (brunotest Tenant)

| Feld     | Wert               |
| -------- | ------------------ |
| Email    | admin@brunotest.de |
| Passwort | BrunoTest123!      |
| Tenant   | brunotest          |

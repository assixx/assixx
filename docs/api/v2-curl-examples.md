# API v2 cURL Examples

## Wichtige Hinweise für Windows/WSL

Bei der Verwendung von curl mit JSON-Daten auf Windows/WSL gibt es häufig Probleme mit der JSON-Escaping. Die sicherste Methode ist die Verwendung einer JSON-Datei.

## Signup v2

### Methode 1: Mit JSON-Datei (EMPFOHLEN)

1. Erstelle eine JSON-Datei:
```bash
cat > /tmp/signup-test.json << 'EOF'
{
  "companyName": "Test Company GmbH",
  "subdomain": "testcompany123",
  "email": "info@testcompany.de",
  "phone": "+491234567890",
  "adminEmail": "admin@testcompany.de",
  "adminPassword": "SecurePass123!",
  "adminFirstName": "Max",
  "adminLastName": "Mustermann",
  "plan": "basic"
}
EOF
```

2. Sende die Anfrage:
```bash
curl -X POST http://localhost:3000/api/v2/signup \
  -H "Content-Type: application/json" \
  -d @/tmp/signup-test.json
```

### Methode 2: Direkt mit JSON (Linux/Mac)

```bash
curl -X POST http://localhost:3000/api/v2/signup \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test Company GmbH",
    "subdomain": "testcompany123",
    "email": "info@testcompany.de",
    "phone": "+491234567890",
    "adminEmail": "admin@testcompany.de",
    "adminPassword": "SecurePass123!",
    "adminFirstName": "Max",
    "adminLastName": "Mustermann",
    "plan": "basic"
  }'
```

## Login v2

### Mit JSON-Datei:

```bash
cat > /tmp/login-test.json << 'EOF'
{
  "email": "admin@testcompany.de",
  "password": "SecurePass123!"
}
EOF

curl -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d @/tmp/login-test.json
```

### Direkt:

```bash
curl -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@testcompany.de", "password": "SecurePass123!"}'
```

## Authentifizierte Anfragen

Nach dem Login erhältst du einen `accessToken`. Verwende diesen für authentifizierte Anfragen:

```bash
# Speichere den Token
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Verwende den Token
curl -X GET http://localhost:3000/api/v2/users \
  -H "Authorization: Bearer $TOKEN"
```

## Weitere v2 Endpoints

### Check Subdomain Availability
```bash
curl -X GET http://localhost:3000/api/v2/signup/check-subdomain/testcompany123
```

### Get User Info (authentifiziert)
```bash
curl -X GET http://localhost:3000/api/v2/auth/user \
  -H "Authorization: Bearer $TOKEN"
```

### Logout (authentifiziert)
```bash
curl -X POST http://localhost:3000/api/v2/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

## Debugging-Tipps

### Verbose Output
Verwende `-v` für detaillierte Ausgabe:
```bash
curl -v -X POST http://localhost:3000/api/v2/signup \
  -H "Content-Type: application/json" \
  -d @/tmp/signup-test.json
```

### Pretty-Print JSON Response
Verwende `jq` für formatierte JSON-Ausgabe:
```bash
curl -X POST http://localhost:3000/api/v2/signup \
  -H "Content-Type: application/json" \
  -d @/tmp/signup-test.json | jq '.'
```

### Response Headers anzeigen
```bash
curl -i -X POST http://localhost:3000/api/v2/signup \
  -H "Content-Type: application/json" \
  -d @/tmp/signup-test.json
```

## Häufige Fehler

### JSON Parsing Error
**Problem:** `SyntaxError: Bad escaped character in JSON`
**Lösung:** Verwende eine JSON-Datei statt direkte JSON-Eingabe auf Windows/WSL

### 401 Unauthorized
**Problem:** Fehlender oder ungültiger Token
**Lösung:** Stelle sicher, dass der Authorization-Header korrekt gesetzt ist: `Bearer <token>`

### 500 Internal Server Error
**Problem:** Serverfehler
**Lösung:** Prüfe die Docker-Logs: `docker logs assixx-backend --tail 100`

## Test-Workflow

1. **Signup** - Erstelle einen neuen Tenant
2. **Login** - Authentifiziere dich mit den Admin-Credentials
3. **Verwende Token** - Nutze den erhaltenen Token für weitere API-Aufrufe

```bash
# 1. Signup
curl -X POST http://localhost:3000/api/v2/signup \
  -H "Content-Type: application/json" \
  -d @/tmp/signup-test.json

# 2. Login
curl -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@testcompany.de", "password": "SecurePass123!"}' \
  | jq -r '.data.accessToken' > /tmp/token.txt

# 3. Use Token
TOKEN=$(cat /tmp/token.txt)
curl -X GET http://localhost:3000/api/v2/auth/user \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```
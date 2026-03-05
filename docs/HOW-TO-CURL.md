# How to curl - Assixx API

## Token holen

### Option A: Browser (schnellste Methode)

1. Browser: F12 (DevTools) -> Network Tab
2. Beliebigen API-Request anklicken
3. Header `Authorization: Bearer eyJ...` kopieren

### Option B: Login via curl

Bash escaped `!` in Passwörtern -> JSON-Datei verwenden:

```bash
cat > /tmp/login.json << 'EOF'
{"email":"admin@apitest.de","password":"ApiTest12345!"}
EOF

TOKEN=$(curl -s -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: apitest" \
  -d @/tmp/login.json | jq -r '.data.accessToken')
```

## API-Requests mit Token

Jeder Request braucht zwei Header: `Authorization` und `X-Tenant-ID`.

```bash
# Variable setzen (Token aus Browser oder Login)
T="eyJhbG..."

# GET
curl -s http://localhost:3000/api/v2/users/me \
  -H "Authorization: Bearer $T" \
  -H "X-Tenant-ID: testfirma" | jq '.'

# POST (Body als JSON-Datei)
cat > /tmp/payload.json << 'EOF'
{"title":"Mein Titel","description":"Beschreibung"}
EOF

curl -s -X POST http://localhost:3000/api/v2/tpm/cards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $T" \
  -H "X-Tenant-ID: testfirma" \
  -d @/tmp/payload.json | jq '.'
```

## Bulk-Erstellung (Beispiel: 10 Einträge)

```bash
T="eyJhbG..."

for i in $(seq 1 10); do
cat > /tmp/item.json << JSONEOF
{"planUuid":"<UUID>","cardRole":"operator","intervalType":"daily","title":"Karte $i"}
JSONEOF

curl -s -X POST http://localhost:3000/api/v2/tpm/cards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $T" \
  -H "X-Tenant-ID: testfirma" \
  -d @/tmp/item.json | jq -r '.data.title // .error.message'
done
```

## Wichtig

- Token läuft nach **30 Minuten** ab
- `X-Tenant-ID` ist der Tenant-Slug (z.B. `apitest`, `testfirma`)
- JSON-Body immer via `@/tmp/datei.json` senden (kein Inline-JSON wegen `!`-Escaping)
- SSE-Streams: `-m 5` für Timeout

## Credentials

| Tenant    | Email              | Passwort       |
|-----------|--------------------|----------------|
| apitest   | admin@apitest.de   | ApiTest12345!  |
| testfirma | admin@tesfirma.de  | ApiTest12345!  |



thats the right bash :
● Bash(curl -s http://localhost:3000/api/v2/features/my-features -H "Authorization: Bearer
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwiZW1haWwiOiJhZG1pbkB0ZXNmaXJ…)
⎿ Running…

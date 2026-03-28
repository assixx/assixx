# How to curl - Assixx API

## WICHTIG FÜR CLAUDE

**NIEMALS selbst einloggen.** Der User gibt den Token direkt als Text in der Nachricht mit.
Token einfach 1:1 übernehmen — KEIN Login-Request nötig.

**Regeln:**

1. Token IMMER direkt inline im curl-Befehl verwenden
2. **KEINE Variablen** wie `T=`, `TOKEN=`, `$T` — NIEMALS
3. Token hat IMMER das Format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.<PAYLOAD>.<SIGNATURE>`

```bash
# RICHTIG — Token direkt inline:
curl -s http://localhost:3000/api/v2/ENDPOINT \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.PAYLOAD.SIGNATURE" \
  -H "X-Tenant-ID: testfirma" | jq '.'

# FALSCH — NIEMALS so:
# T="eyJ..."
# curl ... -H "Authorization: Bearer $T"
```

---

## Token holen (für den User)

### Option A: Browser (schnellste Methode)

1. Browser: F12 (DevTools) -> Network Tab
2. Beliebigen API-Request anklicken
3. Header `Authorization: Bearer eyJ...` kopieren

### Option B: Login via curl

Bash escaped `!` in Passwörtern -> JSON-Datei verwenden:

```bash
cat > /tmp/login.json << 'EOF'
{"email":"admin@testfirma.de","password":"ApiTest12345!"}
EOF

TOKEN=$(curl -s -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: testfirma" \
  -d @/tmp/login.json | jq -r '.data.accessToken')
```

---

## API-Requests mit Token

Jeder Request braucht zwei Header: `Authorization` und `X-Tenant-ID`.

**KEINE Variablen wie `T=` oder `TOKEN=` verwenden — Token IMMER direkt inline im curl-Befehl!**

```bash
# GET — Token DIREKT inline, KEINE Variable!
curl -s http://localhost:3000/api/v2/users/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.PAYLOAD.SIGNATURE" \
  -H "X-Tenant-ID: testfirma" | jq '.'

# POST (Body als JSON-Datei)
cat > /tmp/payload.json << 'EOF'
{"title":"Mein Titel","description":"Beschreibung"}
EOF

curl -s -X POST http://localhost:3000/api/v2/tpm/cards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.PAYLOAD.SIGNATURE" \
  -H "X-Tenant-ID: testfirma" \
  -d @/tmp/payload.json | jq '.'
```

---

## Wichtig

- Token läuft nach **30 Minuten** ab
- `X-Tenant-ID` ist der Tenant-Slug (z.B. `apitest`, `testfirma`)
- JSON-Body immer via `@/tmp/datei.json` senden (kein Inline-JSON wegen `!`-Escaping)
- SSE-Streams: `-m 5` für Timeout

## Credentials

| Tenant    | Email              | Passwort      |
| --------- | ------------------ | ------------- |
| apitest   | admin@apitest.de   | ApiTest12345! |
| testfirma | admin@testfirma.de | ApiTest12345! |

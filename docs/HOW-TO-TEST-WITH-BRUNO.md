# API Testing mit Bruno

> **Bruno CLI** ist als pnpm-Dependency installiert - kein globales Install nötig!

---

## Quick Start

```bash
# Alle API Tests ausführen
pnpm run test:api

# Einzelnes Modul testen
cd api-tests && npx bru run auth --env local
cd api-tests && npx bru run calendar --env local

# Mehrere Module
cd api-tests && npx bru run auth users departments --env local
```

---

## Voraussetzungen

### 1. Docker läuft und ist healthy

```bash
cd /home/scs/projects/Assixx/docker
docker-compose ps

# Erwartete Ausgabe: alle Container "healthy"
```

### 2. Backend erreichbar

```bash
curl -s http://localhost:3000/health | jq .

# Erwartete Ausgabe: { "status": "ok", ... }
```

### 3. Rate Limit Problem?

```bash
# Symptom: 429 Too Many Requests bei Login

# Lösung: Docker neu starten (Rate Limit ist in-memory)
cd /home/scs/projects/Assixx/docker
docker-compose restart

# Warten bis healthy (ca. 15-30 Sek)
sleep 20 && docker-compose ps
```

---

## Projektstruktur

```
api-tests/
├── bruno.json              # Bruno Projekt-Config
├── environments/
│   └── local.bru           # Variablen: base_url, auth_token
├── auth/                   # Login/Logout/Refresh (IMMER ZUERST!)
├── users/                  # User CRUD
├── departments/            # Abteilungen CRUD
├── teams/                  # Teams CRUD
├── notifications/          # Benachrichtigungen
├── blackboard/             # Schwarzes Brett
├── calendar/               # Kalender Events
├── kvp/                    # KVP Vorschläge
├── machines/               # Maschinen/Anlagen
├── surveys/                # Umfragen
├── areas/                  # Bereiche
├── settings/               # Einstellungen
├── roles/                  # Rollen
├── features/               # Feature-Flags
├── chat/                   # Chat System
├── documents/              # Dokumente
└── shifts/                 # Schichtplanung
```

---

## Test-Reihenfolge (KRITISCH!)

```
1. auth/login.bru        → setzt {{auth_token}}
2. */create.bru          → setzt {{resource_id}}
3. */get-by-id.bru       → nutzt {{resource_id}}
4. */update.bru          → nutzt {{resource_id}}
5. */delete.bru          → nutzt {{resource_id}}
```

**Warum wichtig?**
- Ohne Login: alle Requests → 401 Unauthorized
- Ohne Create: get/update/delete → 400/404 (keine ID)

---

## Einzelne Tests manuell ausführen

```bash
# Nur Login testen
cd api-tests && npx bru run auth/login.bru --env local

# Nur Calendar Create testen
cd api-tests && npx bru run calendar/create-event.bru --env local

# Bestimmte Sequenz testen
cd api-tests && npx bru run auth calendar --env local
```

---

## Neuen Test erstellen

### Template für POST (Create)

```bru
meta {
  name: Create Resource
  type: http
  seq: 2
}

post {
  url: {{base_url}}/resources
  body: json
  auth: bearer
}

headers {
  Content-Type: application/json
}

body:json {
  {
    "name": "Test {{$timestamp}}",
    "description": "Bruno API Test"
  }
}

auth:bearer {
  token: {{auth_token}}
}

assert {
  res.status: eq 201
  res.body.success: eq true
}

tests {
  test("should return 201 Created", function() {
    expect(res.getStatus()).to.equal(201);
  });
}

script:post-response {
  if (res.body.data && res.body.data.id) {
    bru.setVar("resource_id", res.body.data.id);
  }
}
```

### Template für GET (List)

```bru
meta {
  name: List Resources
  type: http
  seq: 1
}

get {
  url: {{base_url}}/resources
  auth: bearer
}

auth:bearer {
  token: {{auth_token}}
}

assert {
  res.status: eq 200
  res.body.success: eq true
}

tests {
  test("should return 200 OK", function() {
    expect(res.getStatus()).to.equal(200);
  });

  test("should return array", function() {
    expect(res.getBody().data).to.be.an("array");
  });
}
```

---

## Verfügbare Variablen

| Variable | Beschreibung | Gesetzt von |
|----------|--------------|-------------|
| `{{base_url}}` | `http://localhost:3000/api/v2` | environments/local.bru |
| `{{auth_token}}` | JWT Access Token | auth/login.bru |
| `{{refresh_token}}` | JWT Refresh Token | auth/login.bru |
| `{{user_id}}` | Eingeloggter User ID | auth/login.bru |
| `{{tenant_id}}` | Tenant ID | auth/login.bru |
| `{{$timestamp}}` | Unix Timestamp | Bruno built-in |
| `{{$randomInt}}` | Zufällige Zahl | Bruno built-in |

---

## Troubleshooting

| Symptom | Ursache | Lösung |
|---------|---------|--------|
| `429 Too Many Requests` | Rate Limit | `docker-compose restart` |
| `401 Unauthorized` | Token fehlt/abgelaufen | auth/login zuerst ausführen |
| `400 Bad Request` | Validation Error | Body-Format prüfen |
| `404 Not Found` | Resource existiert nicht | Create zuerst ausführen |
| `500 Internal Server Error` | Backend Bug | `docker logs assixx-backend` |
| `ECONNREFUSED` | Backend down | `docker-compose up -d` |
| `ECONNRESET` | Backend crashed | `docker-compose restart` |

### Debug: Backend Logs anzeigen

```bash
# Letzte 50 Zeilen
docker logs assixx-backend --tail 50

# Live-Stream
docker logs assixx-backend -f
```

---

## Bruno Desktop App (Optional)

Die `.bru` Dateien können auch mit der **Bruno Desktop App** getestet werden:

1. Download: https://www.usebruno.com/
2. `File > Open Collection > api-tests/`
3. Environment: `local` auswählen
4. Tests manuell klicken

**Vorteil:** Bessere Visualisierung von Request/Response

---

## Test-Ergebnisse interpretieren

```
📊 Execution Summary
┌───────────────┬───────────────────────────┐
│ Requests      │ 87 (67 Passed, 20 Failed) │
│ Tests         │          118/144          │
│ Assertions    │          152/181          │
└───────────────┴───────────────────────────┘
```

- **Requests**: HTTP Calls (Passed = 2xx Status)
- **Tests**: JavaScript test() Blöcke
- **Assertions**: assert {} Regeln

---

## Workflow: Neues Feature testen

```bash
# 1. Docker starten/neustarten
cd /home/scs/projects/Assixx/docker
docker-compose restart && sleep 20

# 2. Alle Tests laufen lassen
pnpm run test:api

# 3. Bei Fehlern: Einzelne Module debuggen
cd api-tests && npx bru run calendar --env local

# 4. Backend Logs prüfen bei 500er
docker logs assixx-backend --tail 100 | grep -i error
```

---

*Erstellt: 2025-12-09 | Branch: lint/refactoring*

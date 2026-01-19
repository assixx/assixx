# API Testing mit Bruno

> **Bruno CLI** ist als pnpm-Dependency installiert - kein globales Install nötig!

---

## Isolierter Test-Tenant: brunotest

Tests laufen in einem **isolierten Tenant** namens `brunotest`:

- **Tenant**: Bruno Test GmbH (ID: dynamisch)
- **Admin**: admin@brunotest.de / BrunoTest123!
- **Employee**: employee@brunotest.de / BrunoTest123!
- **Domain**: brunotest.de

**Vorteile:**

- Test-Daten verschmutzen NICHT den Dev-Tenant
- Reproduzierbare Tests
- Einfaches Cleanup (nur Test-Tenant betroffen)

-+

# Alle API Tests ausführen (inkl. _setup)
cd api-tests && npx bru run _setup auth users departments teams notifications blackboard calendar kvp machines surveys areas settings roles features chat documents shifts --env local

# Oder: Standard test:api (ohne _setup - nur für bestehenden Tenant)
pnpm run test:api

# Einzelnes Modul testen (nach _setup)
cd api-tests && npx bru run _setup auth --env local
cd api-tests && npx bru run _setup calendar --env local
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
│   └── local.bru           # Variablen: base_url, brunotest_email, etc.
├── _setup/                 # ZUERST: Tenant-Setup (läuft vor allen Tests!)
│   ├── 01-check-subdomain.bru   # Prüft ob brunotest existiert
│   ├── 02-create-tenant.bru     # Erstellt brunotest (oder 409 = OK)
│   ├── 03-login-brunotest.bru   # Login mit brunotest Admin
│   ├── 04-create-test-employee.bru  # Erstellt Test-Employee
│   └── 05-get-chat-participant.bru  # Setzt chat_participant_id
├── auth/                   # Login/Logout/Refresh
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
├── chat/                   # Chat System (mit delete!)
├── documents/              # Dokumente
└── shifts/                 # Schichtplanung
```

---

## npm Scripts

| Script                      | Beschreibung                                               |
| --------------------------- | ---------------------------------------------------------- |
| `pnpm run test:api`         | Standard-Tests (ohne \_setup, erwartet bestehenden Tenant) |
| `pnpm run test:api:full`    | Vollständig: \_setup + alle Module (empfohlen)             |
| `pnpm run test:api:setup`   | Nur \_setup (erstellt brunotest Tenant)                    |
| `pnpm run test:api:noclean` | Erstellt Daten OHNE zu löschen (für DB/UI Inspektion)      |
| `pnpm run test:api:auth`    | Nur Auth-Tests                                             |

### Daten inspizieren (noclean)

```bash
# 1. Erstelle Test-Daten ohne Cleanup
pnpm run test:api:noclean

# 2. Prüfe in DB
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT * FROM departments WHERE tenant_id = 12;"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT * FROM teams WHERE tenant_id = 12;"

# 3. Prüfe in UI
# Login: http://localhost:3000
# Email: admin@brunotest.de
# Passwort: BrunoTest123!
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

| Variable                  | Beschreibung                   | Gesetzt von                         |
| ------------------------- | ------------------------------ | ----------------------------------- |
| `{{base_url}}`            | `http://localhost:3000/api/v2` | environments/local.bru              |
| `{{brunotest_email}}`     | Admin Email (brunotest)        | environments/local.bru              |
| `{{brunotest_password}}`  | Admin Passwort (brunotest)     | environments/local.bru              |
| `{{auth_token}}`          | JWT Access Token               | \_setup/03-login.bru                |
| `{{refresh_token}}`       | JWT Refresh Token              | \_setup/03-login.bru                |
| `{{user_id}}`             | Eingeloggter User ID           | \_setup/03-login.bru                |
| `{{tenant_id}}`           | Tenant ID (brunotest)          | \_setup/03-login.bru                |
| `{{chat_participant_id}}` | Test Employee ID für Chat      | \_setup/05-get-chat-participant.bru |
| `{{$timestamp}}`          | Unix Timestamp                 | Bruno built-in                      |
| `{{$randomInt}}`          | Zufällige Zahl                 | Bruno built-in                      |

---

## Troubleshooting

| Symptom                     | Ursache                  | Lösung                       |
| --------------------------- | ------------------------ | ---------------------------- |
| `429 Too Many Requests`     | Rate Limit               | `docker-compose restart`     |
| `401 Unauthorized`          | Token fehlt/abgelaufen   | auth/login zuerst ausführen  |
| `400 Bad Request`           | Validation Error         | Body-Format prüfen           |
| `404 Not Found`             | Resource existiert nicht | Create zuerst ausführen      |
| `500 Internal Server Error` | Backend Bug              | `docker logs assixx-backend` |
| `ECONNREFUSED`              | Backend down             | `docker-compose up -d`       |
| `ECONNRESET`                | Backend crashed          | `docker-compose restart`     |

### Debug: Backend Logs anzeigen

```bash
# Letzte 50 Zeilen
docker logs assixx-backend --tail 50

# Live-Stream
docker logs assixx-backend -f
```

---

## Häufiges Problem: 401 nach 409 (Tenant existiert, User fehlt)

**Symptom:**
```
_setup/02-create-tenant (409 Conflict)  ← OK, Tenant existiert
_setup/03-login-brunotest (401 Unauthorized)  ← FAIL!
```

**Ursache:** Der Tenant existiert in der DB, aber der Admin-User wurde gelöscht (z.B. durch vorherigen Test-Cleanup oder manuell).

**Lösung: Brunotest-Tenant komplett löschen**

```bash
# Tenant-ID ermitteln
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "SELECT id FROM tenants WHERE subdomain = 'brunotest';"

# Alle abhängigen Daten + Tenant löschen (ID anpassen!)
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
DELETE FROM admin_area_permissions WHERE tenant_id = <ID>;
DELETE FROM admin_department_permissions WHERE tenant_id = <ID>;
DELETE FROM machine_teams WHERE team_id IN (SELECT id FROM teams WHERE tenant_id = <ID>);
DELETE FROM machines WHERE tenant_id = <ID>;
DELETE FROM areas WHERE tenant_id = <ID>;
DELETE FROM teams WHERE tenant_id = <ID>;
DELETE FROM departments WHERE tenant_id = <ID>;
DELETE FROM users WHERE tenant_id = <ID>;
DELETE FROM tenant_features WHERE tenant_id = <ID>;
DELETE FROM tenant_settings WHERE tenant_id = <ID>;
DELETE FROM tenants WHERE id = <ID>;
"

# Dann _setup erneut ausführen
cd api-tests && npx bru run _setup --env local
```

**Oder Quick-Fix (wenn keine wichtigen Daten):**

```bash
# Rate Limit zurücksetzen + Tests neu starten
cd /home/scs/projects/Assixx/docker
docker-compose restart && sleep 25

# Vollständigen Test mit _setup ausführen
pnpm run test:api:full
```

---

## Test-Ergebnisse interpretieren

```
📊 Execution Summary (Stand: 2026-01-19)
┌───────────────┬────────────────┐
│ Requests      │ 96 (96 Passed) │
│ Tests         │    169/169     │
│ Assertions    │    195/195     │
└───────────────┴────────────────┘
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

_Erstellt: 2025-12-09 | Branch: lint/refactoring_

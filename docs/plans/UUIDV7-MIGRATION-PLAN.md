# UUIDv7 Migration Plan

> **Version:** 1.6.0 | **Status:** In Progress | **Erstellt:** 2026-01-13 | **Aktualisiert:** 2026-01-13

---

## Executive Summary

UUIDv7 (RFC 9562) bietet gegenüber sequentiellen Integer-IDs und UUIDv4 entscheidende Vorteile:

1. **Sicherheit** - Keine ID-Enumeration möglich (`/users/1`, `/users/2` → erratbar!)
2. **Chronologische Sortierung** - Timestamp eingebettet, natürliche Sortierung
3. **Monotonisch** - Immer aufsteigend, auch bei gleichzeitigen Requests
4. **Database Performance** - Bessere B-Tree Index-Performance als UUIDv4
5. **Timestamp-Extraktion** - Erstellungszeit aus UUID extrahierbar (`uuid_created_at`)

---

## Aktueller Status

### Tabellen MIT UUIDv7 (Korrekt implementiert)

| Tabelle                 |  uuid   | uuid_created_at | file_uuid |    API nutzt UUID?     |
| ----------------------- | :-----: | :-------------: | :-------: | :--------------------: |
| blackboard_entries      |   ✅    |       ✅        |     -     |       ✅ String        |
| calendar_events         |   ✅    |       ✅        |     -     | ✅ Dual-Mode (id+uuid) |
| conversations           |   ✅    |       ✅        |     -     |       ✅ String        |
| documents               |   ✅    |       ✅        |    ✅     | ✅ Dual-Mode (id+uuid) |
| kvp_suggestions         |   ✅    |       ✅        |     -     |       ✅ String        |
| kvp_attachments         |    -    |        -        |    ✅     |      ✅ fileUuid       |
| shift_plans             |   ✅    |       ✅        |     -     | ✅ Dual-Mode (id+uuid) |
| surveys                 |   ✅    |       ✅        |     -     |       ✅ String        |
| chat_scheduled_messages | id=UUID |        -        |     -     |           ✅           |

### Tabellen MIT UUIDv7 (Neu migriert - 2026-01-13)

| Tabelle                        |     uuid      | uuid_created_at |      Backend generiert UUIDv7?       |  Status  |
| ------------------------------ | :-----------: | :-------------: | :----------------------------------: | :------: |
| **chat_messages**              |      ✅       |       ✅        |          ✅ chat.service.ts          |   DONE   |
| **users**                      |      ✅       |       ✅        | ✅ users/auth/root/signup.service.ts |   DONE   |
| **document_shares**            | ✅ share_uuid |       ✅        |     ⏳ Kein INSERT-Code gefunden     | DB READY |
| **shift_rotation_patterns**    |      ✅       |       ✅        |        ✅ rotation.service.ts        |   DONE   |
| **shift_rotation_assignments** |      ✅       |       ✅        |        ✅ rotation.service.ts        |   DONE   |
| **shift_rotation_history**     |      ✅       |       ✅        |        ✅ rotation.service.ts        |   DONE   |
| **notifications**              |      ✅       |       ✅        |     ✅ notifications.service.ts      |   DONE   |
| **machines**                   |      ✅       |       ✅        |        ✅ machines.service.ts        |   DONE   |

### Tabellen MIT UUIDv7 (P2/P3 migriert - 2026-01-13)

| Tabelle              | uuid | uuid_created_at | Backend generiert UUIDv7? | Status |
| -------------------- | :--: | :-------------: | :-----------------------: | :----: |
| **survey_responses** |  ✅  |       ✅        |   ✅ surveys.service.ts   |  DONE  |
| **teams**            |  ✅  |       ✅        |    ✅ teams.service.ts    |  DONE  |
| **departments**      |  ✅  |       ✅        | ✅ departments.service.ts |  DONE  |
| **areas**            |  ✅  |       ✅        |    ✅ areas.service.ts    |  DONE  |
| **tenants**          |  ✅  |       ✅        |   ✅ signup.service.ts    |  DONE  |

### Inkonsistenzen (Dual-Mode implementiert)

**LÖSUNG:** UUID-Endpunkte hinzugefügt, alte Integer-Endpunkte als `@deprecated` markiert

| Controller                      | Tabelle           | UUID in DB | UUID-Endpunkte hinzugefügt | Status  |
| ------------------------------- | ----------------- | :--------: | :------------------------: | :-----: |
| **calendar.controller.ts**      | calendar_events   |     ✅     |    3 UUID-Endpunkte ✅     | ✅ DONE |
| **documents.controller.ts**     | documents         |     ✅     |    8 UUID-Endpunkte ✅     | ✅ DONE |
| **shifts.controller.ts**        | shift_plans       |     ✅     |    2 UUID-Endpunkte ✅     | ✅ DONE |
| **users.controller.ts**         | users             |     ✅     |    6 UUID-Endpunkte ✅     | ✅ DONE |
| **rotation.controller.ts**      | shift*rotation*\* |     ✅     |    3 UUID-Endpunkte ✅     | ✅ DONE |
| **notifications.controller.ts** | notifications     |     ✅     |    2 UUID-Endpunkte ✅     | ✅ DONE |
| **machines.controller.ts**      | machines          |     ✅     |    3 UUID-Endpunkte ✅     | ✅ DONE |

**Controller OHNE UUID-Tabelle (OK mit ParseIntPipe):**

| Controller                | Tabelle     | UUID in DB | Grund                                       |
| ------------------------- | ----------- | :--------: | ------------------------------------------- |
| teams.controller.ts       | teams       |     ✅     | UUID in DB, Controller-Migration ausstehend |
| departments.controller.ts | departments |     ✅     | UUID in DB, Controller-Migration ausstehend |
| areas.controller.ts       | areas       |     ✅     | UUID in DB, Controller-Migration ausstehend |
| plans.controller.ts       | plans       |     ❌     | System-Tabelle                              |

**LÖSUNG: Dual-Mode API-Endpunkte**

```typescript
// PHASE 1: Neue UUID-Endpunkte hinzufügen
@Get('uuid/:uuid')
async getByUuid(@Param('uuid') uuid: string) { ... }

// PHASE 2: Alte Endpunkte als deprecated markieren
@Get(':id')
@Deprecated('Use GET /uuid/:uuid instead')
async getById(@Param('id', ParseIntPipe) id: number) { ... }

// PHASE 3: Nach 2 Releases alte Endpunkte entfernen
```

---

## Konsistentes Pattern (GOLDSTANDARD)

### 1. Datenbank-Schema

```sql
-- JEDE Tabelle die UUID braucht, bekommt BEIDE Spalten:
ALTER TABLE {table_name}
ADD COLUMN uuid CHAR(36) NOT NULL,
ADD COLUMN uuid_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Unique Index auf UUID
CREATE UNIQUE INDEX idx_{table_name}_uuid ON {table_name}(uuid);

-- Index auf uuid_created_at für chronologische Abfragen
CREATE INDEX idx_{table_name}_uuid_created_at ON {table_name}(uuid_created_at);
```

**Warum `uuid_created_at`?**

- UUIDv7 enthält Timestamp mit Millisekunden-Präzision
- Explizite Spalte ermöglicht:
  - Direkte DB-Abfragen nach Erstellungszeit
  - Index-Nutzung ohne UUID-Parsing
  - Konsistenz mit bestehenden Tabellen

### 2. Backend-Service Pattern

```typescript
// IMMER so importieren:
import { v7 as uuidv7 } from 'uuid';

// Bei INSERT:
const uuid = uuidv7();
const query = `
  INSERT INTO {table} (tenant_id, uuid, uuid_created_at, ...)
  VALUES ($1, $2, NOW(), ...)
  RETURNING id, uuid
`;
const result = await this.db.query(query, [tenantId, uuid, ...]);
```

### 3. API-Endpunkt Pattern

```typescript
// NICHT SO (Integer-ID exponiert):
@Get(':id')
async getById(@Param('id', ParseIntPipe) id: number) { ... }

// SONDERN SO (UUID in URL):
@Get(':uuid')
async getByUuid(@Param('uuid') uuid: string) {
  // Validierung via Zod DTO
  const entity = await this.service.findByUuid(uuid);
  if (!entity) throw new NotFoundException();
  return entity;
}
```

### 4. Zod-Validierung für UUID

```typescript
// schemas/common.schema.ts
export const UuidSchema = z
  .string()
  .uuid()
  .refine((val) => val.length === 36, 'Invalid UUID format');

// dto/entity-param.dto.ts
export const EntityUuidParamSchema = z.object({
  uuid: UuidSchema,
});
export class EntityUuidParamDto extends createZodDto(EntityUuidParamSchema) {}
```

### 5. Frontend URL-Pattern

```
VORHER: /api/v2/users/123
NACHHER: /api/v2/users/019461a2-7c3f-7000-8000-000000000001

SvelteKit Route:
routes/(app)/entity/[uuid]/+page.svelte
```

---

## Migrations-Strategie

### Phase 1: Schema-Migration (Non-Breaking)

```sql
-- 1. Spalten hinzufügen (nullable zunächst)
ALTER TABLE chat_messages ADD COLUMN uuid CHAR(36);
ALTER TABLE chat_messages ADD COLUMN uuid_created_at TIMESTAMPTZ;

-- 2. Bestehende Rows mit UUIDv7 befüllen
-- WICHTIG: uuid_created_at = created_at für historische Daten
UPDATE chat_messages
SET uuid = gen_random_uuid()::text,  -- Temporär v4, wird durch v7 ersetzt
    uuid_created_at = created_at
WHERE uuid IS NULL;

-- 3. NOT NULL setzen
ALTER TABLE chat_messages ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE chat_messages ALTER COLUMN uuid_created_at SET NOT NULL;

-- 4. Unique Index
CREATE UNIQUE INDEX idx_chat_messages_uuid ON chat_messages(uuid);
```

### Phase 2: Backend Dual-Mode

```typescript
// Service unterstützt BEIDE Lookup-Methoden:
async findById(id: number): Promise<Message | null> { ... }
async findByUuid(uuid: string): Promise<Message | null> { ... }

// Controller bietet BEIDE Endpunkte (deprecated + neu):
@Get(':id')
@Deprecated('Use GET /messages/uuid/:uuid instead')
async getById(@Param('id', ParseIntPipe) id: number) { ... }

@Get('uuid/:uuid')
async getByUuid(@Param('uuid') uuid: string) { ... }
```

### Phase 3: Frontend Migration

```typescript
// Alte API-Calls ersetzen:
// VORHER: fetch(`/api/v2/messages/${id}`)
// NACHHER: fetch(`/api/v2/messages/uuid/${uuid}`)
```

### Phase 4: Deprecation & Cleanup

```typescript
// Nach 2 Releases:
// 1. Integer-ID Endpunkte entfernen
// 2. ParseIntPipe komplett durch UUID-Validierung ersetzen
// 3. Frontend-Routen auf [uuid] umstellen
```

---

## Detaillierte Migrations-Reihenfolge

### P0: Kritisch (Sicherheitsrisiko)

#### 1. `chat_messages` (Chat-Nachrichten)

**Risiko:** Sequentielle IDs → ID-Enumeration-Angriff
**Betroffene Dateien:**

- `database/migrations/XXX-add-uuid-to-chat-messages.sql`
- `backend/src/nest/chat/chat.service.ts`
- `backend/src/nest/chat/chat.controller.ts`
- `backend/src/nest/chat/dto/message-param.dto.ts`
- `frontend/src/routes/(app)/chat/_lib/api.ts`

**Schema-Änderung:**

```sql
ALTER TABLE chat_messages
ADD COLUMN uuid CHAR(36) NOT NULL,
ADD COLUMN uuid_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX idx_chat_messages_uuid ON chat_messages(uuid);
```

**Service-Änderung:**

```typescript
// chat.service.ts - insertMessage()
const messageUuid = uuidv7();
const query = `
  INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, content, uuid, uuid_created_at, ...)
  VALUES ($1, $2, $3, $4, $5, NOW(), ...)
  RETURNING id, uuid
`;
```

#### 2. `users` (Benutzerprofile)

**Risiko:** Profil-URLs exponieren IDs, Avatar-Pfade
**Betroffene Dateien:**

- `database/migrations/XXX-add-uuid-to-users.sql`
- `backend/src/nest/users/users.service.ts`
- `backend/src/nest/users/users.controller.ts`
- `backend/src/nest/signup/signup.service.ts`
- `frontend/src/routes/(app)/manage-employees/_lib/api.ts`
- `frontend/src/routes/(app)/*-profile/_lib/api.ts`

**Besonderheit:** Avatar-Dateipfade sollten auch UUID nutzen:

```
VORHER:  /uploads/profile_pictures/user_123_avatar.jpg
NACHHER: /uploads/profile_pictures/{user_uuid}_avatar.jpg
```

#### 3. `document_shares` (Geteilte Dokument-Links)

**Risiko:** 🔴 KRITISCH - Geteilte Links sind erratbar!
**Lösung:** `share_uuid` als primärer Zugriffs-Token

```sql
ALTER TABLE document_shares
ADD COLUMN share_uuid CHAR(36) NOT NULL,
ADD COLUMN uuid_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX idx_document_shares_share_uuid ON document_shares(share_uuid);
```

**API-Endpunkt:**

```
VORHER:  /api/v2/documents/shares/5
NACHHER: /api/v2/documents/shares/{share_uuid}
```

### P1: Hoch (Best Practice)

#### 4. `notifications`

**Grund:** Deeplinks, Aktivitätsmuster erkennbar

#### 5. `machines`

**Grund:** QR-Codes, TPM-Berichte extern geteilt

### P2: Mittel

#### 6. `survey_responses`

**Grund:** Anonyme Umfragen - IDs könnten Teilnehmer-Reihenfolge verraten

### P3: Niedrig (Nice-to-have)

#### 8-11. `teams`, `departments`, `areas`, `tenants`

**Grund:** Primär interne Nutzung, Export/Import Szenarien

---

## Inkonsistenzen beheben

### calendar.controller.ts

```typescript
// VORHER:
@Get(':id')
async getById(@Param('id', ParseIntPipe) id: number) { ... }

// NACHHER:
@Get(':uuid')
async getByUuid(@Param() params: CalendarEventUuidParamDto) {
  return this.calendarService.findByUuid(params.uuid);
}
```

### documents.controller.ts

```typescript
// Bereits file_uuid für Downloads
// Muss auf uuid für Metadaten-Zugriff umgestellt werden
```

### shifts.controller.ts

```typescript
// shift_plans hat bereits uuid
// Controller muss UUID statt ID nutzen
```

---

## Checkliste pro Tabelle

```markdown
## Migration Checklist: {table_name}

### Database

- [ ] Migration SQL erstellt
- [ ] uuid CHAR(36) NOT NULL hinzugefügt
- [ ] uuid_created_at TIMESTAMPTZ NOT NULL hinzugefügt
- [ ] Unique Index auf uuid erstellt
- [ ] Bestehende Rows befüllt (uuid_created_at = created_at)
- [ ] Migration getestet (dev + staging)

### Backend

- [ ] Service: findByUuid() Methode hinzugefügt
- [ ] Service: create() generiert uuidv7()
- [ ] Controller: Neuer /uuid/:uuid Endpunkt
- [ ] Controller: Alter /:id Endpunkt als @Deprecated markiert
- [ ] DTO: UuidParamDto mit Zod-Validierung
- [ ] Tests aktualisiert

### Frontend

- [ ] API-Client auf UUID umgestellt
- [ ] Routes auf [uuid] Parameter umgestellt (wo nötig)
- [ ] Alle fetch-Calls aktualisiert

### Documentation

- [ ] API-Docs aktualisiert
- [ ] CHANGELOG Eintrag
- [ ] Breaking Change dokumentiert (falls applicable)
```

---

## Risiken & Mitigierung

| Risiko                           | Mitigierung                              |
| -------------------------------- | ---------------------------------------- |
| Breaking Change für API-Consumer | Dual-Mode Phase (alte + neue Endpunkte)  |
| Performance-Impact bei Lookup    | UUID-Index, kein Performance-Unterschied |
| Bestehende Links brechen         | Redirect von /id/:id auf /uuid/:uuid     |
| Frontend-Cache invalidiert       | Cache-Keys auf UUID umstellen            |

---

## Timeline-Empfehlung

| Phase                  | Dauer           | Inhalt                                 |
| ---------------------- | --------------- | -------------------------------------- |
| **1. P0 Migration**    | 1-2 Tage        | chat_messages, users, document_shares  |
| **2. Inkonsistenzen**  | 1 Tag           | calendar, documents, shifts Controller |
| **3. P1 Migration**    | 1 Tag           | notifications, machines                |
| **4. P2/P3 Migration** | 2 Tage          | Restliche Tabellen                     |
| **5. Deprecation**     | Nach 2 Releases | Alte Integer-Endpunkte entfernen       |

---

## Referenzen

- [RFC 9562 - UUIDv7 Specification](https://www.rfc-editor.org/rfc/rfc9562)
- [uuid npm package v13.0.0](https://www.npmjs.com/package/uuid)
- [UUIDv7 Elixir Implementation (Inspiration)](https://github.com/martinthenth/uuidv7)

---

## Implementierungs-Log

### 2026-01-13: P0 Migration abgeschlossen

**Durchgeführte Änderungen:**

1. **Database Migration** (`database/migrations/003-add-uuid-to-p0-tables.sql`)
   - `chat_messages`: uuid + uuid_created_at hinzugefügt, 136 Rows aktualisiert
   - `users`: uuid + uuid_created_at hinzugefügt, 8 Rows aktualisiert
   - `document_shares`: share_uuid + uuid_created_at hinzugefügt, 0 Rows (leer)
   - Unique Indexes auf alle UUID-Spalten erstellt

2. **Backend Services aktualisiert:**
   - `chat.service.ts`: `insertMessageRecord()` und `insertMessage()` generieren UUIDv7
   - `users.service.ts`: `createUser()` generiert UUIDv7
   - `auth.service.ts`: `createUser()` generiert UUIDv7
   - `root.service.ts`: `createAdmin()` und `createRootUser()` generieren UUIDv7
   - `signup.service.ts`: `createRootUser()` generiert UUIDv7

3. **Event Types aktualisiert:**
   - `eventBus.ts`: `MessageEvent` enthält jetzt `uuid`

**Nächste Schritte:**

- [x] ~~API-Controller auf UUID umstellen (Dual-Mode)~~ ✅
- [x] ~~Inkonsistenzen beheben (calendar, documents, shifts)~~ ✅
- [x] ~~rotation.controller.ts UUID-Endpunkte~~ ✅
- [x] ~~users.controller.ts UUID-Endpunkte~~ ✅
- [ ] P1 Migration (notifications, machines)

### 2026-01-13: Inkonsistenzen behoben (Dual-Mode API)

**Durchgeführte Änderungen:**

1. **calendar.controller.ts + calendar.service.ts**
   - Neue UUID-Endpunkte: `GET/PUT/DELETE /calendar/events/uuid/:uuid`
   - Alte Endpunkte als `@deprecated` markiert
   - `resolveEventIdByUuid()` Helper-Methode hinzugefügt

2. **documents.controller.ts + documents.service.ts**
   - Neue UUID-Endpunkte (8 Stück):
     - `GET /documents/uuid/:uuid`
     - `PUT /documents/uuid/:uuid`
     - `DELETE /documents/uuid/:uuid`
     - `POST /documents/uuid/:uuid/archive`
     - `POST /documents/uuid/:uuid/unarchive`
     - `GET /documents/uuid/:uuid/download`
     - `GET /documents/uuid/:uuid/preview`
     - `POST /documents/uuid/:uuid/read`
   - Alte Endpunkte als `@deprecated` markiert
   - `resolveDocumentIdByUuid()` Helper-Methode hinzugefügt

3. **shifts.controller.ts + shifts.service.ts**
   - Neue UUID-Endpunkte für shift_plans:
     - `PUT /shifts/plan/uuid/:uuid`
     - `DELETE /shifts/plan/uuid/:uuid`
   - Alte Endpunkte als `@deprecated` markiert
   - `resolveShiftPlanIdByUuid()` Helper-Methode hinzugefügt

4. **websocket.ts (Legacy WebSocket Handler)**
   - `saveMessage()` generiert jetzt UUIDv7
   - INSERT-Query um `uuid` und `uuid_created_at` erweitert
   - **Bug behoben:** Chat-Nachrichten schlugen fehl wegen NOT NULL constraint auf uuid

**Code-Pattern für UUID-Resolution:**

```typescript
private async resolveEntityIdByUuid(uuid: string, tenantId: number): Promise<number> {
  const result = await this.databaseService.query<{ id: number }>(
    `SELECT id FROM {table} WHERE uuid = $1 AND tenant_id = $2`,
    [uuid, tenantId],
  );
  if (result[0] === undefined) {
    throw new NotFoundException(ERROR_ENTITY_NOT_FOUND);
  }
  return result[0].id;
}
```

### 2026-01-13: Users Controller UUID-Endpunkte

**Durchgeführte Änderungen:**

1. **users.controller.ts + users.service.ts**
   - Neue UUID-Endpunkte (6 Stück):
     - `GET /users/uuid/:uuid`
     - `PUT /users/uuid/:uuid`
     - `DELETE /users/uuid/:uuid`
     - `POST /users/uuid/:uuid/archive`
     - `POST /users/uuid/:uuid/unarchive`
     - `PUT /users/uuid/:uuid/availability`
   - Alte Endpunkte als `@deprecated` markiert
   - `resolveUserIdByUuid()` Helper-Methode hinzugefügt

### 2026-01-13: P1 Rotation Tables Migration

**Durchgeführte Änderungen:**

1. **Database Migration** (`database/migrations/004-add-uuid-to-rotation-tables.sql`)
   - `shift_rotation_patterns`: uuid + uuid_created_at hinzugefügt, 20 Rows aktualisiert
   - `shift_rotation_assignments`: uuid + uuid_created_at hinzugefügt, 22 Rows aktualisiert
   - `shift_rotation_history`: uuid + uuid_created_at hinzugefügt, 31 Rows aktualisiert
   - Unique Indexes auf alle UUID-Spalten erstellt

2. **rotation.service.ts Updates:**
   - Alle INSERT-Statements um `uuid` und `uuid_created_at` erweitert:
     - `createRotationPattern()` - Pattern-INSERT
     - `createPatternForConfig()` - Pattern-INSERT für Config-basierte Generation
     - `assignUsersToPattern()` - Assignment-INSERT
     - `saveGeneratedShifts()` - History-INSERT
     - `insertHistoryEntry()` - History-INSERT mit ON CONFLICT
     - `createAssignmentWithHistory()` - Assignment-INSERT
   - Neue UUID-Resolution-Methoden:
     - `resolvePatternIdByUuid()` - UUID zu ID Auflösung
     - `getRotationPatternByUuid()` - Pattern abrufen
     - `updateRotationPatternByUuid()` - Pattern aktualisieren
     - `deleteRotationPatternByUuid()` - Pattern löschen

3. **rotation.controller.ts Updates:**
   - Neue UUID-Endpunkte (3 Stück):
     - `GET /shifts/rotation/patterns/uuid/:uuid`
     - `PUT /shifts/rotation/patterns/uuid/:uuid`
     - `DELETE /shifts/rotation/patterns/uuid/:uuid`
   - Alte Integer-Endpunkte als `@deprecated` markiert

### 2026-01-13: P1 Notifications & Machines Migration

**Durchgeführte Änderungen:**

1. **Database Migration** (`database/migrations/005-add-uuid-to-p1-tables.sql`)
   - `notifications`: uuid + uuid_created_at hinzugefügt, 10 Rows aktualisiert
   - `machines`: uuid + uuid_created_at hinzugefügt, 2 Rows aktualisiert
   - Unique Indexes auf alle UUID-Spalten erstellt

2. **notifications.service.ts + notifications.controller.ts**
   - INSERT um `uuid` und `uuid_created_at` erweitert
   - Neue UUID-Endpunkte:
     - `PUT /notifications/uuid/:uuid/read`
     - `DELETE /notifications/uuid/:uuid`
   - Alte Integer-Endpunkte als `@deprecated` markiert

3. **machines.service.ts + machines.controller.ts**
   - INSERT um `uuid` und `uuid_created_at` erweitert
   - Neue UUID-Endpunkte:
     - `GET /machines/uuid/:uuid`
     - `PUT /machines/uuid/:uuid`
     - `DELETE /machines/uuid/:uuid`
   - Alte Integer-Endpunkte als `@deprecated` markiert

**Aktueller Stand:**

| Bereich                                | Status      |
| -------------------------------------- | ----------- |
| P0 DB-Migration (chat_messages, users) | ✅ Erledigt |
| calendar.controller UUID               | ✅ Erledigt |
| documents.controller UUID              | ✅ Erledigt |
| shifts.controller UUID                 | ✅ Erledigt |
| users.controller UUID                  | ✅ Erledigt |
| websocket.ts UUID-Bug                  | ✅ Erledigt |
| rotation.controller UUID               | ✅ Erledigt |
| notifications.controller UUID          | ✅ Erledigt |
| machines.controller UUID               | ✅ Erledigt |
| P2 Migration (survey_responses)        | ✅ Erledigt |
| P3 Migration (teams, etc)              | ✅ Erledigt |

### 2026-01-13: P2/P3 Migration abgeschlossen

**Durchgeführte Änderungen:**

1. **Database Migration** (`database/migrations/006-add-uuid-to-p2-p3-tables.sql`)
   - `survey_responses`: uuid + uuid_created_at hinzugefügt, 1 Row aktualisiert
   - `teams`: uuid + uuid_created_at hinzugefügt, 2 Rows aktualisiert
   - `departments`: uuid + uuid_created_at hinzugefügt, 34 Rows aktualisiert
   - `areas`: uuid + uuid_created_at hinzugefügt, 1 Row aktualisiert
   - `tenants`: uuid + uuid_created_at hinzugefügt, 2 Rows aktualisiert
   - Unique Indexes auf alle UUID-Spalten erstellt

2. **Backend Services aktualisiert:**
   - `surveys.service.ts`: INSERT für `survey_responses` generiert UUIDv7
   - `teams.service.ts`: `createTeam()` generiert UUIDv7
   - `departments.service.ts`: `createDepartment()` generiert UUIDv7
   - `areas.service.ts`: `createArea()` generiert UUIDv7
   - `signup.service.ts`: `createTenant()` generiert UUIDv7

**Nächste Schritte (Optional):**

- [ ] UUID-Endpunkte für teams.controller.ts
- [ ] UUID-Endpunkte für departments.controller.ts
- [ ] UUID-Endpunkte für areas.controller.ts
- [ ] surveys.controller.ts UUID-Endpunkte für responses

### 2026-01-13: message_attachments Tabelle entfernt

**Grund für Entfernung:**

Die `message_attachments` Junction-Tabelle war **DEPRECATED** und wurde nie verwendet:

1. **Tabelle war LEER** (0 Rows)
2. **Kein Backend-Code** verwendete diese Tabelle
3. **Chat-Attachments** werden direkt in der `documents`-Tabelle gespeichert:
   - `documents.conversation_id` - Verknüpfung zur Konversation
   - `documents.message_id` - Verknüpfung zur Nachricht
   - `documents.file_uuid` - UUIDv7 für Datei-Downloads
4. **ChatController** verwendet jetzt `DocumentsService` direkt

**Durchgeführte Änderungen:**

1. **Database Migration** (`database/migrations/007-drop-message-attachments.sql`)
   - RLS Policy `tenant_isolation` auf `message_attachments` entfernt
   - Tabelle `message_attachments` mit CASCADE gedroppt

2. **Schema-Dateien aktualisiert:**
   - `database/database-setup.sql` - Tabellen-Definition entfernt, Kommentar hinzugefügt
   - `database/docker-init.sql` - Gelöscht (legacy MySQL-Dump, ersetzt durch node-pg-migrate)

3. **Chat-Attachment-Implementierung** (chat.controller.ts):
   - `uploadConversationAttachment()` - Speichert in documents mit conversation_id
   - `getConversationAttachments()` - Listet documents für Konversation
   - `downloadAttachmentByUuid()` - Download via file_uuid
   - `deleteConversationAttachment()` - Löscht document

**Neue Methode hinzugefügt:**

- `documents.service.ts`: `getDocumentByFileUuid()` - Dokument per file_uuid abrufen

---

**Maintainer:** Claude Code
**Letzte Aktualisierung:** 2026-01-13
**Review Status:** P0 Done, P1 Done, P2/P3 DB+Service Done - Controller-Endpunkte für P3 optional

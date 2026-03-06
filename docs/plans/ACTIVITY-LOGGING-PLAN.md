# Activity Logging Implementation Plan

> **Status:** ✅ COMPLETE (Phase 1 + Phase 2 + Phase 3)
> **Erstellt:** 2026-01-15
> **Ziel:** Alle wichtigen CRUD-Operationen in `root_logs` loggen für Root-Dashboard & Logs-Seite

---

## 1. Übersicht

### Was wird geloggt?

| Kategorie | Aktionen                                | Zweck              |
| --------- | --------------------------------------- | ------------------ |
| **Auth**  | `login`, `logout`, `register`           | Sicherheits-Audit  |
| **CRUD**  | `create`, `update`, `delete`, `archive` | Änderungs-Tracking |
| **Admin** | `role_switch`                           | Privilege-Audit    |

### Ziel-Tabelle: `root_logs`

```sql
-- Spalten die befüllt werden:
tenant_id, user_id, action, entity_type, entity_id,
details, old_values, new_values, ip_address, user_agent,
was_role_switched, created_at
```

---

## 2. Implementierungs-Status

### Phase 1: Core Entities ✅ DONE

| Modul           | Service                  | Status  | Methoden                        |
| --------------- | ------------------------ | ------- | ------------------------------- |
| **Users**       | `users.service.ts`       | ✅ Done | create, update, delete, archive |
| **Departments** | `departments.service.ts` | ✅ Done | create, update, delete          |
| **Teams**       | `teams.service.ts`       | ✅ Done | create, update, delete          |
| **Areas**       | `areas.service.ts`       | ✅ Done | create, update, delete          |
| **Auth**        | `auth.service.ts`        | ✅ Done | login, logout, register         |
| **Role Switch** | `role-switch.service.ts` | ✅ Done | role_switch                     |

### Phase 2: Business Entities ✅ COMPLETE

| Modul          | Service                 | Status  | Methoden                                             |
| -------------- | ----------------------- | ------- | ---------------------------------------------------- |
| **KVP**        | `kvp.service.ts`        | ✅ Done | createSuggestion, updateSuggestion, deleteSuggestion |
| **Documents**  | `documents.service.ts`  | ✅ Done | updateDocument, deleteDocument                       |
| **Surveys**    | `surveys.service.ts`    | ✅ Done | createSurvey, updateSurvey, deleteSurvey             |
| **Blackboard** | `blackboard.service.ts` | ✅ Done | createEntry, updateEntry, deleteEntry, archiveEntry  |

### Phase 3: Root Service (Admin/Root User Management) ✅ COMPLETE

| Modul          | Service           | Status  | Methoden                       | Frontend-Seite   |
| -------------- | ----------------- | ------- | ------------------------------ | ---------------- |
| **Admins**     | `root.service.ts` | ✅ Done | createAdmin, deleteAdmin       | `/manage-admins` |
| **Root Users** | `root.service.ts` | ✅ Done | createRootUser, deleteRootUser | `/manage-root`   |

**Hinweis:** `/manage-employees` nutzt `users.service.ts` (Phase 1) und war bereits abgedeckt.

### Explizit NICHT geloggt

| Modul             | Grund                               |
| ----------------- | ----------------------------------- |
| **Chat**          | Zu hohes Volume, Datenschutz        |
| **Calendar**      | Zu hohes Volume (jedes Event = Log) |
| **Notifications** | System-generiert, kein User-Action  |

---

## 3. Technische Details

### ActivityLoggerService

**Pfad:** `/backend/src/nest/common/services/activity-logger.service.ts`

```typescript
// Verfügbare Entity Types
type ActivityEntityType =
  | 'user'
  | 'department'
  | 'team'
  | 'area'
  | 'kvp'
  | 'blackboard'
  | 'survey'
  | 'document'
  | 'asset'
  | 'notification'
  | 'auth'
  | 'tenant'
  | 'settings';

// Verfügbare Actions
type ActivityAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'register'
  | 'archive'
  | 'restore'
  | 'assign'
  | 'unassign';

// Convenience Methods
await activityLogger.logCreate(tenantId, userId, entityType, entityId, details, newValues);
await activityLogger.logUpdate(tenantId, userId, entityType, entityId, details, oldValues, newValues);
await activityLogger.logDelete(tenantId, userId, entityType, entityId, details, oldValues);
```

### Implementierungs-Pattern pro Service

```typescript
// 1. Import hinzufügen
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';

// 2. Constructor Injection
constructor(
  private readonly db: DatabaseService,
  private readonly activityLogger: ActivityLoggerService,  // NEU
) {}

// 3. In CRUD-Methoden loggen
async createEntity(dto: CreateDto, actingUserId: number, tenantId: number) {
  // ... INSERT logic ...

  await this.activityLogger.logCreate(
    tenantId,
    actingUserId,
    'entity_type',
    entityId,
    `Entity erstellt: ${dto.name}`,
    { name: dto.name, ...relevantFields },
  );

  return result;
}
```

---

## 4. Phase 2 - Detaillierter Plan

### 4.1 KVP Service

**Datei:** `/backend/src/nest/kvp/kvp.service.ts`

| Methode            | Zeile | Log Action | Details                               |
| ------------------ | ----- | ---------- | ------------------------------------- |
| `createSuggestion` | 540   | `create`   | `KVP-Vorschlag erstellt: {title}`     |
| `updateSuggestion` | 659   | `update`   | `KVP-Vorschlag aktualisiert: {title}` |
| `deleteSuggestion` | 690   | `delete`   | `KVP-Vorschlag gelöscht: {title}`     |

**Zu loggende Felder:**

- `title`, `description`, `category_id`, `priority`, `status`, `org_level`, `org_id`

---

### 4.2 Blackboard Service

**Datei:** `/backend/src/nest/blackboard/blackboard.service.ts`

| Methode        | Zeile | Log Action | Details                                         |
| -------------- | ----- | ---------- | ----------------------------------------------- |
| `createEntry`  | 707   | `create`   | `Schwarzes Brett Eintrag erstellt: {title}`     |
| `updateEntry`  | 837   | `update`   | `Schwarzes Brett Eintrag aktualisiert: {title}` |
| `deleteEntry`  | 984   | `delete`   | `Schwarzes Brett Eintrag gelöscht: {title}`     |
| `archiveEntry` | 1013  | `archive`  | `Schwarzes Brett Eintrag archiviert: {title}`   |

**Zu loggende Felder:**

- `title`, `content` (gekürzt), `org_level`, `org_id`, `priority`, `status`

---

### 4.3 Surveys Service

**Datei:** `/backend/src/nest/surveys/surveys.service.ts`

| Methode        | Zeile | Log Action | Details                         |
| -------------- | ----- | ---------- | ------------------------------- |
| `createSurvey` | 710   | `create`   | `Umfrage erstellt: {title}`     |
| `updateSurvey` | 770   | `update`   | `Umfrage aktualisiert: {title}` |
| `deleteSurvey` | 841   | `delete`   | `Umfrage gelöscht: {title}`     |

**Zu loggende Felder:**

- `title`, `description`, `status`, `is_anonymous`, `start_date`, `end_date`

---

### 4.4 Documents Service

**Datei:** `/backend/src/nest/documents/documents.service.ts`

| Methode          | Zeile | Log Action | Details                             |
| ---------------- | ----- | ---------- | ----------------------------------- |
| `updateDocument` | 426   | `update`   | `Dokument aktualisiert: {filename}` |
| `deleteDocument` | 488   | `delete`   | `Dokument gelöscht: {filename}`     |

**Zu loggende Felder:**

- `filename`, `original_name`, `category`, `access_scope`, `file_size`

**Hinweis:** Upload wird über `createDocument` gehandhabt (falls vorhanden prüfen)

---

## 5. Controller Updates

Für jede Service-Methode muss der entsprechende Controller geprüft werden:

```typescript
// VORHER (ohne actingUserId)
async createEntry(@Body() dto, @TenantId() tenantId) {
  return this.service.createEntry(dto, tenantId);
}

// NACHHER (mit actingUserId)
async createEntry(
  @Body() dto,
  @CurrentUser() user: NestAuthUser,  // NEU
  @TenantId() tenantId,
) {
  return this.service.createEntry(dto, user.id, tenantId);  // user.id weitergeben
}
```

---

## 6. Reihenfolge der Implementierung

```
1. KVP Service + Controller
   └── 3 Methoden, kleinste Änderung

2. Documents Service + Controller
   └── 2 Methoden

3. Surveys Service + Controller
   └── 3 Methoden

4. Blackboard Service + Controller
   └── 4 Methoden, größte Datei

5. Final: ESLint + Type-Check
   └── pnpm run validate:all
```

---

## 7. Checkliste pro Modul

```markdown
- [ ] ActivityLoggerService importieren
- [ ] Constructor Injection hinzufügen
- [ ] createX() - Logging hinzufügen
- [ ] updateX() - Logging mit oldValues/newValues
- [ ] deleteX() - Logging mit oldValues
- [ ] Controller: @CurrentUser() hinzufügen
- [ ] Controller: user.id an Service übergeben
- [ ] ESLint prüfen (max-lines, prettier)
- [ ] Type-Check bestanden
```

---

## 8. Hinweise

### ESLint max-lines-per-function

Falls Methoden >60 Zeilen haben, `buildUpdateFields()` Helper extrahieren:

```typescript
private buildUpdateFields(dto: UpdateDto): { fields: string[]; values: unknown[] } {
  // Field mapping logic hier
}
```

### Template Literals

Immer Fallback für undefined:

```typescript
// ❌ Falsch
`Entity: ${entity?.name}`
// ✅ Richtig
`Entity: ${entity?.name ?? 'Unknown'}`;
```

---

## 9. Nach Abschluss

- [x] Phase 1 + 2: Alle Services implementiert (2026-01-16)
- [x] Phase 3: RootService für manage-admins/manage-root (2026-01-16)
- [x] ESLint + TypeScript Check bestanden
- [x] Backend neu gestartet ohne Fehler
- [x] Test: CRUD-Operation ausführen → Log in DB prüfen
- [x] Root-Dashboard zeigt neue Logs an

---

**Phase 1+2 implementiert am:** 2026-01-16
**Phase 3 implementiert am:** 2026-01-16

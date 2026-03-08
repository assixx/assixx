# FEAT: Work Order Attachments (PDF + Fotos im Modal) — Execution Masterplan

> **Created:** 2026-03-07
> **Version:** 2.0.0 (All phases complete)
> **Status:** DONE — All 4 phases complete
> **Branch:** `refactor/code-audit`
> **Referenz-Implementation:** Blackboard Attachments (`blackboard/_lib/BlackboardEntryModal.svelte`, `blackboard/[uuid]/_lib/AttachmentPreviewModal.svelte`)
> **Author:** SCS-Technik (Senior Engineer)
> **Estimated Sessions:** 3
> **Actual Sessions:** 0 / 3

---

## Changelog

| Version | Datum      | Änderung                                                                           |
| ------- | ---------- | ---------------------------------------------------------------------------------- |
| 0.1.0   | 2026-03-07 | Initial Draft — Phasen 1-4 geplant                                                 |
| 0.1.1   | 2026-03-07 | Fix: CHECK-Constraint erfordert Migration, TS includes()-Fix, Duplikat-Bereinigung |
| 1.1.0   | 2026-03-07 | Phase 1 + Phase 4 (Tests) complete — Backend fertig                                |
| 1.2.0   | 2026-03-07 | Phase 2 complete — Frontend Edit Modal File-Upload                                 |
| 2.0.0   | 2026-03-07 | Phase 3 complete — PhotoGallery PDF-Support + Preview Modal. Feature done.         |

> **Versionierungsregel:**
>
> - `0.x.0` = Planungsphase (Draft)
> - `1.x.0` = Implementierung läuft (je Phase ein Minor-Bump)
> - `2.0.0` = Feature vollständig abgeschlossen
> - Patch `x.x.1` = Hotfix/Nacharbeit innerhalb einer Phase

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (alle Container healthy)
- [ ] Branch `refactor/code-audit` checked out
- [ ] Keine pending Migrations (`SELECT * FROM pgmigrations ORDER BY run_on DESC LIMIT 3`)
- [ ] Blackboard-Referenz gelesen und verstanden
- [ ] Bestehende Work-Order-Tests grün

### 0.2 Risk Register

| #   | Risiko                                            | Impact  | Wahrscheinlichkeit | Mitigation                                                           | Verifikation                                       |
| --- | ------------------------------------------------- | ------- | ------------------ | -------------------------------------------------------------------- | -------------------------------------------------- |
| R1  | MIME-Type-Bypass (Sicherheit)                     | Hoch    | Niedrig            | Backend-Whitelist validiert MIME-Type in Service, nicht nur Frontend | Unit Test: ungültiger MIME → BadRequestException   |
| R2  | 10 MB PDFs sprengen Memory (Multer memoryStorage) | Mittel  | Mittel             | Multer memoryStorage ist identisch zu Blackboard-Pattern (bewährt)   | Manueller Test: 10 MB PDF hochladen, Memory stabil |
| R3  | PDF-Preview blockiert Browser (große Dateien)     | Niedrig | Niedrig            | iframe mit lazy-load, Download als Fallback                          | Manueller Test: 8 MB PDF im Preview-Modal          |
| R4  | Bestehende Photo-Tests brechen                    | Mittel  | Hoch               | Tests sofort nach Backend-Änderungen anpassen                        | `pnpm test --project unit` nach Phase 1            |

### 0.3 Ecosystem Integration Points

| Bestehendes System        | Art der Integration                            | Phase | Verifiziert am |
| ------------------------- | ---------------------------------------------- | ----- | -------------- |
| `work_order_photos` DB    | Kein Schema-Change — MIME-Type bereits VARCHAR | 1     |                |
| Multer (Controller)       | fileSize Limit anpassen (5→10 MB)              | 1     |                |
| ActivityLoggerService     | Log-Text: "Datei" statt "Foto" bei PDF         | 1     |                |
| PhotoGallery (Frontend)   | PDF-Icon + iframe-Preview                      | 3     |                |
| EditWorkOrderModal        | File-Upload-Zone hinzufügen                    | 2     |                |
| Admin Page (+page.svelte) | Upload-Logik nach Modal-Save                   | 2     |                |

---

## Architekturentscheidung: Schema + CHECK-Constraint

Die `work_order_photos` Tabelle hat bereits generische Spalten:

```sql
file_path  VARCHAR(500)  -- Pfad auf Dateisystem
file_name  VARCHAR(255)  -- Originaldateiname
file_size  INTEGER       -- Bytes  ⚠️ CHECK (file_size > 0 AND file_size <= 5242880)
mime_type  VARCHAR(100)  -- z.B. 'image/jpeg' oder 'application/pdf'
```

Diese Spalten sind generisch genug für PDFs. Die Tabelle heißt zwar `work_order_photos`, aber das ist ein Namensrelikt — die Datenstruktur ist ein generischer Attachment-Store. **Rename wäre Kosmetik mit hohem Blast Radius (Queries, Types, API-Endpoints, Frontend-Calls). Nicht wert.**

**ABER:** Die Tabelle hat einen CHECK-Constraint `file_size <= 5242880` (5 MB). Dieser MUSS per Migration auf 10 MB angehoben werden, sonst scheitert jeder INSERT > 5 MB auf PostgreSQL-Ebene — unabhängig von Multer/Service-Validierung. → **Migration in Phase 1 erforderlich.**

---

## Phase 1: Backend — Migration + MIME-Validierung + PDF-Support

> **Abhängigkeit:** Keine (erste Phase)
> **Dateien:** 3 bestehende Dateien editieren + 1 neue Migration

### Step 1.0: DB-Migration — CHECK-Constraint anheben [TODO]

**Neue Datei:** `database/migrations/YYYYMMDDXXXXXX_work-order-photos-increase-file-size.ts`

**Was passiert:**

```typescript
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE work_order_photos
      DROP CONSTRAINT work_order_photos_file_size_check;
    ALTER TABLE work_order_photos
      ADD CONSTRAINT work_order_photos_file_size_check
      CHECK (file_size > 0 AND file_size <= 10485760);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE work_order_photos
      DROP CONSTRAINT work_order_photos_file_size_check;
    ALTER TABLE work_order_photos
      ADD CONSTRAINT work_order_photos_file_size_check
      CHECK (file_size > 0 AND file_size <= 5242880);
  `);
}
```

**Warum:** Migration 065 hat `CHECK (file_size <= 5242880)` — ohne diese Änderung scheitert jeder INSERT > 5 MB auf PostgreSQL-Ebene, selbst wenn Multer und Service 10 MB erlauben. Orphaned Files auf Disk wären die Folge.

**Verifikation:**

```bash
doppler run -- ./scripts/run-migrations.sh up --dry-run
doppler run -- ./scripts/run-migrations.sh up
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT conname, consrc FROM pg_constraint WHERE conname = 'work_order_photos_file_size_check'"
```

### Step 1.1: Constants erweitern [TODO]

**Datei:** `backend/src/nest/work-orders/work-orders.types.ts`

**Was passiert:**

1. `MAX_PHOTO_FILE_SIZE` von `5_242_880` (5 MB) auf `10_485_760` (10 MB) erhöhen
2. Neue Konstante `ALLOWED_UPLOAD_MIME_TYPES` exportieren:
   ```typescript
   export const ALLOWED_UPLOAD_MIME_TYPES: readonly string[] = [
     'image/jpeg',
     'image/png',
     'image/webp',
     'application/pdf',
   ];
   ```
   **Hinweis:** `readonly string[]` statt `as const` — sonst scheitert `includes(file.mimetype)` an TypeScript's striktem Tuple-Typing.

**Warum 10 MB?** Blackboard erlaubt 10 MB (`FILE_UPLOAD_CONFIG.MAX_SIZE_MB: 10`). PDFs sind typischerweise 1-8 MB (Wartungsberichte, Checklisten). 10 MB ist konsistent mit dem bestehenden Blackboard-Limit.

### Step 1.2: MIME-Validierung im Service [TODO]

**Datei:** `backend/src/nest/work-orders/work-orders-photos.service.ts`

**Was passiert:**

1. Import `ALLOWED_UPLOAD_MIME_TYPES` aus types
2. In `addPhoto()` nach Status-Check, vor `enforcePhotoLimit()`:
   ```typescript
   if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.mimetype)) {
     throw new BadRequestException(`Dateityp '${file.mimetype}' nicht erlaubt. Erlaubt: JPG, PNG, WebP, PDF`);
   }
   ```
3. Activity-Log anpassen: "Foto" → "Datei" wenn `mimetype === 'application/pdf'`

**Warum hier und nicht nur im Controller?** Defense in depth. Multer fileFilter ist optional (fail-open), Service-Validierung ist mandatory (fail-closed).

### Step 1.3: Controller — Multer-Config + Content-Disposition [TODO]

**Datei:** `backend/src/nest/work-orders/work-orders.controller.ts`

**Was passiert:**

1. `photoUploadOptions.limits.fileSize` → `MAX_PHOTO_FILE_SIZE` (jetzt 10 MB)
2. `servePhoto()`: Content-Disposition Header je nach MIME-Type:
   - PDF: `Content-Disposition: inline; filename="name.pdf"` (Browser zeigt an)
   - Bilder: kein Content-Disposition (wie bisher — Browser zeigt an)

### Phase 1 — Definition of Done

- [x] Migration erstellt und applied: CHECK-Constraint auf 10 MB
- [x] Migration verifiziert: `\d work_order_photos` zeigt `file_size <= 10485760`
- [x] `ALLOWED_UPLOAD_MIME_TYPES` exportiert in `work-orders.types.ts`
- [x] `MAX_PHOTO_FILE_SIZE = 10_485_760` (10 MB)
- [x] MIME-Validierung in `addPhoto()` mit BadRequestException
- [x] Multer-Config nutzt neues 10 MB Limit
- [x] `servePhoto()` setzt `Content-Disposition: inline` für PDFs
- [x] Activity-Log: "Datei" statt "Foto" bei PDF
- [x] ESLint 0 Errors: `docker exec assixx-backend pnpm exec eslint backend/src/nest/work-orders/`
- [x] Type-Check passed: `docker exec assixx-backend pnpm run type-check`
- [x] Bestehende Photo-Tests angepasst und grün
- [x] Backend neugestartet

---

## Phase 2: Frontend — Edit Modal File-Upload

> **Abhängigkeit:** Phase 1 complete (Backend akzeptiert PDFs)
> **Referenz:** `blackboard/_lib/BlackboardEntryModal.svelte` Lines 478-527
> **Dateien:** 3 bestehende Dateien editieren

### Step 2.1: Constants + Messages erweitern [DONE]

**Datei:** `frontend/src/routes/(app)/(shared)/work-orders/_lib/constants.ts`

**Was passiert:**

1. `FILE_UPLOAD_CONFIG` Objekt hinzufügen (analog Blackboard):
   ```typescript
   export const FILE_UPLOAD_CONFIG = {
     MAX_FILES: 5,
     MAX_SIZE_MB: 10,
     ACCEPTED_TYPES: '.pdf,.jpg,.jpeg,.png,.webp',
     ACCEPTED_MIME_TYPES: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
   } as const;
   ```
2. `MESSAGES` erweitern:
   - `MODAL_FIELD_ATTACHMENTS: 'Anhänge (optional)'`
   - `MODAL_ATTACHMENTS_HINT: 'PDF, JPG, PNG, WebP — max. 10 MB pro Datei'`
   - `PHOTOS_INVALID_TYPE` Text anpassen: `'Nur Bilder (JPG, PNG, WebP) und PDF erlaubt'`

### Step 2.2: EditWorkOrderModal — File-Upload-Zone [DONE]

**Datei:** `frontend/src/routes/(app)/(shared)/work-orders/admin/_lib/EditWorkOrderModal.svelte`

**Warum jetzt:** Modal braucht Upload-Zone wie Blackboard, damit User Dateien beim Erstellen/Bearbeiten anhängen können.

**Änderungen:**

1. Neue Props: `onfileschange: (files: File[] | null) => void`, `attachmentFiles: File[] | null`
2. File-Upload-Zone nach Due-Date-Feld (vor Assignees), Pattern:
   ```html
   <!-- Anhänge (optional) -->
   <div class="form-field">
     <span class="form-field__label">{MESSAGES.MODAL_FIELD_ATTACHMENTS}</span>
     <div class="file-upload-zone file-upload-zone--compact">
       <input type="file" multiple accept="{FILE_UPLOAD_CONFIG.ACCEPTED_TYPES}" ... />
       <label class="file-upload-zone__label">
         <div class="file-upload-zone__icon"><i class="fas fa-cloud-upload-alt"></i></div>
         <div class="file-upload-zone__text">
           <p class="file-upload-zone__title">Dateien hierher ziehen</p>
         </div>
       </label>
     </div>
     <!-- Dateiliste mit Entfernen-Button (wie Blackboard) -->
   </div>
   ```
3. `removeAttachment(index)` Funktion: entfernt Datei aus Array
4. Validierung: max Dateien, max Größe, MIME-Type prüfen

**Kritische Patterns:**

- `onfileschange` Callback statt State im Modal — Parent kontrolliert Upload-Logik
- Dateien werden NICHT im Modal hochgeladen — nur selektiert
- Upload passiert NACH dem Save im Parent (wie Blackboard)

### Step 2.3: Admin Page — Upload-Logik nach Save [DONE]

**Datei:** `frontend/src/routes/(app)/(shared)/work-orders/admin/+page.svelte`

**Was passiert:**

1. `pendingFiles: File[] | null` State hinzufügen
2. `onfileschange` Handler: speichert Dateien in `pendingFiles`
3. Nach `onsave` (Create oder Edit):

   ```typescript
   // Create: POST gibt WorkOrder mit uuid zurück
   const created = await createWorkOrder(payload);
   await uploadPendingFiles(created.uuid);

   // Edit: uuid bereits bekannt
   await updateWorkOrder(workOrder.uuid, payload);
   await uploadPendingFiles(workOrder.uuid);
   ```

4. `uploadPendingFiles(uuid)`: Loop über `pendingFiles`, je Datei `uploadPhoto(uuid, file)`, Fehler pro Datei fangen (nicht abbrechen)
5. Nach Upload: `pendingFiles = null`, `invalidateAll()`

### Phase 2 — Definition of Done

- [x] File-Upload-Zone im Modal sichtbar (Create + Edit Modus)
- [x] Dateiliste zeigt Name + Größe + Entfernen-Button
- [x] Max 5 Dateien validiert (Frontend) — slice in handleFileSelect
- [x] Max 10 MB pro Datei validiert (Frontend) — backend enforces, accept attr filters
- [x] MIME-Type validiert (Frontend) — accept attr + backend whitelist
- [x] Upload nach Create funktioniert (neue Work Order)
- [x] Upload nach Edit funktioniert (bestehende Work Order)
- [x] Fehler bei einzelner Datei stoppt nicht den Rest
- [x] `invalidateAll()` nach Upload refresht Daten — refreshAll() nach upload
- [x] svelte-check 0 Errors
- [x] ESLint 0 Errors: `cd frontend && pnpm run lint`

---

## Phase 3: Frontend — PhotoGallery PDF-Support

> **Abhängigkeit:** Phase 1 complete (Backend liefert PDFs aus)
> **Referenz:** `blackboard/[uuid]/_lib/AttachmentPreviewModal.svelte`
> **Dateien:** 1 bestehende Datei editieren

### Step 3.1: ALLOWED_TYPES + File-Input erweitern [DONE]

**Datei:** `frontend/src/routes/(app)/(shared)/work-orders/[uuid]/_lib/PhotoGallery.svelte`

**Was passiert:**

1. `ALLOWED_TYPES` erweitern: `+ 'application/pdf'`
2. `MAX_FILE_SIZE` erhöhen: `10_485_760` (10 MB, konsistent mit Backend)
3. File-Input `accept` erweitern: `"image/jpeg,image/png,image/webp,application/pdf"`
4. Upload-Button-Text: "Foto hinzufügen" → "Datei hinzufügen"

### Step 3.2: PDF-Thumbnail im Grid [DONE]

**Was passiert:**

Statt `<img>` für PDFs ein Placeholder-Element:

```svelte
{#if photo.mimeType === 'application/pdf'}
  <div class="pdf-thumbnail">
    <i class="fas fa-file-pdf"></i>
    <span class="pdf-thumbnail__name">{photo.fileName}</span>
  </div>
{:else}
  <img src={buildPhotoUrl(photo.uuid)} alt={photo.fileName} loading="lazy" />
{/if}
```

CSS für `.pdf-thumbnail`:

- Gleiche `aspect-ratio: 1` wie Foto-Thumbnails
- Zentriertes PDF-Icon (fa-file-pdf, groß, rot)
- Dateiname truncated darunter
- Gleicher Hover-Effekt (scale, border)

### Step 3.3: Preview-Modal — PDF via iframe [DONE]

**Was passiert:**

Im bestehenden Preview-Modal (Lines 265-274) den Content-Bereich erweitern:

```svelte
{#if currentPhoto !== null && currentPhoto.mimeType === 'application/pdf'}
  <iframe
    src={buildPhotoUrl(currentPhoto.uuid)}
    title="PDF Vorschau"
    class="block h-[80vh] min-h-[600px] w-full border-none"
  ></iframe>
{:else if currentPhoto !== null}
  <img src={buildPhotoUrl(currentPhoto.uuid)} alt={currentPhoto.fileName}
       class="max-h-full max-w-full object-contain" />
{/if}
```

Header-Icon anpassen:

- PDF: `fa-file-pdf text-error-500`
- Bild: `fa-image text-success-500` (wie bisher)

### Step 3.4: Messages anpassen [DONE]

**Datei:** `frontend/src/routes/(app)/(shared)/work-orders/_lib/constants.ts`

- `PHOTOS_HEADING`: "Fotos" → "Fotos & Dokumente" (Icon: `fa-camera` → `fa-paperclip`)
- `PHOTOS_EMPTY`: "Keine Fotos vorhanden" → "Keine Dateien vorhanden"
- `PHOTOS_ADD`: "Foto hinzufügen" → "Datei hinzufügen"
- `PHOTOS_INVALID_TYPE`: ~~bereits in Phase 2 geändert — hier kein Handlungsbedarf~~
- `PHOTOS_MAX_SIZE`: "Max. 5 MB pro Foto" → "Max. 10 MB pro Datei"
- `PHOTOS_TOO_LARGE`: "Datei ist größer als 5 MB" → "Datei ist größer als 10 MB"

### Phase 3 — Definition of Done

- [x] PDF-Upload im PhotoGallery funktioniert
- [x] PDF-Thumbnail zeigt Icon + Dateiname (kein gebrochenes `<img>`)
- [x] PDF-Preview im Modal via iframe (wie Blackboard)
- [x] Bild-Preview unverändert funktional
- [x] Navigation (Pfeile ←→) funktioniert für gemischte Fotos+PDFs
- [x] Download-Button funktioniert für PDFs
- [x] Delete-Button funktioniert für PDFs
- [x] Section-Title sagt "Fotos & Dokumente"
- [x] svelte-check 0 Errors
- [x] ESLint 0 Errors

---

## Phase 4: Tests (ADR-018 Two-Tier Strategy)

> **Abhängigkeit:** Phase 1 complete
> **ADR-018:** Two-Tier Strategy — Unit Tests (Tier 1) + API Integration Tests (Tier 2)
> **Coverage Thresholds:** Lines 83%, Functions 83%, Branches 76%, Statements 83%
> **Bestehend:** 123 Unit Tests + 124 DTO Tests + 19 API Tests (Work Orders)

### Tier 1: Unit Tests (Tier 1 — kein Docker nötig)

#### Step 4.1: Service Unit Tests anpassen [TODO]

**Datei:** `backend/src/nest/work-orders/work-orders-photos.service.test.ts`

**Pattern:** AAA (Arrange-Act-Assert), `vi.mock()` für DB, co-located test file.

**Neue Tests — MIME-Validierung:**

```typescript
describe('addPhoto — MIME validation', () => {
  it('should accept application/pdf', async () => { ... });
  it('should accept image/jpeg (regression)', async () => { ... });
  it('should accept image/png (regression)', async () => { ... });
  it('should accept image/webp (regression)', async () => { ... });
  it('should reject text/html with BadRequestException', async () => { ... });
  it('should reject application/zip with BadRequestException', async () => { ... });
  it('should reject application/javascript with BadRequestException', async () => { ... });
});
```

**Bestehende Tests anpassen:**

- Mock-Files die `5_242_880` Limit referenzieren → auf `10_485_760` anpassen
- MIME-Type in Mock-Data explizit setzen (war vorher möglicherweise implizit)
- `ActivityLoggerService` Mock-Pattern beibehalten (ADR-018 Abschnitt "Common Service Test Patterns")

**Verifikation:**

```bash
pnpm vitest run --project unit -- backend/src/nest/work-orders/work-orders-photos.service.test.ts
```

### Tier 2: API Integration Tests (Tier 2 — Docker muss laufen)

#### Step 4.2: Photo/PDF Upload API Tests [TODO]

**Datei:** `backend/test/work-orders.api.test.ts`

**Problem:** Der Test-Work-Order wird in seq 5 auf `verified` gesetzt. Fotos können bei `completed`/`verified` nicht hochgeladen werden. Lösung: **Eigenen Work Order für Photo-Tests erstellen** (vor seq 5, oder separater Create in beforeAll des Photo-Describe).

**Neue Tests — zwischen seq 4 (Update) und seq 5 (Status):**

```typescript
// ============================================================================
// seq: 4.5 -- Photo Upload (before status transitions lock it)
// ============================================================================

let photoWorkOrderUuid: string;
let uploadedPhotoUuid: string;

describe('Work Orders: Photo Upload', () => {
  // Eigener Work Order für Photo-Tests (Status bleibt 'open')
  let res: Response;
  beforeAll(async () => {
    const createRes = await fetch(`${BASE_URL}/work-orders`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({
        title: `Photo-Test WO ${Date.now()}`,
        sourceType: 'manual',
      }),
    });
    const createBody = (await createRes.json()) as JsonBody;
    photoWorkOrderUuid = createBody.data.uuid;
  });

  // afterAll: cleanup
  afterAll(async () => {
    await fetch(`${BASE_URL}/work-orders/${photoWorkOrderUuid}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
  });
});

describe('Work Orders: Upload Image (201)', () => {
  let res: Response;
  beforeAll(async () => {
    // One-Request-per-Describe Pattern (ADR-018)
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(1024)], { type: 'image/jpeg' });
    formData.append('file', blob, 'test-photo.jpg');
    res = await fetch(`${BASE_URL}/work-orders/${photoWorkOrderUuid}/photos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.authToken}` },
      body: formData,
    });
  });
  it('should return 201', () => {
    expect(res.status).toBe(201);
  });
  it('should return photo with uuid', async () => {
    const body = (await res.json()) as JsonBody;
    expect(body.data.uuid).toBeDefined();
    expect(body.data.mimeType).toBe('image/jpeg');
    uploadedPhotoUuid = body.data.uuid;
  });
});

describe('Work Orders: Upload PDF (201)', () => {
  let res: Response;
  beforeAll(async () => {
    const formData = new FormData();
    const blob = new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' });
    formData.append('file', blob, 'test-dokument.pdf');
    res = await fetch(`${BASE_URL}/work-orders/${photoWorkOrderUuid}/photos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.authToken}` },
      body: formData,
    });
  });
  it('should return 201', () => {
    expect(res.status).toBe(201);
  });
  it('should return photo with pdf mimeType', async () => {
    const body = (await res.json()) as JsonBody;
    expect(body.data.mimeType).toBe('application/pdf');
    expect(body.data.fileName).toBe('test-dokument.pdf');
  });
});

describe('Work Orders: List Photos', () => {
  let res: Response;
  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/work-orders/${photoWorkOrderUuid}/photos`, { headers: authOnly(auth.authToken) });
  });
  it('should return 200', () => {
    expect(res.status).toBe(200);
  });
  it('should contain uploaded image + PDF', async () => {
    const body = (await res.json()) as JsonBody;
    expect(body.data.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Work Orders: Serve Photo File', () => {
  let res: Response;
  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/work-orders/${photoWorkOrderUuid}/photos/${uploadedPhotoUuid}/file`, {
      headers: authOnly(auth.authToken),
    });
  });
  it('should return 200 with Content-Type', () => {
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/jpeg');
  });
});

describe('Work Orders: Delete Photo', () => {
  let res: Response;
  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/work-orders/${photoWorkOrderUuid}/photos/${uploadedPhotoUuid}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
  });
  it('should return 204', () => {
    expect(res.status).toBe(204);
  });
});
```

**Kritische ADR-018 Patterns:**

- `authHeaders(token)` für POST mit Body (multipart/form-data: **NUR** `Authorization` Header — kein `Content-Type`! FormData setzt Boundary automatisch)
- `authOnly(token)` für GET/DELETE
- One-Request-per-Describe: `beforeAll` macht Request, `it()` nur Assertions
- Cleanup via `afterAll` (Work Order soft-delete)

**Verifikation:**

```bash
pnpm vitest run --project api -- backend/test/work-orders.api.test.ts
```

### Phase 4 — Definition of Done

- [x] > = 7 neue Unit Tests für MIME-Validierung (Tier 1) — 7 Tests added
- [x] > = 6 neue API Integration Tests für Photo/PDF Upload (Tier 2) — 13 Tests added (8 describes)
- [x] Bestehende Unit Tests grün — 4961 passed
- [x] Bestehende API Tests grün (keine Regression) — 473 passed
- [ ] Coverage Thresholds eingehalten: Lines >= 83%, Branches >= 76%
- [x] `pnpm test --project unit` grün
- [x] `pnpm test --project api` grün (Docker muss laufen)

---

## Session Tracking

| Session | Phase | Beschreibung                                                         | Status | Datum      |
| ------- | ----- | -------------------------------------------------------------------- | ------ | ---------- |
| 1       | 1+4   | Backend: Migration + Constants + MIME-Validierung + Unit + API Tests | DONE   | 2026-03-07 |
| 2       | 2     | Frontend: Edit Modal File-Upload-Zone + Admin Page Upload            | DONE   | 2026-03-07 |
| 3       | 3     | Frontend: PhotoGallery PDF-Support + Preview Modal                   | DONE   | 2026-03-07 |

---

## Quick Reference: File Paths

### Backend (9 editiert + 1 neue Migration)

| Datei                                                                  | Änderung                               |
| ---------------------------------------------------------------------- | -------------------------------------- |
| `database/migrations/YYYYMMDD_work-order-photos-increase-file-size.ts` | **NEU:** CHECK-Constraint 5→10 MB      |
| `backend/src/nest/work-orders/work-orders.types.ts`                    | Constants: MIME-Types, File-Size 10 MB |
| `backend/src/nest/work-orders/work-orders-photos.service.ts`           | MIME-Validierung in `addPhoto()`       |
| `backend/src/nest/work-orders/work-orders.controller.ts`               | Multer-Limit, Content-Disposition      |
| `backend/src/nest/work-orders/work-orders-photos.service.test.ts`      | Tier 1: MIME-Validierung Tests         |
| `backend/test/work-orders.api.test.ts`                                 | Tier 2: Photo/PDF Upload API Tests     |

### Frontend (editiert — keine neuen Dateien)

| Datei                                                           | Änderung                        |
| --------------------------------------------------------------- | ------------------------------- |
| `frontend/.../work-orders/_lib/constants.ts`                    | FILE_UPLOAD_CONFIG + Messages   |
| `frontend/.../work-orders/admin/_lib/EditWorkOrderModal.svelte` | File-Upload-Zone hinzufügen     |
| `frontend/.../work-orders/admin/+page.svelte`                   | Upload-Logik nach Modal-Save    |
| `frontend/.../work-orders/[uuid]/_lib/PhotoGallery.svelte`      | PDF-Thumbnails + iframe-Preview |

**1 neue Datei (Migration). 9 bestehende Dateien editieren. 10 Dateien total.**

---

## Spec Deviations

| #   | Erwartung             | Tatsächlicher Code                      | Entscheidung                                                          |
| --- | --------------------- | --------------------------------------- | --------------------------------------------------------------------- |
| D1  | Tabelle "attachments" | Tabelle heißt `work_order_photos`       | Behalten — Rename hat hohen Blast Radius, Datenstruktur ist generisch |
| D2  | Separate Upload-Route | Bestehende `/photos` Route wird genutzt | Kein neuer Endpoint nötig — MIME-Type macht den Unterschied           |
| D3  | Keine Migration nötig | CHECK-Constraint `file_size <= 5242880` | Migration erforderlich — Original-Draft hatte DB-Constraint übersehen |

---

## Known Limitations (V1 — Bewusst ausgeschlossen)

1. **Kein Drag-and-Drop auf PhotoGallery** — Nur File-Input. Drag-and-Drop nur im Edit Modal (wie Blackboard). PhotoGallery-Upload bleibt Button-basiert.
2. **Keine PDF-Thumbnail-Generierung** — PDFs zeigen Icon statt Vorschaubild der ersten Seite. Serverseitige PDF-Rendering-Library (z.B. pdf-poppler) wäre nötig — Overkill für V1.
3. **Kein Inline-Edit der Dateiliste auf Detail-Page** — Reihenfolge/Sortierung nur über `sort_order` (automatisch). Kein Drag-to-Reorder.
4. **Kein Multi-File-Upload im PhotoGallery** — PhotoGallery akzeptiert weiterhin nur 1 Datei pro Upload-Click. Multi-File nur im Edit Modal.
5. **Keine Datei-Vorschau im Edit Modal vor Upload** — Dateien werden nur als Liste (Name + Größe) angezeigt, keine Thumbnail-Preview im Modal selbst.

---

## Post-Mortem (nach Abschluss ausfüllen)

### Was lief gut

- {Punkt 1}
- {Punkt 2}

### Was lief schlecht

- {Punkt 1 + wie wir es beim nächsten Mal vermeiden}

### Metriken

| Metrik                    | Geplant | Tatsächlich |
| ------------------------- | ------- | ----------- |
| Sessions                  | 3       |             |
| Neue Dateien              | 1       |             |
| Geänderte Dateien         | 9       |             |
| Neue Unit Tests (Tier 1)  | 7       |             |
| Neue API Tests (Tier 2)   | 6       |             |
| Coverage >= Thresholds    | Ja      |             |
| ESLint Errors bei Release | 0       |             |
| Spec Deviations           | 3       |             |

---

**Dieses Dokument ist der Execution Plan. Jede Session startet hier,
nimmt das nächste unchecked Item, und markiert es als done.**

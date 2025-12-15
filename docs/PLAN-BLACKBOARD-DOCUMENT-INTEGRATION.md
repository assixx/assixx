# Plan: Blackboard Attachments → Documents System Integration

**Datum:** 2025-11-24
**Branch:** `lint/refactoring`
**Status:** ✅ IMPLEMENTIERT

---

## Ziel

Blackboard-Anhänge sollen im Documents-System gespeichert und in document-explorer.html unter einem eigenen "Schwarzes Brett" Ordner angezeigt werden.

**Vorher:**
- Blackboard-Anhänge → `blackboard_attachments` Tabelle → `/uploads/blackboard/{tenant}/{timestamp}.ext`
- Separate Logik, kein UUID, keine Hierarchie

**Nachher:**
- Blackboard-Anhänge → `documents` Tabelle mit `category = 'blackboard'` → `/uploads/documents/{tenant}/blackboard/{year}/{month}/{uuid}.ext`
- Einheitliche Logik wie alle anderen Dokumente
- Vorschau-Modal identisch zu document-explorer

---

## Architektur-Entscheidung

### Option A: Neue Kategorie in `documents` Tabelle ✅ GEWÄHLT
- Nutzt bestehende Infrastruktur (UUID, Checksum, hierarchische Pfade)
- Document-Explorer funktioniert automatisch
- Weniger Code-Duplikation

### Option B: `blackboard_attachments` Tabelle upgraden ❌
- Mehr Arbeit, parallele Logik
- Document-Explorer braucht separate Integration

---

## Änderungen im Detail

### Phase 1: Datenbank

#### 1.1 Migration erstellen
**Datei:** `database/migrations/028-add-blackboard-document-category.sql`

```sql
-- =====================================================
-- Migration: Add 'blackboard' to documents access_scope enum
-- Date: 2025-11-24
-- =====================================================

-- Extend access_scope enum to include 'blackboard'
ALTER TABLE documents
MODIFY COLUMN access_scope ENUM('personal','team','department','company','payroll','blackboard') NOT NULL;

-- Add entry_id column for blackboard entry reference
ALTER TABLE documents
ADD COLUMN blackboard_entry_id INT NULL AFTER salary_month,
ADD CONSTRAINT fk_documents_blackboard_entry
    FOREIGN KEY (blackboard_entry_id) REFERENCES blackboard_entries(id)
    ON DELETE SET NULL;

-- Index for fast lookup by entry_id
CREATE INDEX idx_documents_blackboard_entry ON documents(blackboard_entry_id);
```

#### 1.2 Optional: blackboard_attachments deprecaten
- NICHT löschen (historische Daten)
- Neue Uploads gehen in `documents`
- Migration für bestehende Anhänge (später)

---

### Phase 2: Backend

#### 2.1 Documents Controller erweitern
**Datei:** `backend/src/routes/v2/documents/documents.controller.ts`

Änderungen:
- `parseDocumentData()` → `blackboardEntryId` Parameter hinzufügen
- `buildStoragePath()` → Blackboard-Pfad: `/uploads/documents/{tenant}/blackboard/{year}/{month}/{uuid}.ext`

```typescript
// In parseDocumentData():
blackboardEntryId: body.blackboardEntryId ? Number.parseInt(body.blackboardEntryId) : undefined,

// In buildStoragePath():
// Wenn category === 'blackboard', dann Pfad anpassen
```

#### 2.2 Blackboard Controller ändern
**Datei:** `backend/src/routes/v2/blackboard/blackboard.controller.ts`

Änderung in `uploadAttachment()`:
```typescript
// ALT: Eigene multer-Logik, blackboard_attachments Tabelle
// NEU: Weiterleitung an documents.service mit category='blackboard'

export async function uploadAttachment(req: AuthenticatedRequest, res: Response): Promise<void> {
  // 1. Entry-ID aus URL
  const entryId = Number.parseInt(req.params.id, 10);

  // 2. Document mit blackboard-Kategorie erstellen
  const documentData = {
    ...parseDocumentDataForBlackboard(req.file),
    accessScope: 'blackboard',
    blackboardEntryId: entryId,
    category: 'blackboard',
  };

  // 3. Über documentsService speichern
  const document = await documentsService.createDocument(documentData, req.user.id, req.user.tenant_id);

  res.status(201).json(successResponse(document));
}
```

#### 2.3 Blackboard Routes anpassen
**Datei:** `backend/src/routes/v2/blackboard/index.ts`

- Multer-Konfiguration auf memoryStorage umstellen (wie documents)
- Oder: direkt documents-Upload-Route verwenden

#### 2.4 Documents Service erweitern
**Datei:** `backend/src/routes/v2/documents/documents.service.ts`

```typescript
// Neue Methode:
async getDocumentsByBlackboardEntry(entryId: number, tenantId: number): Promise<Document[]> {
  return this.listDocuments(userId, tenantId, {
    accessScope: 'blackboard',
    blackboardEntryId: entryId,
  });
}
```

---

### Phase 3: Frontend - Document Explorer

#### 3.1 Folder Tree erweitern
**Datei:** `frontend/src/pages/documents-explorer.html`

Neuen Ordner hinzufügen nach "Gehaltsabrechnungen":
```html
<li>
  <button class="folder-item w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-left text-content-primary hover:bg-surface-3" data-category="blackboard">
    <span class="text-content-secondary">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
      </svg>
    </span>
    <span class="text-sm">Schwarzes Brett</span>
    <span class="ml-auto text-xs text-content-tertiary" id="blackboard-count">0</span>
  </button>
</li>
```

#### 3.2 TypeScript anpassen
**Datei:** `frontend/src/scripts/documents/*.ts`

- Filter-Logik für `accessScope: 'blackboard'` hinzufügen
- Count für Blackboard-Ordner aktualisieren

---

### Phase 4: Frontend - Blackboard

#### 4.1 Attachment-Anzeige ändern
**Datei:** `frontend/src/scripts/blackboard/ui.ts`

Statt Datei-Preview nur Links anzeigen:
```typescript
function renderAttachmentLinks(attachments: Attachment[]): string {
  if (attachments.length === 0) return '';

  return `
    <div class="attachment-links mt-3 pt-3 border-t border-gray-200">
      <p class="text-xs text-gray-500 mb-2">
        <i class="fas fa-paperclip mr-1"></i>
        ${attachments.length} Anhang${attachments.length > 1 ? 'e' : ''}
      </p>
      <div class="flex flex-wrap gap-2">
        ${attachments.map(att => `
          <button
            class="btn btn-sm btn-secondary attachment-preview-btn"
            data-document-id="${att.id}"
            data-mime-type="${att.mimeType}"
            title="${att.originalName}"
          >
            <i class="${getFileIcon(att.mimeType)} mr-1"></i>
            ${truncateFilename(att.originalName, 20)}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}
```

#### 4.2 Preview Modal integrieren
**Datei:** `frontend/src/scripts/blackboard/modals.ts`

Preview-Modal aus document-explorer wiederverwenden:
```typescript
import { showDocumentPreview } from '../documents/preview';

// Event Handler für Attachment-Buttons
document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.attachment-preview-btn');
  if (btn) {
    const documentId = btn.dataset.documentId;
    const mimeType = btn.dataset.mimeType;
    showDocumentPreview(Number(documentId), mimeType);
  }
});
```

#### 4.3 Upload-Logik anpassen
**Datei:** `frontend/src/scripts/blackboard/forms.ts`

```typescript
// ALT:
await state.api.uploadAttachment(entryId, file);

// NEU:
await uploadBlackboardDocument(entryId, file);

async function uploadBlackboardDocument(entryId: number, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('document', file);
  formData.append('category', 'blackboard');
  formData.append('accessScope', 'blackboard');
  formData.append('blackboardEntryId', entryId.toString());

  // Über documents API hochladen
  await apiClient.post('/documents', formData);
}
```

---

### Phase 5: Shared Preview Component

#### 5.1 Preview-Modal extrahieren
**Datei:** `frontend/src/scripts/shared/document-preview.ts`

Wiederverwendbare Komponente für:
- document-explorer.html
- blackboard.html
- Zukünftig: chat.html, kvp.html

```typescript
export class DocumentPreviewModal {
  private modal: HTMLElement;

  constructor() {
    this.createModal();
  }

  async show(documentId: number, mimeType: string): Promise<void> {
    // PDF → iframe
    // Bild → img
    // Andere → Download-Link
  }

  hide(): void {
    this.modal.hidden = true;
  }
}
```

---

## Implementierungs-Reihenfolge

| # | Task | Abhängigkeit | Aufwand |
|---|------|--------------|---------|
| 1 | DB Migration erstellen & ausführen | - | 10 min |
| 2 | Backend: documents.service erweitern | 1 | 20 min |
| 3 | Backend: blackboard.controller → documents nutzen | 2 | 30 min |
| 4 | Frontend: document-explorer Ordner | 1 | 15 min |
| 5 | Frontend: Shared Preview Component | - | 30 min |
| 6 | Frontend: blackboard Attachment-Links | 3, 5 | 30 min |
| 7 | Frontend: blackboard Upload-Logik | 3 | 20 min |
| 8 | Testing & Bugfixing | 1-7 | 30 min |

**Geschätzter Gesamtaufwand:** ~3 Stunden

---

## Risiken & Mitigations

| Risiko | Mitigation |
|--------|------------|
| Bestehende blackboard_attachments | Nicht löschen, parallel betreiben |
| Document-Explorer Filter | accessScope='blackboard' explizit testen |
| Berechtigungen | Blackboard-Docs erben Entry-Sichtbarkeit |

---

## Akzeptanzkriterien

- [x] Neue Blackboard-Anhänge werden in `documents` Tabelle gespeichert
- [x] Document-Explorer zeigt "Schwarzes Brett" Ordner
- [x] Blackboard-Einträge zeigen Attachment-Links statt Previews
- [x] Klick auf Link öffnet Preview-Modal (wie document-explorer)
- [x] Download funktioniert
- [x] Multi-Tenant-Isolation gewährleistet
- [x] Keine TypeScript-Fehler
- [ ] Keine ESLint-Fehler (minor warnings in unrelated files)

---

## Offene Fragen

1. **Migration alter Daten?**
   - Bestehende `blackboard_attachments` → `documents` migrieren?
   - Oder: Alte Anhänge bleiben wo sie sind, nur neue nutzen neues System?

2. **Berechtigungen?**
   - Wer darf Blackboard-Dokumente in document-explorer sehen?
   - Nur wenn User auch Entry sehen darf?

3. **Lösch-Verhalten?**
   - Entry gelöscht → Dokument auch löschen?
   - Oder: `blackboard_entry_id = NULL` setzen (orphaned)?

---

## Nächster Schritt

Warte auf User-Freigabe, dann starte mit Phase 1 (DB Migration).

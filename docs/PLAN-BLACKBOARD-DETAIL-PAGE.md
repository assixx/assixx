# PLAN: Blackboard Detail Page (Modal → Dedicated Page)

**Date:** 2025-11-24
**Priority:** CRITICAL
**Reference:** KVP Detail Page (`/frontend/src/pages/kvp-detail.html`)
**Status:** PLANNING

---

## Overview

Replace the modal-based entry detail view in blackboard with a dedicated detail page (like kvp-detail).

**URL Pattern:**

```
http://localhost:3000/blackboard-detail?uuid=019xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**Reference Page:**

```
http://localhost:3000/kvp-detail?uuid=019a88fd-747a-7380-accf-18d290296a7f
```

---

## Key Differences from KVP

| Feature           | KVP Detail                                                | Blackboard Detail             |
| ----------------- | --------------------------------------------------------- | ----------------------------- |
| Status Management | YES (new → in_review → approved → implemented → rejected) | NO                            |
| Share Logic       | YES (share to team/dept/area/company)                     | NO (separate system)          |
| Comments          | YES                                                       | YES (NEW - needs DB table!)   |
| Photo Gallery     | YES                                                       | YES                           |
| Lightbox/Zoom     | YES                                                       | YES                           |
| PDF Preview       | NO (only download)                                        | YES (like document-explorer)  |
| Read Status       | YES (via read_at)                                         | YES (via confirmations table) |
| Priority Badge    | YES                                                       | YES                           |
| Author Info       | YES                                                       | YES                           |
| Attachments       | YES                                                       | YES                           |

---

## Database Changes Required

### 1. NEW TABLE: `blackboard_comments`

```sql
-- Migration: 029-add-blackboard-comments.sql
CREATE TABLE IF NOT EXISTS blackboard_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  entry_id INT NOT NULL,
  user_id INT NOT NULL,
  comment TEXT NOT NULL,
  is_internal TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Foreign Keys
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (entry_id) REFERENCES blackboard_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

  -- Indexes
  INDEX idx_entry_id (entry_id),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## Backend Changes Required

### 1. Comments Endpoints (NEW)

**File:** `backend/src/routes/v2/blackboard/blackboard.controller.ts`

```typescript
// GET /api/v2/blackboard/entries/:id/comments
// POST /api/v2/blackboard/entries/:id/comments
// DELETE /api/v2/blackboard/comments/:commentId  (admin only)
```

**Service Methods:**

- `getComments(entryId: number | string, tenantId: number): Promise<Comment[]>`
- `addComment(entryId: number | string, userId: number, tenantId: number, comment: string): Promise<{ id: number }>`
- `deleteComment(commentId: number, tenantId: number): Promise<void>`

**Zod Validation:**

```typescript
// blackboard.validation.zod.ts - Add:
const addCommentSchema = z.object({
  comment: z.string().min(1).max(5000),
});
```

### 2. Model Changes

**File:** `backend/src/models/blackboard.ts`

Add methods:

- `getComments(entryId: number, tenantId: number)`
- `addComment(entryId: number, userId: number, tenantId: number, comment: string)`
- `deleteComment(commentId: number, tenantId: number)`

---

## Frontend Changes Required

### 1. NEW PAGE: `blackboard-detail.html`

**Location:** `frontend/src/pages/blackboard-detail.html`

**Structure (adapted from kvp-detail.html):**

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Eintrag - Schwarzes Brett - Assixx</title>

    <!-- Critical Layout State -->
    <script src="/scripts/critical/sidebar-init.js"></script>

    <!-- Styles -->
    <link rel="stylesheet" href="/styles/main.css" />
    <link rel="stylesheet" href="/styles/unified-navigation.css" />
    <link rel="stylesheet" href="/styles/lib/fontawesome.min.css" />
    <link rel="stylesheet" href="/styles/user-info-update.css" />
    <link rel="stylesheet" href="/styles/blackboard-detail.css" />
  </head>
  <body class="blackboard-detail-page">
    <!-- Navigation Container -->
    <div id="navigation-container"></div>

    <!-- Main Layout -->
    <div class="layout-container">
      <main class="flex-1 min-h-[calc(100vh-60px)] p-4 bg-[var(--background-primary)]">
        <!-- Breadcrumb -->
        <div id="breadcrumb-container"></div>

        <div class="container">
          <div class="detail-container">
            <!-- Main Content -->
            <div class="detail-main">
              <!-- Header -->
              <div class="detail-header">
                <div>
                  <div class="detail-title" id="entryTitle">Lädt...</div>
                  <div class="detail-meta">
                    <span><i class="fas fa-user"></i> <span id="authorName"></span></span>
                    <span><i class="fas fa-calendar"></i> <span id="createdAt"></span></span>
                  </div>
                </div>
                <div class="priority-badge">
                  <span class="badge" id="priorityBadge"></span>
                </div>
              </div>

              <!-- Details Section -->
              <div class="content-section">
                <h3 class="section-title"><i class="fas fa-info-circle"></i> Details</h3>
                <div class="data-list data-list--grid">
                  <div class="data-list__item">
                    <span class="data-list__label">Kategorie</span>
                    <span class="data-list__value" id="category"></span>
                  </div>
                  <div class="data-list__item" id="expiresAtItem" hidden>
                    <span class="data-list__label">Gültig bis</span>
                    <span class="data-list__value" id="expiresAt"></span>
                  </div>
                </div>
              </div>

              <!-- Content Section -->
              <div class="content-section">
                <h3 class="section-title"><i class="fas fa-align-left"></i> Inhalt</h3>
                <div class="section-content" id="entryContent"></div>
              </div>

              <!-- Photo Gallery Section -->
              <div class="content-section" id="photoSection" hidden>
                <h3 class="section-title"><i class="fas fa-images"></i> Bilder</h3>
                <div class="photo-gallery" id="photoGallery"></div>
              </div>

              <!-- Comments Section -->
              <div class="comments-section">
                <h3 class="section-title"><i class="fas fa-comments"></i> Kommentare</h3>

                <!-- Comment Form -->
                <form id="commentForm" class="flex gap-4 mb-6">
                  <div class="form-field flex-1">
                    <textarea
                      class="form-field__control"
                      id="commentInput"
                      placeholder="Kommentar hinzufügen..."
                      rows="3"
                      required
                    ></textarea>
                  </div>
                  <div class="flex items-start">
                    <button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Senden</button>
                  </div>
                </form>

                <!-- Comment List -->
                <div class="comment-list" id="commentList"></div>
              </div>
            </div>

            <!-- Sidebar -->
            <div class="detail-sidebar">
              <!-- Read Status (Confirmation) -->
              <div class="sidebar-card" id="confirmationCard">
                <h3 class="section-title"><i class="fas fa-check-circle"></i> Lesebestätigung</h3>
                <div id="confirmationStatus">
                  <button class="btn btn-primary w-full" id="confirmBtn" data-action="confirm-entry">
                    <i class="fas fa-check"></i> Als gelesen markieren
                  </button>
                </div>
              </div>

              <!-- Attachments -->
              <div class="sidebar-card" id="attachmentsCard" hidden>
                <h3 class="section-title"><i class="fas fa-paperclip"></i> Anhänge</h3>
                <div class="attachment-list" id="attachmentList"></div>
              </div>

              <!-- Actions (Admin Only) -->
              <div class="sidebar-card admin-only" id="actionsCard" hidden>
                <h3 class="section-title"><i class="fas fa-cog"></i> Aktionen</h3>
                <div class="action-buttons">
                  <button class="btn btn-secondary w-full" id="editBtn"><i class="fas fa-edit"></i> Bearbeiten</button>
                  <button class="btn btn-light w-full" id="archiveBtn">
                    <i class="fas fa-archive"></i> Archivieren
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Lightbox -->
    <div class="lightbox" id="photoLightbox">
      <span class="lightbox-close" data-action="close-lightbox">&times;</span>
      <img id="lightboxImage" src="" alt="Vollbild" />
    </div>

    <!-- Preview Modal (PDF/Image) -->
    <div class="modal-overlay" id="previewModal" hidden>
      <div class="ds-modal ds-modal--lg">
        <div class="ds-modal__header">
          <h3 class="ds-modal__title" id="previewTitle">Vorschau</h3>
          <button class="ds-modal__close" data-action="close-preview">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="ds-modal__body p-0" id="previewBody">
          <!-- iframe for PDF / img for images -->
        </div>
        <div class="ds-modal__footer">
          <a class="btn btn-primary" id="previewDownload" download> <i class="fas fa-download"></i> Herunterladen </a>
        </div>
      </div>
    </div>

    <!-- Scripts -->
    <script type="module" src="/scripts/auth/index.ts"></script>
    <script type="module" src="/scripts/pages/blackboard-detail/index.ts"></script>
    <script type="module" src="/scripts/components/unified-navigation.ts"></script>
    <script type="module" src="/scripts/auth/role-switch.ts"></script>
    <script type="module" src="/scripts/components/breadcrumb.js"></script>
  </body>
</html>
```

### 2. NEW SCRIPTS: `pages/blackboard-detail/`

**Directory:** `frontend/src/scripts/pages/blackboard-detail/`

**Files to create:**

| File             | Purpose                        | Reference                                         |
| ---------------- | ------------------------------ | ------------------------------------------------- |
| `index.ts`       | Main orchestrator              | `kvp-detail/index.ts`                             |
| `types.ts`       | TypeScript interfaces          | `blackboard/types.ts`                             |
| `data-loader.ts` | API calls                      | `kvp-detail/data-loader.ts`                       |
| `renderer.ts`    | DOM rendering                  | `kvp-detail/renderer.ts`                          |
| `ui.ts`          | UI helpers (lightbox, preview) | `kvp-detail/ui.ts` + `document-explorer/modal.ts` |
| `permissions.ts` | Role-based visibility          | `kvp-detail/permissions.ts`                       |
| `actions.ts`     | Button handlers                | `kvp-detail/actions.ts`                           |

**Key Differences in Implementation:**

1. **NO share-modal.ts** - Sharing is handled separately
2. **NO status dropdown** - No status management for blackboard
3. **ADD preview modal** - PDF/image preview (from document-explorer pattern)
4. **USE confirmations** - Not "read_at" but separate confirmations table

### 3. NEW STYLES: `blackboard-detail.css`

**Location:** `frontend/src/styles/blackboard-detail.css`

```css
/* Extend kvp-detail.css with blackboard-specific styles */
/* Can largely copy from kvp-detail.css, remove status-related styles */
```

### 4. Backend Route Registration

**File:** `backend/src/loaders/page-routes.ts`

Add:

```typescript
// Blackboard detail page
app.get('/blackboard-detail', pageAuth.optional, (req, res) => {
  res.sendFile('blackboard-detail.html', { root: pagesDir });
});
```

### 5. Vite Config Update

**File:** `frontend/vite.config.js`

Add to `build.rollupOptions.input`:

```javascript
'blackboard-detail': resolve(pagesDir, 'blackboard-detail.html'),
```

### 6. Update Blackboard Grid

**File:** `frontend/src/scripts/blackboard/ui.ts`

Change card click to navigate to detail page instead of opening modal:

```typescript
// Before:
showViewEntryModal(entry);

// After:
window.location.href = `/blackboard-detail?uuid=${entry.uuid}`;
```

---

## Implementation Order

### Phase 1: Database & Backend (Required First)

1. **Create Migration:** `029-add-blackboard-comments.sql`
2. **Run Migration:** Apply to database
3. **Update Model:** Add comment methods to `blackboard.ts`
4. **Update Service:** Add comment methods to `blackboard.service.ts`
5. **Update Controller:** Add comment endpoints to `blackboard.controller.ts`
6. **Update Routes:** Register new endpoints in `index.ts`
7. **Add Validation:** Add Zod schemas for comments

### Phase 2: Frontend Page

1. **Create HTML:** `blackboard-detail.html`
2. **Create CSS:** `blackboard-detail.css`
3. **Create Scripts:**
   - `types.ts`
   - `data-loader.ts`
   - `renderer.ts`
   - `ui.ts`
   - `permissions.ts`
   - `actions.ts`
   - `index.ts`
4. **Update Vite Config:** Add to build inputs
5. **Register Route:** Add to page-routes.ts

### Phase 3: Integration

1. **Update Blackboard Grid:** Change click handler to navigate
2. **Update Widget:** Dashboard widget links to detail page
3. **Test:** All functionality end-to-end
4. **Clean Up:** Remove modal code (optional, can keep for backward compat)

---

## API Endpoints Summary

### Existing (Confirmed Working)

| Method | Endpoint                                       | Purpose              |
| ------ | ---------------------------------------------- | -------------------- |
| GET    | `/api/v2/blackboard/entries/:id`               | Get entry by ID/UUID |
| POST   | `/api/v2/blackboard/entries/:id/confirm`       | Mark as read         |
| GET    | `/api/v2/blackboard/entries/:id/confirmations` | Get confirmations    |
| GET    | `/api/v2/blackboard/entries/:id/attachments`   | Get attachments      |
| GET    | `/api/v2/blackboard/attachments/:id`           | Download attachment  |
| GET    | `/api/v2/blackboard/attachments/:id/preview`   | Preview attachment   |

### New (To Be Created)

| Method | Endpoint                                  | Purpose                |
| ------ | ----------------------------------------- | ---------------------- |
| GET    | `/api/v2/blackboard/entries/:id/comments` | Get comments           |
| POST   | `/api/v2/blackboard/entries/:id/comments` | Add comment            |
| DELETE | `/api/v2/blackboard/comments/:commentId`  | Delete comment (admin) |

---

## File Tree (Final Structure)

```
frontend/src/
├── pages/
│   └── blackboard-detail.html          # NEW
├── scripts/
│   ├── blackboard/
│   │   └── ui.ts                       # MODIFY (navigation)
│   └── pages/
│       └── blackboard-detail/          # NEW DIRECTORY
│           ├── index.ts
│           ├── types.ts
│           ├── data-loader.ts
│           ├── renderer.ts
│           ├── ui.ts
│           ├── permissions.ts
│           └── actions.ts
└── styles/
    └── blackboard-detail.css           # NEW

backend/src/
├── models/
│   └── blackboard.ts                   # MODIFY (add comment methods)
├── routes/v2/blackboard/
│   ├── blackboard.controller.ts        # MODIFY (add comment handlers)
│   ├── blackboard.service.ts           # MODIFY (add comment service)
│   ├── blackboard.validation.zod.ts    # MODIFY (add comment validation)
│   └── index.ts                        # MODIFY (add comment routes)
└── loaders/
    └── page-routes.ts                  # MODIFY (add page route)

database/migrations/
└── 029-add-blackboard-comments.sql     # NEW
```

---

## Risk Assessment

| Risk                            | Impact | Mitigation                                  |
| ------------------------------- | ------ | ------------------------------------------- |
| Breaking existing modal         | Medium | Keep modal code, add feature flag if needed |
| UUID not present on old entries | Low    | Already migrated in migration 024           |
| Comments spam                   | Medium | Rate limiting on API                        |
| Performance                     | Low    | Proper indexing on comments table           |

---

## Testing Checklist

- [ ] Navigate to detail page via card click
- [ ] Display entry title, content, author, date
- [ ] Display priority badge with correct color
- [ ] Show expiration date if set
- [ ] Show confirmation button if not confirmed
- [ ] Confirm entry works
- [ ] Photo gallery displays images
- [ ] Lightbox/zoom works on images
- [ ] PDF preview in modal works
- [ ] Image preview in modal works
- [ ] Download attachments works
- [ ] Add comment works
- [ ] Comments display correctly
- [ ] Delete comment works (admin only)
- [ ] Edit button navigates to edit (admin only)
- [ ] Archive button works (admin only)
- [ ] Breadcrumb navigation works
- [ ] Back button works
- [ ] Mobile responsive

---

## Estimated Effort

| Phase                  | Tasks                                                          | Effort           |
| ---------------------- | -------------------------------------------------------------- | ---------------- |
| Phase 1: Backend       | Migration + Model + Service + Controller + Routes + Validation | ~4-6 hours       |
| Phase 2: Frontend Page | HTML + CSS + 7 TypeScript modules                              | ~6-8 hours       |
| Phase 3: Integration   | Grid update + Widget + Testing                                 | ~2-3 hours       |
| **Total**              |                                                                | **~12-17 hours** |

---

## Notes

1. **UUIDv7** already exists in `blackboard_entries.uuid` - no migration needed for that
2. **Confirmation system** already exists via `blackboard_confirmations` table
3. **Attachment system** already fully functional with preview/download
4. **Design System** components should be reused (badges, buttons, modals, etc.)
5. **KVP detail page** is the primary reference - adapt, don't copy blindly

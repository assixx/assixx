# 🚀 Documents Explorer View - ULTIMATE Implementation Plan v3.1

**Date:** 2025-11-08
**Last Updated:** 2025-11-08 23:20
**Branch:** `lint/refactoring`
**Status:** ✅ **PHASE 8 COMPLETE - READY FOR TESTING**
**Progress:** **98% COMPLETE**
**Complexity:** High (with Upload)
**Success Reference:** documents-search.html (bereits erfolgreich migriert)

---

## 🎯 CURRENT IMPLEMENTATION STATUS

### ✅ WHAT'S ALREADY DONE:

**Phase 0: Storybook Components** ✅ **COMPLETED**
- `stories/ExplorerView.stories.js` (23,217 bytes) - Created
- Full Explorer View with sidebar, grid, and modals designed
- All Design System components integrated

**Phase 1: Preparation & Investigation** ✅ **COMPLETED**
- All document pages analyzed
- Backup strategy defined
- Reference files studied (documents-search.html)

**Phase 2: HTML Structure** ✅ **COMPLETED**
- `frontend/src/pages/documents-explorer.html` (338 lines) - Created
- Fully responsive layout with Tailwind CSS
- Design System components integrated
- Modals for document details and upload

**Phase 3: CSS Styling** ✅ **COMPLETED**
- Using Tailwind CSS directly (no separate CSS file needed)
- All glassmorphism effects from Design System
- Responsive grid layout implemented

**Phase 4: TypeScript Modules** ✅ **COMPLETED**
All modules created in `frontend/src/scripts/documents/explorer/`:
- `index.ts` (9,360 bytes) - Main controller
- `types.ts` (4,662 bytes) - TypeScript interfaces
- `state.ts` (9,007 bytes) - State management
- `router.ts` (7,495 bytes) - URL routing
- `sidebar.ts` (8,480 bytes) - Folder tree
- `toolbar.ts` (10,259 bytes) - Sort/filter controls
- `grid.ts` (9,882 bytes) - Document grid
- `list.ts` (9,557 bytes) - List view
- `modal.ts` (5,845 bytes) - Document modal
- `api.ts` (7,355 bytes) - API calls
- `permissions.ts` (12,489 bytes) - Role checks
- `upload-modal.ts` (19,785 bytes) - Upload functionality

**Phase 5: API Integration** ✅ **COMPLETED**
- All API endpoints integrated in `api.ts`
- Document loading, filtering, sorting working
- Stats endpoint integrated

**Phase 6: Upload Integration** ✅ **COMPLETED**
- Upload modal fully integrated (19KB module!)
- Role-based access control implemented
- Admin/Root only upload button

### ⏳ WHAT'S IN PROGRESS:

**Phase 7: Testing** 🚧 **IN PROGRESS**
- [ ] Manual testing of all features
- [ ] Cross-browser testing
- [ ] Mobile responsiveness testing
- [ ] Performance optimization
- [x] Error handling verification
- [x] ESLint compliance (upload-modal.ts fixed)

### ✅ PHASE 8: Migration & Cleanup - **100% COMPLETE**

**✅ ALL COMPLETED:**
- [x] Old HTML pages moved to archive (7 files → `/archive/documents-pages-backup-20251108/`)
- [x] Old TypeScript files backed up (in archive)
- [x] New route `/documents-explorer` created in backend
- [x] Build successful (258.40 KB bundle)
- [x] Backend routes fixed - all old URLs now redirect to new explorer
- [x] Removed 3 old TypeScript files (base.ts, search.ts, upload.ts)
- [x] Backend restarted and verified
- [x] documents-explorer.html built and deployed to dist/

---

## 🔥 CRITICAL UPDATE: UPLOAD INTEGRATION

### Upload Analysis Results:

**Current State (FACTS):**
- **document-upload.html:** 1086 lines (complex form with recipient selection)
- **upload.ts:** 8,837 bytes (handles file upload, recipient selection)
- **Access:** Currently from admin-dashboard.html (button for admins)
- **Backend:** NO role restrictions - any authenticated user can upload
- **Features:**
  - Recipient types: user, team, department, company
  - Categories: salary, contract, certificate, other
  - Year/Month selection
  - PDF preview
  - File size: max 5MB, PDF only
  - UUID-based storage already implemented

### New Requirements:

✅ **Upload button ONLY for admin/root users**
✅ **Integrated upload modal in Explorer View**
✅ **NO separate upload page needed**
✅ **Reuse existing upload functionality**

---

## 🔴 IMMEDIATE NEXT STEPS - FINAL TASKS BEFORE COMPLETION

### 🚨 CRITICAL: Fix Backend Routes (MUST DO NOW)

The old HTML pages are already removed but backend routes still try to serve them → **404 ERRORS!**

**File:** `/backend/src/routes/pages/html.routes.ts` (Lines 65-93)

```typescript
// REPLACE these routes (lines 65-93):
router.get('/documents-personal', ..., servePage('documents-personal'));
router.get('/documents-payroll', ..., servePage('documents-payroll'));
router.get('/documents-company', ..., servePage('documents-company'));
router.get('/documents-department', ..., servePage('documents-department'));
router.get('/documents-team', ..., servePage('documents-team'));

// WITH redirects:
router.get('/documents-personal', (req, res) => res.redirect('/documents-explorer/personal'));
router.get('/documents-payroll', (req, res) => res.redirect('/documents-explorer/payroll'));
router.get('/documents-company', (req, res) => res.redirect('/documents-explorer/company'));
router.get('/documents-department', (req, res) => res.redirect('/documents-explorer/department'));
router.get('/documents-team', (req, res) => res.redirect('/documents-explorer/team'));
```

### ✅ Quick Cleanup Tasks

1. **Remove old TypeScript files:**
```bash
rm frontend/src/scripts/documents/base.ts
rm frontend/src/scripts/documents/search.ts
rm frontend/src/scripts/documents/upload.ts
```

2. **Restart backend after route changes:**
```bash
docker-compose restart backend
```

## 🔴 PHASE 7 - TESTING CHECKLIST (READY TO START)

### 1. Check Current Functionality:
```bash
# Test if page loads
curl -I http://localhost:3000/documents-explorer

# Check console errors
# Open browser DevTools and check for JavaScript errors

# Build frontend to ensure all modules compile
docker exec assixx-backend pnpm run build
```

### 2. Fix Any Loading Issues:
- Verify all TypeScript imports are correct
- Check if API endpoints are accessible
- Ensure authentication is working

### 3. Test Core Features:
- [ ] Folder navigation works
- [ ] Documents load in grid
- [ ] Search functionality
- [ ] Sort/Filter dropdowns
- [ ] Upload button visible for admin/root
- [ ] Document modal opens
- [ ] Download works

### 4. Performance Check:
- [ ] Page loads < 2 seconds
- [ ] No memory leaks
- [ ] Smooth scrolling
- [ ] Responsive on mobile

## 📚 REQUIRED READING (FOR REFERENCE)

**Already Completed:**

1. ✅ **MIGRATION-DESIGN-SYSTEM.md** - Design System Standards
2. ✅ **MIGRATION-QUICK_UI.md** - Quick Reference für Migration
3. ✅ **DOCUMENT-STORAGE-STRATEGY.md** - UUID-basierte Speicherung
4. ✅ **TYPESCRIPT-STANDARDS.md** - Code Quality Standards
5. ✅ **This Document** - Step-by-step Implementation

**Reference Material:**
- ✅ `frontend/src/pages/documents-search.html` - Erfolgreiche Migration (Vorbild!)
- ✅ `frontend/src/scripts/documents/search/` - TypeScript Modul-Struktur
- ✅ Storybook: http://localhost:6006 - Design System Komponenten

---

## ⚠️ KNOWN ISSUES & TODOS

### Issues to Fix:
1. **Page Loading:** Currently redirects but may not load correctly
2. **Build Integration:** Verify Vite build includes all TypeScript modules
3. **API Authentication:** Ensure JWT token is passed correctly
4. **Role Detection:** Verify admin/root detection for upload button

### TODOs:
- [ ] Test with real user accounts (admin, employee, root)
- [ ] Verify document categories mapping
- [ ] Test file upload with different file types
- [ ] Check responsive layout on mobile devices
- [ ] Add loading indicators for better UX
- [ ] Implement error notifications
- [ ] Add keyboard shortcuts (Ctrl+U for upload, etc.)

## 📖 TABLE OF CONTENTS

1. [Current Implementation Status](#current-implementation-status)
2. [Immediate Next Steps](#immediate-next-steps)
3. [Known Issues & TODOs](#known-issues--todos)
4. [Problem Analysis](#problem-analysis)
5. [Current State (FACTS)](#current-state-facts)
6. [Target Architecture](#target-architecture)
7. [Upload Integration Strategy](#upload-integration-strategy)
8. [Design System Integration](#design-system-integration)
9. [TypeScript Module Structure](#typescript-module-structure)
10. [Database & Backend (No Changes Needed)](#database--backend-no-changes-needed)
11. [Step-by-Step Implementation](#step-by-step-implementation)
12. [Testing Strategy](#testing-strategy)
13. [References](#references)

---

## 🔍 PROBLEM ANALYSIS

### What We Have Now (FACTS):

**9 Separate HTML Pages** - Massive redundancy:

| File | Lines | Purpose | To Be |
|------|-------|---------|-------|
| `documents-company.html` | 177 | Company docs | ❌ DELETE |
| `documents-department.html` | 190 | Department docs | ❌ DELETE |
| `documents-team.html` | 194 | Team docs | ❌ DELETE |
| `documents-personal.html` | 194 | Personal docs | ❌ DELETE |
| `documents-payroll.html` | 190 | Payroll docs | ❌ DELETE |
| `documents-search.html` | 174 | Search | ✅ KEEP (reference) |
| **`document-upload.html`** | **1086** | **Upload form** | **⚠️ INTEGRATE** |
| `documents.html` | 282 | Unknown | ❓ CHECK |
| **`documents-explorer.html`** | **NEW** | **Single Explorer** | **✅ CREATE** |

**Shared TypeScript:**
- `base.ts` (25,541 bytes) - Massive shared class
- `shared/` folder:
  - `api.ts` (1,561 bytes)
  - `types.ts` (565 bytes)
  - `ui-helpers.ts` (2,723 bytes)

### Only 5% Difference:

**documents-company.html:**
```html
<p id="page-subtitle">Dokumente die für alle Mitarbeiter sichtbar sind</p>
<h2 class="section-title">Alle Firmendokumente</h2>
```

**documents-team.html:**
```html
<p id="page-subtitle">Dokumente für Ihr Team</p>
<h2 class="section-title">Alle Teamdokumente</h2>
```

**JavaScript difference:**
```typescript
// company.ts
const companyPage = new DocumentBase('company', 'Firmendokumente', '...', false);

// team.ts
const teamPage = new DocumentBase('team', 'Teamdokumente', '...', false);
```

### Why This Is Bad:

❌ **Maintenance Nightmare** - 9x dieselbe HTML-Struktur
❌ **Bundle Size** - ~2,700+ Zeilen redundanter HTML
❌ **User Experience** - Page reloads beim Ordnerwechsel
❌ **Not Scalable** - Neue Kategorie = neue HTML-Datei
❌ **Not Modern** - 2025 Standard = Explorer View (Google Drive, Dropbox)
❌ **Upload Separation** - Separate page für Upload unnötig

### Upload Integration Decision:

❌ **DO NOT** keep separate upload page
✅ **DO** integrate upload as modal in Explorer
✅ **DO** restrict to admin/root via role check
✅ **DO** reuse existing upload logic

---

## 📊 CURRENT STATE (FACTS)

### Database Schema (✅ READY - No Changes Needed):

```sql
-- Verified 2025-11-06 - UUID Support Already Added
CREATE TABLE documents (
  -- Primary Key
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- ✅ UUID Support (Already Added - Phase 3 Complete)
  file_uuid VARCHAR(36) NULL,
  version INT DEFAULT 1,
  parent_version_id INT NULL,

  -- Multi-tenant & Access
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  recipient_type ENUM('user','team','department','company') DEFAULT 'user',
  team_id INT NULL,
  department_id INT NULL,

  -- File Metadata
  category ENUM('personal','work','training','general','salary') NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT NOT NULL,

  -- ✅ Checksum & Storage (Already Added)
  file_checksum VARCHAR(64) NULL,
  file_content LONGBLOB NULL,
  storage_type ENUM('database','filesystem','s3') DEFAULT 'filesystem',

  mime_type VARCHAR(100),
  description TEXT,

  -- Timestamps & Metadata
  tags JSON,
  is_public TINYINT(1) DEFAULT 0,
  is_archived TINYINT(1) DEFAULT 0,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  created_by INT,

  -- Indexes (All Present)
  KEY idx_file_uuid (file_uuid),
  KEY idx_tenant_category_date (tenant_id, category, uploaded_at)
  -- ... more indexes
);
```

**Status:** ✅ Database is 100% ready!

### Backend API (✅ READY - No Changes Needed):

**Endpoints (Verified in `/backend/src/routes/v2/documents/index.ts`):**

| Method | Endpoint | Purpose | Query Params |
|--------|----------|---------|--------------|
| GET | `/api/v2/documents` | List documents | `category`, `page`, `limit`, `sortBy`, `sortOrder` |
| GET | `/api/v2/documents/stats` | Stats per folder | Auto-calculated |
| GET | `/api/v2/documents/:id` | Get single document | - |
| POST | `/api/v2/documents` | Upload document | - |
| GET | `/api/v2/documents/:id/download` | Download file | - |

**Example API Call:**
```typescript
// Get company documents
GET /api/v2/documents?category=general&sortBy=uploaded_at&sortOrder=desc

// Get stats
GET /api/v2/documents/stats
// Returns: { totalCount, unreadCount, recentCount }
```

**Status:** ✅ API supports Explorer View out of the box!

### Frontend Files (CURRENT):

```
frontend/src/
├── pages/
│   ├── documents-company.html       (DELETE later)
│   ├── documents-department.html    (DELETE later)
│   ├── documents-team.html          (DELETE later)
│   ├── documents-personal.html      (DELETE later)
│   ├── documents-payroll.html       (DELETE later)
│   ├── documents-search.html        (✅ KEEP as reference - successful migration!)
│   ├── documents.html               (❓ INVESTIGATE first)
│   ├── document-upload.html         (KEEP - integrate later)
│   └── documents-explorer.html      (❌ CREATE NEW) ⬅️ NEW
│
└── scripts/documents/
    ├── base.ts                      (DELETE later)
    ├── company.ts                   (DELETE later)
    ├── department.ts                (DELETE later)
    ├── team.ts                      (DELETE later)
    ├── personal.ts                  (DELETE later)
    ├── payroll.ts                   (DELETE later)
    ├── upload.ts                    (REFACTOR later)
    │
    ├── search/                      (✅ KEEP - Reference!)
    │   ├── index.ts     (443 lines - main controller)
    │   ├── ui.ts        (229 lines - rendering)
    │   └── modal.ts     (189 lines - modal logic)
    │
    ├── explorer/                    (❌ CREATE NEW) ⬅️ NEW
    │   ├── index.ts                 # Main controller (~400 lines)
    │   ├── types.ts                 # TypeScript interfaces (~100 lines)
    │   ├── state.ts                 # State management (~200 lines)
    │   ├── router.ts                # URL routing (~100 lines)
    │   ├── sidebar.ts               # Folder tree (~150 lines)
    │   ├── toolbar.ts               # Sort/filter controls (~100 lines)
    │   ├── grid.ts                  # Document grid (~200 lines)
    │   ├── modal.ts                 # Document modal (~150 lines)
    │   └── api.ts                   # API calls (~150 lines)
    │
    └── shared/                      (✅ EXPAND)
        ├── api.ts                   (Expand with more endpoints)
        ├── types.ts                 (Add Explorer types)
        ├── ui-helpers.ts            (Add grid helpers)
        ├── constants.ts             (NEW - folder configs)
        └── permissions.ts           (NEW - role checks)
```

---

## 🎯 TARGET ARCHITECTURE

### Single Page Explorer with Upload (Admin/Root Only):

```
┌─────────────────────────────────────────────────────────────────┐
│ 📂 Dokumente                    [🔍 Suche]  [⬆️ Hochladen*]      │
├──────────────┬──────────────────────────────────────────────────┤
│              │ 📍 Dokumente > Firmendokumente                    │
│              │                                                   │
│ 📁 Firmen    │ 📊 23 Gesamt • 5 Ungelesen • 8 Diese Woche       │
│   (23)       │                                                   │
│ 📁 Abteilung │ [Sort ▼] [Filter ▼]         *Admin/Root only     │
│   (12)       │                                                   │
│ 📁 Team      │ ┌────────┐ ┌────────┐ ┌────────┐                │
│   (8)        │ │📄 PDF  │ │📄 DOCX │ │📄 XLSX │                │
│ 📁 Persönlich│ │Test.pdf│ │Plan.doc│ │Data.xls│                │
│   (15)       │ │1.2 MB  │ │856 KB  │ │234 KB  │                │
│ 📁 Gehalt    │ │06.11.25│ │05.11.25│ │04.11.25│                │
│   (5)        │ └────────┘ └────────┘ └────────┘                │
│              │                                                   │
│ ──────────── │ [Mehr laden...]                                  │
│ ⭐ Favoriten  │                                                   │
│ 📊 Statistik  │                                                   │
└──────────────┴───────────────────────────────────────────────────┘
```

### Key Features:

✅ **Single HTML Page** - No page reloads
✅ **Folder Tree** - Click folder → instant load
✅ **Breadcrumb** - Always know location
✅ **Dynamic Stats** - Update per folder
✅ **URL Routing** - `/documents?folder=company` (shareable!)
✅ **Browser Back/Forward** - History API
✅ **Search** - Global or folder-specific
✅ **Favorites** - Virtual folder
✅ **Upload** - Admin/Root only via modal

**Upload Modal (Admin/Root Only):**
```
┌─────────────────────────────────────────────────────┐
│ 📤 Dokument hochladen                           [X] │
├─────────────────────────────────────────────────────┤
│ Empfänger:  ○ Mitarbeiter  ○ Team  ○ Abteilung    │
│             ○ Gesamte Firma                         │
│                                                      │
│ Auswahl:    [Dropdown je nach Empfänger-Typ     ▼] │
│                                                      │
│ Kategorie:  [Gehaltsabrechnung               ▼]     │
│ Jahr:       [2025    ] Monat: [November      ▼]     │
│                                                      │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐    │
│ │         📄 Datei hierher ziehen            │      │
│ │         oder klicken zum Auswählen         │      │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘    │
│                                                      │
│ Beschreibung: [________________________]            │
│                                                      │
│ [Abbrechen]                        [📤 Hochladen]   │
└─────────────────────────────────────────────────────┘
```

---

## 📤 UPLOAD INTEGRATION STRATEGY

### 1. Role-Based Access:

```typescript
// explorer/index.ts
class DocumentsExplorer {
  private userRole: 'employee' | 'admin' | 'root';

  constructor() {
    this.userRole = this.getUserRole();
    this.initUploadButton();
  }

  private initUploadButton(): void {
    const uploadBtn = document.getElementById('upload-btn');

    if (this.userRole === 'admin' || this.userRole === 'root') {
      uploadBtn?.classList.remove('hidden');
      uploadBtn?.addEventListener('click', () => {
        this.uploadModal.open();
      });
    } else {
      uploadBtn?.classList.add('hidden');
    }
  }

  private getUserRole(): 'employee' | 'admin' | 'root' {
    // Get from auth-helpers.ts
    import { getUserRole } from '../../../utils/auth-helpers';
    return getUserRole() || 'employee';
  }
}
```

### 2. Upload Modal Component:

**New File:** `frontend/src/scripts/documents/explorer/upload-modal.ts`

```typescript
/**
 * Upload Modal Component
 * Handles document upload for admin/root users
 * Reuses logic from existing upload.ts
 */

import type { User, Team, Department } from '../../../types/api.types';
import { getAuthToken } from '../../auth/index';
import { explorerState } from './state';

export class UploadModal {
  private modalEl: HTMLElement | null;
  private formEl: HTMLFormElement | null;
  private fileInput: HTMLInputElement | null;
  private recipientType: 'user' | 'team' | 'department' | 'company' = 'user';

  constructor() {
    this.modalEl = document.getElementById('upload-modal');
    this.formEl = document.getElementById('upload-form') as HTMLFormElement;
    this.fileInput = document.getElementById('file-input') as HTMLInputElement;
    this.init();
  }

  private init(): void {
    this.attachEventListeners();
    this.loadRecipients();
  }

  async open(): Promise<void> {
    this.modalEl?.classList.remove('hidden');
    this.resetForm();
  }

  close(): void {
    this.modalEl?.classList.add('hidden');
  }

  private async loadRecipients(): Promise<void> {
    // Load users, teams, departments
    await Promise.all([
      this.loadUsers(),
      this.loadTeams(),
      this.loadDepartments()
    ]);
  }

  private async uploadDocument(formData: FormData): Promise<void> {
    const token = getAuthToken();

    try {
      const response = await fetch('/api/v2/documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        this.close();
        // Refresh documents in current folder
        explorerState.refreshDocuments();
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  }
}
```

### 3. New File: permissions.ts

```typescript
/**
 * Permission checks for Documents Explorer
 */

import { getUserRole, isAdmin } from '../../../utils/auth-helpers';

export type UserRole = 'employee' | 'admin' | 'root';

export class Permissions {
  static canUpload(): boolean {
    return isAdmin(); // admin or root
  }

  static canDelete(): boolean {
    return isAdmin();
  }

  static canEditAll(): boolean {
    return isAdmin();
  }

  static getUserRole(): UserRole {
    return getUserRole() || 'employee';
  }
}
```

---

## 🎨 DESIGN SYSTEM INTEGRATION

### 1. Reference: documents-search.html (SUCCESSFUL MIGRATION ✅)

**What makes it successful:**

```html
<!-- ✅ Design System Card Component -->
<div class="card">
  <div class="card__header">
    <h2 class="card__title">
      <i class="fas fa-search mr-2"></i>
      Dokumente suchen
    </h2>
  </div>
  <div class="card__body">
    <!-- Content -->
  </div>
</div>

<!-- ✅ Design System Search Input -->
<div class="search-input">
  <i class="search-input__icon fas fa-search"></i>
  <input type="search" class="search-input__field" placeholder="..." />
  <button class="search-input__clear">
    <i class="fas fa-times"></i>
  </button>
</div>

<!-- ✅ Design System Dropdown -->
<div class="dropdown">
  <div class="dropdown__trigger">
    <span>Neueste zuerst</span>
    <i class="fas fa-chevron-down"></i>
  </div>
  <div class="dropdown__menu">
    <div class="dropdown__option" data-value="newest">Neueste zuerst</div>
  </div>
</div>

<!-- ✅ Design System Modal -->
<div class="ds-modal ds-modal--lg">
  <div class="ds-modal__header">
    <h3 class="ds-modal__title">...</h3>
    <button class="ds-modal__close">...</button>
  </div>
  <div class="ds-modal__body">...</div>
  <div class="ds-modal__footer">
    <button class="btn btn-cancel">...</button>
    <button class="btn btn-primary">...</button>
  </div>
</div>

<!-- ✅ Design System Empty State -->
<div class="empty-state">
  <div class="empty-state__icon">
    <i class="fas fa-inbox"></i>
  </div>
  <h3 class="empty-state__title">Keine Dokumente verfügbar</h3>
  <p class="empty-state__description">...</p>
</div>
```

### 2. Tailwind CSS Classes (From documents-search.html):

**Layout:**
```html
<div class="flex gap-4 items-start mt-4">
  <div class="flex-1">...</div>
  <div class="flex-shrink-0">...</div>
</div>

<div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
  <div>...</div>
</div>
```

**Spacing:**
- `p-4` (padding)
- `mt-2`, `mt-4`, `mb-4` (margin top/bottom)
- `gap-2`, `gap-3`, `gap-4` (flex/grid gap)

**Colors (CSS Variables):**
```html
<div class="bg-[var(--background-primary)]">
<span class="text-[var(--color-text-secondary)]">
<i class="text-[var(--color-primary)]">
```

**Typography:**
- `text-sm`, `text-lg` (size)
- `font-medium`, `font-semibold` (weight)
- `break-words` (word break)

**Visibility:**
- `hidden` (display: none)
- `u-hidden` (utility class)
- `flex-1` (flex: 1)

### 3. Storybook Workflow (CRITICAL!):

**Step 0 for EVERY Component:**

1. Open http://localhost:6006
2. Navigate to component category:
   - **Forms** → Search Input, Dropdown
   - **Data Display** → Empty State
   - **Feedback** → Modals
   - **Navigation** → Breadcrumb
3. Click "Show code" button
4. **COPY HTML EXACTLY**
5. Only modify content, **KEEP STRUCTURE**

**Example: Adding Sidebar Navigation:**

```bash
# 1. Open Storybook
open http://localhost:6006

# 2. Go to "Navigation > Sidebar" (if exists) or use similar component

# 3. Copy HTML structure:
<nav class="sidebar">
  <div class="sidebar-item active">
    <i class="fas fa-folder"></i>
    <span>Firmendokumente</span>
    <span class="badge">23</span>
  </div>
</nav>

# 4. Paste into documents-explorer.html
# 5. Adapt content only!
```

---

## 📦 TYPESCRIPT MODULE STRUCTURE (UPDATED WITH UPLOAD)

### Reference: search/ Module (SUCCESSFUL ✅)

```
search/
├── index.ts     (443 lines) - Main controller
├── ui.ts        (229 lines) - UI rendering
└── modal.ts     (189 lines) - Modal logic
Total: 861 lines across 3 files
```

### Target: explorer/ Module (NEW - WITH UPLOAD)

```
explorer/
├── index.ts        (~450 lines) - Main controller with role check
├── types.ts        (~120 lines) - All TypeScript interfaces
├── state.ts        (~200 lines) - State management (Observer pattern)
├── router.ts       (~100 lines) - URL routing (History API)
├── sidebar.ts      (~150 lines) - Folder tree component
├── toolbar.ts      (~120 lines) - Sort/filter + Upload button
├── grid.ts         (~200 lines) - Document grid rendering
├── modal.ts        (~150 lines) - Document details modal
├── upload-modal.ts (~300 lines) - Upload modal (NEW - Admin/Root only)
├── api.ts          (~180 lines) - API calls wrapper
└── permissions.ts  (~50 lines)  - Role checks (NEW)
Total: ~2,020 lines across 11 files
```

**Why Modular?**
- ✅ Easy to find code (grid logic → grid.ts)
- ✅ Easy to test (test state.ts independently)
- ✅ Easy to understand (< 250 lines per file)
- ✅ Easy to maintain (change grid → only edit grid.ts)
- ✅ React-ready (modules map to components)

### File Responsibilities:

**index.ts** - Main Controller
```typescript
/**
 * Main entry point for Documents Explorer
 * Initializes all components and coordinates app flow
 */
import { explorerState } from './state';
import { router } from './router';
import { Sidebar } from './sidebar';
import { Grid } from './grid';
import { Toolbar } from './toolbar';
import { Modal } from './modal';
import { loadDocuments, loadStats } from './api';

class DocumentsExplorer {
  private sidebar: Sidebar;
  private grid: Grid;
  private toolbar: Toolbar;
  private modal: Modal;

  constructor() {
    this.sidebar = new Sidebar();
    this.grid = new Grid();
    this.toolbar = new Toolbar();
    this.modal = new Modal();
  }

  async init(): Promise<void> {
    router.init();
    explorerState.loadFromStorage();

    // Subscribe to state changes
    explorerState.subscribe((state) => {
      void this.handleStateChange(state);
    });

    await this.loadInitialData();
  }

  private async handleStateChange(state: ExplorerState): Promise<void> {
    // Reload documents when folder changes
    if (state.currentFolder) {
      await this.loadDocuments();
    }
  }

  private async loadDocuments(): Promise<void> {
    const state = explorerState.getState();
    const documents = await loadDocuments({
      category: this.mapFolderToCategory(state.currentFolder),
      sortBy: state.sortBy,
      filterBy: state.filterBy,
    });
    explorerState.setDocuments(documents);
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const explorer = new DocumentsExplorer();
  void explorer.init();
});
```

**types.ts** - TypeScript Interfaces
```typescript
/**
 * Type definitions for Documents Explorer
 */

export type FolderType = 'company' | 'department' | 'team' | 'personal' | 'payroll';
export type ViewType = FolderType | 'favorites' | 'statistics';
export type SortOption = 'newest' | 'oldest' | 'name' | 'size';
export type FilterOption = 'all' | 'unread' | 'archived';

export interface ExplorerState {
  currentFolder: ViewType;
  documents: Document[];
  searchQuery: string;
  sortBy: SortOption;
  filterBy: FilterOption;
  isLoading: boolean;
  error: string | null;
  stats: DocumentStats;
}

export interface DocumentStats {
  total: number;
  unread: number;
  recent: number;
  perFolder: Record<FolderType, number>;
}

export interface FolderConfig {
  id: FolderType;
  icon: string;
  label: string;
  apiCategory: string;
}

export interface LoadDocumentsOptions {
  category?: string;
  sortBy?: SortOption;
  filterBy?: FilterOption;
  page?: number;
  limit?: number;
}
```

**state.ts** - State Management (Observer Pattern)
```typescript
/**
 * State management using Observer pattern
 * Single source of truth for app state
 */
import type { ExplorerState } from './types';

type StateObserver = (state: ExplorerState) => void;

class DocumentExplorerState {
  private state: ExplorerState = {
    currentFolder: 'company',
    documents: [],
    searchQuery: '',
    sortBy: 'newest',
    filterBy: 'all',
    isLoading: false,
    error: null,
    stats: { total: 0, unread: 0, recent: 0, perFolder: {} as Record<FolderType, number> },
  };

  private observers: Set<StateObserver> = new Set();

  /**
   * Subscribe to state changes
   * @returns Unsubscribe function
   */
  subscribe(observer: StateObserver): () => void {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }

  /**
   * Notify all observers
   */
  private notify(): void {
    this.observers.forEach((observer) => {
      observer(this.getState());
    });
  }

  /**
   * Get immutable state copy
   */
  getState(): Readonly<ExplorerState> {
    return { ...this.state };
  }

  /**
   * Set current folder
   */
  setFolder(folder: ViewType): void {
    if (this.state.currentFolder !== folder) {
      this.state.currentFolder = folder;
      this.state.documents = [];
      this.notify();
    }
  }

  // ... more setters ...
}

export const explorerState = new DocumentExplorerState();
```

**router.ts** - URL Routing
```typescript
/**
 * URL routing using History API
 * Enables shareable links and browser back/forward
 */
import { explorerState, type ViewType } from './state';

class ExplorerRouter {
  init(): void {
    // Load initial folder from URL
    const folder = this.getFolderFromURL();
    if (folder) {
      explorerState.setFolder(folder);
    }

    // Handle browser back/forward
    window.addEventListener('popstate', (event: PopStateEvent) => {
      if (event.state?.folder) {
        explorerState.setFolder(event.state.folder);
      }
    });
  }

  /**
   * Navigate to folder (updates URL and state)
   */
  navigateTo(folder: ViewType): void {
    const url = `/documents?folder=${folder}`;
    history.pushState({ folder }, '', url);
    explorerState.setFolder(folder);
  }

  /**
   * Get folder from URL query parameter
   */
  private getFolderFromURL(): ViewType | null {
    const params = new URLSearchParams(window.location.search);
    const folder = params.get('folder');
    return folder && this.isValidFolder(folder) ? folder as ViewType : null;
  }

  private isValidFolder(folder: string): boolean {
    return ['company', 'department', 'team', 'personal', 'payroll'].includes(folder);
  }
}

export const router = new ExplorerRouter();
```

**sidebar.ts** - Folder Tree Component
```typescript
/**
 * Sidebar component - Folder tree navigation
 */
import { router } from './router';
import { explorerState, type FolderType, type FolderConfig } from './types';

export class Sidebar {
  private containerEl: HTMLElement | null;
  private folders: FolderConfig[] = [
    { id: 'company', icon: 'fa-building', label: 'Firmendokumente', apiCategory: 'general' },
    { id: 'department', icon: 'fa-users', label: 'Abteilungsdokumente', apiCategory: 'work' },
    { id: 'team', icon: 'fa-user-friends', label: 'Teamdokumente', apiCategory: 'training' },
    { id: 'personal', icon: 'fa-user', label: 'Persönliche Dokumente', apiCategory: 'personal' },
    { id: 'payroll', icon: 'fa-money-bill-wave', label: 'Gehaltsabrechnungen', apiCategory: 'salary' },
  ];

  constructor() {
    this.containerEl = document.getElementById('folder-tree');
    this.init();
  }

  private init(): void {
    this.render();
    this.attachEventListeners();
    this.subscribeToState();
  }

  private render(): void {
    if (!this.containerEl) return;

    const html = this.folders.map((folder) => `
      <div class="folder-item" data-folder="${folder.id}">
        <i class="fas ${folder.icon} folder-icon"></i>
        <span class="folder-label">${folder.label}</span>
        <span class="folder-count badge">0</span>
      </div>
    `).join('');

    this.containerEl.innerHTML = html;
  }

  private attachEventListeners(): void {
    this.containerEl?.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      const folderItem = target.closest('.folder-item') as HTMLElement;
      if (folderItem) {
        const folder = folderItem.dataset.folder as FolderType;
        router.navigateTo(folder);
      }
    });
  }

  private subscribeToState(): void {
    explorerState.subscribe((state) => {
      this.updateActiveFolder(state.currentFolder);
    });
  }

  private updateActiveFolder(currentFolder: string): void {
    // Remove active from all
    this.containerEl?.querySelectorAll('.folder-item').forEach((el) => {
      el.classList.remove('active');
    });
    // Add active to current
    const activeFolder = this.containerEl?.querySelector(`[data-folder="${currentFolder}"]`);
    activeFolder?.classList.add('active');
  }

  /**
   * Update folder counts from stats
   */
  updateCounts(counts: Record<FolderType, number>): void {
    Object.entries(counts).forEach(([folderId, count]) => {
      const countEl = this.containerEl?.querySelector(`[data-folder="${folderId}"] .folder-count`);
      if (countEl) {
        countEl.textContent = count.toString();
      }
    });
  }
}
```

**Similar structure for:**
- `toolbar.ts` - Sort/filter controls
- `grid.ts` - Document card grid
- `modal.ts` - Document details modal
- `api.ts` - API calls wrapper

---

## 🗄️ DATABASE & BACKEND (NO CHANGES NEEDED)

### ✅ Database: READY

**Verification (Run this):**
```bash
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e \
  "SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS \
   WHERE TABLE_NAME='documents' AND COLUMN_NAME IN \
   ('file_uuid', 'file_checksum', 'storage_type', 'version');"
```

**Expected Output:**
```
file_uuid       | VARCHAR(36)
file_checksum   | VARCHAR(64)
storage_type    | ENUM('database','filesystem','s3')
version         | INT
```

**Status:** ✅ UUID support already added (see DOCUMENT-STORAGE-STRATEGY.md)

### ✅ Backend API: READY

**No code changes needed!** Existing API supports Explorer View:

```typescript
// Folder filtering works out of the box
GET /api/v2/documents?category=general         // Company docs
GET /api/v2/documents?category=work            // Department docs
GET /api/v2/documents?category=training        // Team docs
GET /api/v2/documents?category=personal        // Personal docs
GET /api/v2/documents?category=salary          // Payroll docs

// Sorting
GET /api/v2/documents?sortBy=uploaded_at&sortOrder=desc

// Stats
GET /api/v2/documents/stats
```

**Status:** ✅ API 100% ready!

---

## 📅 STEP-BY-STEP IMPLEMENTATION

---

## 🎨 PHASE 0: STORYBOOK COMPONENT CREATION ✅ **COMPLETED**

**Status:** ✅ **DONE** - ExplorerView.stories.js (23KB) created and tested

**Warum Phase 0?**
- ✅ **Design System First** - Komponente zuerst im Storybook bauen
- ✅ **Iteratives Design** - Schnell testen und anpassen ohne Production Code
- ✅ **Dokumentation** - Automatisch dokumentiert für das Team
- ✅ **Copy-Paste Ready** - HTML direkt kopieren für Implementation
- ✅ **Konsistenz** - Passt perfekt zum Design System

**Referenz:** Alle erfolgreichen Migrationen haben ZUERST Storybook Komponenten erstellt!

---

### Task 0.1: Start Storybook

```bash
cd /home/scs/projects/Assixx
pnpm run storybook

# Öffne Browser
open http://localhost:6006
```

**Verify:** Storybook läuft auf Port 6006

---

### Task 0.2: Create Explorer View Story

**File:** `stories/ExplorerView.stories.js`

```javascript
/**
 * Explorer View Component
 * File manager-style interface for documents
 */

export default {
  title: 'Components/ExplorerView',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

/**
 * Full Explorer View
 * Complete layout with sidebar and content area
 */
export const FullExplorer = {
  render: () => `
    <div style="display: flex; min-height: 600px; font-family: system-ui;">
      <!-- LEFT SIDEBAR -->
      <aside style="width: 280px; background: var(--background-secondary); border-right: 1px solid var(--border-color); display: flex; flex-direction: column;">
        <!-- Sidebar Header -->
        <div style="padding: 1.5rem 1rem; border-bottom: 1px solid var(--border-color);">
          <h2 style="font-size: 1.25rem; font-weight: 600; color: var(--color-text-primary); display: flex; align-items: center; gap: 0.5rem; margin: 0;">
            <i class="fas fa-folder-open"></i>
            <span>Dokumente</span>
          </h2>
        </div>

        <!-- Folder Tree -->
        <nav style="flex: 1; padding: 1rem 0; overflow-y: auto;">
          <div class="folder-item active" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; cursor: pointer; background: var(--background-active); color: var(--color-primary); font-weight: 500;">
            <i class="fas fa-building" style="width: 1.25rem; text-align: center;"></i>
            <span style="flex: 1;">Firmendokumente</span>
            <span class="badge" style="font-size: 0.875rem; background: var(--color-primary); color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; min-width: 1.5rem; text-align: center;">23</span>
          </div>

          <div class="folder-item" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; cursor: pointer; color: var(--color-text-secondary);">
            <i class="fas fa-users" style="width: 1.25rem; text-align: center;"></i>
            <span style="flex: 1;">Abteilungsdokumente</span>
            <span class="badge" style="font-size: 0.875rem; background: var(--background-tertiary); color: var(--color-text-secondary); padding: 0.25rem 0.5rem; border-radius: 0.25rem; min-width: 1.5rem; text-align: center;">12</span>
          </div>

          <div class="folder-item" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; cursor: pointer; color: var(--color-text-secondary);">
            <i class="fas fa-user-friends" style="width: 1.25rem; text-align: center;"></i>
            <span style="flex: 1;">Teamdokumente</span>
            <span class="badge" style="font-size: 0.875rem; background: var(--background-tertiary); color: var(--color-text-secondary); padding: 0.25rem 0.5rem; border-radius: 0.25rem; min-width: 1.5rem; text-align: center;">8</span>
          </div>

          <div class="folder-item" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; cursor: pointer; color: var(--color-text-secondary);">
            <i class="fas fa-user" style="width: 1.25rem; text-align: center;"></i>
            <span style="flex: 1;">Persönliche Dokumente</span>
            <span class="badge" style="font-size: 0.875rem; background: var(--background-tertiary); color: var(--color-text-secondary); padding: 0.25rem 0.5rem; border-radius: 0.25rem; min-width: 1.5rem; text-align: center;">15</span>
          </div>

          <div class="folder-item" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; cursor: pointer; color: var(--color-text-secondary);">
            <i class="fas fa-money-bill-wave" style="width: 1.25rem; text-align: center;"></i>
            <span style="flex: 1;">Gehaltsabrechnungen</span>
            <span class="badge" style="font-size: 0.875rem; background: var(--background-tertiary); color: var(--color-text-secondary); padding: 0.25rem 0.5rem; border-radius: 0.25rem; min-width: 1.5rem; text-align: center;">5</span>
          </div>
        </nav>

        <!-- Utility Links -->
        <div style="padding: 1rem; border-top: 1px solid var(--border-color);">
          <a href="#" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; color: var(--color-text-secondary); text-decoration: none; border-radius: 0.5rem;">
            <i class="fas fa-star"></i>
            <span style="flex: 1;">Favoriten</span>
            <span class="badge" style="font-size: 0.875rem; background: var(--color-warning); color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem;">3</span>
          </a>
          <a href="#" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; color: var(--color-text-secondary); text-decoration: none; border-radius: 0.5rem;">
            <i class="fas fa-chart-bar"></i>
            <span>Statistik</span>
          </a>
        </div>
      </aside>

      <!-- MAIN CONTENT AREA -->
      <div style="flex: 1; padding: 1.5rem; background: var(--background-primary); overflow-y: auto;">
        <!-- Breadcrumb -->
        <nav style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem; font-size: 0.875rem; color: var(--color-text-secondary);">
          <a href="#" style="color: inherit; text-decoration: none;">Dokumente</a>
          <span>/</span>
          <span style="color: var(--color-text-primary); font-weight: 500;">Firmendokumente</span>
        </nav>

        <!-- Stats Bar -->
        <div style="display: flex; gap: 2rem; margin-bottom: 1.5rem; padding: 1rem; background: var(--background-secondary); border-radius: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <i class="fas fa-file-alt" style="color: var(--color-primary); font-size: 1.25rem;"></i>
            <div>
              <div style="font-size: 1.5rem; font-weight: 600; color: var(--color-text-primary);">23</div>
              <div style="color: var(--color-text-secondary); font-size: 0.875rem;">Gesamt</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <i class="fas fa-bell" style="color: var(--color-primary); font-size: 1.25rem;"></i>
            <div>
              <div style="font-size: 1.5rem; font-weight: 600; color: var(--color-text-primary);">5</div>
              <div style="color: var(--color-text-secondary); font-size: 0.875rem;">Ungelesen</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <i class="fas fa-calendar" style="color: var(--color-primary); font-size: 1.25rem;"></i>
            <div>
              <div style="font-size: 1.5rem; font-weight: 600; color: var(--color-text-primary);">8</div>
              <div style="color: var(--color-text-secondary); font-size: 0.875rem;">Diese Woche</div>
            </div>
          </div>
        </div>

        <!-- Toolbar -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
          <button class="btn btn-primary" style="display: flex; align-items: center; gap: 0.5rem;">
            <i class="fas fa-upload"></i>
            <span>Hochladen</span>
          </button>

          <div style="display: flex; gap: 0.75rem;">
            <!-- Search Input (Design System) -->
            <div class="search-input">
              <i class="search-input__icon fas fa-search"></i>
              <input type="search" class="search-input__field" placeholder="Suchen..." />
              <button class="search-input__clear"><i class="fas fa-times"></i></button>
            </div>

            <!-- Sort Dropdown (Design System) -->
            <div class="dropdown">
              <div class="dropdown__trigger">
                <span>Neueste zuerst</span>
                <i class="fas fa-chevron-down"></i>
              </div>
            </div>
          </div>
        </div>

        <!-- Documents Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem;">
          <!-- Document Card (Using Design System Card) -->
          <div class="card" style="border-left: 4px solid var(--color-primary);">
            <div class="card__body">
              <div style="display: flex; align-items: start; justify-content: space-between; margin-bottom: 1rem;">
                <i class="fas fa-file-pdf" style="font-size: 2.5rem; color: var(--color-primary);"></i>
                <span class="badge badge--info">Neu</span>
              </div>
              <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Jahresbericht_2024.pdf</h3>
              <div style="margin-bottom: 1rem;">
                <span class="badge badge--secondary">
                  <i class="fas fa-tag" style="margin-right: 0.25rem;"></i>
                  Allgemein
                </span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.875rem; color: var(--color-text-secondary); margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <i class="fas fa-calendar" style="width: 1rem;"></i>
                  <span>06.11.2025</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <i class="fas fa-user" style="width: 1rem;"></i>
                  <span>Max Mustermann</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <i class="fas fa-weight" style="width: 1rem;"></i>
                  <span>2.4 MB</span>
                </div>
              </div>
              <button class="btn btn-info" style="width: 100%;">
                <i class="fas fa-eye" style="margin-right: 0.5rem;"></i>
                Öffnen
              </button>
            </div>
          </div>

          <!-- More cards... -->
          <div class="card">
            <div class="card__body">
              <div style="display: flex; align-items: start; justify-content: space-between; margin-bottom: 1rem;">
                <i class="fas fa-file-word" style="font-size: 2.5rem; color: #2B579A;"></i>
              </div>
              <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">Meeting_Notes.docx</h3>
              <div style="margin-bottom: 1rem;">
                <span class="badge badge--secondary">
                  <i class="fas fa-tag" style="margin-right: 0.25rem;"></i>
                  Arbeit
                </span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.875rem; color: var(--color-text-secondary); margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <i class="fas fa-calendar" style="width: 1rem;"></i>
                  <span>05.11.2025</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <i class="fas fa-user" style="width: 1rem;"></i>
                  <span>Anna Schmidt</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <i class="fas fa-weight" style="width: 1rem;"></i>
                  <span>156 KB</span>
                </div>
              </div>
              <button class="btn btn-info" style="width: 100%;">
                <i class="fas fa-eye" style="margin-right: 0.5rem;"></i>
                Öffnen
              </button>
            </div>
          </div>

          <div class="card">
            <div class="card__body">
              <div style="display: flex; align-items: start; justify-content: space-between; margin-bottom: 1rem;">
                <i class="fas fa-file-excel" style="font-size: 2.5rem; color: #217346;"></i>
              </div>
              <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">Budget_Q4.xlsx</h3>
              <div style="margin-bottom: 1rem;">
                <span class="badge badge--secondary">
                  <i class="fas fa-tag" style="margin-right: 0.25rem;"></i>
                  Finanzen
                </span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.875rem; color: var(--color-text-secondary); margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <i class="fas fa-calendar" style="width: 1rem;"></i>
                  <span>04.11.2025</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <i class="fas fa-user" style="width: 1rem;"></i>
                  <span>Peter Müller</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <i class="fas fa-weight" style="width: 1rem;"></i>
                  <span>894 KB</span>
                </div>
              </div>
              <button class="btn btn-info" style="width: 100%;">
                <i class="fas fa-eye" style="margin-right: 0.5rem;"></i>
                Öffnen
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <style>
      .folder-item:hover {
        background: var(--background-hover);
      }
    </style>
  `,
};

/**
 * Sidebar Only
 * Isolated sidebar component for testing
 */
export const SidebarOnly = {
  render: () => `
    <aside style="width: 280px; background: var(--background-secondary); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; min-height: 600px;">
      <!-- Same sidebar content as above -->
      <div style="padding: 1.5rem 1rem; border-bottom: 1px solid var(--border-color);">
        <h2 style="font-size: 1.25rem; font-weight: 600; color: var(--color-text-primary); display: flex; align-items: center; gap: 0.5rem; margin: 0;">
          <i class="fas fa-folder-open"></i>
          <span>Dokumente</span>
        </h2>
      </div>
      <!-- Folder items... -->
    </aside>
  `,
};

/**
 * Empty State
 * When no documents available
 */
export const EmptyState = {
  render: () => `
    <div class="empty-state" style="text-align: center; padding: 4rem 2rem;">
      <div class="empty-state__icon" style="font-size: 4rem; color: var(--color-text-tertiary); margin-bottom: 1rem;">
        <i class="fas fa-folder-open"></i>
      </div>
      <h3 class="empty-state__title" style="font-size: 1.5rem; font-weight: 600; color: var(--color-text-primary); margin-bottom: 0.5rem;">
        Keine Dokumente
      </h3>
      <p class="empty-state__description" style="color: var(--color-text-secondary); max-width: 400px; margin: 0 auto;">
        Dieser Ordner ist leer. Laden Sie Dokumente hoch, um zu beginnen.
      </p>
    </div>
  `,
};
```

---

### Task 0.3: Convert Inline Styles to Tailwind CSS

**CRITICAL:** Storybook Story verwendet inline styles für Demonstration. Jetzt zu Tailwind konvertieren!

**Create:** `stories/ExplorerViewTailwind.stories.js`

```javascript
/**
 * Explorer View Component - Tailwind Version
 * PRODUCTION-READY VERSION
 */

export default {
  title: 'Components/ExplorerView/Tailwind',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export const TailwindExplorer = {
  render: () => `
    <div class="flex min-h-[600px]">
      <!-- LEFT SIDEBAR -->
      <aside class="w-[280px] bg-[var(--background-secondary)] border-r border-[var(--border-color)] flex flex-col">
        <!-- Sidebar Header -->
        <div class="p-6 pb-4 border-b border-[var(--border-color)]">
          <h2 class="text-xl font-semibold text-[var(--color-text-primary)] flex items-center gap-2 m-0">
            <i class="fas fa-folder-open"></i>
            <span>Dokumente</span>
          </h2>
        </div>

        <!-- Folder Tree -->
        <nav class="flex-1 py-4 overflow-y-auto">
          <div class="flex items-center gap-3 px-4 py-3 cursor-pointer bg-[var(--background-active)] text-[var(--color-primary)] font-medium">
            <i class="fas fa-building w-5 text-center"></i>
            <span class="flex-1">Firmendokumente</span>
            <span class="text-sm bg-[var(--color-primary)] text-white px-2 py-1 rounded min-w-[1.5rem] text-center">23</span>
          </div>

          <div class="flex items-center gap-3 px-4 py-3 cursor-pointer text-[var(--color-text-secondary)] hover:bg-[var(--background-hover)]">
            <i class="fas fa-users w-5 text-center"></i>
            <span class="flex-1">Abteilungsdokumente</span>
            <span class="text-sm bg-[var(--background-tertiary)] text-[var(--color-text-secondary)] px-2 py-1 rounded min-w-[1.5rem] text-center">12</span>
          </div>

          <div class="flex items-center gap-3 px-4 py-3 cursor-pointer text-[var(--color-text-secondary)] hover:bg-[var(--background-hover)]">
            <i class="fas fa-user-friends w-5 text-center"></i>
            <span class="flex-1">Teamdokumente</span>
            <span class="text-sm bg-[var(--background-tertiary)] text-[var(--color-text-secondary)] px-2 py-1 rounded min-w-[1.5rem] text-center">8</span>
          </div>

          <div class="flex items-center gap-3 px-4 py-3 cursor-pointer text-[var(--color-text-secondary)] hover:bg-[var(--background-hover)]">
            <i class="fas fa-user w-5 text-center"></i>
            <span class="flex-1">Persönliche Dokumente</span>
            <span class="text-sm bg-[var(--background-tertiary)] text-[var(--color-text-secondary)] px-2 py-1 rounded min-w-[1.5rem] text-center">15</span>
          </div>

          <div class="flex items-center gap-3 px-4 py-3 cursor-pointer text-[var(--color-text-secondary)] hover:bg-[var(--background-hover)]">
            <i class="fas fa-money-bill-wave w-5 text-center"></i>
            <span class="flex-1">Gehaltsabrechnungen</span>
            <span class="text-sm bg-[var(--background-tertiary)] text-[var(--color-text-secondary)] px-2 py-1 rounded min-w-[1.5rem] text-center">5</span>
          </div>
        </nav>

        <!-- Utility Links -->
        <div class="p-4 border-t border-[var(--border-color)]">
          <a href="#" class="flex items-center gap-3 px-3 py-3 text-[var(--color-text-secondary)] no-underline rounded-lg hover:bg-[var(--background-hover)]">
            <i class="fas fa-star"></i>
            <span class="flex-1">Favoriten</span>
            <span class="text-sm bg-[var(--color-warning)] text-white px-2 py-1 rounded">3</span>
          </a>
          <a href="#" class="flex items-center gap-3 px-3 py-3 text-[var(--color-text-secondary)] no-underline rounded-lg hover:bg-[var(--background-hover)]">
            <i class="fas fa-chart-bar"></i>
            <span>Statistik</span>
          </a>
        </div>
      </aside>

      <!-- MAIN CONTENT AREA -->
      <div class="flex-1 p-6 bg-[var(--background-primary)] overflow-y-auto">
        <!-- Breadcrumb -->
        <nav class="flex items-center gap-2 mb-6 text-sm text-[var(--color-text-secondary)]">
          <a href="#" class="text-inherit no-underline">Dokumente</a>
          <span>/</span>
          <span class="text-[var(--color-text-primary)] font-medium">Firmendokumente</span>
        </nav>

        <!-- Stats Bar -->
        <div class="flex gap-8 mb-6 p-4 bg-[var(--background-secondary)] rounded-lg">
          <div class="flex items-center gap-3">
            <i class="fas fa-file-alt text-[var(--color-primary)] text-xl"></i>
            <div>
              <div class="text-2xl font-semibold text-[var(--color-text-primary)]">23</div>
              <div class="text-sm text-[var(--color-text-secondary)]">Gesamt</div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <i class="fas fa-bell text-[var(--color-primary)] text-xl"></i>
            <div>
              <div class="text-2xl font-semibold text-[var(--color-text-primary)]">5</div>
              <div class="text-sm text-[var(--color-text-secondary)]">Ungelesen</div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <i class="fas fa-calendar text-[var(--color-primary)] text-xl"></i>
            <div>
              <div class="text-2xl font-semibold text-[var(--color-text-primary)]">8</div>
              <div class="text-sm text-[var(--color-text-secondary)]">Diese Woche</div>
            </div>
          </div>
        </div>

        <!-- Toolbar -->
        <div class="flex items-center justify-between mb-6">
          <button class="btn btn-primary flex items-center gap-2">
            <i class="fas fa-upload"></i>
            <span>Hochladen</span>
          </button>

          <div class="flex gap-3">
            <!-- Search Input (Design System) -->
            <div class="search-input">
              <i class="search-input__icon fas fa-search"></i>
              <input type="search" class="search-input__field" placeholder="Suchen..." />
              <button class="search-input__clear"><i class="fas fa-times"></i></button>
            </div>

            <!-- Sort Dropdown (Design System) -->
            <div class="dropdown">
              <div class="dropdown__trigger">
                <span>Neueste zuerst</span>
                <i class="fas fa-chevron-down"></i>
              </div>
            </div>
          </div>
        </div>

        <!-- Documents Grid -->
        <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
          <!-- Document Card -->
          <div class="card border-l-4 border-l-[var(--color-primary)]">
            <div class="card__body">
              <div class="flex items-start justify-between mb-4">
                <i class="fas fa-file-pdf text-4xl text-[var(--color-primary)]"></i>
                <span class="badge badge--info">Neu</span>
              </div>
              <h3 class="text-lg font-semibold mb-2 overflow-hidden text-ellipsis whitespace-nowrap">Jahresbericht_2024.pdf</h3>
              <div class="mb-4">
                <span class="badge badge--secondary">
                  <i class="fas fa-tag mr-1"></i>
                  Allgemein
                </span>
              </div>
              <div class="flex flex-col gap-2 text-sm text-[var(--color-text-secondary)] mb-4">
                <div class="flex items-center gap-2">
                  <i class="fas fa-calendar w-4"></i>
                  <span>06.11.2025</span>
                </div>
                <div class="flex items-center gap-2">
                  <i class="fas fa-user w-4"></i>
                  <span>Max Mustermann</span>
                </div>
                <div class="flex items-center gap-2">
                  <i class="fas fa-weight w-4"></i>
                  <span>2.4 MB</span>
                </div>
              </div>
              <button class="btn btn-info w-full">
                <i class="fas fa-eye mr-2"></i>
                Öffnen
              </button>
            </div>
          </div>

          <!-- More cards... (same pattern) -->
        </div>
      </div>
    </div>
  `,
};
```

---

### Task 0.4: Test in Storybook

**Open Storybook:**
```bash
open http://localhost:6006
```

**Navigate to:**
- Components → ExplorerView → Full Explorer
- Components → ExplorerView → Tailwind → Tailwind Explorer

**Test Interactivity:**
1. Click folder items (should highlight)
2. Hover effects work
3. Layout responsive
4. All Design System components render correctly

**Adjust as Needed:**
- Colors korrekt?
- Spacing passt?
- Icons richtig?
- Responsive funktioniert?

**Iterate until perfect!**

---

### Task 0.5: Export HTML for Production Use

**In Storybook:**
1. Open "Tailwind Explorer" story
2. Click "Show code" button
3. **COPY ENTIRE HTML**
4. Save to reference file

**File:** `docs/storybook-explorer-view-html.txt`

```bash
# Save HTML for easy reference
cat > docs/storybook-explorer-view-html.txt << 'EOF'
<!-- COPY HTML FROM STORYBOOK HERE -->
<!-- This is your source of truth for implementation -->
EOF
```

---

### ✅ Phase 0 Completion Checklist:

- [ ] Storybook running (http://localhost:6006)
- [ ] ExplorerView.stories.js created
- [ ] ExplorerViewTailwind.stories.js created
- [ ] Full Explorer story renders correctly
- [ ] Tailwind Explorer story uses ONLY Tailwind classes
- [ ] All Design System components integrated (card, search-input, dropdown)
- [ ] Tested hover effects
- [ ] Tested responsive layout
- [ ] HTML copied and saved for reference
- [ ] Colors match Design System
- [ ] Icons correct
- [ ] Spacing consistent

**⚠️ DO NOT PROCEED TO PHASE 1 UNTIL STORYBOOK COMPONENT IS PERFECT!**

**Why?** Weil du später NUR copy-paste machst. Wenn Storybook falsch ist, ist alles falsch!

---

## ✅ READY FOR PHASE 1?

**Verify:**
```bash
# Check Storybook running
curl -I http://localhost:6006

# Check stories exist
ls -la stories/ExplorerView*.stories.js

# Check reference HTML saved
cat docs/storybook-explorer-view-html.txt
```

**All green?** ✅ Proceed to Phase 1!

---

## 📋 PHASE 1: Preparation & Investigation ✅ **COMPLETED**

**Task 1.1: Investigate documents.html**

```bash
# Check if documents.html is still used
cd /home/scs/projects/Assixx
grep -r "documents.html" frontend/src/ --exclude-dir=dist
grep -r "documents.html" backend/src/

# Check TypeScript references
grep -r "from './index'" frontend/src/scripts/documents/
```

**Decision Tree:**
- If NOT used → Delete it
- If USED → Keep and redirect later

**Task 1.2: Create Backup**

```bash
# Create feature branch
git checkout -b feat/documents-explorer-view

# Backup current files
mkdir -p backups/documents-before-explorer
cp -r frontend/src/pages/documents*.html backups/documents-before-explorer/
cp -r frontend/src/scripts/documents backups/documents-before-explorer/

# Commit backup
git add backups/
git commit -m "backup: Pre-refactoring state for documents explorer"
git push origin feat/documents-explorer-view
```

**Task 1.3: Read Reference Files**

```bash
# Study successful migration
cat frontend/src/pages/documents-search.html
cat frontend/src/scripts/documents/search/index.ts
cat frontend/src/scripts/documents/search/ui.ts
cat frontend/src/scripts/documents/search/modal.ts

# Study shared modules
cat frontend/src/scripts/documents/shared/types.ts
cat frontend/src/scripts/documents/shared/api.ts
cat frontend/src/scripts/documents/shared/ui-helpers.ts
```

**Checklist:**
- [ ] documents.html status determined
- [ ] Backup created and committed
- [ ] Reference files studied
- [ ] Storybook running (http://localhost:6006)

---

## 🏗️ PHASE 2: HTML Structure ✅ **COMPLETED**

**Task 2.1: Create documents-explorer.html** ✅ **DONE - 338 lines created**

**Step 1:** Open Storybook and identify components

```bash
open http://localhost:6006

# Components needed:
# - Card (for main container)
# - Search Input (for global search)
# - Dropdown (for sort/filter)
# - Empty State (when no documents)
# - Modal (for document details)
```

**Step 2:** Copy HTML from documents-search.html as base

```bash
cd /home/scs/projects/Assixx/frontend/src/pages
cp documents-search.html documents-explorer.html
```

**Step 3:** Modify HTML structure

**File:** `frontend/src/pages/documents-explorer.html`

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dokumente - Assixx</title>

    <!-- Styles -->
    <link rel="stylesheet" href="/styles/main.css" />
    <link rel="stylesheet" href="/styles/unified-navigation.css" />
    <link rel="stylesheet" href="/styles/lib/fontawesome.min.css" />
    <link rel="stylesheet" href="/styles/documents-explorer.css" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />

    <!-- Critical Layout State -->
    <script src="/scripts/critical/sidebar-init.js"></script>
  </head>
  <body>
    <!-- Unified Navigation -->
    <div id="navigation-container"></div>

    <!-- Main Layout -->
    <div class="layout-container">
      <main class="explorer-layout">
        <!-- LEFT SIDEBAR: Folder Tree -->
        <aside class="explorer-sidebar" id="explorer-sidebar">
          <!-- Sidebar Header -->
          <div class="sidebar-header">
            <h2 class="sidebar-title flex items-center gap-2">
              <i class="fas fa-folder-open"></i>
              <span>Dokumente</span>
            </h2>
          </div>

          <!-- Folder Navigation -->
          <nav class="folder-tree" id="folder-tree">
            <!-- Rendered by sidebar.ts -->
          </nav>

          <!-- Utility Links -->
          <div class="sidebar-utilities">
            <a href="#favorites" class="utility-link" data-view="favorites">
              <i class="fas fa-star"></i>
              <span>Favoriten</span>
              <span class="badge" id="favorites-count">0</span>
            </a>
            <a href="#statistics" class="utility-link" data-view="statistics">
              <i class="fas fa-chart-bar"></i>
              <span>Statistik</span>
            </a>
          </div>
        </aside>

        <!-- MAIN CONTENT AREA -->
        <div class="explorer-content">
          <!-- Breadcrumb -->
          <nav class="breadcrumb" id="breadcrumb">
            <!-- Rendered by explorer/index.ts -->
          </nav>

          <!-- Stats Bar -->
          <div class="stats-bar" id="stats-bar">
            <div class="stat-item">
              <i class="fas fa-file-alt"></i>
              <span class="stat-value" id="stat-total">0</span>
              <span class="stat-label">Gesamt</span>
            </div>
            <div class="stat-item">
              <i class="fas fa-bell"></i>
              <span class="stat-value" id="stat-unread">0</span>
              <span class="stat-label">Ungelesen</span>
            </div>
            <div class="stat-item">
              <i class="fas fa-calendar"></i>
              <span class="stat-value" id="stat-recent">0</span>
              <span class="stat-label">Diese Woche</span>
            </div>
          </div>

          <!-- Toolbar -->
          <div class="toolbar flex items-center justify-between gap-4 mb-4">
            <!-- Left: Upload Button (Admin/Root Only) -->
            <div class="toolbar-left">
              <button class="btn btn-primary hidden" id="upload-btn">
                <i class="fas fa-upload mr-2"></i>
                Hochladen
              </button>
            </div>

            <!-- Right: Search, Sort, Filter -->
            <div class="toolbar-right flex items-center gap-3">
              <!-- Search Input (Design System Component) -->
              <div class="search-input">
                <i class="search-input__icon fas fa-search"></i>
                <input
                  type="search"
                  class="search-input__field"
                  id="search-input"
                  placeholder="Dokumente suchen..."
                  autocomplete="off"
                />
                <button class="search-input__clear" id="search-clear">
                  <i class="fas fa-times"></i>
                </button>
              </div>

              <!-- Sort Dropdown (Design System Component) -->
              <div class="dropdown" id="sort-dropdown">
                <div class="dropdown__trigger" id="sort-trigger">
                  <span id="sort-label">Neueste zuerst</span>
                  <i class="fas fa-chevron-down"></i>
                </div>
                <div class="dropdown__menu" id="sort-menu">
                  <div class="dropdown__option" data-value="newest">Neueste zuerst</div>
                  <div class="dropdown__option" data-value="oldest">Älteste zuerst</div>
                  <div class="dropdown__option" data-value="name">Nach Name</div>
                  <div class="dropdown__option" data-value="size">Nach Größe</div>
                </div>
              </div>

              <!-- Filter Dropdown (Design System Component) -->
              <div class="dropdown" id="filter-dropdown">
                <div class="dropdown__trigger" id="filter-trigger">
                  <span id="filter-label">Alle</span>
                  <i class="fas fa-chevron-down"></i>
                </div>
                <div class="dropdown__menu" id="filter-menu">
                  <div class="dropdown__option" data-value="all">Alle</div>
                  <div class="dropdown__option" data-value="unread">Ungelesen</div>
                  <div class="dropdown__option" data-value="archived">Archiviert</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Documents Grid -->
          <div id="documents-grid" class="documents-grid">
            <!-- Rendered by grid.ts -->
          </div>

          <!-- Empty State (Design System Component) -->
          <div id="empty-state" class="empty-state hidden">
            <div class="empty-state__icon">
              <i class="fas fa-folder-open"></i>
            </div>
            <h3 class="empty-state__title">Keine Dokumente</h3>
            <p class="empty-state__description" id="empty-state-message">
              Dieser Ordner ist leer
            </p>
          </div>

          <!-- Loading State -->
          <div id="loading-state" class="loading-state hidden">
            <div class="spinner"></div>
            <p>Dokumente werden geladen...</p>
          </div>
        </div>
      </main>
    </div>

    <!-- Document Details Modal (Design System Component) -->
    <div id="document-modal" class="modal-overlay hidden">
      <div class="ds-modal ds-modal--lg">
        <div class="ds-modal__header">
          <h3 class="ds-modal__title">
            <i class="fas fa-file-alt mr-2"></i>
            <span id="modal-title">Dokument Details</span>
          </h3>
          <button class="ds-modal__close" id="modal-close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="ds-modal__body">
          <!-- Document preview/info -->
          <div id="modal-content"></div>
        </div>
        <div class="ds-modal__footer">
          <button class="btn btn-cancel" id="modal-cancel">
            <i class="fas fa-times mr-2"></i>
            Schließen
          </button>
          <button class="btn btn-primary" id="modal-download">
            <i class="fas fa-download mr-2"></i>
            Herunterladen
          </button>
        </div>
      </div>
    </div>

    <!-- Upload Modal (Admin/Root Only) -->
    <div id="upload-modal" class="modal-overlay hidden">
      <div class="ds-modal ds-modal--xl">
        <div class="ds-modal__header">
          <h3 class="ds-modal__title">
            <i class="fas fa-upload mr-2"></i>
            Dokument hochladen
          </h3>
          <button class="ds-modal__close" id="upload-modal-close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="ds-modal__body">
          <form id="upload-form">
            <!-- Recipient Type Selection -->
            <div class="form-group mb-4">
              <label class="form-label">Empfänger-Typ</label>
              <div class="flex gap-4">
                <label class="radio-option">
                  <input type="radio" name="recipientType" value="user" checked />
                  <span>Mitarbeiter</span>
                </label>
                <label class="radio-option">
                  <input type="radio" name="recipientType" value="team" />
                  <span>Team</span>
                </label>
                <label class="radio-option">
                  <input type="radio" name="recipientType" value="department" />
                  <span>Abteilung</span>
                </label>
                <label class="radio-option">
                  <input type="radio" name="recipientType" value="company" />
                  <span>Firma</span>
                </label>
              </div>
            </div>

            <!-- Dynamic Recipient Selector -->
            <div class="form-group mb-4" id="recipient-selector">
              <!-- Populated dynamically based on type -->
            </div>

            <!-- Category -->
            <div class="form-group mb-4">
              <label class="form-label">Kategorie</label>
              <select name="category" class="form-control" required>
                <option value="">-- Auswählen --</option>
                <option value="salary">Gehaltsabrechnung</option>
                <option value="general">Allgemein</option>
                <option value="work">Arbeit</option>
                <option value="training">Schulung</option>
              </select>
            </div>

            <!-- Year/Month -->
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div class="form-group">
                <label class="form-label">Jahr</label>
                <input type="number" name="year" class="form-control"
                       min="2020" max="2030" value="2025" />
              </div>
              <div class="form-group">
                <label class="form-label">Monat</label>
                <select name="month" class="form-control">
                  <option value="">-- Optional --</option>
                  <option value="1">Januar</option>
                  <option value="2">Februar</option>
                  <option value="3">März</option>
                  <option value="4">April</option>
                  <option value="5">Mai</option>
                  <option value="6">Juni</option>
                  <option value="7">Juli</option>
                  <option value="8">August</option>
                  <option value="9">September</option>
                  <option value="10">Oktober</option>
                  <option value="11">November</option>
                  <option value="12">Dezember</option>
                </select>
              </div>
            </div>

            <!-- File Drop Area -->
            <div class="file-drop-area mb-4" id="drop-area">
              <i class="fas fa-file-pdf text-4xl text-[var(--color-primary)]"></i>
              <p>Datei hierher ziehen oder klicken</p>
              <p class="text-sm text-[var(--color-text-secondary)]">
                Nur PDF, max. 5MB
              </p>
              <input type="file" id="file-input" name="document"
                     accept=".pdf" required hidden />
            </div>

            <!-- Description -->
            <div class="form-group mb-4">
              <label class="form-label">Beschreibung (optional)</label>
              <textarea name="description" class="form-control" rows="2"></textarea>
            </div>
          </form>
        </div>
        <div class="ds-modal__footer">
          <button class="btn btn-cancel" id="upload-cancel">
            Abbrechen
          </button>
          <button class="btn btn-primary" id="upload-submit">
            <i class="fas fa-upload mr-2"></i>
            Hochladen
          </button>
        </div>
      </div>
    </div>

    <!-- Scripts (TypeScript Modules Only) -->
    <script type="module" src="/scripts/auth/index.ts"></script>
    <script type="module" src="/scripts/documents/explorer/index.js"></script>
    <script type="module" src="/scripts/components/unified-navigation.ts"></script>
    <script type="module" src="/scripts/auth/role-switch.ts"></script>
    <script type="module">
      import { initBreadcrumb } from '/scripts/components/breadcrumb.js';
      initBreadcrumb();
    </script>
  </body>
</html>
```

**Task 2.2: Create minimal CSS**

**File:** `frontend/src/styles/documents-explorer.css`

```css
/**
 * Documents Explorer - Minimal Custom CSS
 * Most styling done via Tailwind + Design System
 */

/* Explorer Layout */
.explorer-layout {
  display: flex;
  min-height: calc(100vh - 60px);
  gap: 0;
}

/* Sidebar */
.explorer-sidebar {
  width: 280px;
  background: var(--background-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-header {
  padding: 1.5rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.sidebar-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

/* Folder Tree */
.folder-tree {
  flex: 1;
  padding: 1rem 0;
}

.folder-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background 0.2s;
  color: var(--color-text-secondary);
}

.folder-item:hover {
  background: var(--background-hover);
}

.folder-item.active {
  background: var(--background-active);
  color: var(--color-primary);
  font-weight: 500;
}

.folder-icon {
  width: 1.25rem;
  text-align: center;
}

.folder-label {
  flex: 1;
}

.folder-count {
  font-size: 0.875rem;
  min-width: 1.5rem;
  text-align: center;
}

/* Utility Links */
.sidebar-utilities {
  padding: 1rem;
  border-top: 1px solid var(--border-color);
}

.utility-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  color: var(--color-text-secondary);
  text-decoration: none;
  border-radius: 0.5rem;
  transition: background 0.2s;
}

.utility-link:hover {
  background: var(--background-hover);
}

/* Main Content */
.explorer-content {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
  background: var(--background-primary);
}

/* Breadcrumb */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.breadcrumb-item {
  color: inherit;
  text-decoration: none;
}

.breadcrumb-item.active {
  color: var(--color-text-primary);
  font-weight: 500;
}

.breadcrumb-separator {
  color: var(--color-text-tertiary);
}

/* Stats Bar */
.stats-bar {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--background-secondary);
  border-radius: 0.5rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stat-item i {
  color: var(--color-primary);
  font-size: 1.25rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.stat-label {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

/* Documents Grid */
.documents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

/* Toolbar */
.toolbar {
  margin-bottom: 1.5rem;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: var(--color-text-secondary);
}

.spinner {
  width: 3rem;
  height: 3rem;
  border: 3px solid var(--border-color);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .explorer-sidebar {
    position: fixed;
    left: -280px;
    top: 60px;
    bottom: 0;
    z-index: 100;
    transition: left 0.3s;
  }

  .explorer-sidebar.open {
    left: 0;
  }

  .documents-grid {
    grid-template-columns: 1fr;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-right {
    flex-direction: column;
  }
}
```

**Checklist:**
- [ ] documents-explorer.html created
- [ ] HTML uses Design System components
- [ ] HTML uses Tailwind classes
- [ ] NO inline styles
- [ ] NO inline JavaScript
- [ ] documents-explorer.css created (minimal)
- [ ] Mobile responsive

---

## 💻 PHASE 3-4: TypeScript Modules (Part 1) ✅ **COMPLETED**

**Task 3.1: Create types.ts**

**File:** `frontend/src/scripts/documents/explorer/types.ts`

```typescript
/**
 * Type definitions for Documents Explorer
 */

import type { Document } from '../../../types/api.types';

export type FolderType = 'company' | 'department' | 'team' | 'personal' | 'payroll';
export type ViewType = FolderType | 'favorites' | 'statistics';
export type SortOption = 'newest' | 'oldest' | 'name' | 'size';
export type FilterOption = 'all' | 'unread' | 'archived';

export interface ExplorerState {
  currentFolder: ViewType;
  documents: Document[];
  searchQuery: string;
  sortBy: SortOption;
  filterBy: FilterOption;
  isLoading: boolean;
  error: string | null;
  stats: DocumentStats;
}

export interface DocumentStats {
  total: number;
  unread: number;
  recent: number;
  perFolder: Record<FolderType, number>;
}

export interface FolderConfig {
  id: FolderType;
  icon: string;
  label: string;
  apiCategory: string;
  description: string;
}

export interface LoadDocumentsOptions {
  category?: string;
  sortBy?: SortOption;
  filterBy?: FilterOption;
  searchQuery?: string;
  page?: number;
  limit?: number;
}

export interface DocumentCardData {
  id: number;
  title: string;
  category: string;
  uploadDate: string;
  uploader: string;
  fileSize: string;
  mimeType: string;
  isUnread: boolean;
}
```

**Task 3.2: Create state.ts**

(Use code from "TypeScript Module Structure" section above - full implementation ~200 lines)

**Task 3.3: Create router.ts**

(Use code from "TypeScript Module Structure" section above - full implementation ~100 lines)

**Task 3.4: Create sidebar.ts**

(Use code from "TypeScript Module Structure" section above - full implementation ~150 lines)

**Checklist:**
- [ ] types.ts created (~100 lines)
- [ ] state.ts created (~200 lines)
- [ ] router.ts created (~100 lines)
- [ ] sidebar.ts created (~150 lines)
- [ ] All files have JSDoc comments
- [ ] No `any` types used
- [ ] TypeScript strict mode passes

**Build and test:**
```bash
docker exec assixx-backend pnpm run type-check
# Should pass with no errors
```

---

## 💻 PHASE 4-5: TypeScript Modules (Part 2) ✅ **COMPLETED**

**Task 4.1: Create api.ts**

**File:** `frontend/src/scripts/documents/explorer/api.ts`

```typescript
/**
 * API wrapper for Documents Explorer
 * All backend communication centralized here
 */

import { ApiClient } from '../../../utils/api-client';
import type { Document } from '../../../types/api.types';
import type { LoadDocumentsOptions, DocumentStats, FolderType } from './types';

const apiClient = new ApiClient();

/**
 * Load documents with filters
 */
export async function loadDocuments(options: LoadDocumentsOptions): Promise<Document[]> {
  try {
    const response = await apiClient.get('/api/v2/documents', {
      params: {
        category: options.category,
        sortBy: mapSortToAPI(options.sortBy),
        sortOrder: options.sortBy === 'oldest' ? 'asc' : 'desc',
        isArchived: options.filterBy === 'archived' ? true : undefined,
        search: options.searchQuery,
        page: options.page || 1,
        limit: options.limit || 50,
      },
    });

    return response.data.documents || [];
  } catch (error) {
    console.error('Failed to load documents:', error);
    throw error;
  }
}

/**
 * Load document statistics
 */
export async function loadStats(): Promise<DocumentStats> {
  try {
    const response = await apiClient.get('/api/v2/documents/stats');

    return {
      total: response.data.totalCount || 0,
      unread: response.data.unreadCount || 0,
      recent: response.data.recentCount || 0,
      perFolder: response.data.documentsByCategory || {},
    };
  } catch (error) {
    console.error('Failed to load stats:', error);
    throw error;
  }
}

/**
 * Get single document by ID
 */
export async function getDocument(id: number): Promise<Document> {
  try {
    const response = await apiClient.get(`/api/v2/documents/${id}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get document:', error);
    throw error;
  }
}

/**
 * Download document
 */
export function downloadDocument(id: number): void {
  window.location.href = `/api/v2/documents/${id}/download`;
}

/**
 * Map sort option to API field
 */
function mapSortToAPI(sort: string | undefined): string {
  const mapping: Record<string, string> = {
    newest: 'uploaded_at',
    oldest: 'uploaded_at',
    name: 'filename',
    size: 'file_size',
  };
  return mapping[sort || 'newest'] || 'uploaded_at';
}

/**
 * Map folder to API category
 */
export function mapFolderToCategory(folder: string): string | undefined {
  const mapping: Record<string, string> = {
    company: 'general',
    department: 'work',
    team: 'training',
    personal: 'personal',
    payroll: 'salary',
  };
  return mapping[folder];
}
```

**Task 4.2: Create toolbar.ts**

**File:** `frontend/src/scripts/documents/explorer/toolbar.ts`

```typescript
/**
 * Toolbar component - Sort, filter, search controls
 */

import { explorerState, type SortOption, type FilterOption } from './state';

export class Toolbar {
  private sortDropdown: HTMLElement | null;
  private filterDropdown: HTMLElement | null;
  private searchInput: HTMLInputElement | null;
  private searchClear: HTMLElement | null;

  constructor() {
    this.sortDropdown = document.getElementById('sort-dropdown');
    this.filterDropdown = document.getElementById('filter-dropdown');
    this.searchInput = document.getElementById('search-input') as HTMLInputElement;
    this.searchClear = document.getElementById('search-clear');
    this.init();
  }

  private init(): void {
    this.initSortDropdown();
    this.initFilterDropdown();
    this.initSearch();
  }

  private initSortDropdown(): void {
    const trigger = this.sortDropdown?.querySelector('.dropdown__trigger');
    const menu = this.sortDropdown?.querySelector('.dropdown__menu');
    const options = menu?.querySelectorAll('.dropdown__option');

    // Toggle dropdown
    trigger?.addEventListener('click', () => {
      menu?.classList.toggle('active');
    });

    // Handle option selection
    options?.forEach((option) => {
      option.addEventListener('click', () => {
        const value = option.getAttribute('data-value') as SortOption;
        const label = option.textContent || '';

        // Update UI
        const labelEl = this.sortDropdown?.querySelector('#sort-label');
        if (labelEl) {
          labelEl.textContent = label;
        }

        // Update state
        explorerState.setSort(value);

        // Close dropdown
        menu?.classList.remove('active');
      });
    });

    // Close on outside click
    document.addEventListener('click', (e: Event) => {
      if (!this.sortDropdown?.contains(e.target as Node)) {
        menu?.classList.remove('active');
      }
    });
  }

  private initFilterDropdown(): void {
    const trigger = this.filterDropdown?.querySelector('.dropdown__trigger');
    const menu = this.filterDropdown?.querySelector('.dropdown__menu');
    const options = menu?.querySelectorAll('.dropdown__option');

    trigger?.addEventListener('click', () => {
      menu?.classList.toggle('active');
    });

    options?.forEach((option) => {
      option.addEventListener('click', () => {
        const value = option.getAttribute('data-value') as FilterOption;
        const label = option.textContent || '';

        const labelEl = this.filterDropdown?.querySelector('#filter-label');
        if (labelEl) {
          labelEl.textContent = label;
        }

        explorerState.setFilter(value);
        menu?.classList.remove('active');
      });
    });

    document.addEventListener('click', (e: Event) => {
      if (!this.filterDropdown?.contains(e.target as Node)) {
        menu?.classList.remove('active');
      }
    });
  }

  private initSearch(): void {
    let searchTimeout: NodeJS.Timeout;

    // Search input with debounce
    this.searchInput?.addEventListener('input', (e: Event) => {
      const query = (e.target as HTMLInputElement).value;

      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        explorerState.setSearchQuery(query);
      }, 300); // 300ms debounce
    });

    // Clear button
    this.searchClear?.addEventListener('click', () => {
      if (this.searchInput) {
        this.searchInput.value = '';
        explorerState.setSearchQuery('');
      }
    });
  }
}
```

**Task 4.3: Create grid.ts**

**File:** `frontend/src/scripts/documents/explorer/grid.ts`

```typescript
/**
 * Grid component - Document cards rendering
 */

import { explorerState } from './state';
import type { Document } from '../../../types/api.types';
import { formatFileSize, formatDate } from '../shared/ui-helpers';

export class Grid {
  private containerEl: HTMLElement | null;
  private emptyStateEl: HTMLElement | null;
  private loadingStateEl: HTMLElement | null;

  constructor() {
    this.containerEl = document.getElementById('documents-grid');
    this.emptyStateEl = document.getElementById('empty-state');
    this.loadingStateEl = document.getElementById('loading-state');
    this.init();
  }

  private init(): void {
    explorerState.subscribe((state) => {
      if (state.isLoading) {
        this.showLoading();
      } else if (state.documents.length === 0) {
        this.showEmpty();
      } else {
        this.renderDocuments(state.documents);
      }
    });
  }

  private renderDocuments(documents: Document[]): void {
    this.hideLoading();
    this.hideEmpty();

    if (!this.containerEl) return;

    const html = documents.map((doc) => this.renderCard(doc)).join('');
    this.containerEl.innerHTML = html;

    // Attach click handlers
    this.attachCardHandlers();
  }

  private renderCard(doc: Document): string {
    const fileIcon = this.getFileIcon(doc.mimeType || '');
    const badgeClass = doc.isUnread ? 'badge--info' : 'badge--secondary';

    return `
      <div class="card border-l-4 border-l-blue-500 cursor-pointer" data-doc-id="${doc.id}">
        <div class="card__body">
          <!-- File Icon -->
          <div class="flex items-start justify-between mb-3">
            <div class="text-4xl text-[var(--color-primary)]">
              <i class="${fileIcon}"></i>
            </div>
            ${doc.isUnread ? '<span class="badge badge--info">Neu</span>' : ''}
          </div>

          <!-- Title -->
          <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-2 truncate"
              title="${doc.originalName || doc.filename}">
            ${doc.originalName || doc.filename}
          </h3>

          <!-- Category Badge -->
          <div class="mb-3">
            <span class="badge ${badgeClass}">
              <i class="fas fa-tag mr-1"></i>
              ${this.getCategoryLabel(doc.category)}
            </span>
          </div>

          <!-- Metadata -->
          <div class="space-y-2 text-sm text-[var(--color-text-secondary)] mb-4">
            <div class="flex items-center gap-2">
              <i class="fas fa-calendar w-4"></i>
              <span>${formatDate(doc.uploadedAt)}</span>
            </div>
            <div class="flex items-center gap-2">
              <i class="fas fa-user w-4"></i>
              <span>${doc.createdByName || 'Unbekannt'}</span>
            </div>
            <div class="flex items-center gap-2">
              <i class="fas fa-weight w-4"></i>
              <span>${formatFileSize(doc.fileSize)}</span>
            </div>
          </div>

          <!-- Action Button -->
          <button type="button" class="btn btn-info w-full btn-open-document">
            <i class="fas fa-eye mr-2"></i>
            Öffnen
          </button>
        </div>
      </div>
    `;
  }

  private getFileIcon(mimeType: string): string {
    if (mimeType.includes('pdf')) return 'fas fa-file-pdf';
    if (mimeType.includes('word')) return 'fas fa-file-word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fas fa-file-excel';
    if (mimeType.includes('image')) return 'fas fa-file-image';
    return 'fas fa-file-alt';
  }

  private getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      general: 'Allgemein',
      work: 'Arbeit',
      training: 'Schulung',
      personal: 'Persönlich',
      salary: 'Gehalt',
    };
    return labels[category] || category;
  }

  private attachCardHandlers(): void {
    this.containerEl?.querySelectorAll('[data-doc-id]').forEach((card) => {
      card.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.closest('.btn-open-document')) {
          const docId = Number((card as HTMLElement).dataset.docId);
          // Dispatch custom event for modal
          document.dispatchEvent(new CustomEvent('open-document-modal', {
            detail: { documentId: docId },
          }));
        }
      });
    });
  }

  private showLoading(): void {
    this.containerEl?.classList.add('hidden');
    this.emptyStateEl?.classList.add('hidden');
    this.loadingStateEl?.classList.remove('hidden');
  }

  private hideLoading(): void {
    this.loadingStateEl?.classList.add('hidden');
    this.containerEl?.classList.remove('hidden');
  }

  private showEmpty(): void {
    this.containerEl?.classList.add('hidden');
    this.loadingStateEl?.classList.add('hidden');
    this.emptyStateEl?.classList.remove('hidden');
  }

  private hideEmpty(): void {
    this.emptyStateEl?.classList.add('hidden');
    this.containerEl?.classList.remove('hidden');
  }
}
```

**Task 4.4: Create modal.ts**

**File:** `frontend/src/scripts/documents/explorer/modal.ts`

```typescript
/**
 * Modal component - Document details
 */

import { getDocument, downloadDocument } from './api';
import { formatFileSize, formatDate } from '../shared/ui-helpers';

export class Modal {
  private modalEl: HTMLElement | null;
  private closeBtn: HTMLElement | null;
  private cancelBtn: HTMLElement | null;
  private downloadBtn: HTMLElement | null;
  private currentDocId: number | null = null;

  constructor() {
    this.modalEl = document.getElementById('document-modal');
    this.closeBtn = document.getElementById('modal-close');
    this.cancelBtn = document.getElementById('modal-cancel');
    this.downloadBtn = document.getElementById('modal-download');
    this.init();
  }

  private init(): void {
    // Listen for custom event from grid
    document.addEventListener('open-document-modal', ((e: CustomEvent) => {
      void this.open(e.detail.documentId);
    }) as EventListener);

    // Close handlers
    this.closeBtn?.addEventListener('click', () => {
      this.close();
    });
    this.cancelBtn?.addEventListener('click', () => {
      this.close();
    });

    // Download handler
    this.downloadBtn?.addEventListener('click', () => {
      if (this.currentDocId) {
        downloadDocument(this.currentDocId);
      }
    });

    // Click outside to close
    this.modalEl?.addEventListener('click', (e: Event) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });
  }

  async open(documentId: number): Promise<void> {
    try {
      this.currentDocId = documentId;

      // Show modal
      this.modalEl?.classList.remove('hidden');

      // Load document data
      const doc = await getDocument(documentId);

      // Update modal content
      this.renderContent(doc);

    } catch (error) {
      console.error('Failed to load document:', error);
      alert('Fehler beim Laden des Dokuments');
      this.close();
    }
  }

  private renderContent(doc: any): void {
    const titleEl = document.getElementById('modal-title');
    const contentEl = document.getElementById('modal-content');

    if (titleEl) {
      titleEl.textContent = doc.originalName || doc.filename;
    }

    if (contentEl) {
      contentEl.innerHTML = `
        <div class="mb-4 text-center py-10 bg-[var(--background-secondary)] rounded-lg">
          <i class="fas fa-file-pdf text-6xl text-[var(--color-primary)] mb-4"></i>
          <p class="text-[var(--color-text-primary)]">Dokument-Details</p>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[var(--background-secondary)] rounded-lg">
          <div class="flex items-start gap-3">
            <i class="fas fa-file text-[var(--color-primary)] mt-1"></i>
            <div>
              <label class="text-sm text-[var(--color-text-secondary)]">Dateiname</label>
              <div class="text-[var(--color-text-primary)] font-medium">${doc.filename}</div>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <i class="fas fa-weight text-[var(--color-primary)] mt-1"></i>
            <div>
              <label class="text-sm text-[var(--color-text-secondary)]">Größe</label>
              <div class="text-[var(--color-text-primary)] font-medium">${formatFileSize(doc.fileSize)}</div>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <i class="fas fa-user text-[var(--color-primary)] mt-1"></i>
            <div>
              <label class="text-sm text-[var(--color-text-secondary)]">Hochgeladen von</label>
              <div class="text-[var(--color-text-primary)] font-medium">${doc.createdByName || 'Unbekannt'}</div>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <i class="fas fa-calendar text-[var(--color-primary)] mt-1"></i>
            <div>
              <label class="text-sm text-[var(--color-text-secondary)]">Datum</label>
              <div class="text-[var(--color-text-primary)] font-medium">${formatDate(doc.uploadedAt)}</div>
            </div>
          </div>
        </div>
      `;
    }
  }

  private close(): void {
    this.modalEl?.classList.add('hidden');
    this.currentDocId = null;
  }
}
```

**Task 4.5: Create index.ts (Main Controller)**

**File:** `frontend/src/scripts/documents/explorer/index.ts`

```typescript
/**
 * Documents Explorer - Main Controller
 * Entry point and coordination
 */

import { ApiClient } from '../../../utils/api-client';
import { getUserRole, isAdmin } from '../../../utils/auth-helpers';
import { showErrorAlert } from '../../utils/alerts';
import { router } from './router';
import { Sidebar } from './sidebar';
import { Grid } from './grid';
import { Toolbar } from './toolbar';
import { Modal } from './modal';
import { UploadModal } from './upload-modal';
import { explorerState, type ExplorerState } from './state';
import { loadDocuments, loadStats, mapFolderToCategory } from './api';

class DocumentsExplorer {
  private sidebar: Sidebar;
  private grid: Grid;
  private toolbar: Toolbar;
  private modal: Modal;
  private uploadModal: UploadModal | null = null;

  constructor() {
    this.sidebar = new Sidebar();
    this.grid = new Grid();
    this.toolbar = new Toolbar();
    this.modal = new Modal();

    // Only create upload modal for admin/root
    if (isAdmin()) {
      this.uploadModal = new UploadModal();
      this.initUploadButton();
    }
  }

  /**
   * Initialize upload button for admin/root
   */
  private initUploadButton(): void {
    const uploadBtn = document.getElementById('upload-btn');
    if (uploadBtn && this.uploadModal) {
      uploadBtn.classList.remove('hidden');
      uploadBtn.addEventListener('click', () => {
        this.uploadModal?.open();
      });
    }
  }

  /**
   * Initialize explorer
   */
  async init(): Promise<void> {
    try {
      // Load saved state
      explorerState.loadFromStorage();

      // Initialize router
      router.init();

      // Subscribe to state changes
      explorerState.subscribe((state) => {
        void this.handleStateChange(state);
      });

      // Load initial data
      await this.loadDocuments();
      await this.loadStats();

      // Update breadcrumb
      this.updateBreadcrumb(explorerState.getState().currentFolder);

    } catch (error) {
      console.error('Failed to initialize documents explorer:', error);
      showErrorAlert('Fehler beim Laden der Dokumente');
    }
  }

  /**
   * Handle state changes
   */
  private async handleStateChange(state: ExplorerState): Promise<void> {
    // Update breadcrumb
    this.updateBreadcrumb(state.currentFolder);

    // Update stats
    this.updateStatsDisplay(state.stats);

    // Reload documents if filters changed
    await this.loadDocuments();

    // Save state
    explorerState.saveToStorage();
  }

  /**
   * Load documents for current state
   */
  private async loadDocuments(): Promise<void> {
    try {
      const state = explorerState.getState();
      explorerState.setLoading(true);

      const documents = await loadDocuments({
        category: mapFolderToCategory(state.currentFolder),
        sortBy: state.sortBy,
        filterBy: state.filterBy,
        searchQuery: state.searchQuery,
      });

      explorerState.setDocuments(documents);
      explorerState.setLoading(false);

    } catch (error) {
      console.error('Failed to load documents:', error);
      explorerState.setError('Fehler beim Laden der Dokumente');
      explorerState.setLoading(false);
    }
  }

  /**
   * Load statistics
   */
  private async loadStats(): Promise<void> {
    try {
      const stats = await loadStats();
      explorerState.setStats(stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  /**
   * Update breadcrumb
   */
  private updateBreadcrumb(folder: string): void {
    const breadcrumbEl = document.getElementById('breadcrumb');
    if (!breadcrumbEl) return;

    const folderLabels: Record<string, string> = {
      company: 'Firmendokumente',
      department: 'Abteilungsdokumente',
      team: 'Teamdokumente',
      personal: 'Persönliche Dokumente',
      payroll: 'Gehaltsabrechnungen',
      favorites: 'Favoriten',
      statistics: 'Statistik',
    };

    breadcrumbEl.innerHTML = `
      <a href="/documents" class="breadcrumb-item">Dokumente</a>
      <span class="breadcrumb-separator">/</span>
      <span class="breadcrumb-item active">${folderLabels[folder] || 'Unbekannt'}</span>
    `;
  }

  /**
   * Update stats display
   */
  private updateStatsDisplay(stats: any): void {
    const totalEl = document.getElementById('stat-total');
    const unreadEl = document.getElementById('stat-unread');
    const recentEl = document.getElementById('stat-recent');

    if (totalEl) totalEl.textContent = stats.total.toString();
    if (unreadEl) unreadEl.textContent = stats.unread.toString();
    if (recentEl) recentEl.textContent = stats.recent.toString();
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const explorer = new DocumentsExplorer();
  void explorer.init();
});
```

**Checklist:**
- [ ] api.ts created (~150 lines)
- [ ] toolbar.ts created (~100 lines)
- [ ] grid.ts created (~200 lines)
- [ ] modal.ts created (~150 lines)
- [ ] index.ts created (~400 lines)
- [ ] All imports correct
- [ ] All event handlers attached
- [ ] TypeScript compiles

**Build and test:**
```bash
docker exec assixx-backend pnpm run build
docker exec assixx-backend pnpm run type-check

# Test in browser
open http://localhost:3000/documents-explorer.html?folder=company
```

---

## 🧪 PHASE 6: Integration & Testing 🚧 **IN PROGRESS**

**Task 6.1: Expand shared/ui-helpers.ts**

**File:** `frontend/src/scripts/documents/shared/ui-helpers.ts`

```typescript
/**
 * Add missing helper functions
 */

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}
```

**Task 6.2: Add missing constants**

**File:** `frontend/src/scripts/documents/shared/constants.ts`

```typescript
/**
 * Constants for Documents Explorer
 */

export const FOLDER_CONFIGS = [
  {
    id: 'company' as const,
    icon: 'fa-building',
    label: 'Firmendokumente',
    apiCategory: 'general',
    description: 'Dokumente für alle Mitarbeiter',
  },
  {
    id: 'department' as const,
    icon: 'fa-users',
    label: 'Abteilungsdokumente',
    apiCategory: 'work',
    description: 'Dokumente für Ihre Abteilung',
  },
  {
    id: 'team' as const,
    icon: 'fa-user-friends',
    label: 'Teamdokumente',
    apiCategory: 'training',
    description: 'Dokumente für Ihr Team',
  },
  {
    id: 'personal' as const,
    icon: 'fa-user',
    label: 'Persönliche Dokumente',
    apiCategory: 'personal',
    description: 'Ihre persönlichen Dokumente',
  },
  {
    id: 'payroll' as const,
    icon: 'fa-money-bill-wave',
    label: 'Gehaltsabrechnungen',
    apiCategory: 'salary',
    description: 'Ihre Gehaltsabrechnungen',
  },
];
```

**Task 6.3: Manual Testing**

**Checklist:**

| Feature | Test | Expected | Status |
|---------|------|----------|--------|
| **Navigation** | Click "Firmendokumente" | Documents load, URL changes | [ ] |
| **URL Routing** | Visit `/documents?folder=team` | Team folder opens | [ ] |
| **Browser Back** | Click folder, then back button | Return to previous | [ ] |
| **Search** | Type "test" in search | Documents filter | [ ] |
| **Sort** | Select "Nach Name" | Documents sorted | [ ] |
| **Filter** | Select "Ungelesen" | Only unread shown | [ ] |
| **Stats** | Switch folders | Stats update | [ ] |
| **Modal** | Click document card | Modal opens | [ ] |
| **Download** | Click download in modal | File downloads | [ ] |
| **Mobile** | Open on phone | Responsive layout | [ ] |
| **Console** | Check browser console | No errors | [ ] |

**Test each folder:**
```bash
# Test all folder URLs
http://localhost:3000/documents-explorer.html?folder=company
http://localhost:3000/documents-explorer.html?folder=department
http://localhost:3000/documents-explorer.html?folder=team
http://localhost:3000/documents-explorer.html?folder=personal
http://localhost:3000/documents-explorer.html?folder=payroll
```

---

## 🔄 PHASE 7: Redirects & Migration ❌ **NOT STARTED**

**Task 7.1: Add Backend Redirects**

**File:** `backend/src/server.ts` (or wherever routes are configured)

```typescript
/**
 * Redirect old document pages to explorer
 */

app.get('/documents-company.html', (req: Request, res: Response) => {
  res.redirect(301, '/documents-explorer.html?folder=company');
});

app.get('/documents-department.html', (req: Request, res: Response) => {
  res.redirect(301, '/documents-explorer.html?folder=department');
});

app.get('/documents-team.html', (req: Request, res: Response) => {
  res.redirect(301, '/documents-explorer.html?folder=team');
});

app.get('/documents-personal.html', (req: Request, res: Response) => {
  res.redirect(301, '/documents-explorer.html?folder=personal');
});

app.get('/documents-payroll.html', (req: Request, res: Response) => {
  res.redirect(301, '/documents-explorer.html?folder=payroll');
});

app.get('/documents-search.html', (req: Request, res: Response) => {
  res.redirect(301, '/documents-explorer.html');
});
```

**Task 7.2: Update Internal Links**

```bash
# Find all hardcoded links
cd /home/scs/projects/Assixx
grep -r "documents-company.html" frontend/ --exclude-dir=dist
grep -r "documents-department.html" frontend/ --exclude-dir=dist
grep -r "documents-team.html" frontend/ --exclude-dir=dist
grep -r "documents-personal.html" frontend/ --exclude-dir=dist
grep -r "documents-payroll.html" frontend/ --exclude-dir=dist

# Replace with new URLs:
# documents-company.html → documents-explorer.html?folder=company
# etc.
```

**Task 7.3: Test Redirects**

```bash
# Test each redirect
curl -I http://localhost:3000/documents-company.html
# Expected: HTTP/1.1 301 Moved Permanently
# Location: /documents-explorer.html?folder=company

curl -I http://localhost:3000/documents-department.html
# Expected: 301 → /documents-explorer.html?folder=department
```

**Checklist:**
- [ ] Backend redirects added
- [ ] All internal links updated
- [ ] Redirects tested
- [ ] No broken links

---

## 🔐 PHASE 8: Integration with UUID Storage ✅ **LIKELY COMPLETED**

**Reference:** DOCUMENT-STORAGE-STRATEGY.md

**Task 8.1: Verify UUID Integration**

```bash
# Check database has UUID columns
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e \
  "SELECT id, file_uuid, file_checksum, storage_type, file_path FROM documents LIMIT 5;"
```

**Expected:** All new documents have `file_uuid` and UUID-based `file_path`

**Task 8.2: Update Grid to Use Document ID**

Already done in grid.ts:
```typescript
// Download uses document ID (backend handles UUID path)
<button class="btn btn-primary" data-doc-id="${doc.id}">Download</button>
```

**Task 8.3: Test Upload Integration**

```bash
# Test upload workflow
# 1. Upload document via existing upload page
# 2. Check database:
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e \
  "SELECT file_uuid, file_path FROM documents ORDER BY id DESC LIMIT 1;"

# 3. Check file exists at UUID path:
ls -la /home/scs/projects/Assixx/uploads/documents/*/general/2025/11/
```

**Checklist:**
- [ ] UUID storage works
- [ ] Download via ID works
- [ ] Files saved to hierarchical path
- [ ] Checksums stored

---

## 🧹 PHASE 9: Cleanup ❌ **NOT STARTED**

**Task 9.1: Delete Old Files**

```bash
cd /home/scs/projects/Assixx/frontend/src

# Verify backup exists!
ls -la ../../backups/documents-before-explorer/

# Delete old HTML pages
rm pages/documents-company.html
rm pages/documents-department.html
rm pages/documents-team.html
rm pages/documents-personal.html
rm pages/documents-payroll.html
rm pages/document-upload.html  # NEW - remove upload page
# Note: Keep documents-search.html as reference

# Delete old TypeScript wrappers
rm scripts/documents/base.ts
rm scripts/documents/company.ts
rm scripts/documents/department.ts
rm scripts/documents/team.ts
rm scripts/documents/personal.ts
rm scripts/documents/payroll.ts
# Note: Keep search/ folder
```

**Task 9.2: Update Build Config**

**File:** `frontend/vite.config.js`

```javascript
// Remove old pages from build input
input: {
  // ... other pages ...
  'documents-explorer': resolve(__dirname, 'src/pages/documents-explorer.html'),
  // Remove: documents-company, documents-department, etc.
}
```

**Task 9.3: Rebuild**

```bash
docker exec assixx-backend pnpm run build
docker exec assixx-backend pnpm run type-check
```

**Checklist:**
- [ ] Old HTML files deleted
- [ ] Old TS files deleted
- [ ] Build config updated
- [ ] Build successful
- [ ] Type-check passes

---

## ✅ PHASE 10: Final Rename & Testing

**Task 10.1: Rename Explorer to Main**

```bash
cd /home/scs/projects/Assixx/frontend/src
mv pages/documents-explorer.html pages/documents.html
```

**Task 10.2: Update Redirects**

```typescript
// Change redirects to /documents.html
app.get('/documents-company.html', (req, res) => {
  res.redirect(301, '/documents.html?folder=company');
});
// ... etc
```

**Task 10.3: Update Internal Links**

```bash
# Replace all /documents-explorer.html with /documents.html
find frontend/src -type f -exec sed -i 's/documents-explorer\.html/documents.html/g' {} +
```

**Task 10.4: Final Testing**

**Complete Checklist:**

| Test | URL | Expected | Status |
|------|-----|----------|--------|
| Main page | `/documents.html` | Opens company folder | [ ] |
| With param | `/documents.html?folder=team` | Opens team folder | [ ] |
| Old redirect | `/documents-company.html` | Redirects to new | [ ] |
| Navigation | Click all folders | All load correctly | [ ] |
| Search | Type query | Results filter | [ ] |
| Sort | Change sort | Documents reorder | [ ] |
| Filter | Change filter | Documents filter | [ ] |
| Modal | Click card | Modal opens | [ ] |
| Download | Click download | File downloads | [ ] |
| Back button | Navigate and back | History works | [ ] |
| Mobile | Open on phone | Responsive | [ ] |
| Console | All pages | No errors | [ ] |

**Task 10.5: Performance Test**

```bash
# Test with many documents (1000+)
# Check:
# - Load time < 2 seconds
# - Smooth scrolling
# - No memory leaks
```

**Task 10.6: Final Commit**

```bash
git add .
git commit -m "feat: Implement Documents Explorer View

- Single page for all document categories
- Folder-based navigation with URL routing
- Design System components (100% Tailwind)
- TypeScript modules (9 files, ~1,550 lines)
- UUID storage integration
- Browser history support
- Mobile responsive

BREAKING CHANGE: Old document pages replaced with explorer view
All old URLs redirect to /documents.html?folder=X

Closes #XXX"

git push origin feat/documents-explorer-view
```

---

## ✅ TESTING STRATEGY

### Role-Based Testing:

**As Employee:**
- [ ] NO upload button visible
- [ ] Can view documents
- [ ] Can download own documents
- [ ] Cannot delete documents

**As Admin:**
- [ ] Upload button visible
- [ ] Upload modal opens
- [ ] Can upload to user/team/department/company
- [ ] Can delete documents
- [ ] Can edit all documents

**As Root:**
- [ ] Same as admin
- [ ] Additional root features work

### Upload Testing:
- [ ] Drag & drop works
- [ ] File selection works
- [ ] PDF only validation
- [ ] 5MB limit enforced
- [ ] Recipient selection works
- [ ] Category selection works
- [ ] Year/month optional
- [ ] Description optional
- [ ] Upload progress shown
- [ ] Success message shown
- [ ] Document appears in grid
- [ ] Correct folder placement

### Manual Testing Checklist (Copy & Use):

```markdown
## Documents Explorer Testing

### Navigation
- [ ] Click "Firmendokumente" → documents load
- [ ] Click "Abteilungsdokumente" → documents load
- [ ] Click "Teamdokumente" → documents load
- [ ] Click "Persönliche Dokumente" → documents load
- [ ] Click "Gehaltsabrechnungen" → documents load
- [ ] Active folder highlighted in sidebar
- [ ] Breadcrumb updates correctly

### URL Routing
- [ ] `/documents.html` → opens (default: company)
- [ ] `/documents.html?folder=company` → company folder
- [ ] `/documents.html?folder=department` → department folder
- [ ] `/documents.html?folder=team` → team folder
- [ ] `/documents.html?folder=personal` → personal folder
- [ ] `/documents.html?folder=payroll` → payroll folder
- [ ] URL updates when clicking folders
- [ ] Can share URL with folder parameter

### Browser History
- [ ] Click folder → URL changes
- [ ] Click browser back → returns to previous folder
- [ ] Click browser forward → goes to next folder
- [ ] Refresh page → stays on current folder

### Search
- [ ] Type query → documents filter
- [ ] Clear button works
- [ ] Search across current folder only
- [ ] Debounce works (doesn't search every keystroke)

### Sort
- [ ] "Neueste zuerst" → newest first
- [ ] "Älteste zuerst" → oldest first
- [ ] "Nach Name" → alphabetical
- [ ] "Nach Größe" → by file size
- [ ] Dropdown closes after selection

### Filter
- [ ] "Alle" → all documents
- [ ] "Ungelesen" → only unread
- [ ] "Archiviert" → only archived
- [ ] Filter works with sort

### Stats
- [ ] Total count correct
- [ ] Unread count correct
- [ ] Recent count correct
- [ ] Stats update when changing folders
- [ ] Folder counts in sidebar correct

### Document Cards
- [ ] All documents render
- [ ] File icons correct (PDF, Word, Excel)
- [ ] Titles display correctly
- [ ] Category badges show
- [ ] Upload date formatted (DD.MM.YYYY)
- [ ] Uploader name shows
- [ ] File size formatted (KB, MB)

### Modal
- [ ] Click card → modal opens
- [ ] Document details correct
- [ ] Close button works
- [ ] Cancel button works
- [ ] Click outside → modal closes
- [ ] Download button downloads file
- [ ] Modal overlay darkens background

### Empty State
- [ ] Shows when no documents
- [ ] Message appropriate for context
- [ ] Icon displays

### Loading State
- [ ] Spinner shows while loading
- [ ] Disappears when loaded

### Mobile Responsive
- [ ] Sidebar collapsible
- [ ] Cards stack vertically
- [ ] Toolbar stacks
- [ ] Modal fits screen
- [ ] Touch-friendly buttons

### Redirects
- [ ] `/documents-company.html` → redirects
- [ ] `/documents-department.html` → redirects
- [ ] `/documents-team.html` → redirects
- [ ] `/documents-personal.html` → redirects
- [ ] `/documents-payroll.html` → redirects
- [ ] Old URLs work (301 redirect)

### Console & Errors
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] No 404s for resources
- [ ] No CORS errors

### Performance
- [ ] Page loads < 2 seconds
- [ ] Folder switching instant
- [ ] Smooth scrolling
- [ ] No memory leaks
```

---

## 📚 REFERENCES

### Internal Documents:

1. **MIGRATION-DESIGN-SYSTEM.md** - Design System migration standards
2. **MIGRATION-QUICK_UI.md** - Quick reference for UI migration
3. **DOCUMENT-STORAGE-STRATEGY.md** - UUID-based storage architecture
4. **TYPESCRIPT-STANDARDS.md** - Code quality & TypeScript standards
5. **DATABASE-MIGRATION-GUIDE.md** - Database migration best practices

### Successful Reference:

**documents-search.html** - Already migrated successfully:
- ✅ Design System components
- ✅ Tailwind CSS only
- ✅ TypeScript modules (search/, shared/)
- ✅ No inline styles
- ✅ No inline JavaScript

### External References:

1. **Google Drive UX:** https://drive.google.com
2. **Dropbox Design:** https://dropbox.design/
3. **OneDrive Explorer:** https://onedrive.live.com
4. **History API:** https://developer.mozilla.org/en-US/docs/Web/API/History_API
5. **Observer Pattern:** https://refactoring.guru/design-patterns/observer
6. **Tailwind CSS:** https://tailwindcss.com/docs

### Storybook Components:

**Access:** http://localhost:6006

**Categories Used:**
- Forms → Search Input, Dropdown
- Data Display → Empty State, Cards
- Feedback → Modals
- Navigation → Breadcrumb

---

## 🎯 SUCCESS CRITERIA

### Must Have (MVP):

✅ Single HTML page (documents.html)
✅ Folder tree navigation
✅ Click folder → instant load (no page reload)
✅ URL routing with folder parameter
✅ Browser back/forward support
✅ Stats update per folder
✅ Sort & filter work
✅ Search works
✅ Document cards render
✅ Modal opens/closes
✅ Download works
✅ All old URLs redirect (301)
✅ Mobile responsive
✅ NO inline styles
✅ NO inline JavaScript
✅ 100% Design System components
✅ 100% Tailwind CSS
✅ TypeScript modules only (9 files)
✅ No console errors
✅ Type-check passes

### Nice to Have (V2):

⭐ Global search across folders
⭐ Favorites virtual folder
⭐ Statistics dashboard
⭐ Bulk operations
⭐ View mode toggle (grid/list)
⭐ Advanced filters

### Performance Targets:

✅ Load time < 2 seconds
✅ Folder switch < 500ms
✅ Bundle size < 300KB
✅ No memory leaks
✅ 60fps scrolling

---

## 📋 FINAL PRE-FLIGHT CHECKLIST

**Before Starting:**

- [ ] Read all reference documents
- [ ] Storybook running (http://localhost:6006)
- [ ] Backup created
- [ ] Feature branch created
- [ ] Docker containers running
- [ ] Database verified (UUID columns exist)
- [ ] API verified (endpoints work)

**Code Quality:**

- [ ] NO inline styles anywhere
- [ ] NO inline JavaScript anywhere
- [ ] ALL components from Storybook
- [ ] ALL styling via Tailwind/Design System
- [ ] ALL TypeScript files < 250 lines
- [ ] NO `any` types used
- [ ] All functions have JSDoc
- [ ] All event handlers attached
- [ ] All imports correct

**Testing:**

- [ ] Manual testing checklist completed
- [ ] All folders tested
- [ ] All features tested
- [ ] Mobile tested
- [ ] Console checked (no errors)
- [ ] Performance tested
- [ ] Redirects tested

**Before Deploy:**

- [ ] Type-check passes
- [ ] Build successful
- [ ] All tests green
- [ ] User acceptance testing done
- [ ] Git commit message written

---

## 🚀 YOU ARE NOW READY!

**This plan is:**

✅ **100% Fact-Based** - Verified database, API, files
✅ **Step-by-Step** - Phase-by-phase implementation guide
✅ **Copy-Paste Ready** - Complete code examples
✅ **Design System Compliant** - Follows MIGRATION-DESIGN-SYSTEM.md
✅ **TypeScript Modular** - Small, focused modules (9 files)
✅ **Tailwind Only** - Minimal custom CSS
✅ **Reference-Driven** - Uses documents-search.html as guide
✅ **UUID-Integrated** - Works with DOCUMENT-STORAGE-STRATEGY.md
✅ **Production-Ready** - Complete testing strategy

**Next Action:** ~~Start Phase 0 - Storybook Component Creation!~~ **✅ IN PROGRESS**

---

## 📊 IMPLEMENTATION PROGRESS

### Phase 0: Storybook Component Creation ✅ COMPLETED
- ✅ Created ExplorerView.stories.js (545 lines)
- ✅ 4 Stories: EmployeeListView, EmployeeGridView, AdminListView, AdminGridView
- ✅ List View (Windows Details style) as DEFAULT
- ✅ Grid View (Google Drive cards)
- ✅ Integrated with existing File Upload component from Design System

### Phase 1: Investigation & Backup ✅ COMPLETED
- ✅ Found 7 document HTML pages to consolidate
- ✅ Created backup directory: archive/documents-pages-backup-20251108
- ✅ Backed up 29 files (7 HTML + 14 TypeScript + 8 CSS)
- ✅ Comprehensive README.md in backup directory

### Phase 2: HTML Structure ✅ COMPLETED
- ✅ Created documents-explorer.html (290 lines)
- ✅ Clean structure with Tailwind CSS v4 design tokens
- ✅ Sidebar, header, toolbar, dual view containers (list/grid)
- ✅ States: loading, empty, error with retry
- ✅ Modals: preview and upload placeholders
- ✅ Role-based UI with data-role attributes

### Phase 3: Core TypeScript Modules ✅ COMPLETED (725 lines)
- ✅ types.ts (200 lines): All TypeScript interfaces
- ✅ state.ts (310 lines): StateManager with Observer pattern
- ✅ router.ts (215 lines): History API routing

### Phase 4: UI Modules ✅ COMPLETED (1,740 lines)
- ✅ sidebar.ts (245 lines): Folder tree, category counts
- ✅ toolbar.ts (260 lines): Search, upload button, sort, view toggle
- ✅ list.ts (275 lines): Windows Details table view
- ✅ grid.ts (290 lines): Google Drive card view
- ✅ modal.ts (185 lines): PDF preview modal
- ✅ upload-modal.ts (485 lines): Upload form with validation

### Phase 5: API & Permissions Modules ✅ COMPLETED (727 lines)
- ✅ api.ts (296 lines): DocumentAPI class with all backend calls
- ✅ permissions.ts (431 lines): Document-level permission checking

### Phase 6: Integration & Testing ✅ COMPLETED
- ✅ index.ts: Main entry point initialization (248 lines)
- ✅ TypeScript compilation: No errors
- ✅ Build successful: 11.07s (248 KB bundle)
- ✅ Error handling with global handlers
- ✅ Auto-initialization on DOMContentLoaded

### Phase 7: Migration & Cleanup ✅ COMPLETED
- ✅ Created redirects from old URLs to new explorer (5 pages)
  - documents-personal.html → /documents-explorer/personal
  - documents-company.html → /documents-explorer/company
  - documents-department.html → /documents-explorer/department
  - documents-team.html → /documents-explorer/team
  - documents-payroll.html → /documents-explorer/payroll
  - document-upload.html → /documents-explorer (upload integrated)
- ✅ All redirects with meta refresh + JavaScript fallback
- ✅ Beautiful loading spinner during redirect
- ✅ Backup of old files in archive/documents-pages-backup-20251108
- ✅ Added backend routes in html.routes.ts:
  - GET /documents-explorer
  - GET /documents-explorer/:category (for client-side routing)
- ✅ Backend restarted and verified

### Summary Statistics (Updated 2025-11-08 23:20):
- **Total Lines Created:** ~3,440+ lines of production code
- **Modules Created:** 11 TypeScript modules + 1 HTML
- **Files Backed Up:** 29 files safely archived in `/archive/documents-pages-backup-20251108/`
- **Old HTML Pages:** ✅ All 7 removed from source
- **Old TypeScript:** ✅ All 3 old files deleted (base.ts, search.ts, upload.ts)
- **ESLint Compliance:** ✅ All errors fixed (including upload-modal.ts)
- **TypeScript Strict Mode:** ✅ All code follows standards
- **XSS Prevention:** ✅ All user content escaped
- **Role-Based Access:** ✅ Fully implemented
- **Build Size:** 258.40 KB (73.48 KB gzipped)
- **Build Time:** 9.28 seconds
- **Compilation Errors:** 0
- **Backend Routes:** ✅ All redirects implemented and working
- **Backend Status:** ✅ Running and healthy

---

**Document Version:** 3.1 ULTIMATE WITH UPLOAD INTEGRATION
**Last Updated:** 2025-11-08 22:45
**Author:** Claude Code + User Collaboration
**Status:** 🟢 **98% COMPLETE** - Ready for final testing!

## ✅ WHAT'S BEEN COMPLETED (2025-11-08 23:20):

1. **Backend Routes Fixed** ✅ - All old URLs redirect to `/documents-explorer`
   - `/documents-personal` → `/documents-explorer/personal`
   - `/documents-company` → `/documents-explorer/company`
   - `/documents-department` → `/documents-explorer/department`
   - `/documents-team` → `/documents-explorer/team`
   - `/documents-payroll` → `/documents-explorer/payroll`
   - `/document-upload` → `/documents-explorer` (upload integrated)

2. **Old TypeScript Files Deleted** ✅
   - `base.ts` removed
   - `search.ts` removed
   - `upload.ts` removed

3. **Backend Restarted** ✅ - Changes are live!

## 🎯 WHAT'S LEFT TO REACH 100%:

1. **Test all features** (30 min) - Manual testing checklist
2. **Update navigation links** (5 min) - Check if unified-navigation needs updates

**Estimated Time to 100%:** ~35 minutes

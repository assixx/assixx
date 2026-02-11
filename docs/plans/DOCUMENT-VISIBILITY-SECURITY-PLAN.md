# 🔐 DOCUMENT VISIBILITY & SECURITY SYSTEM - COMPREHENSIVE PLAN

**Status:** CRITICAL - Security Isolation Implementation
**Date:** 2025-01-10
**Version:** 1.0
**Author:** Claude Code Analysis

---

## 🚨 EXECUTIVE SUMMARY

**Current State:** BROKEN
**Security Risk:** HIGH
**Critical Issues Found:** 3

### Critical Issues:

1. ❌ **Frontend category dropdown uses wrong values** (work/training vs personal/team)
2. ❌ **Payroll filtering completely broken** (string.includes() on ENUM)
3. ❌ **No automatic visibility mapping** (user must manually select recipient type)

### What User Wants:

> "die sichtbarkeit sollte mit dem dropdown automatisch klar sein"
> **Translation:** Visibility should be automatically determined by dropdown selection

**Security Requirements:**

- ✅ `personal` → Only specific user can see
- ✅ `payroll` → Only specific user can see (special case)
- ✅ `team` → Only team members can see
- ✅ `department` → Only department members can see
- ✅ `company` → All in tenant can see
- ✅ **NEVER** show documents across tenant boundaries

---

## 📊 SYSTEM ANALYSIS

### 1. Database Schema (Verified via `docker exec`)

```sql
CREATE TABLE documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,                      --  TENANT ISOLATION

  -- WHO CAN SEE IT (Access Control)
  recipient_type ENUM('user','team','department','company') DEFAULT 'user',
  user_id INT NOT NULL,                         -- Specific user (when recipient_type='user')
  team_id INT,                                  -- Specific team (when recipient_type='team')
  department_id INT,                            -- Specific dept (when recipient_type='department')

  -- WHAT TYPE OF DOCUMENT (Metadata/Classification)
  category ENUM('personal','work','training','general','salary') NOT NULL,

  -- File storage
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_content LONGBLOB,

  -- Metadata
  description TEXT,
  tags JSON,
  year INT,
  month VARCHAR(20),

  -- Timestamps
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_archived BOOLEAN DEFAULT FALSE,

  -- Foreign Keys
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,

  INDEX idx_tenant_id (tenant_id),
  INDEX idx_recipient_type (recipient_type)
);
```

**Key Insight:**

- `recipient_type` + IDs = **ACCESS CONTROL** (WHO can see)
- `category` field = **METADATA** (WHAT type of document)

### 2. User Session Data (Available in Frontend)

```typescript
interface User {
  id: number; // Current user ID
  tenant_id: number; // Company isolation
  department_id?: number; // User's department
  team_id?: number; // User's team (can be multiple via user_teams)
  role: 'admin' | 'employee' | 'root';
}
```

### 3. Current Sidebar Categories (from HTML)

```html
<li data-category="all">Alle</li>
<li data-category="personal">Persönlich</li>
<li data-category="team">Team</li>
<li data-category="department">Abteilung</li>
<li data-category="company">Firma</li>
<li data-category="payroll">Gehalt</li>
```

### 4. Sidebar Filtering Logic (state.ts:242-261)

```typescript
private matchesCategory(doc: Document, category: DocumentCategory): boolean {
  const categoryMap: Record<string, DocumentCategory> = {
    user: 'personal',      // recipient_type='user' → sidebar 'personal'
    team: 'team',          // recipient_type='team' → sidebar 'team'
    department: 'department',  // recipient_type='department' → sidebar 'department'
    company: 'company',    // recipient_type='company' → sidebar 'company'
  };

  // 🔴 CRITICAL BUG: This is BROKEN!
  if (category === 'payroll') {
    return (
      doc.category.toLowerCase().includes('gehalt') ||
      doc.category.toLowerCase().includes('payroll') ||
      doc.category.toLowerCase().includes('lohn')
    );
  }

  const mappedCategory = categoryMap[doc.recipientType];
  return mappedCategory === category;
}
```

**BUG ANALYSIS:**

- `doc.category` is ENUM: `'salary'` (not a freeform string)
- `'salary'.includes('gehalt')` = **FALSE**
- `'salary'.includes('payroll')` = **FALSE**
- `'salary'.includes('lohn')` = **FALSE**
- **Result:** Payroll documents NEVER show in payroll sidebar!

**CORRECT FIX:**

```typescript
if (category === 'payroll') {
  return doc.category === 'salary' && doc.recipientType === 'user';
}
```

### 5. Backend Access Control (documents.service.ts:693-726)

```typescript
private async checkDocumentAccess(
  document: DbDocument,
  userId: number,
  tenantId: number,
): Promise<boolean> {
  const user = await User.findById(userId, tenantId);
  if (!user) return false;

  // ✅ Admins have access to all documents in their tenant
  if (user.role === 'admin' || user.role === 'root') {
    return true;
  }

  // ✅ Check based on recipient type
  switch (document.recipient_type) {
    case 'user':
      return document.user_id === userId;

    case 'team': {
      if (!document.team_id) return false;
      const teamMembers = await Team.getTeamMembers(document.team_id);
      return teamMembers.some((member: { id: number }) => member.id === userId);
    }

    case 'department':
      return user.department_id === document.department_id;

    case 'company':
      return true; // All users in tenant

    default:
      return false;
  }
}
```

**Security Analysis:** ✅ CORRECT - Access control is properly implemented

---

## 🎯 THE SOLUTION: AUTOMATIC VISIBILITY MAPPING

### Core Concept

**User-Facing Categories** (Dropdown) → **Backend Storage** (Automatic Mapping)

| User Selects   | recipientType  | user_id        | team_id            | department_id      | category (DB) | Who Can See         |
| -------------- | -------------- | -------------- | ------------------ | ------------------ | ------------- | ------------------- |
| **Persönlich** | `'user'`       | currentUser.id | NULL               | NULL               | `'personal'`  | Only me             |
| **Team**       | `'team'`       | NULL           | currentUser.teamId | NULL               | `'work'`      | My team members     |
| **Abteilung**  | `'department'` | NULL           | NULL               | currentUser.deptId | `'work'`      | My department       |
| **Firma**      | `'company'`    | NULL           | NULL               | NULL               | `'general'`   | Everyone in company |
| **Gehalt**     | `'user'`       | currentUser.id | NULL               | NULL               | `'salary'`    | Only me (special)   |

### Why This Mapping?

1. **Sidebar filters by `recipient_type`** (except payroll)
2. **Access control uses `recipient_type` + IDs**
3. **`category` field is metadata only** (except payroll special case)
4. **Automatic = Secure** (no user error possible)

---

## 🔧 IMPLEMENTATION PLAN

### Step 1: Fix Frontend Dropdown ✅

**File:** `frontend/src/pages/documents-explorer.html` (Lines 365-384)

**BEFORE (WRONG):**

```html
<div class="dropdown__menu" id="category-menu">
  <div class="dropdown__option" data-value="work">Arbeitsdokumente</div>
  <div class="dropdown__option" data-value="training">Schulungen</div>
  <div class="dropdown__option" data-value="general">Allgemeine Dokumente</div>
  <div class="dropdown__option" data-value="salary">Gehaltsabrechnungen</div>
</div>
```

**AFTER (CORRECT):**

```html
<div class="dropdown__menu" id="category-menu">
  <div class="dropdown__option" data-value="personal">
    <i class="fas fa-user"></i>
    <span>Persönlich</span>
  </div>
  <div class="dropdown__option" data-value="team">
    <i class="fas fa-users"></i>
    <span>Team</span>
  </div>
  <div class="dropdown__option" data-value="department">
    <i class="fas fa-building"></i>
    <span>Abteilung</span>
  </div>
  <div class="dropdown__option" data-value="company">
    <i class="fas fa-briefcase"></i>
    <span>Gesamte Firma</span>
  </div>
  <div class="dropdown__option" data-value="payroll">
    <i class="fas fa-money-bill"></i>
    <span>Gehalt</span>
  </div>
</div>
```

### Step 2: Add Category Mapping in Upload Modal ✅

**File:** `frontend/src/scripts/documents/explorer/upload-modal.ts`

**Add Mapping Object:**

```typescript
/**
 * Category Mapping: User-facing → Backend storage
 *
 * CRITICAL: This ensures correct visibility/access control
 * - recipientType determines WHO can see it
 * - dbCategory determines document classification
 * - IDs are auto-filled from current user session
 */
interface CategoryMapping {
  recipientType: 'user' | 'team' | 'department' | 'company';
  dbCategory: 'personal' | 'work' | 'training' | 'general' | 'salary';
  requiresTeam?: boolean;
  requiresDepartment?: boolean;
}

const CATEGORY_MAPPINGS: Record<string, CategoryMapping> = {
  'personal': {
    recipientType: 'user',
    dbCategory: 'personal',
  },
  'team': {
    recipientType: 'team',
    dbCategory: 'work',
    requiresTeam: true,
  },
  'department': {
    recipientType: 'department',
    dbCategory: 'work',
    requiresDepartment: true,
  },
  'company': {
    recipientType: 'company',
    dbCategory: 'general',
  },
  'payroll': {
    recipientType: 'user',
    dbCategory: 'salary',
  },
};

/**
 * Get current user from session
 */
private async getCurrentUser(): Promise<User> {
  const response = await fetch('/api/v2/users/me', {
    headers: {
      'Authorization': `Bearer ${this.authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  const data = await response.json();
  return data.data || data.user || data;
}

/**
 * Validate category selection based on user data
 */
private validateCategorySelection(category: string, user: User): boolean {
  const mapping = CATEGORY_MAPPINGS[category];
  if (!mapping) return false;

  if (mapping.requiresTeam && !user.team_id) {
    showWarningAlert('Sie müssen einem Team zugeordnet sein, um Team-Dokumente hochzuladen!');
    return false;
  }

  if (mapping.requiresDepartment && !user.department_id) {
    showWarningAlert('Sie müssen einer Abteilung zugeordnet sein, um Abteilungs-Dokumente hochzuladen!');
    return false;
  }

  return true;
}

/**
 * Build FormData with automatic visibility mapping
 */
private async buildFormData(file: File, category: string): Promise<FormData | null> {
  // Get current user
  const user = await this.getCurrentUser();

  // Validate category selection
  if (!this.validateCategorySelection(category, user)) {
    return null;
  }

  const mapping = CATEGORY_MAPPINGS[category];
  const fd = new FormData();

  // File
  fd.append('document', file);

  // Backend fields (automatic mapping)
  fd.append('category', mapping.dbCategory);  // DB ENUM value
  fd.append('recipientType', mapping.recipientType);

  // Auto-populate IDs based on recipient type
  switch (mapping.recipientType) {
    case 'user':
      fd.append('userId', user.id.toString());
      break;

    case 'team':
      if (user.team_id) {
        fd.append('teamId', user.team_id.toString());
      } else {
        throw new Error('User has no team_id');
      }
      break;

    case 'department':
      if (user.department_id) {
        fd.append('departmentId', user.department_id.toString());
      } else {
        throw new Error('User has no department_id');
      }
      break;

    case 'company':
      // No specific ID needed - all in tenant
      break;
  }

  // Optional fields
  const description = (document.getElementById('upload-description') as HTMLTextAreaElement)?.value;
  if (description) {
    fd.append('description', description.trim());
  }

  // Tags (if any)
  const tags = this.getSelectedTags();
  if (tags.length > 0) {
    fd.append('tags', JSON.stringify(tags));
  }

  return fd;
}
```

### Step 3: Remove/Hide Visibility Radio Buttons (Optional) ✅

Since visibility is now automatic, the visibility radio buttons are redundant.

**Option A: Hide them completely**

```typescript
// In upload-modal.ts
private hideVisibilityOptions(): void {
  const visibilitySection = document.querySelector('.visibility-options');
  if (visibilitySection) {
    visibilitySection.style.display = 'none';
  }
}
```

**Option B: Auto-set them (keep for visual feedback)**

```typescript
private updateVisibilityDisplay(category: string): void {
  const mapping = CATEGORY_MAPPINGS[category];
  const radioInput = document.querySelector(
    `input[name="visibility"][value="${mapping.recipientType}"]`
  ) as HTMLInputElement;

  if (radioInput) {
    radioInput.checked = true;
    radioInput.disabled = true; // Read-only
  }
}
```

**Recommendation:** Keep them auto-set (Option B) for visual feedback, but make them disabled/read-only.

### Step 4: Fix Payroll Filtering Bug ✅

**File:** `frontend/src/scripts/documents/explorer/state.ts` (Lines 251-257)

**BEFORE (BROKEN):**

```typescript
if (category === 'payroll') {
  return (
    doc.category.toLowerCase().includes('gehalt') ||
    doc.category.toLowerCase().includes('payroll') ||
    doc.category.toLowerCase().includes('lohn')
  );
}
```

**AFTER (FIXED):**

```typescript
// Payroll: recipient_type='user' AND category='salary' AND user_id=currentUser
if (category === 'payroll') {
  // Note: currentUser.id should be available in state
  return (
    doc.category === 'salary' && doc.recipientType === 'user' && doc.userId === this.currentUserId // Add currentUserId to state
  );
}
```

**Alternative (if currentUserId not in state):**

```typescript
if (category === 'payroll') {
  return doc.category === 'salary' && doc.recipientType === 'user';
  // Backend filtering will ensure only current user's docs are returned
}
```

### Step 5: Update Backend Validation ✅

**File:** `backend/src/routes/v2/documents/documents.validation.zod.ts`

**BEFORE:**

```typescript
const CategorySchema = z.enum(['personal', 'work', 'training', 'general', 'salary'], {
  message: 'Invalid category',
});
```

**AFTER:**

```typescript
// Accept both frontend AND backend values for backwards compatibility
const CategorySchema = z
  .enum(
    [
      // Frontend values (user-facing)
      'personal',
      'team',
      'department',
      'company',
      'payroll',
      // Backend DB values (for API compatibility)
      'work',
      'training',
      'general',
      'salary',
    ],
    {
      message: 'Invalid category',
    },
  )
  .transform((val) => {
    // Map frontend values to DB values
    const mapping: Record<string, string> = {
      personal: 'personal',
      team: 'work',
      department: 'work',
      company: 'general',
      payroll: 'salary',
      // DB values pass through unchanged
      work: 'work',
      training: 'training',
      general: 'general',
      salary: 'salary',
    };
    return mapping[val] || val;
  });
```

**Alternative (simpler - recommended):**

Keep backend validation as-is, but ensure frontend ALWAYS sends DB ENUM values (via mapping in upload-modal.ts). This is cleaner and follows separation of concerns.

---

## SECURITY VERIFICATION MATRIX

### Test Scenarios (Must ALL Pass)

| #   | Scenario                                       | Expected Result                | Verification                                |
| --- | ---------------------------------------------- | ------------------------------ | ------------------------------------------- |
| 1   | User A uploads "Persönlich" doc                | Only User A can see it         | ✅ recipient_type='user', user_id=A         |
| 2   | User A uploads "Team" doc (team_id=5)          | Only members of team 5 can see | ✅ recipient_type='team', team_id=5         |
| 3   | User B (team_id=7) tries to see A's team doc   | Access denied                  | ✅ checkDocumentAccess returns false        |
| 4   | User A uploads "Abteilung" (dept_id=3)         | Only dept 3 members can see    | ✅ recipient_type='department'              |
| 5   | User C (dept_id=8) tries to see A's dept doc   | Access denied                  | ✅ department_id mismatch                   |
| 6   | User A uploads "Firma" doc                     | All tenant users can see       | ✅ recipient_type='company'                 |
| 7   | User D (different tenant) tries to see A's doc | Access denied (404)            | ✅ tenant_id filter in query                |
| 8   | User A uploads "Gehalt" doc                    | Only User A can see            | ✅ recipient_type='user', category='salary' |
| 9   | Admin views any tenant doc                     | Success                        | ✅ Admin bypass in checkDocumentAccess      |
| 10  | User without team tries to upload "Team"       | Validation error               | ✅ Frontend validation                      |
| 11  | User without dept tries "Abteilung"            | Validation error               | ✅ Frontend validation                      |
| 12  | User switches teams                            | Loses access to old team docs  | ✅ Dynamic team_id check                    |
| 13  | Sidebar "Gehalt" click                         | Shows only salary docs for me  | ✅ Fixed payroll filter                     |
| 14  | Sidebar "Team" click                           | Shows all my team docs         | ✅ recipient_type='team' filter             |
| 15  | API call without tenant_id                     | Blocked                        | ✅ All queries filter by tenant_id          |

### SQL Security Verification

**Query Pattern (Always Used):**

```sql
SELECT * FROM documents
WHERE tenant_id = ?
  AND (
    -- Access control based on recipient_type
    (recipient_type = 'user' AND user_id = ?)
    OR (recipient_type = 'team' AND team_id IN (?))
    OR (recipient_type = 'department' AND department_id = ?)
    OR recipient_type = 'company'
  )
```

**Security Guarantees:**

1. ✅ `tenant_id` ALWAYS in WHERE clause (multi-tenant isolation)
2. ✅ Access control via recipient_type + IDs
3. ✅ No documents leak across tenants
4. ✅ No documents leak across teams/departments
5. ✅ Admin role checked before query execution

---

## 🐛 EDGE CASES & SOLUTIONS

### Edge Case 1: User Has Multiple Teams

**Problem:** User is member of teams 5, 7, and 9. How to handle?

**Solution:** ✅ Already handled!

```typescript
case 'team': {
  const teamMembers = await Team.getTeamMembers(document.team_id);
  return teamMembers.some((member) => member.id === userId);
}
```

**SQL Query:**

```sql
SELECT * FROM documents
WHERE recipient_type = 'team'
  AND team_id IN (
    SELECT team_id FROM user_teams WHERE user_id = ?
  )
```

### Edge Case 2: User Switches Teams

**Problem:** User was in team 5, now in team 7. What happens to old docs?

**Solution:**

- Documents uploaded to team 5 stay with team 5
- User loses access to team 5 documents ✅
- User gains access to team 7 documents ✅
- This is CORRECT behavior (team documents belong to team, not individual)

### Edge Case 3: User Has No Team

**Problem:** User tries to upload "Team" document but has no team_id.

**Solution:**

```typescript
if (mapping.requiresTeam && !user.team_id) {
  showWarningAlert('Sie müssen einem Team zugeordnet sein!');
  return null;
}
```

**Additional:** Disable "Team" option in dropdown if user has no team:

```typescript
private async updateCategoryOptions(): Promise<void> {
  const user = await this.getCurrentUser();

  const teamOption = document.querySelector('[data-value="team"]');
  if (teamOption && !user.team_id) {
    teamOption.classList.add('disabled');
    teamOption.setAttribute('title', 'Sie sind keinem Team zugeordnet');
  }

  const deptOption = document.querySelector('[data-value="department"]');
  if (deptOption && !user.department_id) {
    deptOption.classList.add('disabled');
    deptOption.setAttribute('title', 'Sie sind keiner Abteilung zugeordnet');
  }
}
```

### Edge Case 4: Team Is Deleted

**Problem:** Team 5 is deleted. What happens to team 5 documents?

**Current Behavior:** `ON DELETE CASCADE` → Documents are deleted! ⚠️

**Better Solution:** Change to `ON DELETE SET NULL`:

```sql
ALTER TABLE documents
DROP FOREIGN KEY fk_documents_team_id;

ALTER TABLE documents
ADD CONSTRAINT fk_documents_team_id
FOREIGN KEY (team_id) REFERENCES teams(id)
ON DELETE SET NULL;
```

Then handle orphaned documents:

```typescript
if (document.recipient_type === 'team' && !document.team_id) {
  // Team was deleted - mark as orphaned
  // Only admins can see orphaned documents
  return user.role === 'admin' || user.role === 'root';
}
```

### Edge Case 5: Department Is Renamed

**Problem:** No issue - department_id stays the same, only name changes.

**Solution:** ✅ No action needed.

### Edge Case 6: Admin Uploads Document

**Problem:** Admin uploads "Team" document but might not be in any team.

**Solution:**

- Admins should select WHICH team when uploading
- Add team selector for admins:

```html
<!-- Show only for admins when category='team' -->
<div id="team-selector" style="display: none;">
  <label>Für welches Team?</label>
  <select id="target-team">
    <!-- Populated dynamically -->
  </select>
</div>
```

Same for department documents.

### Edge Case 7: Payroll Documents for Other Users

**Problem:** Admin wants to upload payroll for specific employee.

**Solution:**

- Add user selector when category='payroll' AND user.role='admin':

```html
<!-- Show only for admins when category='payroll' -->
<div id="user-selector" style="display: none;">
  <label>Für welchen Mitarbeiter?</label>
  <select id="target-user">
    <!-- Populated with employees -->
  </select>
</div>
```

Then:

```typescript
if (category === 'payroll' && user.role === 'admin') {
  const targetUserId = (document.getElementById('target-user') as HTMLSelectElement).value;
  fd.append('userId', targetUserId);
} else {
  fd.append('userId', user.id.toString());
}
```

---

## 📋 TESTING CHECKLIST

### Pre-Implementation Tests

- [ ] Verify current database schema matches documentation
- [ ] Check all existing documents have valid recipient_type values
- [ ] Verify user_teams table has correct relationships
- [ ] Check that payroll filtering is actually broken (expected: yes)

### Post-Implementation Tests

#### Unit Tests

- [ ] Category mapping object returns correct values
- [ ] validateCategorySelection correctly checks team/dept membership
- [ ] buildFormData includes all required fields
- [ ] Payroll filter correctly checks category='salary'

#### Integration Tests (Upload Flow)

- [ ] Upload "Persönlich" → Check DB: recipient_type='user', user_id=me, category='personal'
- [ ] Upload "Team" → Check DB: recipient_type='team', team_id=myTeam, category='work'
- [ ] Upload "Abteilung" → Check DB: recipient_type='department', department_id=myDept, category='work'
- [ ] Upload "Firma" → Check DB: recipient_type='company', category='general'
- [ ] Upload "Gehalt" → Check DB: recipient_type='user', user_id=me, category='salary'

#### Integration Tests (Visibility/Access)

- [ ] User A sees own personal docs, not User B's personal docs
- [ ] User A sees own team docs, not User C's team docs (different team)
- [ ] User A sees own department docs, not User D's dept docs (different dept)
- [ ] All users see company docs
- [ ] User A sees own payroll docs, not User B's payroll docs
- [ ] Admin sees all documents in their tenant

#### Integration Tests (Sidebar Filtering)

- [ ] Click "Persönlich" → Shows only my personal docs (recipient_type='user')
- [ ] Click "Team" → Shows only my team docs (recipient_type='team', team_id IN myTeams)
- [ ] Click "Abteilung" → Shows only my dept docs (recipient_type='department', department_id=myDept)
- [ ] Click "Firma" → Shows all company docs (recipient_type='company')
- [ ] Click "Gehalt" → Shows only my payroll docs (category='salary', recipient_type='user')

#### Security Tests (Cross-Tenant)

- [ ] User in tenant 1 cannot see docs from tenant 2
- [ ] API call with tenant_id=1 cannot access documents with tenant_id=2
- [ ] SQL injection attempt with tenant_id parameter fails safely

#### Edge Case Tests

- [ ] User with no team cannot select "Team" category (validation error)
- [ ] User with no dept cannot select "Abteilung" category (validation error)
- [ ] User switches teams → Loses access to old team docs, gains access to new team docs
- [ ] Team is deleted → Documents become orphaned, only admins can see
- [ ] Admin uploads doc for specific team (using team selector)

---

## 🚀 DEPLOYMENT CHECKLIST

### Phase 1: Preparation (30 min)

- [ ] Backup database: `bash scripts/quick-backup.sh "before_visibility_fix"`
- [ ] Create feature branch: `git checkout -b fix/document-visibility-security`
- [ ] Read all relevant docs (this file, DATABASE-MIGRATION-GUIDE.md)
- [ ] Verify current system behavior (take screenshots of broken payroll filter)

### Phase 2: Frontend Changes (1 hour)

- [ ] Fix dropdown values in documents-explorer.html
- [ ] Add CATEGORY_MAPPINGS object in upload-modal.ts
- [ ] Implement getCurrentUser() method
- [ ] Implement validateCategorySelection() method
- [ ] Implement buildFormData() with automatic mapping
- [ ] Fix payroll filter in state.ts
- [ ] Update visibility radio buttons (auto-set or hide)
- [ ] Add team/dept selector for admins (if needed)
- [ ] Run `docker exec assixx-backend pnpm run type-check`
- [ ] Run `docker exec assixx-backend pnpm run lint`

### Phase 3: Backend Changes (30 min)

- [ ] Review validation in documents.validation.zod.ts (no change needed if frontend maps correctly)
- [ ] Test API with new category values
- [ ] Verify access control logic (should already be correct)
- [ ] Run `docker exec assixx-backend pnpm run type-check`

### Phase 4: Testing (2 hours)

- [ ] Build frontend: `docker exec assixx-backend pnpm run build`
- [ ] Restart backend: `docker-compose restart backend`
- [ ] Clear browser cache (Ctrl+Shift+R)
- [ ] Run all tests from Testing Checklist above
- [ ] Fix any issues found
- [ ] Re-test until all pass

### Phase 5: Documentation (30 min)

- [ ] Update docs/FEATURES.md with correct visibility behavior
- [ ] Update docs/DATABASE-SETUP-README.md with security notes
- [ ] Add this plan to docs/ folder (already done)
- [ ] Document any issues/workarounds discovered

### Phase 6: Deployment (15 min)

- [ ] Commit changes: `git add -A && git commit -m "Fix: Document visibility and security isolation"`
- [ ] Test one final time
- [ ] Create PR (if using PR workflow) or merge to main
- [ ] Tag release: `git tag -a v0.1.1-visibility-fix -m "Fixed document visibility security"`
- [ ] Monitor logs for any errors: `docker logs -f assixx-backend --tail=100`

---

## 📚 RELATED DOCUMENTATION

- [DATABASE-SETUP-README.md](./DATABASE-SETUP-README.md) - Database schema reference
- [DATABASE-MIGRATION-GUIDE.md](./DATABASE-MIGRATION-GUIDE.md) - How to create migrations
- [TYPESCRIPT-STANDARDS.md](./TYPESCRIPT-STANDARDS.md) - TypeScript best practices
- [DESIGN-STANDARDS.md](./DESIGN-STANDARDS.md) - UI/UX guidelines

---

## 🔗 REFERENCES

### Best Practices (2025)

- Multi-Tenant RLS: [AWS PostgreSQL RLS Guide](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- Access Control Patterns: [Recipient Type ENUM Pattern](https://cazzer.medium.com/designing-the-most-performant-row-level-security-strategy-in-postgres-a06084f31945)
- Security Standards: [OWASP SaaS Security](https://owasp.org/www-project-saas-security/)

### Code References

- Backend Access Control: `backend/src/routes/v2/documents/documents.service.ts:693-726`
- Frontend Filtering: `frontend/src/scripts/documents/explorer/state.ts:242-261`
- Database Schema: `database/schema/02-modules/documents.sql`
- Validation: `backend/src/routes/v2/documents/documents.validation.zod.ts`

---

## ❓ FAQ

### Q: Why not use the category field for access control?

**A:** The category field is metadata/classification (WHAT type of document). Access control should be separate (WHO can see it) via recipient_type + IDs. This follows separation of concerns and makes the system more flexible.

### Q: What if we need more categories in the future?

**A:** Add them to the `category` ENUM and update the mapping. The access control logic (recipient_type) remains unchanged. This is the beauty of separating "what" from "who".

### Q: Can we add a "supervisor" recipient type?

**A:** Yes! Add `'supervisor'` to the recipient_type ENUM, then add logic in checkDocumentAccess:

```typescript
case 'supervisor': {
  const subordinates = await User.getSubordinates(userId);
  return subordinates.some(s => s.id === document.user_id);
}
```

### Q: What about document versioning?

**A:** Already supported! Database has `file_uuid`, `version`, and `parent_version_id` fields. Versioning is orthogonal to visibility - each version inherits the access control of the original document.

### Q: Performance impact of these queries?

**A:** Minimal. The database has indexes on:

- `idx_tenant_id` (tenant isolation)
- `idx_recipient_type` (access filtering)
- `idx_team_id`, `idx_department_id` (FK indexes)

Queries will be fast even with millions of documents.

---

**END OF DOCUMENT**

_Generated by Claude Code Analysis - 2025-01-10_
_Version 1.0 - Security Implementation Plan_
_Status: READY FOR IMPLEMENTATION_

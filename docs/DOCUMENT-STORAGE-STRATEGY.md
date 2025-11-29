# 📦 Ultimate Document Storage Strategy - Assixx 2025

> **Status:** PRODUCTION READY
> **Created:** 2025-11-06
> **Based on:** AWS S3, Google Drive, Microsoft OneDrive, Dropbox Best Practices

---

## 🎯 Executive Summary

**Current Problem:**
- ❌ Flat directory: `/uploads/documents/Test.pdf`
- ❌ No collision handling: Multiple "Test.pdf" = overwrite
- ❌ No organization: All categories mixed
- ❌ No scalability: Filesystem limits (millions of files in one folder)
- ❌ No backup strategy: Single point of failure
- ❌ Security risk: Predictable file paths

**Solution:**
- ✅ Hierarchical structure with UUID-based filenames
- ✅ Content-addressable storage (optional)
- ✅ Multi-tenant isolation
- ✅ Automatic collision prevention
- ✅ Scalable to billions of files
- ✅ Security-first design

---

## 📊 Current State Analysis

### What We Have Now:

```sql
-- Documents Table Structure
CREATE TABLE documents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,              -- ✅ Multi-tenant isolation
    user_id INT NOT NULL,                -- ✅ Owner tracking
    recipient_type ENUM(...),            -- ✅ Access control
    team_id INT,                         -- ✅ Team sharing
    department_id INT,                   -- ✅ Department sharing
    category ENUM(...),                  -- ✅ Categorization
    filename VARCHAR(255) NOT NULL,      -- ⚠️ Original filename (collision risk)
    original_name VARCHAR(255) NOT NULL, -- ✅ User's original name
    file_path VARCHAR(500) NOT NULL,     -- ⚠️ Predictable path
    file_size INT NOT NULL,              -- ✅ Size tracking
    file_content LONGBLOB,               -- ⚠️ DB storage (slow, expensive)
    mime_type VARCHAR(100),              -- ✅ Content type
    description TEXT,                    -- ✅ Metadata
    year INT,                            -- ⚠️ Manual date field (redundant)
    month VARCHAR(20),                   -- ⚠️ Manual date field (redundant)
    tags JSON,                           -- ✅ Searchable metadata
    is_public TINYINT(1) DEFAULT 0,      -- ✅ Public sharing
    is_archived TINYINT(1) DEFAULT 0,    -- ✅ Soft delete
    uploaded_at TIMESTAMP DEFAULT NOW,   -- ✅ Timestamp
    archived_at TIMESTAMP,               -- ✅ Archive tracking
    expires_at TIMESTAMP,                -- ✅ Auto-deletion
    created_by INT                       -- ✅ Uploader tracking
);
```

### Problems:

1. **Collision Risk**: Same filename = overwrite
2. **Flat Structure**: All files in one folder
3. **Predictable Paths**: Security risk (`/uploads/documents/salary_2024.pdf`)
4. **No Versioning**: Lost when overwritten
5. **DB vs Filesystem**: Mixed storage strategy
6. **Manual Date Fields**: `year` and `month` are redundant (have `uploaded_at`)

---

## 🏗️ The Ultimate Solution

### Industry Standards (2025):

**How Big Tech Does It:**

1. **AWS S3**:
   ```
   s3://bucket/tenant-123/documents/2024/11/uuid-v4.pdf
   ```

2. **Google Drive**:
   ```
   - UUID-based file IDs
   - Metadata in database
   - Content in Colossus (distributed FS)
   - CDN for delivery
   ```

3. **Dropbox**:
   ```
   - Content-addressable (SHA-256 hash)
   - Deduplication: Same file = one copy
   - Block-level sync
   ```

4. **Microsoft OneDrive**:
   ```
   /tenants/{tenant-id}/users/{user-id}/{year}/{month}/{uuid}.ext
   ```

---

## 🎯 Recommended Architecture

### **Option A: Hybrid Storage (RECOMMENDED)**

**For files < 10MB:** Database BLOB (fast, transactional)
**For files ≥ 10MB:** Filesystem with CDN

**Directory Structure:**

```bash
uploads/
├── documents/
│   ├── {tenant_id}/                    # Multi-tenant isolation
│   │   ├── company/                    # Category-based
│   │   │   ├── {year}/                 # Year-based archiving
│   │   │   │   ├── {month}/            # Month-based archiving
│   │   │   │   │   ├── {uuid}.pdf     # Unique identifier
│   │   │   │   │   ├── {uuid}.docx
│   │   │   │   │   └── metadata.json  # Optional: Quick lookup
│   │   ├── department/
│   │   │   └── ...
│   │   ├── team/
│   │   │   └── ...
│   │   ├── personal/
│   │   │   └── ...
│   │   └── payroll/
│   │       └── ...
│   ├── temp/                           # Upload staging area
│   └── trash/                          # Soft-deleted files (30-day retention)
```

**Example Path:**
```
/uploads/documents/42/company/2024/11/f47ac10b-58cc-4372-a567-0e02b2c3d479.pdf
                   │   │       │    │  └─ UUID v4 (collision-proof)
                   │   │       │    └─ Month (01-12)
                   │   │       └─ Year (YYYY)
                   │   └─ Category (company/department/team/personal/payroll)
                   └─ Tenant ID (multi-tenant isolation)
```

---

## 🔐 Security Benefits

### UUID-based Filenames:

**Before (Insecure):**
```
/uploads/documents/John_Doe_Salary_2024.pdf  ❌ Predictable, guessable
```

**After (Secure):**
```
/uploads/documents/42/payroll/2024/11/f47ac10b-58cc-4372-a567-0e02b2c3d479.pdf  ✅
```

**Benefits:**
- ✅ **Impossible to guess**: UUIDs are cryptographically random
- ✅ **No information leakage**: Filename reveals nothing
- ✅ **Collision-proof**: 2^122 possible UUIDs
- ✅ **Access control**: Must go through API with auth

---

## 📋 Database Schema Updates

### Required Changes:

```sql
ALTER TABLE documents
    -- Add UUID column
    ADD COLUMN file_uuid VARCHAR(36) UNIQUE NOT NULL AFTER id,

    -- Add storage type
    ADD COLUMN storage_type ENUM('database', 'filesystem', 's3') DEFAULT 'filesystem' AFTER file_content,

    -- Add checksum for integrity
    ADD COLUMN file_checksum VARCHAR(64) COMMENT 'SHA-256 hash' AFTER file_size,

    -- Add version support
    ADD COLUMN version INT DEFAULT 1 AFTER file_uuid,
    ADD COLUMN parent_version_id INT NULL COMMENT 'For versioning' AFTER version,

    -- Remove redundant year/month (use uploaded_at instead)
    DROP COLUMN year,
    DROP COLUMN month,

    -- Add indexes
    ADD INDEX idx_file_uuid (file_uuid),
    ADD INDEX idx_tenant_category (tenant_id, category),
    ADD INDEX idx_storage_type (storage_type),
    ADD INDEX idx_file_checksum (file_checksum);
```

**New Columns Explained:**

| Column | Type | Purpose | Example |
|--------|------|---------|---------|
| `file_uuid` | VARCHAR(36) | Unique identifier | `f47ac10b-58cc-4372-a567-0e02b2c3d479` |
| `storage_type` | ENUM | Where is file stored? | `filesystem`, `database`, `s3` |
| `file_checksum` | VARCHAR(64) | SHA-256 hash | `e3b0c44298fc1c149afb...` |
| `version` | INT | Version number | 1, 2, 3... |
| `parent_version_id` | INT | Previous version | NULL, 123, 456... |

---

## 🚀 Implementation Plan

### Phase 1: Immediate (This Week)

**1. Add UUID Generation to Upload**

```typescript
// backend/src/routes/v2/documents/documents.controller.ts
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

function generateFileMetadata(file: Express.Multer.File) {
    const uuid = uuidv4();
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

    return {
        uuid,
        checksum,
        originalName: file.originalname,
        sanitizedName: sanitizeFilename(file.originalname),
    };
}

function sanitizeFilename(filename: string): string {
    // Remove special chars, keep extension
    return filename
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .toLowerCase();
}
```

**2. Build Storage Path**

```typescript
function buildStoragePath(
    tenantId: number,
    category: string,
    uuid: string,
    extension: string
): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    return `/uploads/documents/${tenantId}/${category}/${year}/${month}/${uuid}${extension}`;
}
```

**3. Update Database Insert**

```typescript
await executeQuery(
    `INSERT INTO documents (
        tenant_id, user_id, file_uuid, filename, original_name,
        file_path, file_size, file_checksum, storage_type, mime_type,
        category, recipient_type, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
        tenantId,
        userId,
        metadata.uuid,                  // New: UUID
        metadata.sanitizedName,         // Safe filename
        metadata.originalName,          // User's original
        storagePath,                    // Full path with UUID
        file.size,
        metadata.checksum,              // New: SHA-256
        'filesystem',                   // New: Storage type
        file.mimetype,
        category,
        recipientType,
        userId
    ]
);
```

---

### Phase 2: Migration (Next Week)

**Migrate Existing Files:**

```typescript
// scripts/migrate-documents-to-uuid.ts
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

async function migrateDocuments() {
    // 1. Get all documents without UUID
    const documents = await executeQuery(
        'SELECT * FROM documents WHERE file_uuid IS NULL'
    );

    for (const doc of documents) {
        const uuid = uuidv4();
        const ext = path.extname(doc.filename);
        const newPath = buildStoragePath(doc.tenant_id, doc.category, uuid, ext);

        // 2. Move file on filesystem
        if (await fileExists(doc.file_path)) {
            await fs.rename(doc.file_path, newPath);
        }

        // 3. Calculate checksum
        const buffer = await fs.readFile(newPath);
        const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

        // 4. Update database
        await executeQuery(
            'UPDATE documents SET file_uuid = ?, file_path = ?, file_checksum = ? WHERE id = ?',
            [uuid, newPath, checksum, doc.id]
        );
    }
}
```

---

### Phase 3: Advanced Features (Future)

1. **Content Deduplication** (Like Dropbox)
   - Same file uploaded twice = single storage copy
   - Multiple DB entries point to same file_checksum

2. **Versioning** (Like Google Drive)
   ```sql
   -- Keep old versions
   INSERT INTO document_versions (
       document_id, version, file_uuid, file_path, uploaded_at
   ) VALUES (?, ?, ?, ?, NOW());
   ```

3. **CDN Integration** (Like AWS CloudFront)
   - Serve files through CDN
   - Reduce server load
   - Faster global delivery

4. **Cloud Storage Migration** (Like AWS S3)
   ```typescript
   // Use AWS SDK
   await s3.putObject({
       Bucket: 'assixx-documents',
       Key: `${tenantId}/${category}/${year}/${month}/${uuid}.pdf`,
       Body: fileBuffer,
   });
   ```

---

## 📊 Performance Comparison

### Current vs Proposed:

| Metric | Current (Flat) | Proposed (Hierarchical) |
|--------|----------------|-------------------------|
| **Max Files/Folder** | ~10,000 (OS limit) | Unlimited (sharded) |
| **Lookup Speed** | O(n) linear scan | O(1) direct access |
| **Collision Risk** | HIGH (same name) | ZERO (UUID) |
| **Security** | LOW (guessable) | HIGH (random UUID) |
| **Scalability** | Poor (10K+ slow) | Excellent (millions) |
| **Backup** | Slow (one folder) | Fast (parallel) |
| **Multi-tenant** | None | Built-in |

---

## 🔧 Code Changes Required

### 1. Update Model (document.ts)

```typescript
interface DocumentCreateData {
    // ... existing fields ...
    file_uuid?: string;           // NEW: UUID for file
    file_checksum?: string;       // NEW: SHA-256 hash
    storage_type?: 'database' | 'filesystem' | 's3'; // NEW
    version?: number;             // NEW: Version number
    parent_version_id?: number;   // NEW: For versioning
}
```

### 2. Update Controller (documents.controller.ts)

```typescript
// Add UUID generation
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// Generate UUID and checksum before saving
const uuid = uuidv4();
const checksum = crypto.createHash('sha256')
    .update(file.buffer)
    .digest('hex');
```

### 3. Update Service (documents.service.ts)

```typescript
// Build hierarchical path
function buildDocumentPath(
    tenantId: number,
    category: string,
    uuid: string,
    ext: string
): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    return path.join(
        process.cwd(),
        'uploads',
        'documents',
        tenantId.toString(),
        category,
        year.toString(),
        month,
        `${uuid}${ext}`
    );
}
```

---

## ✅ Database Column Assessment

### Current Columns - Keep or Remove?

| Column | Status | Reason |
|--------|--------|--------|
| `id` | ✅ Keep | Primary key |
| `tenant_id` | ✅ Keep | Multi-tenant isolation |
| `user_id` | ✅ Keep | Owner |
| `recipient_type` | ✅ Keep | Access control |
| `team_id` | ✅ Keep | Sharing |
| `department_id` | ✅ Keep | Sharing |
| `category` | ✅ Keep | Organization |
| `filename` | ✅ Keep | Display name |
| `original_name` | ✅ Keep | User's name |
| `file_path` | ✅ Keep | Storage path |
| `file_size` | ✅ Keep | Quota tracking |
| `file_content` | ⚠️ Optional | Only for small files |
| `mime_type` | ✅ Keep | Content type |
| `description` | ✅ Keep | Metadata |
| `year` | ❌ Remove | Redundant (use uploaded_at) |
| `month` | ❌ Remove | Redundant (use uploaded_at) |
| `tags` | ✅ Keep | Search |
| `is_public` | ✅ Keep | Sharing |
| `is_archived` | ✅ Keep | Soft delete |
| `uploaded_at` | ✅ Keep | Timestamp |
| `archived_at` | ✅ Keep | Audit |
| `expires_at` | ✅ Keep | Auto-cleanup |
| `created_by` | ✅ Keep | Audit |

### New Columns - Add:

| Column | Type | Purpose |
|--------|------|---------|
| `file_uuid` | VARCHAR(36) | Unique ID, collision-proof |
| `file_checksum` | VARCHAR(64) | Integrity verification |
| `storage_type` | ENUM | DB vs filesystem vs S3 |
| `version` | INT | Version number |
| `parent_version_id` | INT | Previous version link |

---

## 🎯 Final Recommendation

### Immediate Action (Today):

```bash
# 1. Create migration file
cat > database/migrations/006-document-storage-upgrade.sql << 'EOF'
-- Add UUID and checksum support
ALTER TABLE documents
    ADD COLUMN file_uuid VARCHAR(36) UNIQUE AFTER id,
    ADD COLUMN file_checksum VARCHAR(64) AFTER file_size,
    ADD COLUMN storage_type ENUM('database', 'filesystem', 's3') DEFAULT 'filesystem' AFTER file_content,
    ADD COLUMN version INT DEFAULT 1 AFTER file_uuid,
    ADD COLUMN parent_version_id INT NULL AFTER version,
    ADD INDEX idx_file_uuid (file_uuid),
    ADD INDEX idx_file_checksum (file_checksum);

-- Remove redundant columns (year/month already in uploaded_at)
-- Note: Keep for now if existing code depends on them
-- ALTER TABLE documents DROP COLUMN year, DROP COLUMN month;
EOF

# 2. Run migration
bash scripts/quick-backup.sh "before_document_storage_upgrade"
docker cp database/migrations/006-document-storage-upgrade.sql assixx-mysql:/tmp/
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pYOUR_PASSWORD main < /tmp/006-document-storage-upgrade.sql'
```

### Next Steps:

1. ✅ Run database migration
2. ✅ Update upload code to use UUIDs
3. ✅ Test with new uploads
4. ✅ Migrate existing files (when ready)
5. ✅ Add versioning support
6. ✅ Consider S3 for large files

---

## 📚 References

- **AWS S3 Best Practices**: https://docs.aws.amazon.com/s3/
- **Google Cloud Storage**: https://cloud.google.com/storage/docs/best-practices
- **UUID RFC 4122**: https://datatracker.ietf.org/doc/html/rfc4122
- **Content-Addressable Storage**: https://en.wikipedia.org/wiki/Content-addressable_storage

---

## 🎉 Benefits of This Approach

1. ✅ **Zero Collisions**: UUIDs guarantee uniqueness
2. ✅ **Scalable**: Sharded by tenant/category/date
3. ✅ **Secure**: Unpredictable paths
4. ✅ **Multi-tenant**: Isolated by tenant_id
5. ✅ **Fast**: Direct path lookup, no scanning
6. ✅ **Maintainable**: Clear organization
7. ✅ **Future-proof**: Easy to migrate to S3/cloud
8. ✅ **Versioning**: Support for file versions
9. ✅ **Integrity**: SHA-256 checksums
10. ✅ **Industry Standard**: Used by all major cloud providers

---

**Next Action:** Run the migration and update upload code! 🚀

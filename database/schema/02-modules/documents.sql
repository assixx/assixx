-- =====================================================
-- documents.sql - Document Management System (Ultimate Clean)
-- =====================================================
-- Clean Architecture with Clear Access Control
-- Refactored: 2025-01-10
-- Migration: 2025-01-10_document_schema_ultimate_refactor.sql
-- =====================================================
-- PHILOSOPHY:
-- - access_scope = WHO can see (maps 1:1 to frontend sidebar)
-- - owner/target fields = Clear semantic meaning
-- - category = Flexible document classification (VARCHAR, not ENUM)
-- - Database constraints enforce consistency
-- =====================================================

CREATE TABLE IF NOT EXISTS documents (
  -- ============ PRIMARY KEY ============
  id INT PRIMARY KEY AUTO_INCREMENT,

  -- ============ UUID & VERSIONING ============
  file_uuid VARCHAR(36) DEFAULT NULL
    COMMENT 'UUID v4 for unique file identification',

  version INT DEFAULT 1
    COMMENT 'Document version number',

  parent_version_id INT DEFAULT NULL
    COMMENT 'Previous version ID for version history',

  -- ============ TENANT ISOLATION ============
  tenant_id INT NOT NULL
    COMMENT 'Company/tenant ID for multi-tenant isolation',

  -- ============ ACCESS CONTROL (Single Source of Truth) ============
  -- Maps 1:1 to frontend sidebar categories!
  -- 'personal' = Only specific user can see
  -- 'team' = All members of specific team can see
  -- 'department' = All members of specific department can see
  -- 'company' = All users in tenant can see
  -- 'payroll' = Only specific user + special payroll handling
  access_scope ENUM(
    'personal',
    'team',
    'department',
    'company',
    'payroll'
  ) NOT NULL
    COMMENT 'WHO can see this document (maps to sidebar categories)',

  -- ============ TARGET IDENTIFIERS (Clear Semantics) ============
  -- owner_user_id: Used for 'personal' and 'payroll' scopes
  -- target_team_id: Used for 'team' scope
  -- target_department_id: Used for 'department' scope
  -- NULL for 'company' scope (all in tenant)

  owner_user_id INT DEFAULT NULL
    COMMENT 'User who owns this document (for personal/payroll scopes)',

  target_team_id INT DEFAULT NULL
    COMMENT 'Team that can access this document (for team scope)',

  target_department_id INT DEFAULT NULL
    COMMENT 'Department that can access this document (for department scope)',

  -- ============ DOCUMENT CLASSIFICATION (Flexible) ============
  -- Flexible VARCHAR instead of rigid ENUM for better extensibility
  -- Examples: 'contract', 'invoice', 'certificate', 'training', 'tax', 'payroll', etc.
  category VARCHAR(50) DEFAULT NULL
    COMMENT 'Document type/classification (flexible metadata)',

  -- Flexible tagging system
  tags JSON DEFAULT NULL
    COMMENT 'Flexible tags: ["urgent","tax-2025","reviewed"]',

  -- ============ PAYROLL-SPECIFIC FIELDS ============
  -- Only used when access_scope = 'payroll'
  salary_year INT DEFAULT NULL
    COMMENT 'Year for payroll documents (e.g., 2025)',

  salary_month INT DEFAULT NULL
    COMMENT 'Month for payroll documents (1-12)',

  -- ============ FILE STORAGE ============
  -- UUID-based hierarchical storage
  filename VARCHAR(255) NOT NULL
    COMMENT 'Stored filename (UUID-based for security)',

  original_name VARCHAR(255) NOT NULL
    COMMENT 'User-provided original filename',

  file_path VARCHAR(500) NOT NULL
    COMMENT 'Hierarchical storage path with UUID',

  file_size INT NOT NULL
    COMMENT 'File size in bytes',

  file_checksum VARCHAR(64) DEFAULT NULL
    COMMENT 'SHA-256 checksum for integrity verification',

  file_content LONGBLOB DEFAULT NULL
    COMMENT 'File content (if stored in DB, optional)',

  storage_type ENUM('database','filesystem','s3') DEFAULT 'filesystem'
    COMMENT 'Where the file is physically stored',

  mime_type VARCHAR(100) DEFAULT NULL
    COMMENT 'MIME type (e.g., application/pdf)',

  -- ============ METADATA ============
  description TEXT DEFAULT NULL
    COMMENT 'Optional description/notes',

  is_public BOOLEAN DEFAULT FALSE
    COMMENT 'Whether document is publicly accessible',

  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    COMMENT 'When the document was uploaded',

  created_by INT DEFAULT NULL
    COMMENT 'User ID who uploaded this document',

  is_archived BOOLEAN DEFAULT FALSE
    COMMENT 'Whether document is archived',

  archived_at TIMESTAMP NULL DEFAULT NULL
    COMMENT 'When the document was archived',

  expires_at TIMESTAMP NULL DEFAULT NULL
    COMMENT 'Optional expiration date',

  -- ============ FOREIGN KEYS ============
  -- Strict tenant isolation
  FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE CASCADE,

  -- Owner user (for personal/payroll documents)
  CONSTRAINT fk_documents_owner_user
    FOREIGN KEY (owner_user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  -- Target team (for team documents)
  CONSTRAINT fk_documents_target_team
    FOREIGN KEY (target_team_id)
    REFERENCES teams(id)
    ON DELETE SET NULL,

  -- Target department (for department documents)
  CONSTRAINT fk_documents_target_dept
    FOREIGN KEY (target_department_id)
    REFERENCES departments(id)
    ON DELETE SET NULL,

  -- Creator info
  FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL,

  -- Version chain
  FOREIGN KEY (parent_version_id)
    REFERENCES documents(id)
    ON DELETE SET NULL,

  -- ============ CONSTRAINTS (Data Integrity) ============
  -- Salary month must be 1-12
  CONSTRAINT chk_salary_month_range
    CHECK (salary_month IS NULL OR (salary_month >= 1 AND salary_month <= 12)),

  -- Salary year must be reasonable
  CONSTRAINT chk_salary_year_range
    CHECK (salary_year IS NULL OR (salary_year >= 2000 AND salary_year <= 2100)),

  -- ============ INDEXES (Performance Optimization) ============
  -- Composite index for most common query: "get my documents by scope"
  INDEX idx_tenant_scope_owner (tenant_id, access_scope, owner_user_id),

  -- Index for team document queries
  INDEX idx_tenant_target_team (tenant_id, target_team_id),

  -- Index for department document queries
  INDEX idx_tenant_target_dept (tenant_id, target_department_id),

  -- Individual indexes for specific lookups
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_uploaded_at (uploaded_at),
  INDEX idx_is_archived (is_archived),
  INDEX idx_uuid (file_uuid),
  INDEX idx_checksum (file_checksum),
  INDEX idx_creator (created_by),
  INDEX idx_version (version)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Document management with clean access control (refactored 2025-01-10)';

-- =====================================================
-- REFACTORING NOTES (2025-01-10)
-- =====================================================
-- OLD STRUCTURE (Removed):
--   ❌ recipient_type
--   ❌ user_id (ambiguous)
--   ❌ team_id (ambiguous)
--   ❌ department_id (ambiguous)
--   ❌ year (ambiguous)
--   ❌ month (ambiguous)
--   ❌ category ENUM (rigid)
--
-- NEW STRUCTURE (Clean):
--   ✅ access_scope (maps 1:1 to frontend sidebar)
--   ✅ owner_user_id (semantic, clear)
--   ✅ target_team_id (semantic, clear)
--   ✅ target_department_id (semantic, clear)
--   ✅ salary_year (payroll-specific)
--   ✅ salary_month (payroll-specific)
--   ✅ category VARCHAR(50) (flexible)
--
-- BENEFITS:
--   • Zero ambiguity in field names
--   • Direct 1:1 mapping frontend ↔ database
--   • Payroll is first-class citizen
--   • Flexible classification system
--   • Database-level security constraints
--   • Future-proof and extensible
--
-- MIGRATION:
--   See: database/migrations/2025-01-10_document_schema_ultimate_refactor.sql
-- =====================================================

-- =====================================================
-- Migration: Add refresh_tokens table for token rotation
-- Date: 2025-11-26
-- Author: Claude Code
-- Purpose: Enable refresh token rotation with reuse detection
--
-- Security Features:
-- - Token Family tracking (detect stolen tokens)
-- - Reuse Detection (revoke entire family on reuse)
-- - Proper cleanup support (expired/revoked tokens)
-- =====================================================

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,

    -- User & Tenant (Multi-Tenant Isolation!)
    user_id INT NOT NULL,
    tenant_id INT NOT NULL,

    -- Token Identity (NEVER store raw token!)
    token_hash VARCHAR(64) NOT NULL COMMENT 'SHA-256 hash of the refresh token',
    token_family VARCHAR(36) NOT NULL COMMENT 'UUID to track token chain for reuse detection',

    -- Lifecycle
    expires_at DATETIME NOT NULL,
    is_revoked TINYINT(1) DEFAULT 0 COMMENT 'TRUE when token is invalidated',

    -- Rotation Tracking
    used_at DATETIME DEFAULT NULL COMMENT 'When token was used for refresh (for reuse detection)',
    replaced_by_hash VARCHAR(64) DEFAULT NULL COMMENT 'Hash of the replacement token',

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45) DEFAULT NULL COMMENT 'IPv4 or IPv6 address',
    user_agent VARCHAR(512) DEFAULT NULL,

    -- Indexes for performance
    INDEX idx_refresh_tokens_hash (token_hash),
    INDEX idx_refresh_tokens_user_tenant (user_id, tenant_id),
    INDEX idx_refresh_tokens_family (token_family),
    INDEX idx_refresh_tokens_expires (expires_at),
    INDEX idx_refresh_tokens_revoked (is_revoked),

    -- Foreign Keys (with CASCADE delete for cleanup)
    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_refresh_tokens_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Stores refresh token hashes for rotation and reuse detection';

-- Verify table was created
SELECT 'refresh_tokens table created successfully' AS status;

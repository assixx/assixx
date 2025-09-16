-- =====================================================
-- Migration: Add shift_favorites table for user-specific filter combinations
-- Date: 2025-08-21
-- Author: SCS
-- =====================================================

-- 1. Create shift_favorites table
CREATE TABLE IF NOT EXISTS shift_favorites (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    
    -- Filter combination data
    area_id INT NOT NULL,
    area_name VARCHAR(100) NOT NULL,
    department_id INT NOT NULL,
    department_name VARCHAR(100) NOT NULL,
    machine_id INT NOT NULL,
    machine_name VARCHAR(100) NOT NULL,
    team_id INT NOT NULL,
    team_name VARCHAR(100) NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_shift_fav_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_shift_fav_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_shift_fav_area FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
    CONSTRAINT fk_shift_fav_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    CONSTRAINT fk_shift_fav_machine FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
    CONSTRAINT fk_shift_fav_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    
    -- Unique constraint: Same user can't have duplicate favorite names per tenant
    UNIQUE KEY unique_user_favorite (tenant_id, user_id, name),
    
    -- Indexes for performance
    INDEX idx_user_favorites (tenant_id, user_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Grant permissions
-- (Already handled by the assixx_user permissions on the database)

-- 3. Add comment
ALTER TABLE shift_favorites COMMENT = 'Stores user-specific favorite filter combinations for shift planning';
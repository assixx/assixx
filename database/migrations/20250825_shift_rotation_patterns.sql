-- Migration: Add Shift Rotation Pattern Tables
-- Author: Claude
-- Date: 2025-08-25
-- Description: Creates tables for shift rotation patterns (F/S alternating, N constant)

-- =====================================================
-- Table 1: shift_rotation_patterns
-- Stores rotation pattern definitions
-- =====================================================

CREATE TABLE IF NOT EXISTS shift_rotation_patterns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    pattern_type ENUM('alternate_fs', 'fixed_n', 'custom') NOT NULL DEFAULT 'alternate_fs',
    
    -- Pattern configuration (JSON)
    -- For 'alternate_fs': { "weekType": "F" | "S", "cycleWeeks": 1 }
    -- For 'fixed_n': { "shiftType": "N" }
    -- For 'custom': { "pattern": [...] }
    pattern_config JSON NOT NULL,
    
    -- Rotation settings
    cycle_length_weeks INT NOT NULL DEFAULT 2, -- How many weeks before pattern repeats
    starts_at DATE NOT NULL, -- When this rotation pattern starts
    ends_at DATE DEFAULT NULL, -- Optional end date
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Metadata
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_rotation_pattern_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_rotation_pattern_creator
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    
    -- Indexes for performance
    INDEX idx_rotation_pattern_tenant (tenant_id),
    INDEX idx_rotation_pattern_active (tenant_id, is_active),
    INDEX idx_rotation_pattern_dates (starts_at, ends_at),
    
    -- Unique constraint to prevent duplicate patterns
    UNIQUE KEY uk_rotation_pattern_name (tenant_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Table 2: shift_rotation_assignments
-- Assigns employees to rotation patterns
-- =====================================================

CREATE TABLE IF NOT EXISTS shift_rotation_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    pattern_id INT NOT NULL,
    user_id INT NOT NULL,
    
    -- Assignment details
    shift_group ENUM('F', 'S', 'N') NOT NULL, -- Which shift group they belong to
    rotation_order INT DEFAULT 0, -- Order within the group (for complex patterns)
    
    -- Override options
    can_override BOOLEAN DEFAULT TRUE, -- If manual changes are allowed
    override_dates JSON DEFAULT NULL, -- Dates with manual overrides
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at DATE NOT NULL,
    ends_at DATE DEFAULT NULL,
    
    -- Metadata
    assigned_by INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_rotation_assignment_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_rotation_assignment_pattern
        FOREIGN KEY (pattern_id) REFERENCES shift_rotation_patterns(id) ON DELETE CASCADE,
    CONSTRAINT fk_rotation_assignment_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_rotation_assignment_assigned_by
        FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT,
    
    -- Indexes for performance
    INDEX idx_rotation_assignment_tenant (tenant_id),
    INDEX idx_rotation_assignment_pattern (pattern_id),
    INDEX idx_rotation_assignment_user (user_id),
    INDEX idx_rotation_assignment_active (tenant_id, is_active),
    INDEX idx_rotation_assignment_dates (starts_at, ends_at),
    
    -- Prevent duplicate assignments
    UNIQUE KEY uk_rotation_assignment (tenant_id, pattern_id, user_id, starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Table 3: shift_rotation_history (for audit trail)
-- Tracks all generated shifts from rotation patterns
-- =====================================================

CREATE TABLE IF NOT EXISTS shift_rotation_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    pattern_id INT NOT NULL,
    assignment_id INT NOT NULL,
    user_id INT NOT NULL,
    
    -- Generated shift details
    shift_date DATE NOT NULL,
    shift_type ENUM('F', 'S', 'N') NOT NULL,
    week_number INT NOT NULL,
    
    -- Status
    status ENUM('generated', 'confirmed', 'modified', 'cancelled') DEFAULT 'generated',
    modified_reason TEXT DEFAULT NULL,
    
    -- Metadata
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP NULL DEFAULT NULL,
    confirmed_by INT DEFAULT NULL,
    
    -- Foreign Keys
    CONSTRAINT fk_rotation_history_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_rotation_history_pattern
        FOREIGN KEY (pattern_id) REFERENCES shift_rotation_patterns(id) ON DELETE CASCADE,
    CONSTRAINT fk_rotation_history_assignment
        FOREIGN KEY (assignment_id) REFERENCES shift_rotation_assignments(id) ON DELETE CASCADE,
    CONSTRAINT fk_rotation_history_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_rotation_history_confirmed_by
        FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes for performance
    INDEX idx_rotation_history_tenant (tenant_id),
    INDEX idx_rotation_history_date (shift_date),
    INDEX idx_rotation_history_user_date (user_id, shift_date),
    INDEX idx_rotation_history_pattern (pattern_id),
    
    -- Prevent duplicate entries
    UNIQUE KEY uk_rotation_history (tenant_id, user_id, shift_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Sample Data for Testing (commented out for production)
-- =====================================================

-- INSERT INTO shift_rotation_patterns (tenant_id, name, description, pattern_type, pattern_config, cycle_length_weeks, starts_at, created_by)
-- VALUES 
-- (8, 'Standard F/S Rotation', 'Wöchentlicher Wechsel zwischen Früh- und Spätschicht', 'alternate_fs', '{"weekType": "F", "cycleWeeks": 2}', 2, '2025-09-01', 11),
-- (8, 'Nachtschicht Konstant', 'Durchgehende Nachtschicht', 'fixed_n', '{"shiftType": "N"}', 1, '2025-09-01', 11);

-- =====================================================
-- Grants (adjust as needed)
-- =====================================================

-- Grant permissions to application user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON shift_rotation_patterns TO 'assixx_user'@'%';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON shift_rotation_assignments TO 'assixx_user'@'%';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON shift_rotation_history TO 'assixx_user'@'%';
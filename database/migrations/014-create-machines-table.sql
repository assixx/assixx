-- =====================================================
-- Migration: Create Machines Management System
-- Date: 2025-08-01
-- Author: Claude
-- Description: Tables for machine management (INDUSTRIE-KRITISCH!)
-- =====================================================

-- 1. Create machines table
CREATE TABLE IF NOT EXISTS machines (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    
    -- Basic Information
    name VARCHAR(100) NOT NULL,
    model VARCHAR(100),
    manufacturer VARCHAR(100),
    serial_number VARCHAR(100) UNIQUE,
    asset_number VARCHAR(50),
    
    -- Location & Assignment
    department_id INT,
    area_id INT,
    location VARCHAR(255),
    
    -- Technical Details
    machine_type ENUM('production', 'packaging', 'quality_control', 'logistics', 'utility', 'other') DEFAULT 'production',
    status ENUM('operational', 'maintenance', 'repair', 'standby', 'decommissioned') DEFAULT 'operational',
    
    -- Dates
    purchase_date DATE,
    installation_date DATE,
    warranty_until DATE,
    last_maintenance DATE,
    next_maintenance DATE,
    
    -- Operational Data
    operating_hours DECIMAL(10,2) DEFAULT 0,
    production_capacity VARCHAR(100),
    energy_consumption VARCHAR(100),
    
    -- Documentation
    manual_url VARCHAR(500),
    qr_code VARCHAR(100),
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_tenant_machines (tenant_id),
    INDEX idx_department_machines (department_id),
    INDEX idx_status (status),
    INDEX idx_type (machine_type),
    INDEX idx_serial (serial_number),
    INDEX idx_asset (asset_number)
);

-- 2. Create machine_maintenance_history table
CREATE TABLE IF NOT EXISTS machine_maintenance_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    machine_id INT NOT NULL,
    
    -- Maintenance Details
    maintenance_type ENUM('preventive', 'corrective', 'inspection', 'calibration', 'cleaning', 'other') NOT NULL,
    performed_date DATETIME NOT NULL,
    performed_by INT,
    external_company VARCHAR(100),
    
    -- Work Details
    description TEXT,
    parts_replaced TEXT,
    cost DECIMAL(10,2),
    duration_hours DECIMAL(5,2),
    
    -- Results
    status_after ENUM('operational', 'needs_repair', 'decommissioned') DEFAULT 'operational',
    next_maintenance_date DATE,
    
    -- Documentation
    report_url VARCHAR(500),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_machine_history (machine_id),
    INDEX idx_maintenance_date (performed_date),
    INDEX idx_maintenance_type (maintenance_type)
);

-- 3. Create machine_documents table
CREATE TABLE IF NOT EXISTS machine_documents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    machine_id INT NOT NULL,
    
    -- Document Details
    document_type ENUM('manual', 'certificate', 'warranty', 'inspection_report', 'maintenance_report', 'invoice', 'other') NOT NULL,
    title VARCHAR(200) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT,
    
    -- Validity
    valid_from DATE,
    valid_until DATE,
    
    -- Metadata
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by INT,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_machine_docs (machine_id),
    INDEX idx_doc_type (document_type)
);

-- 4. Create machine_metrics table (for IoT/sensor data)
CREATE TABLE IF NOT EXISTS machine_metrics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    machine_id INT NOT NULL,
    
    -- Metric Data
    metric_type VARCHAR(50) NOT NULL, -- temperature, pressure, vibration, speed, etc.
    metric_value DECIMAL(15,4) NOT NULL,
    unit VARCHAR(20),
    
    -- Context
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_anomaly BOOLEAN DEFAULT FALSE,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
    
    -- Indexes (optimized for time-series queries)
    INDEX idx_machine_metrics (machine_id, recorded_at),
    INDEX idx_metric_type (metric_type, recorded_at),
    INDEX idx_anomalies (is_anomaly, recorded_at)
);

-- 5. Insert sample machine types for categories
CREATE TABLE IF NOT EXISTS machine_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    UNIQUE KEY unique_category_name (name)
);

-- Insert default categories
INSERT INTO machine_categories (name, description, icon, sort_order) VALUES
('CNC-Maschinen', 'Computer Numerical Control Maschinen', 'fa-cogs', 1),
('Spritzgussmaschinen', 'Kunststoff-Spritzgussmaschinen', 'fa-industry', 2),
('Pressen', 'Hydraulische und mechanische Pressen', 'fa-compress', 3),
('Schweißanlagen', 'Verschiedene Schweißtechnologien', 'fa-fire', 4),
('Messgeräte', 'Qualitätskontrolle und Messtechnik', 'fa-ruler', 5),
('Verpackungsmaschinen', 'Verpackung und Etikettierung', 'fa-box', 6),
('Fördertechnik', 'Transportbänder und Fördersysteme', 'fa-truck', 7),
('Kompressoren', 'Druckluft und Vakuumsysteme', 'fa-wind', 8),
('Kühlanlagen', 'Klimatisierung und Kühlung', 'fa-snowflake', 9),
('Sonstige', 'Andere Maschinentypen', 'fa-wrench', 10)
ON DUPLICATE KEY UPDATE description = VALUES(description);
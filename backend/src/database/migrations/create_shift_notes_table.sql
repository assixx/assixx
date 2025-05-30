-- Create shift_notes table for storing weekly notes
CREATE TABLE IF NOT EXISTS shift_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Unique constraint to ensure one note per date per tenant
  UNIQUE KEY unique_tenant_date (tenant_id, date),
  
  -- Foreign keys
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  
  -- Indexes
  INDEX idx_date (date),
  INDEX idx_tenant_date (tenant_id, date)
);
-- ============================================
-- PostgreSQL ENUM Types for Assixx
-- Run AFTER pgloader migration
-- ============================================

-- User roles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('root', 'admin', 'employee');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tenant status
DO $$ BEGIN
    CREATE TYPE tenant_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Shift status
DO $$ BEGIN
    CREATE TYPE shift_status AS ENUM ('planned', 'confirmed', 'in_progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Shift types
DO $$ BEGIN
    CREATE TYPE shift_type AS ENUM ('regular', 'overtime', 'standby', 'vacation', 'sick', 'holiday', 'early', 'late', 'night', 'day', 'flexible', 'F', 'S', 'N');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Document access scope
DO $$ BEGIN
    CREATE TYPE access_scope AS ENUM ('personal', 'team', 'department', 'company', 'payroll', 'blackboard');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Document storage type
DO $$ BEGIN
    CREATE TYPE storage_type AS ENUM ('database', 'filesystem', 's3');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Availability status
DO $$ BEGIN
    CREATE TYPE availability_status AS ENUM ('available', 'unavailable', 'vacation', 'sick');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Deletion status
DO $$ BEGIN
    CREATE TYPE deletion_status AS ENUM ('active', 'marked_for_deletion', 'suspended', 'deleting');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tenant plan
DO $$ BEGIN
    CREATE TYPE tenant_plan AS ENUM ('basic', 'premium', 'enterprise');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Machine type
DO $$ BEGIN
    CREATE TYPE machine_type AS ENUM ('production', 'packaging', 'quality_control', 'logistics', 'utility', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Machine status
DO $$ BEGIN
    CREATE TYPE machine_status AS ENUM ('operational', 'maintenance', 'repair', 'standby', 'decommissioned');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Maintenance type
DO $$ BEGIN
    CREATE TYPE maintenance_type AS ENUM ('preventive', 'corrective', 'inspection', 'calibration', 'cleaning', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Absence type
DO $$ BEGIN
    CREATE TYPE absence_type AS ENUM ('vacation', 'sick', 'training', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Absence status
DO $$ BEGIN
    CREATE TYPE absence_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

SELECT 'ENUM types created successfully' AS status;

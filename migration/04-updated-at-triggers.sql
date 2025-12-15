-- ============================================
-- UPDATED_AT TRIGGERS
-- Auto-update updated_at column on UPDATE
-- Run AFTER pgloader migration
-- ============================================

-- ============================================
-- 1. Generic function for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. Apply to all tables with updated_at column
-- ============================================
DO $$
DECLARE
    tbl RECORD;
    trigger_count INT := 0;
BEGIN
    FOR tbl IN
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND column_name = 'updated_at'
        GROUP BY table_name
    LOOP
        -- Drop existing trigger if any
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', tbl.table_name, tbl.table_name);

        -- Create new trigger
        EXECUTE format('
            CREATE TRIGGER update_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()
        ', tbl.table_name, tbl.table_name);

        trigger_count := trigger_count + 1;
    END LOOP;

    RAISE NOTICE 'Created updated_at triggers for % tables', trigger_count;
END $$;

SELECT 'Updated_at triggers created successfully' AS status;

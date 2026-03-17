/**
 * Migration: Setup pg_partman for automatic partition management
 *
 * Registers audit_trail and root_logs with pg_partman v5.4.3 for automatic
 * monthly partition creation. Replaces manual partition migrations.
 *
 * WARNING: Lossy rollback. Partitions created by pg_partman after 2032
 * cannot be renamed back to legacy format. Manual cleanup required.
 *
 * Supersedes: Migration 20260224000051 (extend-audit-partitions-2028-2032)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ================================================================
    -- Step 0: Pre-Check — Partitionen verifizieren (FAIL LOUD)
    -- ================================================================
    DO $$
    DECLARE
        at_count INTEGER;
        rl_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO at_count
        FROM pg_inherits WHERE inhparent = 'audit_trail'::regclass;

        SELECT COUNT(*) INTO rl_count
        FROM pg_inherits WHERE inhparent = 'root_logs'::regclass;

        IF at_count <> 96 THEN
            RAISE EXCEPTION 'Expected 96 audit_trail partitions, found %', at_count;
        END IF;

        IF rl_count <> 96 THEN
            RAISE EXCEPTION 'Expected 96 root_logs partitions, found %', rl_count;
        END IF;

        RAISE NOTICE 'Pre-check passed: % audit_trail + % root_logs partitions', at_count, rl_count;
    END $$;

    -- ================================================================
    -- Step 1: Schema + Extension erstellen
    -- KEIN IF NOT EXISTS — Migration-Runner garantiert Einmaligkeit.
    -- ================================================================
    CREATE SCHEMA partman;
    CREATE EXTENSION pg_partman SCHEMA partman;

    -- ================================================================
    -- Step 2: Bestehende Partitionen auf pg_partman-Namensschema umbenennen
    -- IST:  audit_trail_2025_01    -> SOLL: audit_trail_p20250101
    -- IST:  root_logs_2025_01      -> SOLL: root_logs_p20250101
    -- 192 Renames total (96 pro Tabelle, 2025_01 bis 2032_12)
    -- ================================================================
    DO $$
    DECLARE
        y INTEGER;
        m INTEGER;
        old_at TEXT;
        new_at TEXT;
        old_rl TEXT;
        new_rl TEXT;
    BEGIN
        FOR y IN 2025..2032 LOOP
            FOR m IN 1..12 LOOP
                old_at := format('audit_trail_%s_%s', y, lpad(m::TEXT, 2, '0'));
                new_at := format('audit_trail_p%s%s01', y, lpad(m::TEXT, 2, '0'));
                old_rl := format('root_logs_%s_%s', y, lpad(m::TEXT, 2, '0'));
                new_rl := format('root_logs_p%s%s01', y, lpad(m::TEXT, 2, '0'));

                EXECUTE format('ALTER TABLE %I RENAME TO %I', old_at, new_at);
                EXECUTE format('ALTER TABLE %I RENAME TO %I', old_rl, new_rl);
            END LOOP;
        END LOOP;
        RAISE NOTICE 'Renamed 192 partitions to pg_partman naming (_pYYYYMMDD)';
    END $$;

    -- ================================================================
    -- Step 3: Tabellen bei pg_partman registrieren
    -- create_partition() = neue 5.4.x API (ersetzt create_parent())
    -- pg_partman erkennt die umbenannten Partitionen und uebernimmt.
    -- ================================================================
    SELECT partman.create_partition(
        p_parent_table  := 'public.audit_trail',
        p_control       := 'created_at',
        p_interval      := '1 month',
        p_premake       := 12,
        p_default_table := true,
        p_jobmon        := false
    );

    SELECT partman.create_partition(
        p_parent_table  := 'public.root_logs',
        p_control       := 'created_at',
        p_interval      := '1 month',
        p_premake       := 12,
        p_default_table := true,
        p_jobmon        := false
    );

    -- ================================================================
    -- Step 4: DEFAULT Partitionen explizit erstellen
    -- pg_partman erstellt sie nicht sofort wenn premake bereits erfuellt ist.
    -- Safety net: verhindert INSERT-Failures bei Daten ausserhalb aller Ranges.
    -- ================================================================
    CREATE TABLE audit_trail_default PARTITION OF audit_trail DEFAULT;
    CREATE TABLE root_logs_default PARTITION OF root_logs DEFAULT;

    -- GRANTs auf DEFAULT Partitionen (konsistent mit bestehenden Partitionen)
    GRANT SELECT, INSERT, UPDATE, DELETE ON audit_trail_default TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON root_logs_default TO app_user;

    -- ================================================================
    -- Step 5: Privilege-Vererbung aktivieren
    -- Neue Partitionen erben GRANTs automatisch vom Parent.
    -- ================================================================
    UPDATE partman.part_config
    SET inherit_privileges = true
    WHERE parent_table IN ('public.audit_trail', 'public.root_logs');

    -- ================================================================
    -- Step 6: Read-only access for app_user on partman schema
    -- Required for /health/partitions endpoint (partition monitoring).
    -- app_user needs to read part_config and call check_default().
    -- ================================================================
    GRANT USAGE ON SCHEMA partman TO app_user;
    GRANT SELECT ON ALL TABLES IN SCHEMA partman TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ================================================================
    -- Step 1: pg_partman Config sauber entfernen (5.4.0+ API)
    -- config_cleanup() entfernt nur die Config, nicht die Tabellen.
    -- ================================================================
    SELECT partman.config_cleanup('public.audit_trail');
    SELECT partman.config_cleanup('public.root_logs');

    -- ================================================================
    -- Step 2: DEFAULT Partitionen droppen (FAIL LOUD bei Daten!)
    -- ================================================================
    DO $$
    DECLARE
        at_default_count BIGINT;
        rl_default_count BIGINT;
    BEGIN
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'audit_trail_default') THEN
            SELECT COUNT(*) INTO at_default_count FROM audit_trail_default;
            IF at_default_count > 0 THEN
                RAISE EXCEPTION 'Cannot drop audit_trail_default: contains % rows — manual migration required', at_default_count;
            END IF;
            DROP TABLE audit_trail_default;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'root_logs_default') THEN
            SELECT COUNT(*) INTO rl_default_count FROM root_logs_default;
            IF rl_default_count > 0 THEN
                RAISE EXCEPTION 'Cannot drop root_logs_default: contains % rows — manual migration required', rl_default_count;
            END IF;
            DROP TABLE root_logs_default;
        END IF;
    END $$;

    -- ================================================================
    -- Step 3: Extension + Schema droppen
    -- ================================================================
    DROP EXTENSION pg_partman CASCADE;
    DROP SCHEMA partman CASCADE;

    -- ================================================================
    -- Step 4: Partitionen zurueck auf altes Namensschema
    -- ================================================================
    DO $$
    DECLARE
        y INTEGER;
        m INTEGER;
        old_name TEXT;
        new_name TEXT;
    BEGIN
        FOR y IN 2025..2032 LOOP
            FOR m IN 1..12 LOOP
                old_name := format('audit_trail_p%s%s01', y, lpad(m::TEXT, 2, '0'));
                new_name := format('audit_trail_%s_%s', y, lpad(m::TEXT, 2, '0'));
                IF EXISTS (SELECT 1 FROM pg_class WHERE relname = old_name) THEN
                    EXECUTE format('ALTER TABLE %I RENAME TO %I', old_name, new_name);
                END IF;

                old_name := format('root_logs_p%s%s01', y, lpad(m::TEXT, 2, '0'));
                new_name := format('root_logs_%s_%s', y, lpad(m::TEXT, 2, '0'));
                IF EXISTS (SELECT 1 FROM pg_class WHERE relname = old_name) THEN
                    EXECUTE format('ALTER TABLE %I RENAME TO %I', old_name, new_name);
                END IF;
            END LOOP;
        END LOOP;

        RAISE NOTICE 'Renamed partitions back to legacy naming (_YYYY_MM)';
        RAISE NOTICE 'Orphan audit_trail partitions (manual cleanup): %',
            COALESCE((SELECT string_agg(inhrelid::regclass::text, ', ')
             FROM pg_inherits
             WHERE inhparent = 'audit_trail'::regclass
             AND inhrelid::regclass::text LIKE '%_p%'), 'none');
        RAISE NOTICE 'Orphan root_logs partitions (manual cleanup): %',
            COALESCE((SELECT string_agg(inhrelid::regclass::text, ', ')
             FROM pg_inherits
             WHERE inhparent = 'root_logs'::regclass
             AND inhrelid::regclass::text LIKE '%_p%'), 'none');
    END $$;
  `);
}

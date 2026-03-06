/**
 * Migration: Extend Audit Log Partitions (2028-2032)
 *
 * Fixes time bomb from migration 004: partitions were only created for 2025-2027.
 * Without this migration, INSERTs into audit_trail and root_logs fail after 2027-12-31.
 *
 * Creates 60 monthly partitions per table (120 total) for years 2028-2032.
 * PostgreSQL automatically inherits RLS policies, indexes, and GRANTs from parent.
 *
 * Next action required: Before 2033, create another migration for 2033-2037.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    DO $$
    DECLARE
        start_year CONSTANT INTEGER := 2028;
        end_year   CONSTANT INTEGER := 2032;
        y INTEGER;
        m INTEGER;
        start_date TEXT;
        end_date TEXT;
        at_name TEXT;
        rl_name TEXT;
    BEGIN
        FOR y IN start_year..end_year LOOP
            FOR m IN 1..12 LOOP
                start_date := format('%s-%s-01', y, lpad(m::TEXT, 2, '0'));

                IF m = 12 THEN
                    end_date := format('%s-01-01', y + 1);
                ELSE
                    end_date := format('%s-%s-01', y, lpad((m + 1)::TEXT, 2, '0'));
                END IF;

                at_name := format('audit_trail_%s_%s', y, lpad(m::TEXT, 2, '0'));
                rl_name := format('root_logs_%s_%s', y, lpad(m::TEXT, 2, '0'));

                EXECUTE format(
                    'CREATE TABLE %I PARTITION OF audit_trail FOR VALUES FROM (%L) TO (%L)',
                    at_name, start_date, end_date
                );

                EXECUTE format(
                    'CREATE TABLE %I PARTITION OF root_logs FOR VALUES FROM (%L) TO (%L)',
                    rl_name, start_date, end_date
                );
            END LOOP;
        END LOOP;

        RAISE NOTICE 'Created 120 partitions (60 per table) for 2028-2032';
    END $$;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DO $$
    DECLARE
        y INTEGER;
        m INTEGER;
        at_name TEXT;
        rl_name TEXT;
        row_count BIGINT;
    BEGIN
        FOR y IN 2028..2032 LOOP
            FOR m IN 1..12 LOOP
                at_name := format('audit_trail_%s_%s', y, lpad(m::TEXT, 2, '0'));
                rl_name := format('root_logs_%s_%s', y, lpad(m::TEXT, 2, '0'));

                -- Safety: refuse to drop partitions that contain data
                EXECUTE format('SELECT COUNT(*) FROM %I', at_name) INTO row_count;
                IF row_count > 0 THEN
                    RAISE EXCEPTION 'Cannot drop %: contains % rows', at_name, row_count;
                END IF;

                EXECUTE format('SELECT COUNT(*) FROM %I', rl_name) INTO row_count;
                IF row_count > 0 THEN
                    RAISE EXCEPTION 'Cannot drop %: contains % rows', rl_name, row_count;
                END IF;

                EXECUTE format('DROP TABLE %I', at_name);
                EXECUTE format('DROP TABLE %I', rl_name);
            END LOOP;
        END LOOP;

        RAISE NOTICE 'Dropped 120 partitions (60 per table) for 2028-2032';
    END $$;
  `);
}

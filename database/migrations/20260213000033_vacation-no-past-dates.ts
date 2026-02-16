/**
 * Migration: Vacation No Past Dates Trigger
 * Date: 2026-02-13
 *
 * Adds a database-level trigger on vacation_requests that prevents
 * INSERT of rows where start_date < CURRENT_DATE.
 *
 * Defense-in-depth: the backend validation service already rejects
 * past dates, but this trigger protects against direct DB manipulation
 * or bypassed application logic.
 *
 * Only fires on INSERT — UPDATE (status transitions, edits) is not
 * affected, so existing records remain functional.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION trg_fn_vacation_no_past_start_date()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.start_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'Startdatum darf nicht in der Vergangenheit liegen (start_date: %, today: %)',
          NEW.start_date, CURRENT_DATE;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_vacation_no_past_start_date
    BEFORE INSERT ON vacation_requests
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_vacation_no_past_start_date();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_vacation_no_past_start_date ON vacation_requests;
    DROP FUNCTION IF EXISTS trg_fn_vacation_no_past_start_date();
  `);
}

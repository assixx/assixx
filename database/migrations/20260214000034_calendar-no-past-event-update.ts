/**
 * Migration: Calendar No Past Event Update Trigger
 * Date: 2026-02-14
 *
 * Adds a database-level trigger on calendar_events that prevents
 * UPDATE of rows where end_date < NOW().
 *
 * Defense-in-depth: the backend service already rejects past-event
 * updates, but this trigger protects against direct DB manipulation
 * or bypassed application logic.
 *
 * Only fires on UPDATE — INSERT and DELETE are not affected.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION trg_fn_calendar_no_past_event_update()
    RETURNS TRIGGER AS $$
    BEGIN
      IF OLD.end_date < NOW() THEN
        RAISE EXCEPTION 'Vergangene Kalendereinträge können nicht bearbeitet werden (end_date: %, now: %)',
          OLD.end_date, NOW();
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_calendar_no_past_event_update
    BEFORE UPDATE ON calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_calendar_no_past_event_update();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_calendar_no_past_event_update ON calendar_events;
    DROP FUNCTION IF EXISTS trg_fn_calendar_no_past_event_update();
  `);
}

/**
 * Migration: Add due_soon_notified_at to work_orders
 *
 * Tracks whether a 24h due-soon notification was already sent
 * for a work order, preventing duplicate notifications from the cron.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('work_orders', {
    due_soon_notified_at: {
      type: 'timestamptz',
      default: null,
    },
  });

  pgm.sql(`COMMENT ON COLUMN work_orders.due_soon_notified_at
    IS 'Timestamp when 24h due-soon notification was sent. NULL = not yet notified.'`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('work_orders', 'due_soon_notified_at');
}

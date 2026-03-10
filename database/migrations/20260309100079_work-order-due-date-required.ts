/**
 * Migration: Work Order due_date NOT NULL
 * Date: 2026-03-09
 *
 * Makes due_date a required field on work_orders.
 * Backfills existing NULL values with created_at + 7 days.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    UPDATE work_orders
    SET due_date = (created_at::date + INTERVAL '7 days')::date
    WHERE due_date IS NULL
  `);

  pgm.alterColumn('work_orders', 'due_date', { notNull: true });
}

export function down(pgm: MigrationBuilder): void {
  pgm.alterColumn('work_orders', 'due_date', { notNull: false });
}

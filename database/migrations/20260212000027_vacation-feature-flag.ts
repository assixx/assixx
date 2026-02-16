/**
 * Migration: Vacation Feature Flag
 * Date: 2026-02-12
 *
 * Registers the 'vacation' feature in the features table.
 * Category: basic (included in all plans), price: 0.00
 *
 * This is a prerequisite for all vacation-related functionality.
 * The FeatureCheckService gates every vacation endpoint via this code.
 *
 * References: FEAT_VACCATION_MASTERPLAN.md (Phase 1, Step 1.1)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- Vacation Feature Flag — register 'vacation' in features table
    -- ==========================================================================

    INSERT INTO features (code, name, description, category, base_price, sort_order)
    VALUES (
        'vacation',
        'Urlaubsverwaltung',
        'Digitale Urlaubsanträge mit automatischer Genehmigung, Vertreterregelung und Kapazitätsprüfung',
        'basic',
        0.00,
        50
    );
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DELETE FROM features WHERE code = 'vacation';`);
}

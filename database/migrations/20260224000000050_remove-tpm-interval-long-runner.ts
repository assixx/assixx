/**
 * Migration: Remove long_runner from tpm_interval_type ENUM
 * Date: 2026-02-24
 *
 * Reason: long_runner is redundant with custom — both represent
 * user-defined maintenance intervals. Simplifying to 7 interval types.
 *
 * Strategy (detach-drop-recreate):
 *   1. Drop CHECK constraints that reference tpm_interval_type
 *   2. Detach columns from ENUM → TEXT
 *   3. Convert any long_runner data → custom
 *   4. DROP old ENUM type
 *   5. CREATE new ENUM with 7 values (without long_runner)
 *   6. Cast columns back to new ENUM
 *   7. Recreate CHECK constraints with new ENUM casts
 *
 * Affected columns:
 *   - tpm_cards.interval_type
 *   - tpm_time_estimates.interval_type
 *
 * Dependent CHECK constraints on tpm_cards:
 *   - chk_tpm_cards_custom_interval (references 'custom'::tpm_interval_type)
 *   - chk_tpm_cards_weekday_override (references 'weekly'::tpm_interval_type)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // Step 1: Drop CHECK constraints that cast to tpm_interval_type
  pgm.sql(`
    ALTER TABLE tpm_cards DROP CONSTRAINT chk_tpm_cards_custom_interval;
    ALTER TABLE tpm_cards DROP CONSTRAINT chk_tpm_cards_weekday_override;
  `);

  // Step 2: Detach columns from old ENUM → TEXT
  pgm.sql(`
    ALTER TABLE tpm_cards
      ALTER COLUMN interval_type TYPE TEXT
      USING interval_type::TEXT;

    ALTER TABLE tpm_time_estimates
      ALTER COLUMN interval_type TYPE TEXT
      USING interval_type::TEXT;
  `);

  // Step 3: Convert any long_runner data to custom (now TEXT=TEXT comparison)
  pgm.sql(`
    UPDATE tpm_cards SET interval_type = 'custom'
      WHERE interval_type = 'long_runner';
    UPDATE tpm_time_estimates SET interval_type = 'custom'
      WHERE interval_type = 'long_runner';
  `);

  // Step 4: Drop old ENUM
  pgm.sql(`DROP TYPE tpm_interval_type;`);

  // Step 5: Create new ENUM without long_runner
  pgm.sql(`
    CREATE TYPE tpm_interval_type AS ENUM (
      'daily',
      'weekly',
      'monthly',
      'quarterly',
      'semi_annual',
      'annual',
      'custom'
    );
  `);

  // Step 6: Cast columns back to new ENUM
  pgm.sql(`
    ALTER TABLE tpm_cards
      ALTER COLUMN interval_type TYPE tpm_interval_type
      USING interval_type::tpm_interval_type;

    ALTER TABLE tpm_time_estimates
      ALTER COLUMN interval_type TYPE tpm_interval_type
      USING interval_type::tpm_interval_type;
  `);

  // Step 7: Recreate CHECK constraints with new ENUM type
  pgm.sql(`
    ALTER TABLE tpm_cards ADD CONSTRAINT chk_tpm_cards_custom_interval
      CHECK (interval_type = 'custom'::tpm_interval_type OR custom_interval_days IS NULL);

    ALTER TABLE tpm_cards ADD CONSTRAINT chk_tpm_cards_weekday_override
      CHECK (weekday_override IS NULL
        OR (interval_type = 'weekly'::tpm_interval_type
            AND weekday_override >= 0
            AND weekday_override <= 6));
  `);

  // Step 8: Update interval_order CHECK (was max 8, now max 7)
  pgm.sql(`
    ALTER TABLE tpm_cards DROP CONSTRAINT chk_tpm_cards_interval_order;
    ALTER TABLE tpm_cards ADD CONSTRAINT chk_tpm_cards_interval_order
      CHECK (interval_order >= 1 AND interval_order <= 7);
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Reverse interval_order constraint back to 8
  pgm.sql(`
    ALTER TABLE tpm_cards DROP CONSTRAINT chk_tpm_cards_interval_order;
    ALTER TABLE tpm_cards ADD CONSTRAINT chk_tpm_cards_interval_order
      CHECK (interval_order >= 1 AND interval_order <= 8);
  `);

  // Drop CHECK constraints
  pgm.sql(`
    ALTER TABLE tpm_cards DROP CONSTRAINT chk_tpm_cards_custom_interval;
    ALTER TABLE tpm_cards DROP CONSTRAINT chk_tpm_cards_weekday_override;
  `);

  // Detach from simplified ENUM
  pgm.sql(`
    ALTER TABLE tpm_cards
      ALTER COLUMN interval_type TYPE TEXT
      USING interval_type::TEXT;

    ALTER TABLE tpm_time_estimates
      ALTER COLUMN interval_type TYPE TEXT
      USING interval_type::TEXT;
  `);

  pgm.sql(`DROP TYPE tpm_interval_type;`);

  // Recreate original ENUM with all 8 values
  pgm.sql(`
    CREATE TYPE tpm_interval_type AS ENUM (
      'daily',
      'weekly',
      'monthly',
      'quarterly',
      'semi_annual',
      'annual',
      'long_runner',
      'custom'
    );
  `);

  pgm.sql(`
    ALTER TABLE tpm_cards
      ALTER COLUMN interval_type TYPE tpm_interval_type
      USING interval_type::tpm_interval_type;

    ALTER TABLE tpm_time_estimates
      ALTER COLUMN interval_type TYPE tpm_interval_type
      USING interval_type::tpm_interval_type;
  `);

  // Recreate CHECK constraints with old ENUM
  pgm.sql(`
    ALTER TABLE tpm_cards ADD CONSTRAINT chk_tpm_cards_custom_interval
      CHECK (interval_type = 'custom'::tpm_interval_type OR custom_interval_days IS NULL);

    ALTER TABLE tpm_cards ADD CONSTRAINT chk_tpm_cards_weekday_override
      CHECK (weekday_override IS NULL
        OR (interval_type = 'weekly'::tpm_interval_type
            AND weekday_override >= 0
            AND weekday_override <= 6));
  `);
}

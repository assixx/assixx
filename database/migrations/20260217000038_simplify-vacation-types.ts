/**
 * Migration: Simplify Vacation Types
 * Date: 2026-02-17
 *
 * Removes special vacation type categories (special_doctor, special_bereavement,
 * special_birth, special_wedding, special_move) from the system entirely.
 *
 * Reason: Specific leave reasons are private matters — employees can state them
 * in the remarks field instead. Only 'regular' and 'unpaid' remain as categories.
 *
 * Strategy:
 *   1. TRUNCATE all vacation data (dev/test environment, confirmed by stakeholder)
 *   2. Drop DEFAULT on vacation_type column (references old ENUM type)
 *   3. Cast column to TEXT (detach from old ENUM)
 *   4. DROP old ENUM type
 *   5. CREATE new ENUM with only 'regular' + 'unpaid'
 *   6. Cast column back to new ENUM
 *   7. Restore DEFAULT
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Step 1: Truncate vacation data (FK dependency order)
    TRUNCATE TABLE vacation_request_status_log CASCADE;
    TRUNCATE TABLE vacation_requests CASCADE;

    -- Step 2: Drop column default (references old type)
    ALTER TABLE vacation_requests
      ALTER COLUMN vacation_type DROP DEFAULT;

    -- Step 3: Detach column from old ENUM → TEXT
    ALTER TABLE vacation_requests
      ALTER COLUMN vacation_type TYPE TEXT
      USING vacation_type::TEXT;

    -- Step 4: Drop old ENUM
    DROP TYPE vacation_type;

    -- Step 5: Create clean ENUM with only the two allowed values
    CREATE TYPE vacation_type AS ENUM ('regular', 'unpaid');

    -- Step 6: Cast column back to new ENUM
    ALTER TABLE vacation_requests
      ALTER COLUMN vacation_type TYPE vacation_type
      USING vacation_type::vacation_type;

    -- Step 7: Restore DEFAULT
    ALTER TABLE vacation_requests
      ALTER COLUMN vacation_type SET DEFAULT 'regular'::vacation_type;
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Reverse: restore old ENUM with all 7 values
  pgm.sql(`
    -- Truncate first (can't cast non-existent values back)
    TRUNCATE TABLE vacation_request_status_log CASCADE;
    TRUNCATE TABLE vacation_requests CASCADE;

    -- Detach from simplified ENUM
    ALTER TABLE vacation_requests
      ALTER COLUMN vacation_type DROP DEFAULT;

    ALTER TABLE vacation_requests
      ALTER COLUMN vacation_type TYPE TEXT
      USING vacation_type::TEXT;

    DROP TYPE vacation_type;

    -- Recreate original ENUM with all 7 values
    CREATE TYPE vacation_type AS ENUM (
      'regular',
      'special_doctor',
      'special_bereavement',
      'special_birth',
      'special_wedding',
      'special_move',
      'unpaid'
    );

    ALTER TABLE vacation_requests
      ALTER COLUMN vacation_type TYPE vacation_type
      USING vacation_type::vacation_type;

    ALTER TABLE vacation_requests
      ALTER COLUMN vacation_type SET DEFAULT 'regular'::vacation_type;
  `);
}

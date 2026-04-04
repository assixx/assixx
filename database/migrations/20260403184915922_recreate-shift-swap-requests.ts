/**
 * Migration: Recreate shift_swap_requests
 *
 * Purpose: Replace legacy shift_swap_requests table (integer PK, wrong FKs, no is_active)
 * with a new table using UUID PK, proper FK design, and approvals integration.
 *
 * Legacy table verified: 0 rows, no dependent FK references.
 * See: docs/FEAT_SWAP_REQUEST_MASTERPLAN.md (Step 1.1)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // -- Phase 1: Drop legacy table + enum -----------------------------------

  pgm.sql(`DROP TABLE IF EXISTS shift_swap_requests CASCADE;`);
  pgm.sql(`DROP TYPE IF EXISTS shift_swap_requests_status;`);

  // Also drop the legacy trigger function if it exists
  pgm.sql(`DROP FUNCTION IF EXISTS on_update_current_timestamp_shift_swap_requests() CASCADE;`);

  // -- Phase 2: Create new ENUMs -------------------------------------------

  pgm.sql(`
    CREATE TYPE swap_request_scope AS ENUM ('single_day', 'week', 'date_range');
  `);

  pgm.sql(`
    CREATE TYPE swap_request_status AS ENUM (
      'pending_partner',
      'pending_approval',
      'approved',
      'rejected',
      'cancelled'
    );
  `);

  // -- Phase 3: Create new table -------------------------------------------

  pgm.sql(`
    CREATE TABLE shift_swap_requests (
      uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

      requester_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      requester_shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,

      target_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      target_shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,

      team_id INTEGER NOT NULL REFERENCES teams(id),
      swap_scope swap_request_scope NOT NULL DEFAULT 'single_day',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,

      status swap_request_status NOT NULL DEFAULT 'pending_partner',
      reason TEXT,

      partner_responded_at TIMESTAMPTZ,
      partner_note TEXT,

      approval_uuid CHAR(36),

      is_active SMALLINT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // -- Phase 4: Trigger ----------------------------------------------------

  pgm.sql(`
    CREATE TRIGGER update_shift_swap_requests_updated_at
      BEFORE UPDATE ON shift_swap_requests
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);

  // -- Phase 5: RLS --------------------------------------------------------

  pgm.sql(`
    ALTER TABLE shift_swap_requests ENABLE ROW LEVEL SECURITY;
    ALTER TABLE shift_swap_requests FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON shift_swap_requests
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    GRANT SELECT, INSERT, UPDATE, DELETE ON shift_swap_requests TO app_user;
  `);

  // -- Phase 6: Indexes ----------------------------------------------------

  pgm.sql(`
    CREATE INDEX idx_swap_requests_tenant
      ON shift_swap_requests(tenant_id) WHERE is_active = 1;

    CREATE INDEX idx_swap_requests_status
      ON shift_swap_requests(tenant_id, status) WHERE is_active = 1;

    CREATE INDEX idx_swap_requests_requester
      ON shift_swap_requests(requester_id) WHERE is_active = 1;

    CREATE INDEX idx_swap_requests_target
      ON shift_swap_requests(target_id) WHERE is_active = 1;

    CREATE INDEX idx_swap_requests_team
      ON shift_swap_requests(team_id) WHERE is_active = 1;

    CREATE INDEX idx_swap_requests_dates
      ON shift_swap_requests(start_date, end_date) WHERE is_active = 1;
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Drop new table + enums
  pgm.sql(`DROP TABLE IF EXISTS shift_swap_requests CASCADE;`);
  pgm.sql(`DROP TYPE IF EXISTS swap_request_status;`);
  pgm.sql(`DROP TYPE IF EXISTS swap_request_scope;`);

  // Recreate legacy table + enum for rollback
  pgm.sql(`
    CREATE TYPE shift_swap_requests_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
  `);

  pgm.sql(`
    CREATE TABLE shift_swap_requests (
      id SERIAL PRIMARY KEY,
      assignment_id INTEGER NOT NULL REFERENCES shift_assignments(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      requested_by INTEGER NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      requested_with INTEGER REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      reason TEXT,
      status shift_swap_requests_status DEFAULT 'pending',
      approved_by INTEGER REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX idx_shift_swap_assignment_id ON shift_swap_requests(assignment_id);
    CREATE INDEX idx_shift_swap_requested_by ON shift_swap_requests(requested_by);
    CREATE INDEX idx_shift_swap_requested_with ON shift_swap_requests(requested_with);
    CREATE INDEX idx_shift_swap_approved_by ON shift_swap_requests(approved_by);
    CREATE INDEX idx_shift_swap_tenant_id ON shift_swap_requests(tenant_id);

    ALTER TABLE shift_swap_requests ENABLE ROW LEVEL SECURITY;
    ALTER TABLE shift_swap_requests FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON shift_swap_requests
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    GRANT SELECT, INSERT, UPDATE, DELETE ON shift_swap_requests TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE shift_swap_requests_id_seq TO app_user;
  `);
}

/**
 * Migration: Rename machine -> asset
 *
 * Purpose: "Maschine" is too narrow for equipment that includes ladders,
 * lifting tables, conveyors, etc. "Asset" aligns with ISO 55000 (Asset
 * Management) and DIN EN 13306 (Maintenance).
 *
 * Scope: 6 ENUMs, 7 tables, 13 columns, 7 sequences, 22 indexes,
 *        25 FK constraints, 3 triggers, 1 function, seed data labels.
 *
 * All operations are transactional DDL renames. PostgreSQL tracks
 * references by OID — renames are safe, zero data loss risk.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- =========================================================================
    -- Step 1: Rename ENUMs
    -- =========================================================================
    ALTER TYPE machines_machine_type RENAME TO assets_asset_type;
    ALTER TYPE machines_status RENAME TO assets_status;
    ALTER TYPE machine_availability_status RENAME TO asset_availability_status;
    ALTER TYPE machine_documents_document_type RENAME TO asset_documents_document_type;
    ALTER TYPE machine_maintenance_history_maintenance_type RENAME TO asset_maintenance_history_maintenance_type;
    ALTER TYPE machine_maintenance_history_status_after RENAME TO asset_maintenance_history_status_after;

    -- =========================================================================
    -- Step 2: Rename trigger function
    -- =========================================================================
    ALTER FUNCTION on_update_current_timestamp_machines() RENAME TO on_update_current_timestamp_assets;

    -- =========================================================================
    -- Step 3: Rename tables
    -- =========================================================================
    ALTER TABLE machines RENAME TO assets;
    ALTER TABLE machine_availability RENAME TO asset_availability;
    ALTER TABLE machine_categories RENAME TO asset_categories;
    ALTER TABLE machine_documents RENAME TO asset_documents;
    ALTER TABLE machine_maintenance_history RENAME TO asset_maintenance_history;
    ALTER TABLE machine_metrics RENAME TO asset_metrics;
    ALTER TABLE machine_teams RENAME TO asset_teams;

    -- =========================================================================
    -- Step 4: Rename columns
    -- =========================================================================
    -- In renamed tables
    ALTER TABLE assets RENAME COLUMN machine_type TO asset_type;
    ALTER TABLE asset_availability RENAME COLUMN asset_id TO asset_id;
    ALTER TABLE asset_documents RENAME COLUMN asset_id TO asset_id;
    ALTER TABLE asset_maintenance_history RENAME COLUMN asset_id TO asset_id;
    ALTER TABLE asset_metrics RENAME COLUMN asset_id TO asset_id;
    ALTER TABLE asset_teams RENAME COLUMN asset_id TO asset_id;

    -- In other tables (FK columns)
    ALTER TABLE shift_favorites RENAME COLUMN asset_id TO asset_id;
    ALTER TABLE shift_favorites RENAME COLUMN asset_name TO asset_name;
    ALTER TABLE shift_plans RENAME COLUMN asset_id TO asset_id;
    ALTER TABLE shifts RENAME COLUMN asset_id TO asset_id;
    ALTER TABLE tpm_cards RENAME COLUMN asset_id TO asset_id;
    ALTER TABLE tpm_maintenance_plans RENAME COLUMN asset_id TO asset_id;
    ALTER TABLE vacation_staffing_rules RENAME COLUMN asset_id TO asset_id;

    -- =========================================================================
    -- Step 5: Rename sequences
    -- =========================================================================
    ALTER SEQUENCE machines_id_seq RENAME TO assets_id_seq;
    ALTER SEQUENCE machine_availability_id_seq RENAME TO asset_availability_id_seq;
    ALTER SEQUENCE machine_categories_id_seq RENAME TO asset_categories_id_seq;
    ALTER SEQUENCE machine_documents_id_seq RENAME TO asset_documents_id_seq;
    ALTER SEQUENCE machine_maintenance_history_id_seq RENAME TO asset_maintenance_history_id_seq;
    ALTER SEQUENCE machine_metrics_id_seq RENAME TO asset_metrics_id_seq;
    ALTER SEQUENCE machine_teams_id_seq RENAME TO asset_teams_id_seq;

    -- =========================================================================
    -- Step 6: Rename indexes (also cleans up MySQL legacy idx_NNNNN_ prefixes)
    -- =========================================================================
    -- On assets (formerly machines)
    ALTER INDEX idx_19326_fk_machines_area RENAME TO idx_assets_area;
    ALTER INDEX idx_19326_idx_department_machines RENAME TO idx_assets_department;
    ALTER INDEX idx_19326_idx_tenant_machines RENAME TO idx_assets_tenant;
    ALTER INDEX idx_machines_uuid RENAME TO idx_assets_uuid;
    ALTER INDEX idx_machines_uuid_created_at RENAME TO idx_assets_uuid_created_at;

    -- On asset_documents (formerly machine_documents)
    ALTER INDEX idx_19337_idx_machine_docs RENAME TO idx_asset_documents_asset;

    -- On asset_maintenance_history
    ALTER INDEX idx_19344_idx_machine_history RENAME TO idx_asset_maint_history_asset;

    -- On asset_metrics
    ALTER INDEX idx_19352_idx_machine_metrics RENAME TO idx_asset_metrics_asset;

    -- On asset_teams
    ALTER INDEX idx_19358_fk_machine_teams_assigned_by RENAME TO idx_asset_teams_assigned_by;
    ALTER INDEX idx_19358_idx_machine_id RENAME TO idx_asset_teams_asset;
    ALTER INDEX idx_19358_idx_tenant_machine_teams RENAME TO idx_asset_teams_tenant;
    ALTER INDEX idx_19358_unique_machine_team_per_tenant RENAME TO uq_asset_teams_per_tenant;

    -- On other tables
    ALTER INDEX idx_19489_fk_shifts_machine RENAME TO idx_shifts_asset;
    ALTER INDEX idx_19510_fk_shift_fav_machine RENAME TO idx_shift_favorites_asset;
    ALTER INDEX idx_19517_idx_shift_plans_machine RENAME TO idx_shift_plans_asset;
    ALTER INDEX idx_ma_machine RENAME TO idx_asset_availability_asset;
    ALTER INDEX idx_tpm_cards_tenant_machine_status RENAME TO idx_tpm_cards_tenant_asset_status;
    ALTER INDEX idx_tpm_plans_machine RENAME TO idx_tpm_plans_asset;
    ALTER INDEX idx_vsr_machine RENAME TO idx_vsr_asset;

    -- PK / UNIQUE constraints (renamed via ALTER INDEX)
    ALTER INDEX machine_availability_pkey RENAME TO asset_availability_pkey;
    ALTER INDEX uq_tpm_plans_tenant_machine RENAME TO uq_tpm_plans_tenant_asset;
    ALTER INDEX vacation_staffing_rules_tenant_id_machine_id_key RENAME TO uq_vsr_tenant_asset;

    -- =========================================================================
    -- Step 7: Rename FK constraints (also cleans up MySQL legacy _ibfk_N names)
    -- =========================================================================
    -- On assets
    ALTER TABLE assets RENAME CONSTRAINT fk_machines_area TO fk_assets_area;
    ALTER TABLE assets RENAME CONSTRAINT machines_ibfk_1 TO fk_assets_tenant;
    ALTER TABLE assets RENAME CONSTRAINT machines_ibfk_2 TO fk_assets_department;
    ALTER TABLE assets RENAME CONSTRAINT machines_ibfk_3 TO fk_assets_created_by;
    ALTER TABLE assets RENAME CONSTRAINT machines_ibfk_4 TO fk_assets_updated_by;

    -- On asset_availability
    ALTER TABLE asset_availability RENAME CONSTRAINT fk_ma_machine TO fk_asset_availability_asset;

    -- On asset_documents
    ALTER TABLE asset_documents RENAME CONSTRAINT machine_documents_ibfk_1 TO fk_asset_documents_tenant;
    ALTER TABLE asset_documents RENAME CONSTRAINT machine_documents_ibfk_2 TO fk_asset_documents_asset;
    ALTER TABLE asset_documents RENAME CONSTRAINT machine_documents_ibfk_3 TO fk_asset_documents_uploaded_by;

    -- On asset_maintenance_history
    ALTER TABLE asset_maintenance_history RENAME CONSTRAINT machine_maintenance_history_ibfk_1 TO fk_asset_maint_history_tenant;
    ALTER TABLE asset_maintenance_history RENAME CONSTRAINT machine_maintenance_history_ibfk_2 TO fk_asset_maint_history_asset;
    ALTER TABLE asset_maintenance_history RENAME CONSTRAINT machine_maintenance_history_ibfk_3 TO fk_asset_maint_history_performed_by;
    ALTER TABLE asset_maintenance_history RENAME CONSTRAINT machine_maintenance_history_ibfk_4 TO fk_asset_maint_history_created_by;

    -- On asset_metrics
    ALTER TABLE asset_metrics RENAME CONSTRAINT machine_metrics_ibfk_1 TO fk_asset_metrics_tenant;
    ALTER TABLE asset_metrics RENAME CONSTRAINT machine_metrics_ibfk_2 TO fk_asset_metrics_asset;

    -- On asset_teams
    ALTER TABLE asset_teams RENAME CONSTRAINT fk_machine_teams_assigned_by TO fk_asset_teams_assigned_by;
    ALTER TABLE asset_teams RENAME CONSTRAINT fk_machine_teams_machine TO fk_asset_teams_asset;
    ALTER TABLE asset_teams RENAME CONSTRAINT fk_machine_teams_team TO fk_asset_teams_team;
    ALTER TABLE asset_teams RENAME CONSTRAINT fk_machine_teams_tenant TO fk_asset_teams_tenant;

    -- On other tables
    ALTER TABLE shift_favorites RENAME CONSTRAINT fk_shift_fav_machine TO fk_shift_favorites_asset;
    ALTER TABLE shift_plans RENAME CONSTRAINT fk_shift_plans_machine TO fk_shift_plans_asset;
    ALTER TABLE shifts RENAME CONSTRAINT fk_shifts_machine TO fk_shifts_asset;
    ALTER TABLE tpm_maintenance_plans RENAME CONSTRAINT fk_tpm_plans_machine TO fk_tpm_plans_asset;
    ALTER TABLE tpm_cards RENAME CONSTRAINT fk_tpm_cards_machine TO fk_tpm_cards_asset;
    ALTER TABLE vacation_staffing_rules RENAME CONSTRAINT vacation_staffing_rules_machine_id_fkey TO fk_vsr_asset;

    -- =========================================================================
    -- Step 8: Rename triggers
    -- =========================================================================
    ALTER TRIGGER update_machines_updated_at ON assets RENAME TO update_assets_updated_at;
    ALTER TRIGGER update_machine_availability_updated_at ON asset_availability RENAME TO update_asset_availability_updated_at;

    -- =========================================================================
    -- Step 9: Update seed data labels (Maschine -> Anlage)
    -- =========================================================================
    UPDATE asset_categories SET name = 'CNC-Anlagen', description = 'CNC-Anlagen (Computer Numerical Control)' WHERE id = 1;
    UPDATE asset_categories SET name = 'Spritzgussanlagen', description = 'Kunststoff-Spritzgussanlagen' WHERE id = 2;
    UPDATE asset_categories SET name = 'Verpackungsanlagen' WHERE id = 6;
    UPDATE asset_categories SET description = 'Andere Anlagentypen' WHERE id = 10;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- =========================================================================
    -- Reverse Step 9: Restore seed data labels
    -- =========================================================================
    UPDATE asset_categories SET name = 'CNC-Maschinen', description = 'Computer Numerical Control Maschinen' WHERE id = 1;
    UPDATE asset_categories SET name = 'Spritzgussmaschinen', description = 'Kunststoff-Spritzgussmaschinen' WHERE id = 2;
    UPDATE asset_categories SET name = 'Verpackungsmaschinen' WHERE id = 6;
    UPDATE asset_categories SET description = 'Andere Maschinentypen' WHERE id = 10;

    -- =========================================================================
    -- Reverse Step 8: Restore trigger names
    -- =========================================================================
    ALTER TRIGGER update_asset_availability_updated_at ON asset_availability RENAME TO update_machine_availability_updated_at;
    ALTER TRIGGER update_assets_updated_at ON assets RENAME TO update_machines_updated_at;

    -- =========================================================================
    -- Reverse Step 7: Restore FK constraint names
    -- =========================================================================
    ALTER TABLE vacation_staffing_rules RENAME CONSTRAINT fk_vsr_asset TO vacation_staffing_rules_machine_id_fkey;
    ALTER TABLE tpm_cards RENAME CONSTRAINT fk_tpm_cards_asset TO fk_tpm_cards_machine;
    ALTER TABLE tpm_maintenance_plans RENAME CONSTRAINT fk_tpm_plans_asset TO fk_tpm_plans_machine;
    ALTER TABLE shifts RENAME CONSTRAINT fk_shifts_asset TO fk_shifts_machine;
    ALTER TABLE shift_plans RENAME CONSTRAINT fk_shift_plans_asset TO fk_shift_plans_machine;
    ALTER TABLE shift_favorites RENAME CONSTRAINT fk_shift_favorites_asset TO fk_shift_fav_machine;

    ALTER TABLE asset_teams RENAME CONSTRAINT fk_asset_teams_tenant TO fk_machine_teams_tenant;
    ALTER TABLE asset_teams RENAME CONSTRAINT fk_asset_teams_team TO fk_machine_teams_team;
    ALTER TABLE asset_teams RENAME CONSTRAINT fk_asset_teams_asset TO fk_machine_teams_machine;
    ALTER TABLE asset_teams RENAME CONSTRAINT fk_asset_teams_assigned_by TO fk_machine_teams_assigned_by;

    ALTER TABLE asset_metrics RENAME CONSTRAINT fk_asset_metrics_asset TO machine_metrics_ibfk_2;
    ALTER TABLE asset_metrics RENAME CONSTRAINT fk_asset_metrics_tenant TO machine_metrics_ibfk_1;

    ALTER TABLE asset_maintenance_history RENAME CONSTRAINT fk_asset_maint_history_created_by TO machine_maintenance_history_ibfk_4;
    ALTER TABLE asset_maintenance_history RENAME CONSTRAINT fk_asset_maint_history_performed_by TO machine_maintenance_history_ibfk_3;
    ALTER TABLE asset_maintenance_history RENAME CONSTRAINT fk_asset_maint_history_asset TO machine_maintenance_history_ibfk_2;
    ALTER TABLE asset_maintenance_history RENAME CONSTRAINT fk_asset_maint_history_tenant TO machine_maintenance_history_ibfk_1;

    ALTER TABLE asset_documents RENAME CONSTRAINT fk_asset_documents_uploaded_by TO machine_documents_ibfk_3;
    ALTER TABLE asset_documents RENAME CONSTRAINT fk_asset_documents_asset TO machine_documents_ibfk_2;
    ALTER TABLE asset_documents RENAME CONSTRAINT fk_asset_documents_tenant TO machine_documents_ibfk_1;

    ALTER TABLE asset_availability RENAME CONSTRAINT fk_asset_availability_asset TO fk_ma_machine;

    ALTER TABLE assets RENAME CONSTRAINT fk_assets_updated_by TO machines_ibfk_4;
    ALTER TABLE assets RENAME CONSTRAINT fk_assets_created_by TO machines_ibfk_3;
    ALTER TABLE assets RENAME CONSTRAINT fk_assets_department TO machines_ibfk_2;
    ALTER TABLE assets RENAME CONSTRAINT fk_assets_tenant TO machines_ibfk_1;
    ALTER TABLE assets RENAME CONSTRAINT fk_assets_area TO fk_machines_area;

    -- =========================================================================
    -- Reverse Step 6: Restore index names
    -- =========================================================================
    ALTER INDEX uq_vsr_tenant_asset RENAME TO vacation_staffing_rules_tenant_id_machine_id_key;
    ALTER INDEX uq_tpm_plans_tenant_asset RENAME TO uq_tpm_plans_tenant_machine;
    ALTER INDEX asset_availability_pkey RENAME TO machine_availability_pkey;

    ALTER INDEX idx_vsr_asset RENAME TO idx_vsr_machine;
    ALTER INDEX idx_tpm_plans_asset RENAME TO idx_tpm_plans_machine;
    ALTER INDEX idx_tpm_cards_tenant_asset_status RENAME TO idx_tpm_cards_tenant_machine_status;
    ALTER INDEX idx_asset_availability_asset RENAME TO idx_ma_machine;
    ALTER INDEX idx_shift_plans_asset RENAME TO idx_19517_idx_shift_plans_machine;
    ALTER INDEX idx_shift_favorites_asset RENAME TO idx_19510_fk_shift_fav_machine;
    ALTER INDEX idx_shifts_asset RENAME TO idx_19489_fk_shifts_machine;

    ALTER INDEX uq_asset_teams_per_tenant RENAME TO idx_19358_unique_machine_team_per_tenant;
    ALTER INDEX idx_asset_teams_tenant RENAME TO idx_19358_idx_tenant_machine_teams;
    ALTER INDEX idx_asset_teams_asset RENAME TO idx_19358_idx_machine_id;
    ALTER INDEX idx_asset_teams_assigned_by RENAME TO idx_19358_fk_machine_teams_assigned_by;

    ALTER INDEX idx_asset_metrics_asset RENAME TO idx_19352_idx_machine_metrics;
    ALTER INDEX idx_asset_maint_history_asset RENAME TO idx_19344_idx_machine_history;
    ALTER INDEX idx_asset_documents_asset RENAME TO idx_19337_idx_machine_docs;

    ALTER INDEX idx_assets_uuid_created_at RENAME TO idx_machines_uuid_created_at;
    ALTER INDEX idx_assets_uuid RENAME TO idx_machines_uuid;
    ALTER INDEX idx_assets_tenant RENAME TO idx_19326_idx_tenant_machines;
    ALTER INDEX idx_assets_department RENAME TO idx_19326_idx_department_machines;
    ALTER INDEX idx_assets_area RENAME TO idx_19326_fk_machines_area;

    -- =========================================================================
    -- Reverse Step 5: Restore sequence names
    -- =========================================================================
    ALTER SEQUENCE asset_teams_id_seq RENAME TO machine_teams_id_seq;
    ALTER SEQUENCE asset_metrics_id_seq RENAME TO machine_metrics_id_seq;
    ALTER SEQUENCE asset_maintenance_history_id_seq RENAME TO machine_maintenance_history_id_seq;
    ALTER SEQUENCE asset_documents_id_seq RENAME TO machine_documents_id_seq;
    ALTER SEQUENCE asset_categories_id_seq RENAME TO machine_categories_id_seq;
    ALTER SEQUENCE asset_availability_id_seq RENAME TO machine_availability_id_seq;
    ALTER SEQUENCE assets_id_seq RENAME TO machines_id_seq;

    -- =========================================================================
    -- Reverse Step 4: Restore column names
    -- =========================================================================
    ALTER TABLE vacation_staffing_rules RENAME COLUMN asset_id TO asset_id;
    ALTER TABLE tpm_maintenance_plans RENAME COLUMN asset_id TO asset_id;
    ALTER TABLE tpm_cards RENAME COLUMN asset_id TO asset_id;
    ALTER TABLE shifts RENAME COLUMN asset_id TO asset_id;
    ALTER TABLE shift_plans RENAME COLUMN asset_id TO asset_id;
    ALTER TABLE shift_favorites RENAME COLUMN asset_name TO asset_name;
    ALTER TABLE shift_favorites RENAME COLUMN asset_id TO asset_id;

    ALTER TABLE asset_teams RENAME COLUMN asset_id TO asset_id;
    ALTER TABLE asset_metrics RENAME COLUMN asset_id TO asset_id;
    ALTER TABLE asset_maintenance_history RENAME COLUMN asset_id TO asset_id;
    ALTER TABLE asset_documents RENAME COLUMN asset_id TO asset_id;
    ALTER TABLE asset_availability RENAME COLUMN asset_id TO asset_id;
    ALTER TABLE assets RENAME COLUMN asset_type TO machine_type;

    -- =========================================================================
    -- Reverse Step 3: Restore table names
    -- =========================================================================
    ALTER TABLE asset_teams RENAME TO machine_teams;
    ALTER TABLE asset_metrics RENAME TO machine_metrics;
    ALTER TABLE asset_maintenance_history RENAME TO machine_maintenance_history;
    ALTER TABLE asset_documents RENAME TO machine_documents;
    ALTER TABLE asset_categories RENAME TO machine_categories;
    ALTER TABLE asset_availability RENAME TO machine_availability;
    ALTER TABLE assets RENAME TO machines;

    -- =========================================================================
    -- Reverse Step 2: Restore trigger function name
    -- =========================================================================
    ALTER FUNCTION on_update_current_timestamp_assets() RENAME TO on_update_current_timestamp_machines;

    -- =========================================================================
    -- Reverse Step 1: Restore ENUM names
    -- =========================================================================
    ALTER TYPE asset_maintenance_history_status_after RENAME TO machine_maintenance_history_status_after;
    ALTER TYPE asset_maintenance_history_maintenance_type RENAME TO machine_maintenance_history_maintenance_type;
    ALTER TYPE asset_documents_document_type RENAME TO machine_documents_document_type;
    ALTER TYPE asset_availability_status RENAME TO machine_availability_status;
    ALTER TYPE assets_status RENAME TO machines_status;
    ALTER TYPE assets_asset_type RENAME TO machines_machine_type;
  `);
}

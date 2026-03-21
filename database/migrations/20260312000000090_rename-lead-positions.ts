/**
 * Migration: Rename compound lead positions to semantic keys (ADR-034)
 *
 * Purpose: Decouple position storage from display names so hierarchy labels
 * propagate correctly. "Bereichsleiter" → "area_lead" etc.
 * Display is resolved at runtime via resolvePositionDisplay().
 *
 * Affects:
 *   - users.position (varchar 100) — rename matching values
 *   - tenants.settings.positionOptions (JSONB) — rename within arrays + ensure lead keys present
 *
 * WARNING: One-way migration. Rollback restores German compound words
 * but any tenant that customized labels in the meantime will lose that context.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

/** Old → new position key mapping */
const RENAMES: ReadonlyArray<[old: string, key: string]> = [
  ['Bereichsleiter', 'area_lead'],
  ['Abteilungsleiter', 'department_lead'],
  ['Teamleiter', 'team_lead'],
];

/** JSONB categories that may contain position values */
const CATEGORIES = ['employee', 'admin', 'root'] as const;

/**
 * Required lead keys per category.
 * Ensures tenants that never had these positions get them added.
 */
const REQUIRED_LEAD_KEYS: Record<string, readonly string[]> = {
  employee: ['team_lead'],
  admin: ['area_lead', 'department_lead'],
  root: [],
};

export function up(pgm: MigrationBuilder): void {
  // 1. Rename position values in users table
  for (const [oldVal, newVal] of RENAMES) {
    pgm.sql(`UPDATE users SET position = '${newVal}' WHERE position = '${oldVal}';`);
  }

  // 2. Rename position values inside tenants.settings.positionOptions JSONB
  //    Only touches tenants that actually have positionOptions set.
  for (const category of CATEGORIES) {
    for (const [oldVal, newVal] of RENAMES) {
      pgm.sql(`
        UPDATE tenants
        SET settings = jsonb_set(
          settings,
          '{positionOptions,${category}}',
          (
            SELECT COALESCE(
              jsonb_agg(
                CASE WHEN val = '${oldVal}' THEN to_jsonb('${newVal}'::text)
                     ELSE to_jsonb(val)
                END
              ),
              '[]'::jsonb
            )
            FROM jsonb_array_elements_text(
              settings->'positionOptions'->'${category}'
            ) AS val
          )
        )
        WHERE settings->'positionOptions'->'${category}' IS NOT NULL;
      `);
    }
  }

  // 3. Ensure required lead keys are present (even if tenant never had the old compound word)
  for (const category of CATEGORIES) {
    const keys = REQUIRED_LEAD_KEYS[category];
    if (keys === undefined) continue;
    for (const key of keys) {
      pgm.sql(`
        UPDATE tenants
        SET settings = jsonb_set(
          settings,
          '{positionOptions,${category}}',
          (settings->'positionOptions'->'${category}') || '"${key}"'::jsonb
        )
        WHERE settings->'positionOptions'->'${category}' IS NOT NULL
          AND NOT (settings->'positionOptions'->'${category}') @> '"${key}"'::jsonb;
      `);
    }
  }
}

export function down(pgm: MigrationBuilder): void {
  // Reverse: semantic keys → German compound words
  for (const [oldVal, newVal] of RENAMES) {
    pgm.sql(`UPDATE users SET position = '${oldVal}' WHERE position = '${newVal}';`);
  }

  for (const category of CATEGORIES) {
    for (const [oldVal, newVal] of RENAMES) {
      pgm.sql(`
        UPDATE tenants
        SET settings = jsonb_set(
          settings,
          '{positionOptions,${category}}',
          (
            SELECT COALESCE(
              jsonb_agg(
                CASE WHEN val = '${newVal}' THEN to_jsonb('${oldVal}'::text)
                     ELSE to_jsonb(val)
                END
              ),
              '[]'::jsonb
            )
            FROM jsonb_array_elements_text(
              settings->'positionOptions'->'${category}'
            ) AS val
          )
        )
        WHERE settings->'positionOptions'->'${category}' IS NOT NULL;
      `);
    }
  }
}

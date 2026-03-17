/**
 * Migration: Add settings JSONB column to tenant_addons
 *
 * Enables per-tenant addon configuration (e.g. KVP daily suggestion limit).
 * Also updates the KVP daily limit trigger to:
 * - Read the configurable limit from tenant_addons.settings->>'daily_limit'
 * - Default to 1 if not configured
 * - Only exempt root and admin with has_full_access=true (not all admins)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // 1. Add settings JSONB column to tenant_addons
  pgm.addColumn('tenant_addons', {
    settings: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },
  });

  pgm.sql(`
    COMMENT ON COLUMN tenant_addons.settings IS
      'Per-addon configuration (e.g. KVP: {"daily_limit": 5}). Schema varies by addon.';
  `);

  // 2. Replace the KVP daily limit trigger function
  //    - Reads configurable limit from tenant_addons.settings->>'daily_limit'
  //    - Only exempts root and admin with has_full_access=true
  pgm.sql(`
    CREATE OR REPLACE FUNCTION check_kvp_daily_limit()
    RETURNS TRIGGER AS $$
    DECLARE
        user_role VARCHAR(50);
        user_full_access BOOLEAN;
        configured_limit INTEGER;
        today_count INTEGER;
    BEGIN
        -- Get user role and full_access flag
        SELECT role, has_full_access INTO user_role, user_full_access
        FROM users
        WHERE id = NEW.submitted_by;

        -- Root is always unlimited
        IF user_role = 'root' THEN
            RETURN NEW;
        END IF;

        -- Admin with has_full_access is unlimited
        IF user_role = 'admin' AND user_full_access = TRUE THEN
            RETURN NEW;
        END IF;

        -- Read configured limit from tenant_addons (KVP addon)
        SELECT COALESCE(
            (ta.settings->>'daily_limit')::integer,
            1
        ) INTO configured_limit
        FROM tenant_addons ta
        JOIN addons a ON ta.addon_id = a.id
        WHERE ta.tenant_id = NEW.tenant_id
          AND a.code = 'kvp'
          AND ta.is_active = 1;

        -- Fallback if no tenant_addons row found
        IF configured_limit IS NULL THEN
            configured_limit := 1;
        END IF;

        -- 0 = unlimited
        IF configured_limit = 0 THEN
            RETURN NEW;
        END IF;

        -- Count today's submissions
        SELECT COUNT(*) INTO today_count
        FROM kvp_suggestions
        WHERE tenant_id = NEW.tenant_id
          AND submitted_by = NEW.submitted_by
          AND created_at >= CURRENT_DATE
          AND created_at < CURRENT_DATE + INTERVAL '1 day';

        IF today_count >= configured_limit THEN
            RAISE EXCEPTION 'Tageslimit erreicht: Sie können nur % KVP-Vorschlag/Vorschläge pro Tag einreichen.', configured_limit;
        END IF;

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    COMMENT ON FUNCTION check_kvp_daily_limit() IS
        'Validates configurable daily KVP limit per user. Exempt: root, admin+has_full_access. Limit from tenant_addons.settings.daily_limit (default 1, 0=unlimited).';
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Restore original trigger function (hardcoded limit=1, exempts all admin+root)
  pgm.sql(`
    CREATE OR REPLACE FUNCTION check_kvp_daily_limit()
    RETURNS TRIGGER AS $$
    DECLARE
        user_role VARCHAR(50);
        today_count INTEGER;
    BEGIN
        SELECT role INTO user_role
        FROM users
        WHERE id = NEW.submitted_by;

        IF user_role IN ('admin', 'root') THEN
            RETURN NEW;
        END IF;

        SELECT COUNT(*) INTO today_count
        FROM kvp_suggestions
        WHERE tenant_id = NEW.tenant_id
          AND submitted_by = NEW.submitted_by
          AND created_at >= CURRENT_DATE
          AND created_at < CURRENT_DATE + INTERVAL '1 day';

        IF today_count >= 1 THEN
            RAISE EXCEPTION 'Tageslimit erreicht: Mitarbeiter können nur 1 KVP-Vorschlag pro Tag einreichen.';
        END IF;

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.dropColumn('tenant_addons', 'settings');
}

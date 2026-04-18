-- =============================================================================
-- Test Tenants (DEV-ONLY) — Idempotent-free, fail-loud on re-run without TRUNCATE
-- =============================================================================
-- WHY: After the Phase 1 clean-slate (FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md
--      v0.4.0 §1.0 TRUNCATE), dev workflows need working tenants with pre-verified
--      tenant_domains rows. Going through the signup API post-Phase-2 would seed
--      `tenant_domains(status='pending')` — and `.test` TLDs never resolve to DNS,
--      so those tenants would be permanently stuck at user_creation 403.
--
--      This seed bypasses the signup API and directly INSERTs tenant + root-user +
--      `tenant_domains(status='verified')` atomically, yielding tenants that are
--      usable from the first `pnpm run db:seed` run in a fresh dev environment.
--      See §0.7 Step 0.7 "Strategy: dedicated SQL seed" and §1.3 of the masterplan.
--
-- WHY IN `database/seeds/`:
--   The `customer/fresh-install/install.sh` pipeline reads from
--   `customer/fresh-install/*.sql` (schema + global-seed + grants + pgmigrations),
--   NOT from `database/seeds/`. So this file is DEV-ONLY by location — production
--   fresh-installs never touch it.
--
-- CREDENTIALS:
--   All 4 roots have role='root' + has_full_access=true. Passwords are bcrypt-12
--   hashed from known plaintexts (regenerable via `bcryptjs.hashSync(pw, 12)`):
--
--     apitest → admin@apitest.de    / ApiTest12345!
--     firma-a → test@firma-a.test   / TestFirmaA12345!
--     firma-b → test@firma-b.test   / TestFirmaB12345!
--     scs     → test@scs-technik.de / TestScs12345!  (change post-seed if desired)
--
-- IDEMPOTENCY:
--   This seed uses plain INSERT (no ON CONFLICT). Re-running WITHOUT a prior
--   TRUNCATE will fail on the subdomain-unique constraint — by design. The whole
--   DO block is wrapped in an implicit transaction (psql autocommit off during DO),
--   so a second run rolls back completely with no partial state.
--
--   To re-seed: TRUNCATE TABLE tenants RESTART IDENTITY CASCADE; then re-run.
--
-- REFERENCES:
--   §0.7 Step 0.7 decision: Option (c) dedicated SQL seed, 3 tenants + apitest compat.
--   §1.1 tenant_domains schema (status, verification_token, is_primary, RLS).
--   signup.service.ts:146-163 = transactional pattern this seed mirrors atomically.

DO $$
DECLARE
  v_tenant_id INTEGER;
  v_user_id   INTEGER;
BEGIN
  -- ==========================================================================
  -- Tenant 1: apitest — backward-compat with scripts/create-test-tenant.sh
  -- ==========================================================================
  -- Rationale (§0.7 Option α): existing API-integration tests hardcode
  -- `admin@apitest.de` / `ApiTest12345!`. Pre-seeding the tenant as VERIFIED keeps
  -- those tests green without having to change their credentials.
  INSERT INTO tenants
    (company_name, subdomain, email, phone, street, house_number, postal_code,
     city, country_code, status, billing_email, uuid, uuid_created_at,
     trial_ends_at)
  VALUES
    ('API Test GmbH', 'apitest', 'info@apitest.de', '+49123456789',
     'Musterstraße', '42', '10115', 'Berlin', 'DE',
     'trial', 'admin@apitest.de', uuidv7(), NOW(),
     NOW() + INTERVAL '14 days')
  RETURNING id INTO v_tenant_id;

  INSERT INTO users
    (username, email, password, role, first_name, last_name, tenant_id, phone,
     employee_number, has_full_access, is_active, uuid, uuid_created_at)
  VALUES
    ('admin@apitest.de', 'admin@apitest.de',
     '$2b$12$HLKWAGdFkmrRjtmLWYZM3.KHQ1B7x9LU8C.dt.RLIbJGA/zD7Xi32',
     'root', 'Admin', 'Test', v_tenant_id, '+49123456789',
     'SEED-APITEST-001', true, 1, uuidv7(), NOW())
  RETURNING id INTO v_user_id;

  UPDATE users SET employee_id = 'API-R' || LPAD(v_user_id::text, 5, '0') WHERE id = v_user_id;

  INSERT INTO tenant_domains
    (tenant_id, domain, status, verification_token, verified_at, is_primary, is_active)
  VALUES
    (v_tenant_id, 'apitest.de', 'verified',
     REPLACE(uuidv7()::text, '-', '') || REPLACE(uuidv7()::text, '-', ''),
     NOW(), true, 1);

  -- Dev-only trial-addon activation (mirrors signup.service.ts#activateTrialAddons).
  -- §0.7 decision: include so dev UI doesn't show "no access" everywhere.
  INSERT INTO tenant_addons
    (tenant_id, addon_id, status, trial_started_at, trial_ends_at, activated_at,
     is_active, created_at, updated_at)
  SELECT v_tenant_id, id, 'trial', NOW(),
         NOW() + (COALESCE(trial_days, 30) || ' days')::INTERVAL,
         NOW(), 1, NOW(), NOW()
  FROM addons WHERE is_core = false AND is_active = 1;

  RAISE NOTICE 'Seeded apitest: tenant_id=%, user_id=%, domain=apitest.de', v_tenant_id, v_user_id;

  -- ==========================================================================
  -- Tenant 2: firma-a — RLS multi-tenant isolation test
  -- ==========================================================================
  INSERT INTO tenants
    (company_name, subdomain, email, phone, street, house_number, postal_code,
     city, country_code, status, billing_email, uuid, uuid_created_at,
     trial_ends_at)
  VALUES
    ('Firma A Test', 'firma-a', 'info@firma-a.test', '+49301234567',
     'Testweg', '1', '10117', 'Berlin', 'DE',
     'trial', 'test@firma-a.test', uuidv7(), NOW(),
     NOW() + INTERVAL '14 days')
  RETURNING id INTO v_tenant_id;

  INSERT INTO users
    (username, email, password, role, first_name, last_name, tenant_id, phone,
     employee_number, has_full_access, is_active, uuid, uuid_created_at)
  VALUES
    ('test@firma-a.test', 'test@firma-a.test',
     '$2b$12$3ui52o0TwLbbtzq4Y11ocuEjTXDEEU9Q0AtcEAv/Bc0V3fDd8L9te',
     'root', 'Test', 'Firma-A', v_tenant_id, '+49301234567',
     'SEED-FIRMA-A-001', true, 1, uuidv7(), NOW())
  RETURNING id INTO v_user_id;

  UPDATE users SET employee_id = 'FIR-R' || LPAD(v_user_id::text, 5, '0') WHERE id = v_user_id;

  INSERT INTO tenant_domains
    (tenant_id, domain, status, verification_token, verified_at, is_primary, is_active)
  VALUES
    (v_tenant_id, 'firma-a.test', 'verified',
     REPLACE(uuidv7()::text, '-', '') || REPLACE(uuidv7()::text, '-', ''),
     NOW(), true, 1);

  INSERT INTO tenant_addons
    (tenant_id, addon_id, status, trial_started_at, trial_ends_at, activated_at,
     is_active, created_at, updated_at)
  SELECT v_tenant_id, id, 'trial', NOW(),
         NOW() + (COALESCE(trial_days, 30) || ' days')::INTERVAL,
         NOW(), 1, NOW(), NOW()
  FROM addons WHERE is_core = false AND is_active = 1;

  RAISE NOTICE 'Seeded firma-a: tenant_id=%, user_id=%, domain=firma-a.test', v_tenant_id, v_user_id;

  -- ==========================================================================
  -- Tenant 3: firma-b — cross-tenant-leak-check partner tenant
  -- ==========================================================================
  INSERT INTO tenants
    (company_name, subdomain, email, phone, street, house_number, postal_code,
     city, country_code, status, billing_email, uuid, uuid_created_at,
     trial_ends_at)
  VALUES
    ('Firma B Test', 'firma-b', 'info@firma-b.test', '+49301234568',
     'Proberstraße', '2', '10118', 'Berlin', 'DE',
     'trial', 'test@firma-b.test', uuidv7(), NOW(),
     NOW() + INTERVAL '14 days')
  RETURNING id INTO v_tenant_id;

  INSERT INTO users
    (username, email, password, role, first_name, last_name, tenant_id, phone,
     employee_number, has_full_access, is_active, uuid, uuid_created_at)
  VALUES
    ('test@firma-b.test', 'test@firma-b.test',
     '$2b$12$JbrG69io8po6M6oyWOHm7e6En9BmZA080hm5nfCPJ4BjNX0ZYvzZO',
     'root', 'Test', 'Firma-B', v_tenant_id, '+49301234568',
     'SEED-FIRMA-B-001', true, 1, uuidv7(), NOW())
  RETURNING id INTO v_user_id;

  UPDATE users SET employee_id = 'FIR-R' || LPAD(v_user_id::text, 5, '0') WHERE id = v_user_id;

  INSERT INTO tenant_domains
    (tenant_id, domain, status, verification_token, verified_at, is_primary, is_active)
  VALUES
    (v_tenant_id, 'firma-b.test', 'verified',
     REPLACE(uuidv7()::text, '-', '') || REPLACE(uuidv7()::text, '-', ''),
     NOW(), true, 1);

  INSERT INTO tenant_addons
    (tenant_id, addon_id, status, trial_started_at, trial_ends_at, activated_at,
     is_active, created_at, updated_at)
  SELECT v_tenant_id, id, 'trial', NOW(),
         NOW() + (COALESCE(trial_days, 30) || ' days')::INTERVAL,
         NOW(), 1, NOW(), NOW()
  FROM addons WHERE is_core = false AND is_active = 1;

  RAISE NOTICE 'Seeded firma-b: tenant_id=%, user_id=%, domain=firma-b.test', v_tenant_id, v_user_id;

  -- ==========================================================================
  -- Tenant 4: scs — user's personal dev tenant (§1.3 preserves test@scs-technik.de)
  -- ==========================================================================
  -- Uses a real-world `scs-technik.de` domain (owned by the user in real life)
  -- so optional later real-TXT-verify testing against live DNS is possible.
  INSERT INTO tenants
    (company_name, subdomain, email, phone, street, house_number, postal_code,
     city, country_code, status, billing_email, uuid, uuid_created_at,
     trial_ends_at)
  VALUES
    ('SCS Technik', 'scs', 'info@scs-technik.de', '+49301234569',
     'Technikweg', '3', '10119', 'Berlin', 'DE',
     'trial', 'test@scs-technik.de', uuidv7(), NOW(),
     NOW() + INTERVAL '14 days')
  RETURNING id INTO v_tenant_id;

  INSERT INTO users
    (username, email, password, role, first_name, last_name, tenant_id, phone,
     employee_number, has_full_access, is_active, uuid, uuid_created_at)
  VALUES
    ('test@scs-technik.de', 'test@scs-technik.de',
     '$2b$12$aPTNbQnux5HyhB0VxY.9jO8AZCGF9jQxpmgdyhcfp0K0qix7c8hiu',
     'root', 'Simon', 'Oeztuerk', v_tenant_id, '+49301234569',
     'SEED-SCS-001', true, 1, uuidv7(), NOW())
  RETURNING id INTO v_user_id;

  UPDATE users SET employee_id = 'SCS-R' || LPAD(v_user_id::text, 5, '0') WHERE id = v_user_id;

  INSERT INTO tenant_domains
    (tenant_id, domain, status, verification_token, verified_at, is_primary, is_active)
  VALUES
    (v_tenant_id, 'scs-technik.de', 'verified',
     REPLACE(uuidv7()::text, '-', '') || REPLACE(uuidv7()::text, '-', ''),
     NOW(), true, 1);

  INSERT INTO tenant_addons
    (tenant_id, addon_id, status, trial_started_at, trial_ends_at, activated_at,
     is_active, created_at, updated_at)
  SELECT v_tenant_id, id, 'trial', NOW(),
         NOW() + (COALESCE(trial_days, 30) || ' days')::INTERVAL,
         NOW(), 1, NOW(), NOW()
  FROM addons WHERE is_core = false AND is_active = 1;

  RAISE NOTICE 'Seeded scs: tenant_id=%, user_id=%, domain=scs-technik.de', v_tenant_id, v_user_id;
END $$;

-- =============================================================================
-- Global Seed Data - Idempotent (safe to run multiple times)
-- =============================================================================
-- Tables: addons, kvp_categories, asset_categories
-- These are global tables (no tenant_id, no RLS).
-- ADR-033: Addon-based SaaS model (replaces plan-tier system).
-- =============================================================================

-- Addons (21 entries)
-- is_core=true: always active, no subscription needed (8 core addons)
-- is_core=false: purchasable, 30-day trial, 10€/month (12 purchasable addons)
INSERT INTO public.addons (id, code, name, description, price_monthly, is_active, requires_setup, icon, sort_order, is_core, trial_days, created_at, updated_at) VALUES
  (1,  'dashboard',      'Dashboard',               'Dashboard mit Übersicht',                                                                            NULL,  1, false, NULL, 0,  true,  NULL, '2025-07-23 09:56:05+02', '2026-03-11 12:00:00+01'),
  (2,  'employees',      'Mitarbeiterverwaltung',   'Mitarbeiter verwalten',                                                                              NULL,  1, false, NULL, 0,  true,  NULL, '2025-07-23 09:56:05+02', '2026-03-11 12:00:00+01'),
  (3,  'departments',    'Abteilungen',             'Abteilungen verwalten',                                                                              NULL,  1, false, NULL, 0,  true,  NULL, '2025-07-23 09:56:05+02', '2026-03-11 12:00:00+01'),
  (4,  'teams',          'Teams',                   'Teams verwalten',                                                                                    NULL,  1, false, NULL, 0,  true,  NULL, '2025-07-23 09:56:05+02', '2026-03-11 12:00:00+01'),
  (5,  'shift_planning', 'Schichtplanung',          'Schichtpläne erstellen und verwalten',                                                               10.00, 1, false, NULL, 0,  false, 30,   '2025-07-23 09:56:05+02', '2026-03-11 12:00:00+01'),
  (6,  'calendar',       'Kalender',                'Gemeinsamer Kalender',                                                                               NULL,  1, false, NULL, 0,  true,  NULL, '2025-07-23 09:56:05+02', '2026-03-11 12:00:00+01'),
  (7,  'blackboard',     'Schwarzes Brett',         'Digitales schwarzes Brett',                                                                          NULL,  1, false, NULL, 0,  true,  NULL, '2025-07-23 09:56:05+02', '2026-03-11 12:00:00+01'),
  (8,  'chat',           'Chat',                    'Team-Chat Funktion',                                                                                 10.00, 1, false, NULL, 0,  false, 30,   '2025-07-23 09:56:05+02', '2026-03-11 12:00:00+01'),
  (9,  'documents',      'Dokumente',               'Dokumentenverwaltung',                                                                               10.00, 1, false, NULL, 0,  false, 30,   '2025-07-23 09:56:05+02', '2026-03-11 12:00:00+01'),
  (10, 'surveys',        'Umfragen',                'Umfragen erstellen und auswerten',                                                                   10.00, 1, false, NULL, 0,  false, 30,   '2025-07-23 09:56:05+02', '2026-03-11 12:00:00+01'),
  (11, 'kvp',            'KVP',                     'Kontinuierlicher Verbesserungsprozess',                                                              10.00, 1, false, NULL, 0,  false, 30,   '2025-07-23 09:56:05+02', '2026-03-11 12:00:00+01'),
  (12, 'settings',       'Einstellungen',           'Systemeinstellungen',                                                                                NULL,  1, false, NULL, 0,  true,  NULL, '2025-07-23 09:56:05+02', '2026-03-11 12:00:00+01'),
  (13, 'vacation',       'Urlaubsverwaltung',       'Digitale Urlaubsanträge mit automatischer Genehmigung, Vertreterregelung und Kapazitätsprüfung',     10.00, 1, false, NULL, 50, false, 30,   '2026-02-12 13:11:15+01', '2026-03-11 12:00:00+01'),
  (14, 'tpm',            'TPM / Wartung',           'Total Productive Maintenance — Kamishibai Board, Wartungspläne, Intervall-Karten',                   10.00, 1, false, NULL, 0,  false, 30,   '2026-02-18 22:42:13+01', '2026-03-11 12:00:00+01'),
  (15, 'work_orders',    'Arbeitsaufträge',         'Modulübergreifendes Arbeitsauftrag-System für Mängelbeseitigung und Aufgabenverwaltung',             10.00, 1, false, NULL, 55, false, 30,   '2026-03-02 21:35:39+01', '2026-03-11 12:00:00+01'),
  (16, 'assets',         'Anlagen & Maschinen',     'Verwaltung von Anlagen, Maschinen und Verfügbarkeit',                                                10.00, 1, false, NULL, 60, false, 30,   '2026-03-09 17:19:58+01', '2026-03-11 12:00:00+01'),
  (17, 'reports',        'Berichte & Auswertungen', 'Unternehmensberichte und Analytics',                                                                 10.00, 1, false, NULL, 65, false, 30,   '2026-03-09 17:19:58+01', '2026-03-11 12:00:00+01'),
  (18, 'audit_trail',    'Protokoll & Audit',       'Audit-Protokollierung und Compliance-Berichte',                                                      10.00, 1, false, NULL, 70, false, 30,   '2026-03-09 17:19:58+01', '2026-03-11 12:00:00+01'),
  (19, 'notifications',  'Benachrichtigungen',      'Benachrichtigungsverwaltung und SSE-Streaming',                                                      NULL,  1, false, NULL, 75, true,  NULL, '2026-03-09 17:19:58+01', '2026-03-11 12:00:00+01'),
  (20, 'dummy_users',    'Platzhalter-Benutzer',    'Anonyme Anzeige-Accounts für Bildschirme',                                                           10.00, 1, false, NULL, 80, false, 30,   '2026-03-09 17:19:58+01', '2026-03-11 12:00:00+01'),
  (21, 'manage_hierarchy','Organisationsstruktur',  'Verwaltung von Bereichen, Abteilungen, Teams und Mitarbeitern',                                       0.00,  1, false, 'fa-sitemap', 50, true, 30, '2026-03-13 20:27:32+01', '2026-03-13 20:27:32+01')
ON CONFLICT (id) DO NOTHING;

-- KVP Categories (6 entries)
INSERT INTO public.kvp_categories VALUES (1, 'Sicherheit', 'Verbesserungen zur Arbeitssicherheit', '#e74c3c', '🛡️', '2025-11-13 22:07:17+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kvp_categories VALUES (2, 'Effizienz', 'Prozessoptimierungen und Zeitersparnis', '#2ecc71', '⚡', '2025-11-13 22:07:17+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kvp_categories VALUES (3, 'Qualität', 'Qualitätsverbesserungen und Fehlervermeidung', '#3498db', '⭐', '2025-11-13 22:07:17+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kvp_categories VALUES (4, 'Umwelt', 'Umweltfreundliche Verbesserungen', '#27ae60', '🌱', '2025-11-13 22:07:17+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kvp_categories VALUES (5, 'Ergonomie', 'Arbeitsplatzverbesserungen', '#9b59b6', '💤', '2025-11-13 22:07:17+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.kvp_categories VALUES (6, 'Kosteneinsparung', 'Maßnahmen zur Kostenreduzierung', '#f39c12', '💰', '2025-11-13 22:07:17+01') ON CONFLICT (id) DO NOTHING;

-- Asset Categories (11 entries)
INSERT INTO public.asset_categories VALUES (1, 'CNC-Anlagen', 'CNC-Anlagen (Computer Numerical Control)', 'fa-cogs', 1, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.asset_categories VALUES (2, 'Spritzgussanlagen', 'Kunststoff-Spritzgussanlagen', 'fa-industry', 2, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.asset_categories VALUES (3, 'Pressen', 'Hydraulische und mechanische Pressen', 'fa-compress', 3, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.asset_categories VALUES (4, 'Schweißanlagen', 'Verschiedene Schweißtechnologien', 'fa-fire', 4, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.asset_categories VALUES (5, 'Messgeräte', 'Qualitätskontrolle und Messtechnik', 'fa-ruler', 5, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.asset_categories VALUES (6, 'Verpackungsanlagen', 'Verpackung und Etikettierung', 'fa-box', 6, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.asset_categories VALUES (7, 'Fördertechnik', 'Transportbänder und Fördersysteme', 'fa-truck', 7, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.asset_categories VALUES (8, 'Kompressoren', 'Druckluft und Vakuumsysteme', 'fa-wind', 8, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.asset_categories VALUES (9, 'Kühlanlagen', 'Klimatisierung und Kühlung', 'fa-snowflake', 9, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.asset_categories VALUES (10, 'Sonstige', 'Andere Anlagentypen', 'fa-wrench', 10, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.asset_categories VALUES (11, 'Test Category', 'Test Category Description', 'fa-test', 99, 1) ON CONFLICT (id) DO NOTHING;

-- Sync sequences to max values
SELECT pg_catalog.setval('public.addons_id_seq', GREATEST((SELECT MAX(id) FROM public.addons), 21), true);
SELECT pg_catalog.setval('public.kvp_categories_id_seq', GREATEST((SELECT MAX(id) FROM public.kvp_categories), 6), true);
SELECT pg_catalog.setval('public.asset_categories_id_seq', GREATEST((SELECT MAX(id) FROM public.asset_categories), 11), true);

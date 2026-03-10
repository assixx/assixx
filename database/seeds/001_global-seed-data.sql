-- =============================================================================
-- Global Seed Data - Idempotent (safe to run multiple times)
-- =============================================================================
-- Tables: features, kvp_categories, asset_categories, plans, plan_features
-- These are global tables (no tenant_id, no RLS).
-- =============================================================================

-- Features (20 entries)
INSERT INTO public.features VALUES (1, 'dashboard', 'Dashboard', 'Dashboard mit Übersicht', 'basic', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2026-01-14 15:50:32.587296+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.features VALUES (2, 'employees', 'Mitarbeiterverwaltung', 'Mitarbeiter verwalten', 'core', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.features VALUES (3, 'departments', 'Abteilungen', 'Abteilungen verwalten', 'core', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.features VALUES (4, 'teams', 'Teams', 'Teams verwalten', 'core', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.features VALUES (5, 'shift_planning', 'Schichtplanung', 'Schichtpläne erstellen und verwalten', 'premium', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2026-01-14 15:50:32.587296+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.features VALUES (6, 'calendar', 'Kalender', 'Gemeinsamer Kalender', 'basic', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.features VALUES (7, 'blackboard', 'Schwarzes Brett', 'Digitales schwarzes Brett', 'basic', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.features VALUES (8, 'chat', 'Chat', 'Team-Chat Funktion', 'premium', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.features VALUES (9, 'documents', 'Dokumente', 'Dokumentenverwaltung', 'core', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.features VALUES (10, 'surveys', 'Umfragen', 'Umfragen erstellen und auswerten', 'premium', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.features VALUES (11, 'kvp', 'KVP', 'Kontinuierlicher Verbesserungsprozess', 'enterprise', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.features VALUES (12, 'settings', 'Einstellungen', 'Systemeinstellungen', 'basic', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.features VALUES (13, 'vacation', 'Urlaubsverwaltung', 'Digitale Urlaubsanträge mit automatischer Genehmigung, Vertreterregelung und Kapazitätsprüfung', 'basic', 0.00, 1, false, NULL, NULL, 50, '2026-02-12 13:11:15.666947+01', '2026-02-12 13:11:15.666947+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.features VALUES (14, 'tpm', 'TPM / Wartung', 'Total Productive Maintenance — Kamishibai Board, Wartungspläne, Intervall-Karten', 'enterprise', 0.00, 1, false, NULL, NULL, 0, '2026-02-18 22:42:13.995392+01', '2026-02-18 22:42:13.995392+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.features VALUES (15, 'work_orders', 'Arbeitsaufträge', 'Modulübergreifendes Arbeitsauftrag-System für Mängelbeseitigung und Aufgabenverwaltung', 'premium', 0.00, 1, false, NULL, NULL, 55, '2026-03-02 21:35:39.500487+01', '2026-03-02 21:35:39.500487+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.features VALUES (16, 'assets', 'Anlagen & Maschinen', 'Verwaltung von Anlagen, Maschinen und Verfügbarkeit', 'premium', 0.00, 1, false, NULL, NULL, 60, '2026-03-09 17:19:58.544799+01', '2026-03-09 17:19:58.544799+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.features VALUES (17, 'reports', 'Berichte & Auswertungen', 'Unternehmensberichte und Analytics', 'premium', 0.00, 1, false, NULL, NULL, 65, '2026-03-09 17:19:58.544799+01', '2026-03-09 17:19:58.544799+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.features VALUES (18, 'audit_trail', 'Protokoll & Audit', 'Audit-Protokollierung und Compliance-Berichte', 'enterprise', 0.00, 1, false, NULL, NULL, 70, '2026-03-09 17:19:58.544799+01', '2026-03-09 17:19:58.544799+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.features VALUES (19, 'notifications', 'Benachrichtigungen', 'Benachrichtigungsverwaltung und SSE-Streaming', 'basic', 0.00, 1, false, NULL, NULL, 75, '2026-03-09 17:19:58.544799+01', '2026-03-09 17:19:58.544799+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.features VALUES (20, 'dummy_users', 'Platzhalter-Benutzer', 'Anonyme Anzeige-Accounts für Bildschirme', 'core', 0.00, 1, false, NULL, NULL, 80, '2026-03-09 17:19:58.544799+01', '2026-03-09 17:19:58.544799+01') ON CONFLICT (id) DO NOTHING;

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

-- Plans (3 tiers)
INSERT INTO public.plans VALUES (1, 'basic', 'Basic', 'Perfekt für kleine Teams und Startups', 49.00, 10, 1, 100, 1, 1, '2025-06-02 19:21:07+02', '2026-01-14 15:31:35.067297+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plans VALUES (2, 'professional', 'Professional', 'Für wachsende Unternehmen', 149.00, 50, 3, 500, 1, 2, '2025-06-02 19:21:07+02', '2026-01-14 15:31:35.079892+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plans VALUES (3, 'enterprise', 'Enterprise', 'Für große Organisationen', 299.00, NULL, NULL, 1000, 1, 3, '2025-06-02 19:21:07+02', '2026-01-14 15:31:35.081322+01') ON CONFLICT (id) DO NOTHING;

-- Plan Features (60 associations: 20 features × 3 plans)
INSERT INTO public.plan_features VALUES (1, 1, 1, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (2, 1, 2, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (3, 1, 3, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (4, 1, 4, false, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (5, 1, 5, false, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (6, 1, 6, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (7, 1, 7, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (8, 1, 8, false, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (9, 1, 9, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (10, 1, 10, false, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (11, 1, 11, false, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (12, 1, 12, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (13, 2, 1, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (14, 2, 2, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (15, 2, 3, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (16, 2, 4, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (17, 2, 5, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (18, 2, 6, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (19, 2, 7, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (20, 2, 8, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (21, 2, 9, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (22, 2, 10, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (23, 2, 11, false, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (24, 2, 12, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (25, 3, 1, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (26, 3, 2, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (27, 3, 3, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (28, 3, 4, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (29, 3, 5, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (30, 3, 6, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (31, 3, 7, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (32, 3, 8, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (33, 3, 9, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (34, 3, 10, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (35, 3, 11, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (36, 3, 12, true, '2025-07-23 09:56:05+02') ON CONFLICT (id) DO NOTHING;
-- vacation (feature 13): Enterprise only
INSERT INTO public.plan_features VALUES (37, 1, 13, false, '2026-02-12 13:11:15+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (38, 2, 13, false, '2026-02-12 13:11:15+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (39, 3, 13, true, '2026-02-12 13:11:15+01') ON CONFLICT (id) DO NOTHING;
-- tpm (feature 14): Enterprise only
INSERT INTO public.plan_features VALUES (40, 1, 14, false, '2026-02-18 22:42:13+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (41, 2, 14, false, '2026-02-18 22:42:13+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (42, 3, 14, true, '2026-02-18 22:42:13+01') ON CONFLICT (id) DO NOTHING;
-- work_orders (feature 15): all plans
INSERT INTO public.plan_features VALUES (58, 1, 15, true, '2026-03-10 00:00:00+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (59, 2, 15, true, '2026-03-10 00:00:00+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (60, 3, 15, true, '2026-03-10 00:00:00+01') ON CONFLICT (id) DO NOTHING;
-- assets (feature 16): all plans
INSERT INTO public.plan_features VALUES (43, 1, 16, true, '2026-03-09 17:19:58.544799+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (44, 2, 16, true, '2026-03-09 17:19:58.544799+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (45, 3, 16, true, '2026-03-09 17:19:58.544799+01') ON CONFLICT (id) DO NOTHING;
-- reports (feature 17): all plans
INSERT INTO public.plan_features VALUES (46, 1, 17, true, '2026-03-09 17:19:58.544799+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (47, 2, 17, true, '2026-03-09 17:19:58.544799+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (48, 3, 17, true, '2026-03-09 17:19:58.544799+01') ON CONFLICT (id) DO NOTHING;
-- audit_trail (feature 18): all plans
INSERT INTO public.plan_features VALUES (49, 1, 18, true, '2026-03-09 17:19:58.544799+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (50, 2, 18, true, '2026-03-09 17:19:58.544799+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (51, 3, 18, true, '2026-03-09 17:19:58.544799+01') ON CONFLICT (id) DO NOTHING;
-- notifications (feature 19): all plans
INSERT INTO public.plan_features VALUES (52, 1, 19, true, '2026-03-09 17:19:58.544799+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (53, 2, 19, true, '2026-03-09 17:19:58.544799+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (54, 3, 19, true, '2026-03-09 17:19:58.544799+01') ON CONFLICT (id) DO NOTHING;
-- dummy_users (feature 20): all plans
INSERT INTO public.plan_features VALUES (55, 1, 20, true, '2026-03-09 17:19:58.544799+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (56, 2, 20, true, '2026-03-09 17:19:58.544799+01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.plan_features VALUES (57, 3, 20, true, '2026-03-09 17:19:58.544799+01') ON CONFLICT (id) DO NOTHING;

-- Sync sequences to max values
SELECT pg_catalog.setval('public.features_id_seq', GREATEST((SELECT MAX(id) FROM public.features), 20), true);
SELECT pg_catalog.setval('public.kvp_categories_id_seq', GREATEST((SELECT MAX(id) FROM public.kvp_categories), 6), true);
SELECT pg_catalog.setval('public.asset_categories_id_seq', GREATEST((SELECT MAX(id) FROM public.asset_categories), 11), true);
SELECT pg_catalog.setval('public.plan_features_id_seq', GREATEST((SELECT MAX(id) FROM public.plan_features), 60), true);
SELECT pg_catalog.setval('public.plans_id_seq', GREATEST((SELECT MAX(id) FROM public.plans), 3), true);

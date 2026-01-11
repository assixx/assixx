--
-- PostgreSQL database dump
--

\restrict gfkRta8pXZBG3nIkb4r7BQDVnUsvriUwvcMZ15SovDbzjfNYnbIX37KaVaFFja7

-- Dumped from database version 17.7
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: features; Type: TABLE DATA; Schema: public; Owner: assixx_user
--

INSERT INTO public.features VALUES (1, 'dashboard', 'Dashboard', 'Dashboard mit Ãœbersicht', 'basic', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02');
INSERT INTO public.features VALUES (2, 'employees', 'Mitarbeiterverwaltung', 'Mitarbeiter verwalten', 'core', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02');
INSERT INTO public.features VALUES (3, 'departments', 'Abteilungen', 'Abteilungen verwalten', 'core', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02');
INSERT INTO public.features VALUES (4, 'teams', 'Teams', 'Teams verwalten', 'core', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02');
INSERT INTO public.features VALUES (5, 'shift_planning', 'Schichtplanung', 'SchichtplÃ¤ne erstellen und verwalten', 'premium', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02');
INSERT INTO public.features VALUES (6, 'calendar', 'Kalender', 'Gemeinsamer Kalender', 'basic', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02');
INSERT INTO public.features VALUES (7, 'blackboard', 'Schwarzes Brett', 'Digitales schwarzes Brett', 'basic', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02');
INSERT INTO public.features VALUES (8, 'chat', 'Chat', 'Team-Chat Funktion', 'premium', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02');
INSERT INTO public.features VALUES (9, 'documents', 'Dokumente', 'Dokumentenverwaltung', 'core', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02');
INSERT INTO public.features VALUES (10, 'surveys', 'Umfragen', 'Umfragen erstellen und auswerten', 'premium', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02');
INSERT INTO public.features VALUES (11, 'kvp', 'KVP', 'Kontinuierlicher Verbesserungsprozess', 'enterprise', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02');
INSERT INTO public.features VALUES (12, 'settings', 'Einstellungen', 'Systemeinstellungen', 'basic', 0.00, 1, false, NULL, NULL, 0, '2025-07-23 09:56:05+02', '2025-07-23 09:56:05+02');


--
-- Data for Name: plans; Type: TABLE DATA; Schema: public; Owner: assixx_user
--

INSERT INTO public.plans VALUES (1, 'basic', 'Basic', 'Perfekt fÃ¼r kleine Teams und Startups', 49.00, 10, 1, 100, 1, 1, '2025-06-02 19:21:07+02', '2025-06-02 19:21:07+02');
INSERT INTO public.plans VALUES (2, 'professional', 'Professional', 'FÃ¼r wachsende Unternehmen', 149.00, 50, 3, 500, 1, 2, '2025-06-02 19:21:07+02', '2025-06-02 19:21:07+02');
INSERT INTO public.plans VALUES (3, 'enterprise', 'Enterprise', 'FÃ¼r groÃŸe Organisationen', 299.00, NULL, NULL, 1000, 1, 3, '2025-06-02 19:21:07+02', '2025-06-02 19:21:07+02');


--
-- Data for Name: plan_features; Type: TABLE DATA; Schema: public; Owner: assixx_user
--

INSERT INTO public.plan_features VALUES (1, 1, 1, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (2, 1, 2, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (3, 1, 3, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (4, 1, 4, false, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (5, 1, 5, false, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (6, 1, 6, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (7, 1, 7, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (8, 1, 8, false, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (9, 1, 9, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (10, 1, 10, false, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (11, 1, 11, false, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (12, 1, 12, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (13, 2, 1, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (14, 2, 2, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (15, 2, 3, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (16, 2, 4, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (17, 2, 5, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (18, 2, 6, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (19, 2, 7, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (20, 2, 8, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (21, 2, 9, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (22, 2, 10, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (23, 2, 11, false, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (24, 2, 12, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (25, 3, 1, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (26, 3, 2, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (27, 3, 3, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (28, 3, 4, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (29, 3, 5, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (30, 3, 6, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (31, 3, 7, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (32, 3, 8, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (33, 3, 9, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (34, 3, 10, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (35, 3, 11, true, '2025-07-23 09:56:05+02');
INSERT INTO public.plan_features VALUES (36, 3, 12, true, '2025-07-23 09:56:05+02');


--
-- Name: features_id_seq; Type: SEQUENCE SET; Schema: public; Owner: assixx_user
--

SELECT pg_catalog.setval('public.features_id_seq', 12, true);


--
-- Name: plan_features_id_seq; Type: SEQUENCE SET; Schema: public; Owner: assixx_user
--

SELECT pg_catalog.setval('public.plan_features_id_seq', 36, true);


--
-- Name: plans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: assixx_user
--

SELECT pg_catalog.setval('public.plans_id_seq', 3, true);


--
-- PostgreSQL database dump complete
--

\unrestrict gfkRta8pXZBG3nIkb4r7BQDVnUsvriUwvcMZ15SovDbzjfNYnbIX37KaVaFFja7


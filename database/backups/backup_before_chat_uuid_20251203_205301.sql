--
-- PostgreSQL database dump
--

\restrict wqyzOEe7YsDM0vtSDFImFgZOHL3m160PDDBs2ahe4uQXFFYaRikBDh0100KpP6e

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: assixx_user
--

CREATE TABLE public.conversations (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    name character varying(255),
    is_group boolean DEFAULT false,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.conversations FORCE ROW LEVEL SECURITY;


ALTER TABLE public.conversations OWNER TO assixx_user;

--
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: assixx_user
--

CREATE SEQUENCE public.conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversations_id_seq OWNER TO assixx_user;

--
-- Name: conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: assixx_user
--

ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;


--
-- Name: conversations id; Type: DEFAULT; Schema: public; Owner: assixx_user
--

ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: assixx_user
--

COPY public.conversations (id, tenant_id, name, is_group, created_at, updated_at) FROM stdin;
2	8	\N	f	2025-12-02 18:47:29.427502+01	2025-12-02 18:47:29.427502+01
12	8	\N	f	2025-12-03 17:46:47.339936+01	2025-12-03 17:46:47.339936+01
13	8	\N	f	2025-12-03 17:46:57.298726+01	2025-12-03 17:46:57.298726+01
14	8	\N	f	2025-12-03 17:47:41.72235+01	2025-12-03 17:47:41.72235+01
15	8	\N	f	2025-12-03 17:49:25.27602+01	2025-12-03 18:49:10.039395+01
\.


--
-- Name: conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: assixx_user
--

SELECT pg_catalog.setval('public.conversations_id_seq', 15, true);


--
-- Name: conversations idx_19132_primary; Type: CONSTRAINT; Schema: public; Owner: assixx_user
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT idx_19132_primary PRIMARY KEY (id);


--
-- Name: idx_19132_idx_tenant; Type: INDEX; Schema: public; Owner: assixx_user
--

CREATE INDEX idx_19132_idx_tenant ON public.conversations USING btree (tenant_id);


--
-- Name: conversations on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: assixx_user
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_conversations();


--
-- Name: conversations update_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: assixx_user
--

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: conversations conversations_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: assixx_user
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: assixx_user
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations tenant_isolation; Type: POLICY; Schema: public; Owner: assixx_user
--

CREATE POLICY tenant_isolation ON public.conversations USING (((NULLIF(current_setting('app.tenant_id'::text, true), ''::text) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: TABLE conversations; Type: ACL; Schema: public; Owner: assixx_user
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.conversations TO app_user;


--
-- Name: SEQUENCE conversations_id_seq; Type: ACL; Schema: public; Owner: assixx_user
--

GRANT SELECT,USAGE ON SEQUENCE public.conversations_id_seq TO app_user;


--
-- PostgreSQL database dump complete
--

\unrestrict wqyzOEe7YsDM0vtSDFImFgZOHL3m160PDDBs2ahe4uQXFFYaRikBDh0100KpP6e


--
-- PostgreSQL database dump
--

\restrict gzic1vzxa6jtfLpWZgHrRuX5H934lwjbfSnewg9j6aTAZWgTKDhp8gMnZn8TCoB

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
-- Name: chat_channel_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_channel_members (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    user_id integer NOT NULL,
    role public.chat_channel_members_role DEFAULT 'member'::public.chat_channel_members_role,
    tenant_id integer NOT NULL,
    joined_at timestamp with time zone
);

ALTER TABLE ONLY public.chat_channel_members FORCE ROW LEVEL SECURITY;


--
-- Name: chat_channel_members_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_channel_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_channel_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_channel_members_id_seq OWNED BY public.chat_channel_members.id;


--
-- Name: chat_channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_channels (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    type public.chat_channels_type NOT NULL,
    visibility_scope public.chat_channels_visibility_scope DEFAULT 'company'::public.chat_channels_visibility_scope,
    target_id integer,
    created_by integer NOT NULL,
    tenant_id integer NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    is_active smallint DEFAULT 1
);

ALTER TABLE ONLY public.chat_channels FORCE ROW LEVEL SECURITY;


--
-- Name: COLUMN chat_channels.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chat_channels.is_active IS 'Status: 0=inactive, 1=active, 3=archived, 4=deleted';


--
-- Name: chat_channels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_channels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_channels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_channels_id_seq OWNED BY public.chat_channels.id;


--
-- Name: chat_message_edits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_message_edits (
    id integer NOT NULL,
    message_id integer NOT NULL,
    previous_content text NOT NULL,
    edited_by integer NOT NULL,
    edited_at timestamp with time zone,
    tenant_id integer NOT NULL
);

ALTER TABLE ONLY public.chat_message_edits FORCE ROW LEVEL SECURITY;


--
-- Name: chat_message_edits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_message_edits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_message_edits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_message_edits_id_seq OWNED BY public.chat_message_edits.id;


--
-- Name: chat_message_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_message_reactions (
    id integer NOT NULL,
    message_id integer NOT NULL,
    user_id integer NOT NULL,
    emoji character varying(10) NOT NULL,
    tenant_id integer NOT NULL,
    created_at timestamp with time zone
);

ALTER TABLE ONLY public.chat_message_reactions FORCE ROW LEVEL SECURITY;


--
-- Name: chat_message_reactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_message_reactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_message_reactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_message_reactions_id_seq OWNED BY public.chat_message_reactions.id;


--
-- Name: chat_message_read_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_message_read_receipts (
    id integer NOT NULL,
    message_id integer NOT NULL,
    user_id integer NOT NULL,
    channel_id integer NOT NULL,
    read_at timestamp with time zone,
    tenant_id integer NOT NULL
);

ALTER TABLE ONLY public.chat_message_read_receipts FORCE ROW LEVEL SECURITY;


--
-- Name: chat_message_read_receipts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_message_read_receipts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_message_read_receipts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_message_read_receipts_id_seq OWNED BY public.chat_message_read_receipts.id;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    sender_id integer NOT NULL,
    content text NOT NULL,
    type public.chat_messages_type DEFAULT 'text'::public.chat_messages_type,
    reply_to_id integer,
    is_edited boolean DEFAULT false,
    edited_at timestamp with time zone,
    is_pinned boolean DEFAULT false,
    tenant_id integer NOT NULL,
    created_at timestamp with time zone,
    is_active smallint DEFAULT 1
);

ALTER TABLE ONLY public.chat_messages FORCE ROW LEVEL SECURITY;


--
-- Name: COLUMN chat_messages.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.chat_messages.is_active IS 'Status: 0=inactive, 1=active, 3=archived, 4=deleted';


--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: chat_channel_members id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channel_members ALTER COLUMN id SET DEFAULT nextval('public.chat_channel_members_id_seq'::regclass);


--
-- Name: chat_channels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channels ALTER COLUMN id SET DEFAULT nextval('public.chat_channels_id_seq'::regclass);


--
-- Name: chat_message_edits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_edits ALTER COLUMN id SET DEFAULT nextval('public.chat_message_edits_id_seq'::regclass);


--
-- Name: chat_message_reactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_reactions ALTER COLUMN id SET DEFAULT nextval('public.chat_message_reactions_id_seq'::regclass);


--
-- Name: chat_message_read_receipts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_read_receipts ALTER COLUMN id SET DEFAULT nextval('public.chat_message_read_receipts_id_seq'::regclass);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Data for Name: chat_channel_members; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_channel_members (id, channel_id, user_id, role, tenant_id, joined_at) FROM stdin;
\.


--
-- Data for Name: chat_channels; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_channels (id, name, description, type, visibility_scope, target_id, created_by, tenant_id, created_at, updated_at, is_active) FROM stdin;
\.


--
-- Data for Name: chat_message_edits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_message_edits (id, message_id, previous_content, edited_by, edited_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: chat_message_reactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_message_reactions (id, message_id, user_id, emoji, tenant_id, created_at) FROM stdin;
\.


--
-- Data for Name: chat_message_read_receipts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_message_read_receipts (id, message_id, user_id, channel_id, read_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_messages (id, channel_id, sender_id, content, type, reply_to_id, is_edited, edited_at, is_pinned, tenant_id, created_at, is_active) FROM stdin;
\.


--
-- Name: chat_channel_members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chat_channel_members_id_seq', 1, true);


--
-- Name: chat_channels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chat_channels_id_seq', 1, true);


--
-- Name: chat_message_edits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chat_message_edits_id_seq', 1, true);


--
-- Name: chat_message_reactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chat_message_reactions_id_seq', 1, true);


--
-- Name: chat_message_read_receipts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chat_message_read_receipts_id_seq', 1, true);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chat_messages_id_seq', 1, true);


--
-- Name: chat_channels idx_19089_primary; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT idx_19089_primary PRIMARY KEY (id);


--
-- Name: chat_channel_members idx_19098_primary; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channel_members
    ADD CONSTRAINT idx_19098_primary PRIMARY KEY (id);


--
-- Name: chat_messages idx_19104_primary; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT idx_19104_primary PRIMARY KEY (id);


--
-- Name: chat_message_edits idx_19115_primary; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_edits
    ADD CONSTRAINT idx_19115_primary PRIMARY KEY (id);


--
-- Name: chat_message_reactions idx_19122_primary; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_reactions
    ADD CONSTRAINT idx_19122_primary PRIMARY KEY (id);


--
-- Name: chat_message_read_receipts idx_19127_primary; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_read_receipts
    ADD CONSTRAINT idx_19127_primary PRIMARY KEY (id);


--
-- Name: idx_19089_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_19089_created_by ON public.chat_channels USING btree (created_by);


--
-- Name: idx_19089_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_19089_tenant_id ON public.chat_channels USING btree (tenant_id);


--
-- Name: idx_19098_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_19098_tenant_id ON public.chat_channel_members USING btree (tenant_id);


--
-- Name: idx_19098_unique_channel_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_19098_unique_channel_user ON public.chat_channel_members USING btree (channel_id, user_id);


--
-- Name: idx_19098_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_19098_user_id ON public.chat_channel_members USING btree (user_id);


--
-- Name: idx_19104_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_19104_channel_id ON public.chat_messages USING btree (channel_id);


--
-- Name: idx_19104_reply_to_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_19104_reply_to_id ON public.chat_messages USING btree (reply_to_id);


--
-- Name: idx_19104_sender_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_19104_sender_id ON public.chat_messages USING btree (sender_id);


--
-- Name: idx_19104_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_19104_tenant_id ON public.chat_messages USING btree (tenant_id);


--
-- Name: idx_19115_edited_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_19115_edited_by ON public.chat_message_edits USING btree (edited_by);


--
-- Name: idx_19115_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_19115_message_id ON public.chat_message_edits USING btree (message_id);


--
-- Name: idx_19115_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_19115_tenant_id ON public.chat_message_edits USING btree (tenant_id);


--
-- Name: idx_19122_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_19122_tenant_id ON public.chat_message_reactions USING btree (tenant_id);


--
-- Name: idx_19122_unique_message_user_emoji; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_19122_unique_message_user_emoji ON public.chat_message_reactions USING btree (message_id, user_id, emoji);


--
-- Name: idx_19122_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_19122_user_id ON public.chat_message_reactions USING btree (user_id);


--
-- Name: idx_19127_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_19127_channel_id ON public.chat_message_read_receipts USING btree (channel_id);


--
-- Name: idx_19127_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_19127_tenant_id ON public.chat_message_read_receipts USING btree (tenant_id);


--
-- Name: idx_19127_unique_message_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_19127_unique_message_user ON public.chat_message_read_receipts USING btree (message_id, user_id);


--
-- Name: idx_19127_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_19127_user_id ON public.chat_message_read_receipts USING btree (user_id);


--
-- Name: idx_chat_channels_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_channels_is_active ON public.chat_channels USING btree (is_active);


--
-- Name: idx_chat_messages_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_is_active ON public.chat_messages USING btree (is_active);


--
-- Name: chat_channels on_update_current_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON public.chat_channels FOR EACH ROW EXECUTE FUNCTION public.on_update_current_timestamp_chat_channels();


--
-- Name: chat_channels update_chat_channels_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_chat_channels_updated_at BEFORE UPDATE ON public.chat_channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: chat_channel_members chat_channel_members_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channel_members
    ADD CONSTRAINT chat_channel_members_ibfk_1 FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: chat_channel_members chat_channel_members_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channel_members
    ADD CONSTRAINT chat_channel_members_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_channel_members chat_channel_members_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channel_members
    ADD CONSTRAINT chat_channel_members_ibfk_3 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_channels chat_channels_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT chat_channels_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_channels chat_channels_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT chat_channels_ibfk_2 FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_message_edits chat_message_edits_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_edits
    ADD CONSTRAINT chat_message_edits_ibfk_1 FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: chat_message_edits chat_message_edits_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_edits
    ADD CONSTRAINT chat_message_edits_ibfk_2 FOREIGN KEY (edited_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_message_edits chat_message_edits_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_edits
    ADD CONSTRAINT chat_message_edits_ibfk_3 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_message_reactions chat_message_reactions_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_reactions
    ADD CONSTRAINT chat_message_reactions_ibfk_1 FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: chat_message_reactions chat_message_reactions_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_reactions
    ADD CONSTRAINT chat_message_reactions_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_message_reactions chat_message_reactions_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_reactions
    ADD CONSTRAINT chat_message_reactions_ibfk_3 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_message_read_receipts chat_message_read_receipts_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_read_receipts
    ADD CONSTRAINT chat_message_read_receipts_ibfk_1 FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: chat_message_read_receipts chat_message_read_receipts_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_read_receipts
    ADD CONSTRAINT chat_message_read_receipts_ibfk_2 FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_message_read_receipts chat_message_read_receipts_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_read_receipts
    ADD CONSTRAINT chat_message_read_receipts_ibfk_3 FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_message_read_receipts chat_message_read_receipts_ibfk_4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_read_receipts
    ADD CONSTRAINT chat_message_read_receipts_ibfk_4 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_messages chat_messages_ibfk_1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_ibfk_1 FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_messages chat_messages_ibfk_2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_ibfk_2 FOREIGN KEY (sender_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_messages chat_messages_ibfk_3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_ibfk_3 FOREIGN KEY (reply_to_id) REFERENCES public.chat_messages(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_messages chat_messages_ibfk_4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_ibfk_4 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: chat_channel_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_channels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_message_edits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_message_edits ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_message_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_message_read_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_message_read_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_channel_members tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.chat_channel_members USING (((NULLIF(current_setting('app.tenant_id'::text, true), ''::text) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: chat_channels tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.chat_channels USING (((NULLIF(current_setting('app.tenant_id'::text, true), ''::text) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: chat_message_edits tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.chat_message_edits USING (((NULLIF(current_setting('app.tenant_id'::text, true), ''::text) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: chat_message_reactions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.chat_message_reactions USING (((NULLIF(current_setting('app.tenant_id'::text, true), ''::text) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: chat_message_read_receipts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.chat_message_read_receipts USING (((NULLIF(current_setting('app.tenant_id'::text, true), ''::text) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- Name: chat_messages tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.chat_messages USING (((NULLIF(current_setting('app.tenant_id'::text, true), ''::text) IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));


--
-- PostgreSQL database dump complete
--

\unrestrict gzic1vzxa6jtfLpWZgHrRuX5H934lwjbfSnewg9j6aTAZWgTKDhp8gMnZn8TCoB


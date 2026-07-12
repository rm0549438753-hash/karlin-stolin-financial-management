REVOKE ALL ON ALL TABLES IN SCHEMA extensions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA extensions FROM PUBLIC, anon, authenticated;
REVOKE CREATE ON SCHEMA extensions FROM PUBLIC;
GRANT USAGE ON SCHEMA extensions TO postgres, service_role;
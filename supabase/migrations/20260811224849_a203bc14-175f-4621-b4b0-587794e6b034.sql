ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_view boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_full_viewer(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _uid AND p.full_view)
$$;

REVOKE EXECUTE ON FUNCTION public.is_full_viewer(uuid) FROM anon;

DROP POLICY IF EXISTS "Editors can view action history" ON public.action_history;
CREATE POLICY "Editors can view action history" ON public.action_history FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'editor') OR public.is_full_viewer(auth.uid()));

DROP POLICY IF EXISTS "admin read archive" ON public.action_history_archive;
CREATE POLICY "admin read archive" ON public.action_history_archive FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR public.is_full_viewer(auth.uid()));

DROP POLICY IF EXISTS "superadmins can read download settings" ON public.app_download_settings;
CREATE POLICY "superadmins can read download settings" ON public.app_download_settings FOR SELECT TO authenticated
USING (has_role(auth.uid(),'superadmin') OR public.is_full_viewer(auth.uid()));

DROP POLICY IF EXISTS "admins view backup_runs" ON public.backup_runs;
CREATE POLICY "admins view backup_runs" ON public.backup_runs FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR public.is_full_viewer(auth.uid()));

DROP POLICY IF EXISTS "superadmin reads blocked ips" ON public.blocked_ips;
CREATE POLICY "superadmin reads blocked ips" ON public.blocked_ips FOR SELECT TO authenticated
USING (has_role(auth.uid(),'superadmin') OR public.is_full_viewer(auth.uid()));

DROP POLICY IF EXISTS "admins can view check email runs" ON public.check_email_runs;
CREATE POLICY "admins can view check email runs" ON public.check_email_runs FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR public.is_full_viewer(auth.uid()));

DROP POLICY IF EXISTS "admins view check email settings" ON public.check_email_settings;
CREATE POLICY "admins view check email settings" ON public.check_email_settings FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR public.is_full_viewer(auth.uid()));

DROP POLICY IF EXISTS "editors read classification applications" ON public.classification_applications;
CREATE POLICY "editors read classification applications" ON public.classification_applications FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'editor') OR public.is_full_viewer(auth.uid()));

DROP POLICY IF EXISTS "admin read automation runs" ON public.email_automation_runs;
CREATE POLICY "admin read automation runs" ON public.email_automation_runs FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR public.is_full_viewer(auth.uid()));

DROP POLICY IF EXISTS "admin read automations" ON public.email_automations;
CREATE POLICY "admin read automations" ON public.email_automations FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR public.is_full_viewer(auth.uid()));

DROP POLICY IF EXISTS "superadmins can read failed logins" ON public.failed_login_attempts;
CREATE POLICY "superadmins can read failed logins" ON public.failed_login_attempts FOR SELECT TO authenticated
USING (has_role(auth.uid(),'superadmin') OR public.is_full_viewer(auth.uid()));

DROP POLICY IF EXISTS "admins can read login events" ON public.login_events;
CREATE POLICY "admins can read login events" ON public.login_events FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'superadmin') OR public.is_full_viewer(auth.uid()));

DROP POLICY IF EXISTS "users read own profile or admin reads all" ON public.profiles;
CREATE POLICY "users read own profile or admin reads all" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR has_role(auth.uid(),'admin') OR public.is_full_viewer(auth.uid()));

DROP POLICY IF EXISTS "admins read accepted findings" ON public.security_accepted_findings;
CREATE POLICY "admins read accepted findings" ON public.security_accepted_findings FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'superadmin') OR public.is_full_viewer(auth.uid()));

DROP POLICY IF EXISTS "admins read security audit runs" ON public.security_audit_runs;
CREATE POLICY "admins read security audit runs" ON public.security_audit_runs FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR public.is_full_viewer(auth.uid()));

DROP POLICY IF EXISTS "admins read security memory" ON public.security_memory;
CREATE POLICY "admins read security memory" ON public.security_memory FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'superadmin') OR public.is_full_viewer(auth.uid()));

DROP POLICY IF EXISTS "sync_ignores select" ON public.sync_ignores;
CREATE POLICY "sync_ignores select" ON public.sync_ignores FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'editor') OR public.is_full_viewer(auth.uid()));

DROP POLICY IF EXISTS "users read own role or admin reads all" ON public.user_roles;
CREATE POLICY "users read own role or admin reads all" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(),'admin') OR public.is_full_viewer(auth.uid()));
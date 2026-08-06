-- Explicit object-level access rules for storage. Deny-by-default remains for
-- every bucket that has no matching policy; the app-downloads bucket is
-- readable/writable only by admins (the server route uses the service role,
-- which bypasses RLS).

DROP POLICY IF EXISTS "Admins can read app-downloads objects" ON storage.objects;
CREATE POLICY "Admins can read app-downloads objects"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'app-downloads' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert app-downloads objects" ON storage.objects;
CREATE POLICY "Admins can insert app-downloads objects"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'app-downloads' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update app-downloads objects" ON storage.objects;
CREATE POLICY "Admins can update app-downloads objects"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'app-downloads' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'app-downloads' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete app-downloads objects" ON storage.objects;
CREATE POLICY "Admins can delete app-downloads objects"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'app-downloads' AND public.has_role(auth.uid(), 'admin'));
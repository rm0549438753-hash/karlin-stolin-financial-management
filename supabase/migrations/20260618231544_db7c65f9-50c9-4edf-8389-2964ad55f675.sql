
DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
  target_email text := 'rm0549438753@gmail.com';
  target_password text := 'A214387953';
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = target_email) THEN
    RAISE NOTICE 'User already exists, skipping.';
    RETURN;
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, recovery_sent_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    target_email,
    crypt(target_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', target_email),
    now(), now(), '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', target_email, 'email_verified', true),
    'email',
    new_user_id::text,
    now(), now(), now()
  );

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new_user_id, target_email, target_email)
  ON CONFLICT (id) DO NOTHING;

  DELETE FROM public.user_roles WHERE user_id = new_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (new_user_id, 'admin');
END $$;

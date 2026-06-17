
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','editor');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid()=id) WITH CHECK (auth.uid()=id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- USER_ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

CREATE POLICY "auth read roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Auto-create profile + role on signup; first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  SELECT count(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'editor');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- LOOKUP TABLES
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'bank',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.expense_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, category_id)
);

-- Grants + RLS for lookups: all authenticated read; admin writes
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','funds','expense_types','categories','subcategories'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY "auth read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (true);', t);
    EXECUTE format('CREATE POLICY "admin write %1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),''admin''));', t);
    EXECUTE format('CREATE POLICY "admin update %1$s" ON public.%1$I FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),''admin'')) WITH CHECK (public.has_role(auth.uid(),''admin''));', t);
    EXECUTE format('CREATE POLICY "admin delete %1$s" ON public.%1$I FOR DELETE TO authenticated USING (public.has_role(auth.uid(),''admin''));', t);
  END LOOP;
END $$;

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  transaction_date DATE NOT NULL,
  value_date DATE,
  amount NUMERIC(14,2) NOT NULL,           -- חיובי = זכות/הכנסה ; שלילי = חובה/הוצאה
  balance NUMERIC(14,2),
  description TEXT,
  reference TEXT,
  fee NUMERIC(14,2),
  channel TEXT,
  fund_id UUID REFERENCES public.funds(id) ON DELETE SET NULL,
  expense_type_id UUID REFERENCES public.expense_types(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_account_date ON public.transactions(account_id, transaction_date DESC);
CREATE INDEX idx_tx_date ON public.transactions(transaction_date DESC);
CREATE INDEX idx_tx_category ON public.transactions(category_id);
CREATE INDEX idx_tx_fund ON public.transactions(fund_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read tx" ON public.transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "editor+admin insert tx" ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "editor+admin update tx" ON public.transactions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "admin delete tx" ON public.transactions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_tx_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- SEED data from settings sheet
INSERT INTO public.accounts (name, kind, sort_order) VALUES
  ('אגודת בית אולפנא - מרכנתיל','bank',1),
  ('אגודת בית אולפנא - פאגי','bank',2),
  ('אגודת ישיבת קרלין - מרכנתיל','bank',3),
  ('אגודת ישיבת קרלין - פאגי','bank',4),
  ('בית הכנסת בחצר הקודש','bank',5),
  ('ברינה יגילו','bank',6),
  ('כולל קרלין','bank',7),
  ('מדרשייה קו לקו','bank',8),
  ('מעלות מירון','bank',9),
  ('מרכז מוסדות - פאגי','bank',10),
  ('מרכז מוסדות קרלין','bank',11),
  ('עזר לנישואין','bank',12),
  ('צ''קים','checks',13),
  ('מזומן','cash',14);

INSERT INTO public.funds (name) VALUES
  ('משה שפירא'),('יונה אקער'),('דוד לובין'),('אלי שור'),('שאול יצחק פריינד'),
  ('שפירא'),('צבי חיים דישון'),('דוד פריינד'),('שעיה פריינד'),('יוחנן אייזן'),
  ('יהודה שפירא'),('משה ביניק'),('פנחס זלצמן'),('חיים יעקב קלפהולץ'),('יוחנן בריזל'),
  ('תומכי עמותות'),('בית אד"ש'),('מתנות לאביונים'),('קמחא דפסחא'),('צבי מרגלית'),
  ('אבי שטריימן'),('עמרם פוטש'),('אלימלך שפירא'),('בית כנסת ירושלים'),('קופה כללית'),
  ('כולל ברגמן'),('ביהכנ"ס היכל רבנו יוחנן'),('יין פסח פ"ו'),('לא רלוונטי');

INSERT INTO public.expense_types (name) VALUES
  ('כוללים'),('בית אד"ש'),('אירועים - טישין'),('משרד'),('אקספו'),('בית כנסת'),
  ('מגבית חו"ל'),('תורתו'),('ויזכו לבנות - שדכנים'),('שעשועי'),('עזר נישואין'),
  ('ועד רבני קרלין'),('צדקת רבי יוחנן'),('די ברכה אין שטוב'),('די אידישע שטוב'),
  ('וועד לטכנולוגיה'),('ברנה יגילו'),('ישיבת פאר ישראל'),('חיפה'),('גבעת זאב'),
  ('צ''קים'),('וועידת נשים חו"ל'),('פעמי רגלנו'),('ועד הרבנים'),('אבי שטריימן'),
  ('צבא'),('קמחא דפסחא'),('גיוס כספים'),('אין איינעם');

INSERT INTO public.categories (name) VALUES
  ('משכורות'),('הוצאות - ספקים'),('מילגות'),('הכנסות'),('שוטף'),
  ('חתונה בן הרב יוחנן'),('גנים בנים'),('חבורה'),('הלוואה'),('חתונה ויליגער כסלו פ"ו'),
  ('ועידה'),('צבי חיים דישון'),('ל"ג בעומר'),('ראש השנה'),('פורים'),('צדקה'),
  ('החזר הלוואה'),('חתונה אייכנשטיין'),('פסח'),('זאת חנוכה'),('שבועות'),('בניה');

INSERT INTO public.subcategories (name) VALUES
  ('הדפסות'),('מקצועיות'),('אחזקה'),('משרדיות'),('תקציבים'),('שכ"ל'),
  ('הוצאות שונות'),('תרומות'),('שונות'),('עמלות והוצאות בנקים'),('הלוואה'),
  ('אלי שור'),('מגבית'),('פרי הארץ'),('מרכז מוסדות'),('בנק'),('שפירא'),
  ('חבורת אברכים'),('פעילות'),('שבת חנוכה'),('שידור חי'),('שוטף'),
  ('משרד החינוך'),('תומכי עמותות'),('גרפיקה'),('גיוס כספים'),('כ"א כסלו'),
  ('שכירות'),('גנים בנים');

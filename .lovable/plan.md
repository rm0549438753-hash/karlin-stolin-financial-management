
## מטרה
כל יום ב-10:00 בבוקר (שעון ישראל) לשלוח מייל בעברית לשני נמענים עם רשימת הצ'קים שאמורים לצאת מהבנק למחרת (`value_date` של חשבון הצ'קים). אם אין צ'קים למחרת — לא נשלח כלום.

## שיטת שליחה — בלי דומיין
נשתמש ב-**Gmail Connector של Lovable**. תחבר בלחיצה את חשבון ה-Gmail שלך (`RM0549438753@gmail.com`) דרך OAuth, ו-Lovable תשלח את המיילים ישירות דרך Gmail API של החשבון הזה. אין צורך בדומיין, אין הגדרות DNS, ואין תשתית מיילים של Lovable.

- שולח: `RM0549438753@gmail.com`
- נמענים: `RM0549438753@gmail.com` + `5326725@gmail.com` (קבועים בקוד)
- מגבלת Gmail: ~500 מיילים ליום — יותר מדי מספיק ל-2 מיילים ביום.

## תבנית המייל (עברית / RTL)
- נושא: `צ'קים יוצאים מחר · {DD/MM/YYYY} · סה"כ {סכום}`
- גוף (HTML פשוט, RTL, מותאם ל-Gmail):
  - כותרת: **מרכז קארלין סטולין**
  - כותרת משנה: "צ'קים אמורים לצאת מחר בתאריך {DD/MM/YYYY}"
  - טבלה: שם / עמותה / סכום / הערה
  - שורת סיכום: "סה"כ: {סכום} · {N} צ'קים"
  - חתימה קצרה בסוף.

## מסלול ציבורי לטריגר מ-cron
קובץ חדש: `src/routes/api/public/hooks/daily-checks-email.ts`
- אימות ב-header `apikey` מול anon key (כמו `daily-backup.ts`).
- לוגיקה:
  1. חישוב "מחר" ב-Asia/Jerusalem.
  2. שליפת חשבון עם `schema_type='checks'` ואז כל התנועות עם `value_date = tomorrow` באותו חשבון.
  3. אין תוצאות → 200 עם `{ skipped: true }`, בלי שליחה.
  4. יש תוצאות → בונה HTML עברי RTL, מקודד ל-base64url, קורא ל-Gmail API דרך ה-gateway:
     ```
     POST https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send
     ```
     עם `Authorization: Bearer $LOVABLE_API_KEY` ו-`X-Connection-Api-Key: $GOOGLE_MAIL_API_KEY`.
  5. שליחה אחת עם `To:` שמכיל את שני הנמענים (מפריד פסיק) — מייל אחד, שני נמענים.
  6. תיעוד ההרצה בטבלה חדשה `check_email_runs` (סטטוס, כמות צ'קים, סכום, שגיאה, זמן).

## טבלה חדשה
```sql
create table public.check_email_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  for_date date not null,
  status text not null,           -- 'sent' | 'skipped' | 'failed'
  check_count int not null default 0,
  total_amount numeric not null default 0,
  error_message text,
  triggered_by text                -- 'cron' | 'manual'
);
-- GRANTs + RLS: קריאה ל-authenticated, כתיבה רק service_role.
```

## תזמון
`pg_cron` יומי בשם `daily-upcoming-checks-email`:
- `0 7 * * *` UTC = 10:00 שעון ישראל בקיץ (07:00 UTC + 3).
- הערה: בחורף זה יריץ ב-09:00 שעון ישראל. אם תעדיף בדיוק 10:00 גם בחורף — אעדכן ל-`0 8 * * *` אחרי אישורך; כרגע בחרתי בקיץ כי אנחנו בקיץ.
- קורא ל-URL היציב: `https://project--fc9530c9-4ee2-43bc-9557-a23bae98cfae.lovable.app/api/public/hooks/daily-checks-email` עם header `apikey`.

## פאנל בהגדרות
קובץ חדש: `src/components/UpcomingChecksEmailPanel.tsx`, נטמע ב-`src/routes/_authenticated/settings.tsx` ליד "גיבוי יומי":
- הצגת הנמענים (קבועים), השעה, וחשבון השולח.
- כפתור **"שלח עכשיו לבדיקה"** (רק אדמין) — קורא ל-hook עם `triggered_by=manual`.
- טבלת "ריצות אחרונות" מתוך `check_email_runs` עם סטטוס, תאריך, כמות, שגיאה.

## שלבי ביצוע (בבנייה)
1. `standard_connectors--connect` עם `connector_id=google_mail` — תבחר את חשבון `RM0549438753@gmail.com` ותאשר הרשאת `gmail.send`.
2. מיגרציה: יצירת `check_email_runs` + `pg_cron` job.
3. יצירת המסלול הציבורי `daily-checks-email.ts`.
4. יצירת פאנל ההגדרות + כפתור בדיקה ידני.
5. הרצת בדיקה ידנית לוודא שהמייל מגיע לשני הנמענים בעברית תקינה.

## קבצים שייווצרו/ישונו
- `src/routes/api/public/hooks/daily-checks-email.ts` (חדש)
- `src/components/UpcomingChecksEmailPanel.tsx` (חדש)
- `src/routes/_authenticated/settings.tsx` (הוספת פאנל)
- מיגרציית SQL: טבלה + cron job

## הערות
- הכתובות מקובעות בקוד. אם תרצה בעתיד לנהל אותן מהממשק — טבלת מנויים קטנה, נוסיף בהמשך.
- אם תבטל את חיבור Gmail בעתיד — ה-cron ימשיך לרוץ אבל השליחה תיכשל ותופיע ב-`check_email_runs` עם שגיאה.

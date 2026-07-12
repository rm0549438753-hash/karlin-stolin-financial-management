
## מטרה
כל יום ב-10:00 בבוקר (שעון ישראל) לשלוח מייל לשני נמענים עם רשימת הצ'קים שאמורים לצאת מהבנק למחרת (לפי `value_date` של חשבון הצ'קים). אם אין צ'קים למחרת — לא נשלח כלום.

## נמענים
- RM0549438753@gmail.com
- 5326725@gmail.com

## תשתית מיילים
1. וידוא שיש דומיין מייל מוגדר לפרויקט. אם אין — יוצג דיאלוג הגדרת דומיין; לאחר סיום ההגדרה נמשיך אוטומטית.
2. הרצת setup_email_infra (יוצר תור מיילים, טבלאות log/suppression, וכו').
3. scaffold_transactional_email — יוצר את המסלולים והתבניות. נשאיר את מסלולי ברירת המחדל ונוסיף תבנית משלנו.

## תבנית המייל
- קובץ חדש: `src/lib/email-templates/upcoming-checks.tsx`
- נושא: `צ'קים יוצאים מחר · {תאריך} · סה"כ {סכום}`
- תוכן: כותרת "מרכז קארלין סטולין", התאריך של מחר, טבלה עם עמודות: שם / עמותה / סכום / הערה, וסיכום סה"כ בתחתית. עיצוב תואם למותג (כחול/זהב, RTL).
- רישום ב-`src/lib/email-templates/registry.ts`.

## מסלול ציבורי לטריגר מ-cron
- קובץ חדש: `src/routes/api/public/hooks/daily-checks-email.ts`
- אימות ב-header `apikey` מול ה-anon key (בהתאם לתבנית של `daily-backup.ts`).
- לוגיקה:
  1. חישוב תאריך "מחר" ב-Asia/Jerusalem.
  2. שליפת חשבון עם `schema_type='checks'`, ואז שליפת כל התנועות עם `value_date = tomorrow` באותו חשבון.
  3. אם אין תוצאות — מחזיר 200 עם `{ skipped: true }`, לא שולח מייל.
  4. אחרת — קורא ל-`/lovable/email/transactional/send` פנימית (עם service role) פעם אחת לכל נמען, `templateName: 'upcoming-checks'`, `idempotencyKey: upcoming-checks-{YYYY-MM-DD}-{email}` כדי למנוע כפילויות.

## תזמון
- pg_cron שרץ כל יום ב-`0 7 * * *` UTC = 10:00 שעון ישראל (קיץ) / 09:00 (חורף). כדי לוודא 10:00 בקיץ נשתמש ב-`0 7 * * *`. (הערה: בחורף זה יריץ ב-09:00; אם מעדיף בדיוק 10:00 שנה-עגול נשתמש ב-`0 8 * * *` — אאשר איתך בביצוע אם צריך).
- ה-cron מריץ `net.http_post` ל-URL הציבורי היציב של הפרויקט עם `apikey` header.

## פאנל בהגדרות
- הוספת כרטיס קטן בעמוד ההגדרות (ליד "גיבוי יומי"): "מייל צ'קים יומי" עם:
  - הצגת הנמענים והשעה.
  - כפתור "שלח עכשיו לבדיקה" (רק לאדמין) שמפעיל את אותו hook.
  - סטטוס אחרון (הצלחה/כישלון + הודעת שגיאה) מתוך `email_send_log`.

## קבצים שייווצרו/ישונו
- `src/lib/email-templates/upcoming-checks.tsx` (חדש)
- `src/lib/email-templates/registry.ts` (עדכון)
- `src/routes/api/public/hooks/daily-checks-email.ts` (חדש)
- `src/components/UpcomingChecksEmailPanel.tsx` (חדש)
- `src/routes/_authenticated/settings.tsx` (הוספת הפאנל)
- מיגרציה: `pg_cron` job בשם `daily-upcoming-checks-email`

## הערות
- הכתובות מוגדרות קשיח בקוד ה-hook. אם תרצה בעתיד לנהל אותן מהממשק — נוכל להוסיף טבלה קטנה עם רשימת מנויים.
- אם דומיין המייל עוד לא מוגדר, נצטרך אותך להשלים את הגדרת ה-DNS לפני שהמיילים יתחילו לצאת בפועל. עד אז — ה-cron ירוץ אבל השליחה תיכשל ותופיע ב-log.

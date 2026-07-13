## תוכנית: יתרת תחילת שנה לקופות

### מה נבנה

**1. טבלה חדשה במסד: `fund_opening_balances`**
- `fund_id` (הפניה לקופה)
- `year` (מספר שלם, למשל 2026)
- `amount` (numeric — חיובי = יתרה זכות, שלילי = חוב)
- `note` (טקסט חופשי, אופציונלי)
- unique על (`fund_id`, `year`)
- RLS: כולם קוראים, admin+editor כותבים

**2. דוח חדש: "יתרת תחילת שנה - קופות"**
- מיקום: תת-טאב חדש בעמוד הדוחות (`/reports`)
- טבלה: כל הקופות הפעילות (חוץ מ"לא רלוונטי") + שדה סכום עריכה + הערה + כפתור שמירה
- מציג את היתרה הנוכחית לשנת 2026
- מנהל/עורך יכולים לערוך; צופה רק רואה

**3. שילוב בלוח הבקרה — טאב "קופות (הלוואות)"**
- **בכרטיס של כל קופה**: מוצג "יתרת תחילת שנה: X ₪", ו"יתרה נוכחית" = יתרת תחילת שנה + הכנסות − הוצאות (במקום נטו בלבד).
- **בסיכום הכולל בראש הטאב**: סך יתרות תחילת שנה מתווסף לסיכום הכללי.
- הגרף החודשי לא משתנה — הוא ממשיך להראות תזרים חודשי.

### פרטים טכניים

- הרשאות: policy עם `has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'editor')` על INSERT/UPDATE/DELETE; SELECT ל-authenticated.
- Grants: `SELECT, INSERT, UPDATE, DELETE ... TO authenticated` + `ALL TO service_role`.
- שאילתה בלוח הבקרה: fetch יחיד של כל היתרות לשנה הנבחרת → map לפי `fund_id` → מחיבור לכרטיסי הקופות הקיימים.
- שנת ההשוואה נלקחת מבורר השנה של הדשבורד (אם בעתיד יבחר 2027 — יראה יתרות 2027 אם הוזנו).

### קבצים

- מיגרציה חדשה: `fund_opening_balances` + policies + grants
- `src/routes/_authenticated/reports.tsx`: הוספת טאב "יתרת תחילת שנה"
- קומפוננטת דוח חדשה: `src/components/FundOpeningBalancesReport.tsx`
- `src/routes/_authenticated/dashboard.tsx`: קריאת היתרות ושילובן בטאב קופות (כרטיסים + סיכום)
- hook חדש קטן: `useFundOpeningBalances(year)` ב-`src/hooks/use-lookups.ts` או קובץ נפרד
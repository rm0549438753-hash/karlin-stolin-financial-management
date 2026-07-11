# תוכנית תיקונים

## 1. באג שורת כותרת בטבלת התנועות (צילום 1)
בקובץ `src/routes/_authenticated/transactions.tsx` — כרגע יש שורה ריקה מעל שורת ה-`TableHead` (ככל הנראה שורת סימון-הכל/פילטרים שנשארה תלויה) שגורמת לשורת הכותרת האמיתית לא להיות ראשונה, ולסינון להחליק שורה.
- להסיר את השורה הריקה/כפולה ב-`<TableHeader>` כך שהכותרת האמיתית (תאריך, יום ערך, תיאור וכו׳) היא ה-`<tr>` הראשון.
- לוודא שגם ה-sticky header עובד רק על שורה זו.
- לעשות את אותו תיקון בכל סכימות החשבון (mercantile, pagi, checks, cash) שנרנדרות מאותו רכיב.

## 2. גובה חלון "ייצוא ל-PDF" חורג מהמסך (צילום 2)
בקובץ `src/components/PrintDialog.tsx` — כרגע `DialogContent` ללא תקרה, ובמסך נמוך הכפתורים בתחתית נדחפים מתחת ל-viewport.
- להוסיף `max-h-[90vh]` + `overflow-y-auto` על גוף הדיאלוג.
- להפוך את `DialogFooter` ל-sticky בתחתית (רקע לבן + `border-t`) כך שכפתורי "ביטול / תצוגה מקדימה / הורדת PDF" תמיד נראים.
- להקטין padding פנימי במסכים קטנים.

## 3. מהירות טעינה של הדפים
כרגע `dashboard` ו-`reports` שולפים את כל התנועות עם עימוד 1000 בלולאה, ומחשבים הכל בצד לקוח על כל טעינה.
- להוסיף `staleTime` (למשל 60 שניות) ו-`gcTime` ארוך יותר ב-`useQuery` המרכזיים כך שמעבר בין דפים לא ישלוף מחדש.
- לצמצם את ה-`select` לעמודות שבאמת בשימוש בכל דף (dashboard לא צריך `note`, `channel`, `fee` — reports/transactions כן).
- ב-`GlobalSearch` — debounce של 250ms ו-`limit(30)` כדי שלא ירוץ על כל הקשה.
- לוודא ש-prefetch של דשבורד/דוחות רץ ברקע בזמן שהמשתמש בדף הבית (`router.preloadRoute`).
- הערה: השיפור העיקרי מגיע מ-`staleTime` — אחרי הטעינה הראשונה מעברים יהיו מיידיים.

## 4. הדפסת דוח צ׳קים עתידיים — סינון לפי חודש/יום/עמותה
ב-`src/routes/_authenticated/reports.tsx` (טאב future-checks) — כיום ה-`scopes` שנשלחים ל-`PrintDialog` הם רק "החודש הפתוח" + "כל הצ׳קים" + עמותות.
- כשפותחים דיאלוג הדפסה מתוך פירוט חודש: לפתוח אותו כשה-scope הפעיל הוא אותו חודש בלבד.
- להוסיף בתוך הדיאלוג בחירת יום ספציפי מתוך החודש הפתוח (checkbox-list של תאריכים קיימים באותו חודש). ברירת מחדל: כל הימים בחודש.
- אחרי בחירת יום/ימים — לאפשר סינון נוסף לפי עמותה (checkbox-list של העמותות שקיימות ביום/ים שנבחרו). זה יעודכן דינמית.
- זה ידרוש הרחבה קטנה ל-`PrintDialog`: תמיכה ב-scope עם sub-filters מדורגים (day → association), או פשוט לחשב ולעדכן את `scopes` בצד המזמין לפי הבחירות.

## 5. חיפוש גלובלי (לוח הבקרה) — לא עובד
`src/components/GlobalSearch.tsx` — התיקון האחרון (עטיפת ה-ILIKE במרכאות) מפעיל את החיפוש רק כשהוא נקרא. אצטרך:
- לבדוק שקומפוננטת `GlobalSearch` באמת מותקנת ב-Header של `AppShell` (ולא רק בדף התנועות). אם לא — להוסיף אותה שם כדי שתופיע בכל הממשק.
- לוודא שהחיפוש מחפש ב: `description`, `note`, `payee`, וגם ב-`reference` וב-`amount` (כמספר). כרגע reference/amount לא נכללים.
- בקליק על תוצאה — לנווט לדף התנועות עם `?highlight=<id>&account=<accountId>` (הלוגיקה כבר קיימת שם).
- להוסיף הצגה של שם החשבון ליד כל תוצאה.

## 6. לוח הבקרה לא מציג תנועות חדשות
לאחר הוספה/עריכה/ייבוא/סנכרון — ה-`queryKey` של הדשבורד לא תמיד מבוטל.
- לאחד את כל הכתיבות (`TransactionDialog`, `ImportDialog`, `BulkEditDialog`, סנכרון Sheets, מחיקה) לקרוא `queryClient.invalidateQueries({ queryKey: ["tx-dashboard-full"] })` וגם `["reports-all-tx"]` וגם `["tx-list"]`.
- להוסיף `refetchOnWindowFocus: true` בשאילתות הדשבורד — כך שחזרה לטאב תרענן.
- להוסיף Realtime subscription קל ל-`transactions` (INSERT/UPDATE/DELETE) שמפעיל `invalidateQueries` — כך שגם אם משתמש אחר הוסיף תנועה, הדשבורד יתעדכן.
- הפילטרים בדשבורד (טווח תאריכים) לא צריכים לחתוך תנועות ללא תאריך במסלולים שמראים "כל הנתונים כרגע" — לוודא שהשליפה ה-בסיסית מביאה את כל התנועות ורק החישוב מסנן.

## פרטים טכניים

**קבצים שיערכו:**
- `src/routes/_authenticated/transactions.tsx` (#1)
- `src/components/PrintDialog.tsx` (#2, #4)
- `src/routes/_authenticated/dashboard.tsx` (#3, #6)
- `src/routes/_authenticated/reports.tsx` (#3, #4, #6)
- `src/components/GlobalSearch.tsx` (#5)
- `src/components/AppShell.tsx` (#5 — הוספת GlobalSearch ל-header אם חסר)
- `src/components/TransactionDialog.tsx`, `ImportDialog.tsx`, `BulkEditDialog.tsx`, `src/lib/sheets-sync.functions.ts` — רק invalidations (#6)

**ללא שינויי DB.** אין הגירות.

## שאלה אחת קטנה
בסעיף 4 — כשאתה בוחר "יום בחודש", האם אתה רוצה שיודפסו רק צ׳קים של אותו יום ספציפי, או שלב מדורג: בחר קודם את היום ואז לסמן עמותות מתוך אותו יום? (ההצעה שלי היא השנייה — יום + סינון עמותה מתוכו, ברירת מחדל כל העמותות של אותו יום). אמשיך לפי זה אלא אם תגיד אחרת.

# סריקת תלויות npm יומית — ללא התראות מייל

## מה ייבנה

### 1. Server route (hook לcron)
`src/routes/api/public/hooks/daily-security-audit.ts`
- מקבל POST מ-pg_cron, מאומת עם `x-cron-secret` (אותה שיטה של הגיבוי היומי ומייל הצ׳קים).
- קורא את `package.json` (dependencies + devDependencies).
- שולח בקשה ל-API הציבורי של npm audit (`https://registry.npmjs.org/-/npm/v1/security/audits`) עם רשימת החבילות והגרסאות.
- סופר findings לפי חומרה (low / moderate / high / critical).
- שומר את התוצאה בטבלה `security_audit_runs`.
- **לא שולח מייל**.

### 2. טבלה חדשה
```text
security_audit_runs
- id, ran_at
- status: ok | vulnerabilities | failed
- low_count, moderate_count, high_count, critical_count
- report_json (jsonb — פירוט מלא של החבילות הפגיעות)
- error_message, triggered_by (cron | manual)
```
RLS: רק admin רואה/מוחק.

### 3. UI בהגדרות → טאב חדש "סריקת אבטחה"
`SecurityAuditPanel.tsx`:
- כפתור "הרץ סריקה עכשיו" (ידני).
- טבלת "ריצות אחרונות": תאריך, סטטוס, ספירת findings בכל חומרה, כפתור פרטים שמציג את הרשימה המפורטת (שם חבילה, גרסה נוכחית, גרסה מתוקנת, קישור למידע).
- כפתור מחיקה לכל ריצה.

### 4. cron יומי
כל יום ב-09:00 שעון ישראל (06:00 UTC):
```
SELECT cron.schedule('daily-security-audit', '0 6 * * *', ...)
```
עם `x-cron-secret` דרך ה-RPC הקיים `get_cron_hook_secret`.

## קבצים

**חדשים:**
- `supabase/migrations/*_security_audit.sql` — טבלה + GRANT + RLS
- `src/routes/api/public/hooks/daily-security-audit.ts` — cron hook
- `src/lib/security-audit.server.ts` — לוגיקת הסריקה
- `src/lib/security-audit.functions.ts` — server functions ל-UI (list / trigger / delete)
- `src/components/SecurityAuditPanel.tsx` — UI
- הוספת ה-cron ל-DB (insert אחרי המיגרציה)

**שינויים:**
- `src/routes/_authenticated/settings.tsx` — הוספת טאב "סריקת אבטחה"

## הערה על מגבלת ה-worker

`bun audit` המקומי לא יכול לרוץ ב-Cloudflare Workers (אין `child_process`). לכן משתמשים ישירות ב-API של npm audit — הוא בודק את אותם CVEs הידועים ומחזיר אותה רשימת פגיעויות.

import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "תנאי שימוש | מרכז קארלין סטאלין" },
      { name: "description", content: "תנאי השימוש במערכת הניהול הפיננסי של אגודת בית אולפנא." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "תנאי שימוש | מרכז קארלין סטאלין" },
      { property: "og:description", content: "תנאי השימוש במערכת הניהול הפיננסי של אגודת בית אולפנא." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="תנאי שימוש" updated="2 באוגוסט 2026">
      <LegalSection title="1. כללי">
        <p>
          המערכת מופעלת על ידי <strong>אגודת בית אולפנא (ע"ר 580002988)</strong> ומיועדת
          לשימוש פנימי של משתמשים מורשים מטעמה בלבד. השימוש במערכת מהווה הסכמה לתנאים אלה.
        </p>
      </LegalSection>

      <LegalSection title="2. גישה והרשאות">
        <ul>
          <li>חשבונות משתמש נוצרים על ידי מנהל המערכת בלבד; אין הרשמה עצמית.</li>
          <li>חל איסור מוחלט על שיתוף פרטי הגישה עם כל גורם אחר.</li>
          <li>כל משתמש אחראי לפעולות המבוצעות בחשבונו.</li>
          <li>מנהל המערכת רשאי לחסום או להסיר גישה בכל עת.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. תיעוד פעילות">
        <p>
          כל פעולה במערכת — הוספה, עריכה, מחיקה, ייבוא וייצוא — מתועדת ביומן פעילות
          הכולל את זהות המשתמש ומועד הפעולה. התיעוד משמש לצרכי בקרה ואבטחת מידע.
        </p>
      </LegalSection>

      <LegalSection title="4. קניין ושימוש בנתונים">
        <p>
          כלל הנתונים במערכת הם קניינה של האגודה. אין להעתיק, להפיץ, לפרסם או להעביר
          מידע מהמערכת לכל גורם חיצוני ללא אישור מפורש מהנהלת האגודה. ייצוא נתונים
          לאקסל או ל-PDF מותר לצרכי עבודה פנימיים בלבד.
        </p>
      </LegalSection>

      <LegalSection title="5. הגבלת אחריות">
        <p>
          המערכת היא כלי עזר ניהולי ואינה מהווה תחליף לספרי הנהלת חשבונות רשמיים,
          לדיווחים לרשויות או לייעוץ חשבונאי. האחריות לנכונות הנתונים המוזנים ולבדיקתם
          מוטלת על המשתמשים. האגודה אינה אחראית לנזק שייגרם מהסתמכות בלעדית על נתוני המערכת.
        </p>
      </LegalSection>

      <LegalSection title="6. זמינות ושינויים">
        <p>
          האגודה רשאית לעדכן, לשנות או להפסיק את פעילות המערכת או חלקים ממנה בכל עת.
          תנאים אלה עשויים להתעדכן; המשך השימוש לאחר עדכון מהווה הסכמה לנוסח המעודכן.
        </p>
      </LegalSection>

      <LegalSection title="7. דין וסמכות שיפוט">
        <p>
          על תנאים אלה יחולו דיני מדינת ישראל. סמכות השיפוט הבלעדית בכל מחלוקת
          תהיה נתונה לבתי המשפט המוסמכים בישראל.
        </p>
      </LegalSection>

      <p className="text-sm text-muted-foreground border-t pt-4">
        ראו גם את <Link to="/privacy" className="underline font-medium">מדיניות הפרטיות</Link>.
        מסמך זה מהווה נוסח בסיסי ואינו מהווה ייעוץ משפטי; מומלץ שיאושר על ידי יועץ משפטי מטעם האגודה.
      </p>
    </LegalPage>
  );
}

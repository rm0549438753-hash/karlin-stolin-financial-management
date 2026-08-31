import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { nis } from "./ui";
import { BLUE, BLUE_SOFT, GOLD, GOLD_DEEP, GOLD_SOFT, GREEN, INK, LINE, MUTED, PANEL, RED } from "../theme";

const panel: React.CSSProperties = {
  background: PANEL,
  border: `1px solid ${LINE}`,
  borderRadius: 18,
  boxShadow: "0 10px 30px rgba(34,48,63,0.05)",
};

const Card: React.FC<{ label: string; value: string; tone?: string; delay?: number; note?: string }> = ({
  label,
  value,
  tone = INK,
  delay = 0,
  note,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 170 } });
  return (
    <div
      style={{
        ...panel,
        flex: 1,
        borderTop: `4px solid ${GOLD}`,
        padding: "18px 22px",
        transform: `translateY(${interpolate(s, [0, 1], [22, 0])}px)`,
        opacity: s,
      }}
    >
      <div style={{ fontSize: 20, color: MUTED, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 40, fontWeight: 900, color: tone, marginTop: 4 }}>{value}</div>
      {note ? <div style={{ fontSize: 17, color: MUTED, marginTop: 4 }}>{note}</div> : null}
    </div>
  );
};

/* ---------------- Dashboard ---------------- */

export const DashboardBody: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bars = [62, 48, 80, 55, 92, 70, 88, 64, 76, 58, 84, 68];
  const months = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, height: "100%" }}>
      <div style={{ display: "flex", gap: 8 }}>
        {["מרכז קרלין סטולין", "בית הכנסת - גבעת זאב", "דו\"ח קופות"].map((t, i) => (
          <div
            key={t}
            style={{
              padding: "10px 22px",
              borderRadius: 999,
              fontSize: 19,
              fontWeight: i === 0 ? 900 : 400,
              color: i === 0 ? "#fff" : MUTED,
              background: i === 0 ? BLUE : PANEL,
              border: `1px solid ${LINE}`,
            }}
          >
            {t}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        <Card label="הכנסות החודש" value={nis(184500)} tone={GREEN} delay={4} note="+12% מהחודש הקודם" />
        <Card label="הוצאות החודש" value={nis(126300)} tone={RED} delay={9} note="לפי 8 קופות" />
        <Card label="יתרת מזומן" value={nis(58200)} delay={14} note="עדכני לרגע זה" />
        <Card label="צ'קים לפירעון" value={nis(42600)} tone={GOLD_DEEP} delay={19} note="30 הימים הקרובים" />
      </div>
      <div style={{ display: "flex", gap: 14, flex: 1 }}>
        <div style={{ ...panel, flex: 2.2, padding: 22, display: "flex", flexDirection: "column" }}>
          <div style={{ fontWeight: 900, fontSize: 23, marginBottom: 12 }}>תנועה חודשית · הכנסות מול הוצאות</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flex: 1 }}>
            {bars.map((b, i) => {
              const s = spring({ frame: frame - 16 - i * 2, fps, config: { damping: 16, stiffness: 150 } });
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", gap: 6 }}>
                  <div
                    style={{
                      height: `${b * s * 0.82}%`,
                      borderRadius: "8px 8px 4px 4px",
                      background: i % 2 ? `linear-gradient(180deg, ${GOLD}, ${GOLD_DEEP})` : `linear-gradient(180deg, ${BLUE_SOFT}, ${BLUE})`,
                    }}
                  />
                  <div style={{ fontSize: 14, color: MUTED, textAlign: "center" }}>{months[i]}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ ...panel, flex: 1, padding: 22, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <Donut frame={frame} />
          <div style={{ fontWeight: 900, fontSize: 21 }}>פילוח לפי קטגוריה</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {[
              ["תרומות", BLUE],
              ["תפעול", GOLD],
              ["גבייה", BLUE_SOFT],
              ["אחר", "#E6DFCE"],
            ].map(([t, c]) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 16, color: MUTED }}>
                <div style={{ width: 12, height: 12, borderRadius: 4, background: c as string }} />
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Donut: React.FC<{ frame: number }> = ({ frame }) => {
  const p = interpolate(frame, [16, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const a = 140 * p;
  const b = a + 110 * p;
  const c = b + 70 * p;
  return (
    <div
      style={{
        width: 190,
        height: 190,
        borderRadius: 999,
        background: `conic-gradient(${BLUE} 0deg ${a}deg, ${GOLD} ${a}deg ${b}deg, ${BLUE_SOFT} ${b}deg ${c}deg, #EFE8D8 ${c}deg 360deg)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: 118, height: 118, borderRadius: 999, background: PANEL, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 22 }}>
        100%
      </div>
    </div>
  );
};

/* ---------------- Transactions ---------------- */

const ROWS = [
  { d: "12/03", desc: "ספק חשמל — תשלום חודשי", ref: "10482", amt: -4820, tag: "תפעול" },
  { d: "12/03", desc: "תרומה — קרן ייעודית", ref: "10481", amt: 25000, tag: "תרומות" },
  { d: "11/03", desc: "רכישת ציוד משרדי", ref: "10479", amt: -1340, tag: "" },
  { d: "10/03", desc: "החזר הוצאות נסיעה", ref: "10474", amt: -760, tag: "תפעול" },
  { d: "09/03", desc: "הכנסות אירוע שנתי", ref: "10470", amt: 18450, tag: "" },
  { d: "08/03", desc: "שכר לימוד — גבייה", ref: "10465", amt: 9600, tag: "גבייה" },
  { d: "07/03", desc: "אחזקת מבנה", ref: "10461", amt: -3210, tag: "תפעול" },
  { d: "06/03", desc: "תרומה חודשית — הוראת קבע", ref: "10458", amt: 4500, tag: "תרומות" },
];

export const TransactionsBody: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bannerS = spring({ frame: frame - 20, fps, config: { damping: 15, stiffness: 160 } });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      <div style={{ display: "flex", gap: 10 }}>
        {["מתאריך", "עד תאריך", "סוג", "קופה", "קטגוריה", "תיאור", "סכום"].map((t) => (
          <div key={t} style={{ ...panel, flex: 1, padding: "10px 14px", fontSize: 17, color: MUTED, borderRadius: 12 }}>
            {t}
          </div>
        ))}
      </div>
      <div
        style={{
          background: "#FFF7E4",
          border: `2px dashed ${GOLD}`,
          borderRadius: 14,
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: bannerS,
          transform: `translateY(${interpolate(bannerS, [0, 1], [-12, 0])}px)`,
        }}
      >
        <div style={{ fontSize: 22 }}>⚠️</div>
        <div style={{ fontWeight: 900, fontSize: 22, color: GOLD_DEEP }}>2 תנועות ללא סיווג בחשבון זה</div>
        <div style={{ marginInlineStart: "auto", background: GOLD_DEEP, color: "#fff", borderRadius: 999, padding: "8px 20px", fontWeight: 700, fontSize: 19 }}>
          הצג וסווג
        </div>
      </div>
      <div style={{ ...panel, overflow: "hidden", flex: 1 }}>
        <div style={{ display: "flex", background: BLUE, color: "#fff", fontWeight: 900, fontSize: 19, padding: "12px 18px" }}>
          <div style={{ width: 90 }}>תאריך</div>
          <div style={{ width: 110 }}>אסמכתא</div>
          <div style={{ flex: 1 }}>תיאור</div>
          <div style={{ width: 160 }}>סיווג</div>
          <div style={{ width: 170, textAlign: "left" }}>סכום</div>
        </div>
        {ROWS.map((r, i) => {
          const s = spring({ frame: frame - 6 - i * 2, fps, config: { damping: 200 } });
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "13px 18px",
                fontSize: 20,
                borderBottom: `1px solid ${LINE}`,
                background: i % 2 ? "#FCFAF4" : PANEL,
                opacity: s,
              }}
            >
              <div style={{ width: 90, color: MUTED }}>{r.d}</div>
              <div style={{ width: 110, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{r.ref}</div>
              <div style={{ flex: 1, fontWeight: 700 }}>{r.desc}</div>
              <div style={{ width: 160 }}>
                {r.tag ? (
                  <span style={{ background: "rgba(43,74,111,0.10)", color: BLUE, borderRadius: 999, padding: "4px 14px", fontSize: 17, fontWeight: 700 }}>{r.tag}</span>
                ) : (
                  <span style={{ background: "#FFF2D2", color: GOLD_DEEP, borderRadius: 999, padding: "4px 14px", fontSize: 17, fontWeight: 900, border: `1px dashed ${GOLD}` }}>
                    לא מסווג
                  </span>
                )}
              </div>
              <div style={{ width: 170, textAlign: "left", fontWeight: 900, fontVariantNumeric: "tabular-nums", color: r.amt >= 0 ? GREEN : RED }}>
                {nis(Math.abs(r.amt))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ---------------- Import ---------------- */

export const ImportBody: React.FC = () => {
  const frame = useCurrentFrame();
  const pct = interpolate(frame, [18, 90], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const done = pct >= 100;
  return (
    <div style={{ display: "flex", gap: 18, height: "100%" }}>
      <div style={{ ...panel, flex: 1.3, padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ border: `3px dashed ${GOLD}`, borderRadius: 18, padding: "26px 22px", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 44 }}>📄</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 27 }}>תנועות_מרץ.xlsx</div>
            <div style={{ color: MUTED, fontSize: 20 }}>1,248 שורות · העמודות זוהו אוטומטית</div>
          </div>
        </div>
        <div>
          <div style={{ height: 18, borderRadius: 999, background: "#EFE8D8", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${BLUE}, ${GOLD})` }} />
          </div>
          <div style={{ marginTop: 10, fontWeight: 900, fontSize: 22, color: done ? GREEN : INK }}>
            {done ? "✓ הייבוא הושלם — 1,248 תנועות נוספו" : `מייבא… ${Math.round(pct)}%`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ background: BLUE, color: "#fff", borderRadius: 12, padding: "12px 26px", fontWeight: 900, fontSize: 21 }}>סיום</div>
          <div style={{ border: `2px solid ${RED}`, color: RED, borderRadius: 12, padding: "12px 26px", fontWeight: 900, fontSize: 21, opacity: done ? 1 : 0.35 }}>
            ביטול הייבוא האחרון
          </div>
        </div>
        <div style={{ color: MUTED, fontSize: 19, marginTop: "auto" }}>
          תאריכים, סכומים ומוטבים נקראים בדיוק כפי שהם בקובץ — בלי הסטות ובלי תיקונים ידניים.
        </div>
      </div>
      <div style={{ ...panel, flex: 1, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 23 }}>תצוגה מקדימה</div>
        {["ספק חשמל · 4,820 ₪", "תרומה ייעודית · 25,000 ₪", "ציוד משרדי · 1,340 ₪", "גבייה חודשית · 9,600 ₪", "אחזקת מבנה · 3,210 ₪"].map((t, i) => {
          const o = interpolate(frame, [20 + i * 8, 32 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 20, opacity: o, borderBottom: `1px solid ${LINE}`, paddingBottom: 10 }}>
              <span style={{ color: GREEN, fontWeight: 900 }}>✓</span>
              {t}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ---------------- Checks ---------------- */

export const ChecksBody: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mail = spring({ frame: frame - 46, fps, config: { damping: 14, stiffness: 150 } });
  const months = [
    { m: "מרץ", v: 42600 },
    { m: "אפריל", v: 31800 },
    { m: "מאי", v: 55400 },
    { m: "יוני", v: 27300 },
    { m: "יולי", v: 19200 },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      <div style={{ display: "flex", gap: 12 }}>
        {months.map((mo, i) => {
          const s = spring({ frame: frame - 6 - i * 4, fps, config: { damping: 16, stiffness: 160 } });
          return (
            <div
              key={mo.m}
              style={{
                ...panel,
                flex: 1,
                background: i === 1 ? BLUE : PANEL,
                color: i === 1 ? "#fff" : INK,
                padding: "18px 20px",
                transform: `translateY(${interpolate(s, [0, 1], [22, 0])}px)`,
                opacity: s,
              }}
            >
              <div style={{ fontSize: 20, opacity: 0.7, fontWeight: 700 }}>{mo.m}</div>
              <div style={{ fontSize: 32, fontWeight: 900, marginTop: 4 }}>{nis(mo.v)}</div>
            </div>
          );
        })}
      </div>
      <div style={{ ...panel, padding: 22, flex: 1 }}>
        <div style={{ fontWeight: 900, fontSize: 23, marginBottom: 12 }}>אפריל · לפי ימים</div>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            ["03/04", 8400],
            ["09/04", 12300],
            ["17/04", 4800],
            ["24/04", 6300],
          ].map(([d, v], i) => {
            const s = spring({ frame: frame - 22 - i * 5, fps, config: { damping: 18, stiffness: 160 } });
            return (
              <div key={d as string} style={{ flex: 1, border: `1px solid ${LINE}`, borderRadius: 14, padding: "14px 16px", opacity: s, background: "#FCFAF4" }}>
                <div style={{ color: MUTED, fontSize: 18 }}>{d}</div>
                <div style={{ fontWeight: 900, fontSize: 26 }}>{nis(v as number)}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          ...panel,
          border: `2px solid ${GOLD}`,
          padding: 22,
          transform: `translateY(${interpolate(mail, [0, 1], [34, 0])}px)`,
          opacity: mail,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 24, color: BLUE }}>✉️ תזכורת אוטומטית — יום לפני הפירעון</div>
        <div style={{ color: MUTED, fontSize: 20, marginTop: 6 }}>מחר לפירעון: 3 צ'קים בסך 18,400 ₪ · נשלח למנהל הכספים בכל בוקר</div>
      </div>
    </div>
  );
};

/* ---------------- Reports ---------------- */

export const ReportsBody: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const menu = spring({ frame: frame - 52, fps, config: { damping: 15, stiffness: 170 } });
  const lines = [78, 55, 88, 40, 66, 95, 72, 61, 84];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 900, fontSize: 27 }}>דוח הכנסות והוצאות · שנתי</div>
        <div style={{ background: BLUE, color: "#fff", borderRadius: 12, padding: "10px 24px", fontWeight: 900, fontSize: 21 }}>ייצוא ▾</div>
      </div>
      <div style={{ ...panel, padding: 22, flex: 1, display: "flex", alignItems: "flex-end", gap: 14 }}>
        {lines.map((h, i) => {
          const s = spring({ frame: frame - 8 - i * 3, fps, config: { damping: 200 } });
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, justifyContent: "flex-end", height: "100%" }}>
              <div style={{ height: `${h * s * 0.62}%`, background: `linear-gradient(180deg, ${GOLD_SOFT}, ${GOLD})`, borderRadius: 8 }} />
              <div style={{ height: `${(100 - h) * s * 0.45}%`, background: `linear-gradient(180deg, ${BLUE_SOFT}, ${BLUE})`, borderRadius: 8 }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        {[
          ["קופות · יתרת תחילת שנה", nis(312400)],
          ["מזומן · יתרה נוכחית", nis(58200)],
          ["תנועות לא מסווגות", "2"],
        ].map(([a, b]) => (
          <div key={a as string} style={{ ...panel, flex: 1, padding: "16px 20px" }}>
            <div style={{ color: MUTED, fontSize: 19 }}>{a}</div>
            <div style={{ fontWeight: 900, fontSize: 28 }}>{b}</div>
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          top: 54,
          insetInlineStart: 0,
          ...panel,
          boxShadow: "0 24px 60px rgba(34,48,63,0.18)",
          overflow: "hidden",
          width: 250,
          opacity: menu,
          transform: `translateY(${interpolate(menu, [0, 1], [-14, 0])}px)`,
        }}
      >
        {["ייצוא לאקסל", "ייצוא ל-PDF", "הדפסה"].map((t, i) => (
          <div key={t} style={{ padding: "14px 20px", fontSize: 21, fontWeight: 700, borderTop: i ? `1px solid ${LINE}` : "none" }}>
            {t}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------------- Settings ---------------- */

export const SettingsBody: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tabs = ["קופות", "קטגוריות", "סוגים", "משתמשים והרשאות", "גיבויים"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      <div style={{ display: "flex", gap: 8 }}>
        {tabs.map((t, i) => (
          <div
            key={t}
            style={{
              padding: "10px 22px",
              borderRadius: 999,
              fontSize: 19,
              fontWeight: i === 3 ? 900 : 400,
              color: i === 3 ? "#fff" : MUTED,
              background: i === 3 ? BLUE : PANEL,
              border: `1px solid ${LINE}`,
            }}
          >
            {t}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, flex: 1 }}>
        <div style={{ ...panel, flex: 1.4, padding: 22 }}>
          <div style={{ fontWeight: 900, fontSize: 23, marginBottom: 14 }}>משתמשים והרשאות</div>
          {[
            ["מנהל כספים", "מנהל · הרשאה מלאה", BLUE],
            ["הנהלת חשבונות", "מנהל · ייבוא ועריכה", BLUE],
            ["ועד מנהל", "צפייה בלבד · הדפסה וייצוא", GOLD_DEEP],
            ["רואה חשבון", "צפייה בלבד · דוחות", GOLD_DEEP],
          ].map(([n, r, c], i) => {
            const s = spring({ frame: frame - 8 - i * 5, fps, config: { damping: 200 } });
            return (
              <div key={n as string} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 4px", borderBottom: `1px solid ${LINE}`, opacity: s }}>
                <div style={{ width: 40, height: 40, borderRadius: 999, background: "rgba(43,74,111,0.10)" }} />
                <div style={{ fontWeight: 900, fontSize: 21 }}>{n}</div>
                <div style={{ marginInlineStart: "auto", color: c as string, fontWeight: 700, fontSize: 19 }}>{r}</div>
              </div>
            );
          })}
        </div>
        <div style={{ ...panel, flex: 1, padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 23 }}>אבטחה וגיבוי</div>
          {["אימות דו-שלבי פעיל", "גיבוי אוטומטי יומי", "יומן פעולות מלא", "הרשאות לפי תפקיד"].map((t, i) => {
            const s = spring({ frame: frame - 16 - i * 6, fps, config: { damping: 200 } });
            return (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 20, opacity: s }}>
                <div style={{ width: 46, height: 26, borderRadius: 999, background: GREEN, position: "relative" }}>
                  <div style={{ position: "absolute", top: 3, insetInlineStart: 23, width: 20, height: 20, borderRadius: 999, background: "#fff" }} />
                </div>
                {t}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

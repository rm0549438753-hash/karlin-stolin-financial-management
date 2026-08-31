import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { AppFrame, nis } from "./ui";
import { FONT, GOLD, GREEN, INK, NAVY, RED } from "../theme";

const soft = "rgba(18,32,50,0.55)";

const Card: React.FC<{ label: string; value: string; tone?: string; delay?: number }> = ({
  label,
  value,
  tone = INK,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 160 } });
  return (
    <div
      style={{
        flex: 1,
        background: "#fff",
        border: "1px solid rgba(18,32,50,0.10)",
        borderTop: `4px solid ${GOLD}`,
        borderRadius: 16,
        padding: "18px 20px",
        transform: `scale(${interpolate(s, [0, 1], [0.9, 1])})`,
        opacity: s,
        boxShadow: "0 8px 24px rgba(13,59,102,0.08)",
      }}
    >
      <div style={{ fontSize: 20, color: soft, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 900, color: tone, marginTop: 6 }}>{value}</div>
    </div>
  );
};

/** Dashboard: KPI cards + animated monthly bars + donut. */
export const DashboardMock: React.FC<{ width: number }> = ({ width }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bars = [62, 48, 80, 55, 92, 70, 88, 64];
  const scale = width / 1200;
  return (
    <AppFrame title="לוח בקרה" style={{ width, transform: `scale(1)` }}>
      <div style={{ padding: 26 * scale, background: "#FBFAF6" }}>
        <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
          <Card label="הכנסות החודש" value={nis(184500)} tone={GREEN} delay={6} />
          <Card label="הוצאות החודש" value={nis(126300)} tone={RED} delay={12} />
          <Card label="יתרת מזומן" value={nis(58200)} delay={18} />
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          <div
            style={{
              flex: 2,
              background: "#fff",
              borderRadius: 16,
              border: "1px solid rgba(18,32,50,0.10)",
              padding: 20,
              height: 260,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 14 }}>תנועה חודשית</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 170 }}>
              {bars.map((b, i) => {
                const s = spring({ frame: frame - 20 - i * 3, fps, config: { damping: 16, stiffness: 140 } });
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                    <div
                      style={{
                        height: `${b * s}%`,
                        borderRadius: "8px 8px 4px 4px",
                        background: i % 2 ? `linear-gradient(180deg, ${GOLD}, #B9932B)` : `linear-gradient(180deg, ${NAVY}, #0a2f52)`,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div
            style={{
              flex: 1,
              background: "#fff",
              borderRadius: 16,
              border: "1px solid rgba(18,32,50,0.10)",
              padding: 20,
              height: 260,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
            }}
          >
            <Donut frame={frame} />
            <div style={{ fontWeight: 700, fontSize: 20, color: soft }}>פילוח לפי קטגוריה</div>
          </div>
        </div>
      </div>
    </AppFrame>
  );
};

const Donut: React.FC<{ frame: number }> = ({ frame }) => {
  const p = interpolate(frame, [24, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const a = 140 * p;
  const b = a + 110 * p;
  const c = b + 110 * p;
  return (
    <div
      style={{
        width: 150,
        height: 150,
        borderRadius: 999,
        background: `conic-gradient(${NAVY} 0deg ${a}deg, ${GOLD} ${a}deg ${b}deg, #7FA6C7 ${b}deg ${c}deg, #E7E2D6 ${c}deg 360deg)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: 92, height: 92, borderRadius: 999, background: "#fff" }} />
    </div>
  );
};

const ROWS = [
  { d: "12/03", desc: "ספק חשמל — תשלום חודשי", amt: -4820, tag: "תפעול" },
  { d: "12/03", desc: "תרומה — קרן ייעודית", amt: 25000, tag: "תרומות" },
  { d: "11/03", desc: "רכישת ציוד משרדי", amt: -1340, tag: "" },
  { d: "10/03", desc: "החזר הוצאות נסיעה", amt: -760, tag: "תפעול" },
  { d: "09/03", desc: "הכנסות אירוע שנתי", amt: 18450, tag: "" },
  { d: "08/03", desc: "שכר לימוד — גבייה", amt: 9600, tag: "גבייה" },
];

/** Transactions table with the "unclassified" alert banner. */
export const TransactionsMock: React.FC<{ width: number; showBanner?: boolean }> = ({ width, showBanner = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bannerS = spring({ frame: frame - 26, fps, config: { damping: 14, stiffness: 150 } });
  return (
    <AppFrame title="תנועות · חשבון בנק 4821" style={{ width }}>
      <div style={{ background: "#FBFAF6", padding: 22 }}>
        {showBanner && (
          <div
            style={{
              background: "#FFF6E0",
              border: "2px dashed #E0B33C",
              borderRadius: 14,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
              opacity: bannerS,
              transform: `translateY(${interpolate(bannerS, [0, 1], [-14, 0])}px)`,
            }}
          >
            <div style={{ fontSize: 24 }}>⚠️</div>
            <div style={{ fontWeight: 900, fontSize: 24, color: "#8A6516" }}>2 תנועות ללא סיווג בחשבון זה</div>
            <div
              style={{
                marginInlineStart: "auto",
                background: "#8A6516",
                color: "#fff",
                borderRadius: 999,
                padding: "8px 18px",
                fontWeight: 700,
                fontSize: 20,
              }}
            >
              הצג וסווג
            </div>
          </div>
        )}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(18,32,50,0.10)", overflow: "hidden" }}>
          <div style={{ display: "flex", background: NAVY, color: "#fff", fontWeight: 900, fontSize: 20, padding: "12px 16px" }}>
            <div style={{ width: 90 }}>תאריך</div>
            <div style={{ flex: 1 }}>תיאור</div>
            <div style={{ width: 150 }}>סיווג</div>
            <div style={{ width: 160, textAlign: "left" }}>סכום</div>
          </div>
          {ROWS.map((r, i) => {
            const s = spring({ frame: frame - 8 - i * 3, fps, config: { damping: 200 } });
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "13px 16px",
                  fontSize: 21,
                  borderBottom: "1px solid rgba(18,32,50,0.08)",
                  background: i % 2 ? "#FCFBF7" : "#fff",
                  opacity: s,
                }}
              >
                <div style={{ width: 90, color: soft }}>{r.d}</div>
                <div style={{ flex: 1, fontWeight: 700 }}>{r.desc}</div>
                <div style={{ width: 150 }}>
                  {r.tag ? (
                    <span style={{ background: "#EEF3F8", color: NAVY, borderRadius: 999, padding: "4px 14px", fontSize: 18, fontWeight: 700 }}>
                      {r.tag}
                    </span>
                  ) : (
                    <span style={{ background: "#FFF0CE", color: "#8A6516", borderRadius: 999, padding: "4px 14px", fontSize: 18, fontWeight: 900, border: "1px dashed #E0B33C" }}>
                      לא מסווג
                    </span>
                  )}
                </div>
                <div
                  style={{
                    width: 160,
                    textAlign: "left",
                    fontWeight: 900,
                    fontVariantNumeric: "tabular-nums",
                    color: r.amt >= 0 ? GREEN : RED,
                  }}
                >
                  {nis(Math.abs(r.amt))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppFrame>
  );
};

/** Import panel: file drop → progress → undo button. */
export const ImportMock: React.FC<{ width: number }> = ({ width }) => {
  const frame = useCurrentFrame();
  const pct = interpolate(frame, [12, 55], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const done = pct >= 100;
  return (
    <AppFrame title="ייבוא קובץ" style={{ width }}>
      <div style={{ background: "#FBFAF6", padding: 30, display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            border: `3px dashed ${GOLD}`,
            borderRadius: 18,
            padding: "26px 22px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            background: "#fff",
          }}
        >
          <div style={{ fontSize: 40 }}>📄</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 26 }}>תנועות_מרץ.xlsx</div>
            <div style={{ color: soft, fontSize: 20 }}>1,248 שורות · זוהו העמודות אוטומטית</div>
          </div>
        </div>
        <div>
          <div style={{ height: 18, borderRadius: 999, background: "#E8E3D6", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${NAVY}, ${GOLD})` }} />
          </div>
          <div style={{ marginTop: 10, fontWeight: 700, fontSize: 22, color: done ? GREEN : INK }}>
            {done ? "✓ הייבוא הושלם — 1,248 תנועות נוספו" : `מייבא… ${Math.round(pct)}%`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ background: NAVY, color: "#fff", borderRadius: 12, padding: "12px 24px", fontWeight: 900, fontSize: 22 }}>
            סיום
          </div>
          <div
            style={{
              border: `2px solid ${RED}`,
              color: RED,
              borderRadius: 12,
              padding: "12px 24px",
              fontWeight: 900,
              fontSize: 22,
              opacity: done ? 1 : 0.35,
            }}
          >
            ביטול הייבוא האחרון
          </div>
        </div>
      </div>
    </AppFrame>
  );
};

/** Future checks + email reminder card. */
export const ChecksMock: React.FC<{ width: number }> = ({ width }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mail = spring({ frame: frame - 34, fps, config: { damping: 13, stiffness: 140 } });
  const months = [
    { m: "מרץ", v: 42600 },
    { m: "אפריל", v: 31800 },
    { m: "מאי", v: 55400 },
    { m: "יוני", v: 27300 },
  ];
  return (
    <AppFrame title="צ'קים עתידיים" style={{ width }}>
      <div style={{ background: "#FBFAF6", padding: 26, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 12 }}>
          {months.map((mo, i) => {
            const s = spring({ frame: frame - 8 - i * 4, fps, config: { damping: 16, stiffness: 150 } });
            return (
              <div
                key={mo.m}
                style={{
                  flex: 1,
                  background: i === 1 ? NAVY : "#fff",
                  color: i === 1 ? "#fff" : INK,
                  border: "1px solid rgba(18,32,50,0.10)",
                  borderRadius: 16,
                  padding: "16px 18px",
                  transform: `translateY(${interpolate(s, [0, 1], [24, 0])}px)`,
                  opacity: s,
                }}
              >
                <div style={{ fontSize: 20, opacity: 0.7, fontWeight: 700 }}>{mo.m}</div>
                <div style={{ fontSize: 30, fontWeight: 900, marginTop: 4 }}>{nis(mo.v)}</div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            background: "#fff",
            border: `2px solid ${GOLD}`,
            borderRadius: 16,
            padding: 20,
            transform: `translateY(${interpolate(mail, [0, 1], [40, 0])}px) scale(${interpolate(mail, [0, 1], [0.95, 1])})`,
            opacity: mail,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 24, color: NAVY }}>✉️ תזכורת אוטומטית — יום לפני הפירעון</div>
          <div style={{ color: soft, fontSize: 21, marginTop: 8 }}>
            מחר לפירעון: 3 צ'קים בסך 18,400 ₪ · נשלח למנהל הכספים בכל בוקר
          </div>
        </div>
      </div>
    </AppFrame>
  );
};

/** Reports mock with export menu. */
export const ReportsMock: React.FC<{ width: number }> = ({ width }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const menu = spring({ frame: frame - 30, fps, config: { damping: 15, stiffness: 160 } });
  const lines = [78, 55, 88, 40, 66, 95, 72];
  return (
    <AppFrame title="דוחות" style={{ width }}>
      <div style={{ background: "#FBFAF6", padding: 26, position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 900, fontSize: 26 }}>דוח הכנסות והוצאות · שנתי</div>
          <div style={{ background: NAVY, color: "#fff", borderRadius: 12, padding: "10px 22px", fontWeight: 900, fontSize: 22 }}>
            ייצוא ▾
          </div>
        </div>
        <div
          style={{
            background: "#fff",
            border: "1px solid rgba(18,32,50,0.10)",
            borderRadius: 16,
            padding: 20,
            height: 240,
            display: "flex",
            alignItems: "flex-end",
            gap: 16,
          }}
        >
          {lines.map((h, i) => {
            const s = spring({ frame: frame - 10 - i * 3, fps, config: { damping: 200 } });
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, justifyContent: "flex-end", height: "100%" }}>
                <div style={{ height: `${h * s * 0.7}%`, background: `linear-gradient(180deg, ${GOLD}, #C09B2C)`, borderRadius: 8 }} />
                <div style={{ height: `${(100 - h) * s * 0.5}%`, background: NAVY, borderRadius: 8 }} />
              </div>
            );
          })}
        </div>
        <div
          style={{
            position: "absolute",
            top: 74,
            insetInlineStart: 26,
            background: "#fff",
            borderRadius: 14,
            border: "1px solid rgba(18,32,50,0.12)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
            overflow: "hidden",
            width: 240,
            opacity: menu,
            transform: `translateY(${interpolate(menu, [0, 1], [-16, 0])}px)`,
            fontFamily: FONT,
          }}
        >
          {["ייצוא לאקסל", "ייצוא ל-PDF", "הדפסה"].map((t, i) => (
            <div key={t} style={{ padding: "14px 18px", fontSize: 22, fontWeight: 700, borderTop: i ? "1px solid rgba(18,32,50,0.08)" : "none" }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    </AppFrame>
  );
};

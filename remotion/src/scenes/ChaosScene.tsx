import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { Sub, Title, useVertical } from "../components/ui";
import { CREAM, FONT, GOLD, INK, NAVY } from "../theme";

const sheets = [
  { label: "בנק_ראשי.xlsx", x: 9, y: 18, rotate: -9, tone: "#E7F0F7" },
  { label: "צ'קים_עתידיים.xlsx", x: 58, y: 12, rotate: 7, tone: "#FFF0CE" },
  { label: "קופת_מזומן.xlsx", x: 16, y: 59, rotate: 8, tone: "#E7F3E8" },
  { label: "סיכום_חודשי.xlsx", x: 63, y: 57, rotate: -6, tone: "#F8E7E1" },
];

export const ChaosScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Background light />
      <AbsoluteFill style={{ background: `linear-gradient(135deg, ${CREAM}, #EEE6D7)` }} />
      <div style={{ position: "absolute", top: vertical ? 100 : 105, right: vertical ? 58 : 120, left: vertical ? 58 : 120, display: "flex", flexDirection: "column", alignItems: vertical ? "center" : "flex-start", textAlign: vertical ? "center" : "right" }}>
        <div style={{ color: NAVY, fontFamily: FONT, fontWeight: 900, fontSize: vertical ? 29 : 36, direction: "rtl", opacity: interpolate(frame, [0, 24], [0, 1], { extrapolateRight: "clamp" }) }}>המציאות המוכרת</div>
        <Title color={INK} size={vertical ? 58 : 75} delay={12} style={{ marginTop: 18, maxWidth: vertical ? 900 : 1050 }}>עשרות חשבונות, צ׳קים ומזומן — כל אחד בקובץ אחר?</Title>
      </div>
      {sheets.map((sheet, i) => {
        const s = spring({ frame: frame - 18 - i * 7, fps, config: { damping: 14, stiffness: 120 } });
        const wobble = Math.sin(frame / 12 + i) * (1.5 + i);
        return (
          <div key={sheet.label} style={{ position: "absolute", left: `${vertical ? 13 + (i % 2) * 49 : sheet.x}%`, top: `${vertical ? 29 + Math.floor(i / 2) * 29 : sheet.y}%`, width: vertical ? "74%" : 570, height: vertical ? 260 : 250, background: sheet.tone, border: "1px solid rgba(18,32,50,0.16)", borderRadius: 18, padding: 20, transform: `rotate(${sheet.rotate + wobble}deg) scale(${interpolate(s, [0, 1], [0.7, 1])})`, opacity: s, boxShadow: "0 22px 45px rgba(18,32,50,0.16)", fontFamily: FONT, direction: "rtl" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: NAVY, fontWeight: 900, fontSize: vertical ? 23 : 27 }}><span style={{ width: 16, height: 16, borderRadius: 4, background: "#59A86A" }} />{sheet.label}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginTop: 22 }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cell) => <div key={cell} style={{ height: 15, background: cell % 3 === 0 ? "rgba(13,59,102,0.20)" : "rgba(18,32,50,0.08)", borderRadius: 3 }} />)}
            </div>
          </div>
        );
      })}
      <div style={{ position: "absolute", bottom: vertical ? 75 : 60, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: interpolate(frame, [100, 145], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: vertical ? 33 : 42, color: GOLD, background: NAVY, borderRadius: 999, padding: "12px 30px", direction: "rtl" }}>צריך סדר, שליטה ושקט</div>
      </div>
    </AbsoluteFill>
  );
};

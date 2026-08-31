import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Background } from "../components/Background";
import { GoldRule, Sub, Title, useVertical } from "../components/ui";
import { FONT, GOLD } from "../theme";

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const vertical = useVertical();
  const flare = interpolate(frame, [0, 45, 120], [0, 1, 0.35], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Background />
      <div style={{ position: "absolute", top: vertical ? 220 : 170, right: vertical ? 70 : 150, width: vertical ? 130 : 190, height: vertical ? 130 : 190, borderRadius: 999, border: `2px solid rgba(212,175,55,${flare * 0.5})`, boxShadow: `0 0 100px rgba(212,175,55,${flare * 0.22})` }} />
      <div style={{ position: "absolute", bottom: vertical ? 230 : 140, left: vertical ? 70 : 150, width: vertical ? 8 : 12, height: vertical ? 220 : 320, borderRadius: 12, background: `linear-gradient(180deg, transparent, ${GOLD}, transparent)`, opacity: 0.65 }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: vertical ? "center" : "flex-start", justifyContent: "center", padding: vertical ? "0 70px" : "0 150px", textAlign: vertical ? "center" : "right" }}>
        <div style={{ fontFamily: FONT, color: GOLD, fontWeight: 900, fontSize: vertical ? 34 : 42, opacity: interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" }), direction: "rtl" }}>רוזנטל מערכות ניהול פיננסיים</div>
        <div style={{ marginTop: 30 }}><GoldRule width={vertical ? 190 : 280} delay={12} height={vertical ? 7 : 9} /></div>
        <Title size={vertical ? 76 : 106} delay={22} style={{ marginTop: vertical ? 38 : 44, maxWidth: vertical ? 900 : 1100 }}>ניהול פיננסי למוסדות — בשליטה מלאה</Title>
        <Sub size={vertical ? 32 : 42} delay={42} style={{ marginTop: vertical ? 36 : 38, maxWidth: vertical ? 820 : 850 }}>כל התנועות, הדוחות והבקרה — במקום אחד</Sub>
      </div>
      <div style={{ position: "absolute", bottom: vertical ? 90 : 64, left: vertical ? 70 : 150, fontFamily: FONT, color: "rgba(255,255,255,0.45)", fontSize: vertical ? 21 : 25, direction: "rtl" }}>פתרון ניהול חכם לעמותות ולארגונים</div>
    </AbsoluteFill>
  );
};

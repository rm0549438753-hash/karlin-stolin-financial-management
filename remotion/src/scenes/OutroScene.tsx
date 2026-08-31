import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Background } from "../components/Background";
import { GoldRule, Sub, Title, useVertical } from "../components/ui";
import { FONT, GOLD } from "../theme";

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const vertical = useVertical();
  const ring = interpolate(frame, [0, 40], [0.2, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Background />
      <div style={{ position: "absolute", top: vertical ? 170 : 135, right: vertical ? 100 : 230, width: vertical ? 120 : 170, height: vertical ? 120 : 170, borderRadius: 999, border: `2px solid rgba(212,175,55,${ring * 0.7})`, boxShadow: `0 0 100px rgba(212,175,55,${ring * 0.2})` }} />
      <div style={{ position: "absolute", bottom: vertical ? 190 : 115, left: vertical ? 80 : 210, width: vertical ? 170 : 270, height: 7, borderRadius: 7, background: GOLD, opacity: ring }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: vertical ? "0 55px" : "0 140px", direction: "rtl" }}>
        <div style={{ fontFamily: FONT, color: GOLD, fontWeight: 900, fontSize: vertical ? 31 : 40, opacity: interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" }) }}>רוזנטל מערכות ניהול פיננסיים</div>
        <div style={{ marginTop: 28 }}><GoldRule width={vertical ? 180 : 260} delay={13} height={vertical ? 7 : 9} /></div>
        <Title size={vertical ? 63 : 86} delay={25} style={{ marginTop: 38 }}>מנהלים נכון.<br /><span style={{ color: GOLD }}>מתקדמים בביטחון.</span></Title>
        <Sub size={vertical ? 30 : 38} delay={43} style={{ marginTop: 38 }}>זמין גם כאפליקציה לאנדרואיד</Sub>
        <div style={{ marginTop: vertical ? 76 : 58, color: "#fff", fontFamily: FONT, fontWeight: 900, fontSize: vertical ? 32 : 42, opacity: interpolate(frame, [58, 85], [0, 1], { extrapolateRight: "clamp" }) }}>054-943-8753</div>
        <div style={{ marginTop: 12, color: "rgba(255,255,255,0.62)", fontFamily: FONT, fontSize: vertical ? 23 : 29, opacity: interpolate(frame, [66, 92], [0, 1], { extrapolateRight: "clamp" }) }}>מערכות ניהול פיננסי לעמותות ולארגונים</div>
      </div>
    </AbsoluteFill>
  );
};

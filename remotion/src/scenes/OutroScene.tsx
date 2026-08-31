import React from "react";
import { AbsoluteFill, Img, staticFile, interpolate, useCurrentFrame } from "remotion";
import { GoldRule, Sub, Title, useVertical } from "../components/ui";
import { BLUE, FONT, GOLD, PAPER, PAPER_2, bgGradient } from "../theme";

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const vertical = useVertical();
  const reveal = interpolate(frame, [0, 28], [0, 1], { extrapolateRight: "clamp" });
  const contact = interpolate(frame, [48, 72], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: bgGradient, alignItems: "center", justifyContent: "center", padding: vertical ? 80 : 110 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", direction: "rtl", opacity: reveal, transform: `translateY(${(1 - reveal) * 22}px)` }}>
        <div style={{ width: vertical ? 220 : 250, height: vertical ? 140 : 155, background: PAPER, border: `1px solid ${GOLD}`, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 20px 50px rgba(34,48,63,0.10)" }}>
          <Img src={staticFile("brand-logo.svg")} style={{ width: "88%", height: "88%", objectFit: "contain" }} />
        </div>
        <div style={{ marginTop: 28 }}><GoldRule width={vertical ? 180 : 260} delay={10} height={vertical ? 7 : 9} /></div>
        <Title size={vertical ? 66 : 84} color={BLUE} delay={16} style={{ marginTop: 28, textAlign: "center" }}>מנהלים נכון.<br /><span style={{ color: GOLD }}>מתקדמים בביטחון.</span></Title>
        <Sub size={vertical ? 34 : 39} color={BLUE} delay={30} style={{ marginTop: 24 }}>רוזנטל מערכות ניהול פיננסיים</Sub>
        <div style={{ marginTop: vertical ? 55 : 40, color: BLUE, fontFamily: FONT, fontWeight: 900, fontSize: vertical ? 32 : 40, opacity: contact }}>054-943-8753</div>
        <div style={{ marginTop: 8, color: "rgba(34,48,63,0.56)", fontFamily: FONT, fontSize: vertical ? 22 : 27, opacity: contact }}>מערכות ניהול פיננסי לעמותות ולארגונים</div>
      </div>
    </AbsoluteFill>
  );
};

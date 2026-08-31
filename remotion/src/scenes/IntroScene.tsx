import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate } from "remotion";
import { GoldRule, Sub, Title, useVertical } from "../components/ui";
import { BLUE, GOLD, PAPER, bgGradient } from "../theme";

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const vertical = useVertical();
  const reveal = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: bgGradient, alignItems: "center", justifyContent: "center", padding: vertical ? 90 : 120 }}>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 22, opacity: reveal, transform: `translateY(${interpolate(reveal, [0, 1], [24, 0])}px)` }}>
        <div style={{ width: vertical ? 230 : 290, height: vertical ? 230 : 290, borderRadius: 44, background: PAPER, border: `2px solid ${GOLD}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 20px 60px rgba(34,48,63,0.12)" }}>
          <Img src={staticFile("brand-logo.svg")} style={{ width: "86%", height: "86%", objectFit: "contain" }} />
        </div>
        <Title size={vertical ? 76 : 94} color={BLUE} delay={8} style={{ textAlign: "center" }}>רוזנטל מערכות ניהול פיננסיים</Title>
        <GoldRule width={vertical ? 190 : 280} delay={16} />
        <Sub size={vertical ? 38 : 42} color={BLUE} delay={20} style={{ textAlign: "center" }}>שליטה. סדר. שקט נפשי.</Sub>
      </div>
    </AbsoluteFill>
  );
};

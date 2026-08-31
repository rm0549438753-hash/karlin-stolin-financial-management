import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Background } from "../components/Background";
import { DashboardMock } from "../components/Mockups";
import { Sub, Title, useVertical } from "../components/ui";
import { GOLD, NAVY } from "../theme";

export const SolutionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const vertical = useVertical();
  const reveal = interpolate(frame, [0, 28], [80, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Background />
      <div style={{ position: "absolute", top: vertical ? 110 : 105, left: vertical ? 60 : 150, right: vertical ? 60 : undefined, width: vertical ? "auto" : 670, zIndex: 2, textAlign: vertical ? "center" : "right" }}>
        <Title size={vertical ? 65 : 86} delay={12}>מערכת אחת.<br />תמונה אחת.<br /><span style={{ color: GOLD }}>אמת אחת.</span></Title>
        <Sub size={vertical ? 30 : 38} delay={30} style={{ marginTop: 30 }}>ניהול ברור, נגיש ומדויק לכל הארגון</Sub>
      </div>
      <div style={{ position: "absolute", top: vertical ? 700 : 260, left: vertical ? 40 : 720, right: vertical ? 40 : undefined, transform: `translateX(${reveal}px) scale(${vertical ? 0.72 : 0.73})`, transformOrigin: vertical ? "top center" : "top right", opacity: interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" }) }}>
        <DashboardMock width={1200} />
      </div>
      <div style={{ position: "absolute", bottom: vertical ? 100 : 70, right: vertical ? 0 : 150, left: vertical ? 0 : undefined, display: "flex", justifyContent: vertical ? "center" : "flex-start", alignItems: "center", gap: 14, fontFamily: "Heebo", color: "rgba(255,255,255,0.65)", fontSize: vertical ? 23 : 28, direction: "rtl" }}>
        <span style={{ width: 12, height: 12, borderRadius: 999, background: GOLD }} />
        <span>הנתונים החשובים — תמיד מול העיניים</span>
      </div>
    </AbsoluteFill>
  );
};

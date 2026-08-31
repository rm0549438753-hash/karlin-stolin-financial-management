import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { Sub, Title, useVertical } from "../components/ui";
import { GOLD, GREEN, NAVY } from "../theme";

const trustItems = [
  ["⌁", "הרשאות לפי תפקיד", "כל משתמש רואה ופועל לפי הצורך"],
  ["◈", "אימות דו-שלבי", "שכבת הגנה נוספת לחשבון"],
  ["↗", "גיבוי יומי", "השקט לדעת שהמידע נשמר"],
  ["≡", "יומן פעולות", "שקיפות ובקרה לאורך זמן"],
];

export const TrustScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Background />
      <div style={{ position: "absolute", top: vertical ? 150 : 130, left: vertical ? 45 : 150, right: vertical ? 45 : 150, textAlign: vertical ? "center" : "right", direction: "rtl" }}>
        <Title size={vertical ? 64 : 88} delay={12}>הנתונים שלכם —<br /><span style={{ color: GOLD }}>מוגנים ומגובים.</span></Title>
        <Sub size={vertical ? 29 : 38} delay={30} style={{ marginTop: 28 }}>בקרה פיננסית טובה מתחילה באמון</Sub>
      </div>
      <div style={{ position: "absolute", top: vertical ? 680 : 425, left: vertical ? 40 : 150, right: vertical ? 40 : 150, display: "grid", gridTemplateColumns: vertical ? "1fr 1fr" : "repeat(4, 1fr)", gap: vertical ? 14 : 18, direction: "rtl" }}>
        {trustItems.map(([icon, title, desc], i) => {
          const s = spring({ frame: frame - 45 - i * 8, fps, config: { damping: 16, stiffness: 140 } });
          return (
            <div key={title} style={{ borderTop: `4px solid ${i === 0 ? GOLD : "rgba(212,175,55,0.45)"}`, borderRadius: 18, background: "rgba(255,255,255,0.09)", padding: vertical ? "18px 15px" : "25px 18px", opacity: s, transform: `translateY(${interpolate(s, [0, 1], [35, 0])}px)`, textAlign: "right" }}>
              <div style={{ width: vertical ? 45 : 56, height: vertical ? 45 : 56, display: "flex", alignItems: "center", justifyContent: "center", background: i === 0 ? GOLD : "rgba(255,255,255,0.12)", color: i === 0 ? NAVY : GOLD, borderRadius: 14, fontSize: vertical ? 25 : 32, fontWeight: 900, fontFamily: "sans-serif" }}>{icon}</div>
              <div style={{ fontFamily: "Heebo", color: "#fff", fontWeight: 900, fontSize: vertical ? 22 : 27, marginTop: 18, direction: "rtl" }}>{title}</div>
              <div style={{ fontFamily: "Heebo", color: "rgba(255,255,255,0.58)", fontSize: vertical ? 18 : 22, lineHeight: 1.3, marginTop: 8, direction: "rtl" }}>{desc}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", bottom: vertical ? 82 : 62, right: vertical ? 45 : 150, color: "rgba(255,255,255,0.5)", fontFamily: "Heebo", fontSize: vertical ? 19 : 24, direction: "rtl" }}>שליטה. שקיפות. שקט.</div>
    </AbsoluteFill>
  );
};

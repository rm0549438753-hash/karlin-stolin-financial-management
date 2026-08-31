import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { Background } from "../components/Background";
import { ChecksMock, ImportMock, ReportsMock, TransactionsMock } from "../components/Mockups";
import { Sub, Title, useVertical } from "../components/ui";
import { GOLD, NAVY } from "../theme";

const features = [
  { title: "ייבוא אקסל מהיר ובטוח", sub: "העלאה, זיהוי עמודות וביטול הייבוא האחרון", comp: ImportMock },
  { title: "סיווג חכם — בלי לפספס", sub: "התראה ממוקדת על כל תנועה שדורשת טיפול", comp: TransactionsMock },
  { title: "דוחות שמספרים את התמונה", sub: "תרשימים אינטראקטיביים וייצוא לאקסל או PDF", comp: ReportsMock },
  { title: "צ׳קים עתידיים — בזמן", sub: "מעקב לפי חודש, יום ותנועה עם תזכורת אוטומטית", comp: ChecksMock },
];

export const FeaturesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const vertical = useVertical();
  const { fps } = useVideoConfig();
  const beat = Math.min(3, Math.floor(frame / 195));
  const progress = interpolate(frame - beat * 195, [0, 28], [0, 1], { extrapolateRight: "clamp" });
  const feature = features[beat];
  const Comp = feature.comp;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Background />
      <div style={{ position: "absolute", top: vertical ? 92 : 80, left: vertical ? 45 : 120, right: vertical ? 45 : 120, display: "flex", justifyContent: "space-between", alignItems: "flex-start", direction: "rtl" }}>
        <div>
          <div style={{ color: GOLD, fontFamily: "Heebo", fontSize: vertical ? 24 : 28, fontWeight: 900, opacity: progress }}>הכלים שעושים את ההבדל</div>
          <Title size={vertical ? 53 : 66} delay={8} style={{ marginTop: 9 }}>{feature.title}</Title>
          <Sub size={vertical ? 27 : 34} delay={18} style={{ marginTop: 15, maxWidth: vertical ? 760 : 700 }}>{feature.sub}</Sub>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
          {features.map((_, i) => <div key={i} style={{ width: vertical ? 34 : 50, height: 8, borderRadius: 8, background: i === beat ? GOLD : "rgba(255,255,255,0.25)", transform: `scaleX(${i === beat ? interpolate(progress, [0, 1], [0.3, 1]) : 1})` }} />)}
        </div>
      </div>
      <div style={{ position: "absolute", top: vertical ? 560 : 290, left: vertical ? 20 : 360, right: vertical ? 20 : undefined, transform: `scale(${vertical ? 0.68 : 0.72})`, transformOrigin: vertical ? "top center" : "top right", opacity: progress }}>
        <Comp width={1200} showBanner={beat === 1} />
      </div>
      <div style={{ position: "absolute", bottom: vertical ? 80 : 60, left: vertical ? 45 : 120, right: vertical ? 45 : 120, display: "flex", justifyContent: "space-between", direction: "rtl", color: "rgba(255,255,255,0.5)", fontFamily: "Heebo", fontSize: vertical ? 19 : 24 }}>
        <span>רוזנטל מערכות ניהול פיננסיים</span><span>0{beat + 1} / 04</span>
      </div>
    </AbsoluteFill>
  );
};

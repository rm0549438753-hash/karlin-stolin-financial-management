import React from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { fade } from "@remotion/transitions/fade";
import { LoginScene } from "./scenes/LoginScene";
import { DashboardScene } from "./scenes/DashboardScene";
import { TransactionsScene } from "./scenes/TransactionsScene";
import { ImportScene } from "./scenes/ImportScene";
import { ChecksScene } from "./scenes/ChecksScene";
import { ReportsScene } from "./scenes/ReportsScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { OutroScene } from "./scenes/OutroScene";
import { TextCard } from "./scenes/TextCard";
import { PAPER } from "./theme";

const TRANSITION = 20;
const timing = springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION });
const SCREEN = 190;
const CARD = 90;

/** Exactly 60 seconds at 30fps: eight full-screen moments and six short title cards. */
export const SCENE_FRAMES = [SCREEN, CARD, SCREEN, CARD, SCREEN, CARD, SCREEN, CARD, SCREEN, CARD, SCREEN, CARD, SCREEN, SCREEN];
export const TOTAL_FRAMES = SCENE_FRAMES.reduce((a, b) => a + b, 0) - TRANSITION * (SCENE_FRAMES.length - 1);

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Audio src={staticFile("audio/promo-music.mp3")} volume={0.48} />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCREEN}><LoginScene /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={CARD}><TextCard kicker="לוח אחד" title="רואים את התמונה המלאה" sub="בקרה ברורה על הכנסות, הוצאות, קופות וצ'קים — בזמן אמת." /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-left" })} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCREEN}><DashboardScene /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={CARD}><TextCard kicker="כל תנועה במקום" title="פחות חיפוש. יותר שליטה." sub="סינון, חיפוש לפי מוטב וסכום, וסיווג מהיר לכל חשבון." /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-left" })} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCREEN}><TransactionsScene /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={CARD}><TextCard kicker="ייבוא חכם" title="מאקסל למערכת — בלי כאב ראש" sub="מייבאים קובץ, מזהים עמודות, ושומרים על הנתונים בדיוק כפי שהם." /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-left" })} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCREEN}><ImportScene /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={CARD}><TextCard kicker="תכנון קדימה" title="צ'קים עתידיים לא מפתיעים" sub="חודש, יום ותנועה — עם תזכורת אוטומטית לפני הפירעון." /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-left" })} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCREEN}><ChecksScene /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={CARD}><TextCard kicker="דוחות חכמים" title="מהנתונים לתובנות" sub="תרשימים, יתרות, דוחות וייצוא לאקסל או PDF — בכמה לחיצות." /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-left" })} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCREEN}><ReportsScene /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={CARD}><TextCard kicker="שליטה וביטחון" title="המערכת שעובדת בשבילכם" sub="הרשאות לפי תפקיד, גיבוי יומי ויומן פעולות — הכול במקום אחד." /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-left" })} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCREEN}><SettingsScene /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCREEN}><OutroScene /></TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

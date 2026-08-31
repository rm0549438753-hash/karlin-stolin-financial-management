import React from "react";
import { AbsoluteFill, Img, staticFile, interpolate, useCurrentFrame } from "remotion";
import { Cursor, Stage } from "../components/Screen";
import { FONT, BLUE, GOLD, GOLD_SOFT, INK, PANEL, PAPER, PAPER_2 } from "../theme";

export const LoginScene: React.FC = () => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Stage zoomFrom={1} zoomTo={1.06} focus={[800, 430]}>
        <div style={{ width: 1600, height: 900, background: `linear-gradient(135deg, ${PAPER} 0%, ${PAPER_2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", direction: "rtl", fontFamily: FONT }}>
          <div style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: 650, background: `linear-gradient(150deg, ${BLUE}, #426486)`, clipPath: "polygon(0 0, 100% 0, 78% 100%, 0 100%)" }} />
          <div style={{ position: "absolute", insetInlineStart: 105, top: 170, color: "#fff", width: 410, zIndex: 1, opacity: reveal }}>
            <div style={{ fontWeight: 900, fontSize: 46, lineHeight: 1.15 }}>סדר פיננסי<br />שמתחיל כאן.</div>
            <div style={{ width: 130, height: 6, background: GOLD, borderRadius: 4, marginTop: 22 }} />
            <div style={{ fontSize: 23, marginTop: 20, opacity: 0.82 }}>כל הנתונים של הארגון<br />במקום אחד, ברור ונגיש.</div>
          </div>
          <div style={{ width: 540, background: PANEL, borderRadius: 22, padding: "34px 42px", boxShadow: "0 26px 70px rgba(34,48,63,0.16)", zIndex: 2, opacity: reveal, transform: `translateY(${(1 - reveal) * 24}px)` }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}><Img src={staticFile("brand-logo.svg")} style={{ width: 210, height: 116, objectFit: "contain" }} /></div>
            <div style={{ textAlign: "center", color: BLUE, fontWeight: 900, fontSize: 29 }}>ממשק ניהול פיננסי</div>
            <div style={{ textAlign: "center", color: INK, fontSize: 21, marginTop: 6 }}>כניסה למערכת</div>
            <div style={{ height: 50, border: `1px solid ${GOLD_SOFT}`, borderRadius: 10, marginTop: 24, padding: "0 16px", display: "flex", alignItems: "center", color: "rgba(34,48,63,0.42)", fontSize: 18 }}>כתובת דוא״ל</div>
            <div style={{ height: 50, border: `1px solid ${GOLD_SOFT}`, borderRadius: 10, marginTop: 12, padding: "0 16px", display: "flex", alignItems: "center", color: "rgba(34,48,63,0.42)", fontSize: 18 }}>סיסמה</div>
            <div style={{ height: 52, borderRadius: 10, marginTop: 20, background: BLUE, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 21 }}>כניסה למערכת</div>
          </div>
        </div>
        <Cursor path={[{ f: 42, x: 1020, y: 510 }, { f: 72, x: 1060, y: 595 }, { f: 108, x: 1040, y: 680, click: true }]} />
      </Stage>
    </AbsoluteFill>
  );
};

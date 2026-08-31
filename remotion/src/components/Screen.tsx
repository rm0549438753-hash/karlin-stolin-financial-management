import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { BLUE, DH, DW, FONT, GOLD, GOLD_SOFT, INK, LINE, MUTED, PANEL, PAPER, bgGradient } from "../theme";

/** Scales the 1600x900 design canvas to fill the frame, with a slow zoom push. */
export const Stage: React.FC<{
  children: React.ReactNode;
  zoomFrom?: number;
  zoomTo?: number;
  focus?: [number, number];
  dur?: number;
}> = ({ children, zoomFrom = 1.02, zoomTo = 1.12, focus = [DW / 2, DH / 2], dur = 150 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  // Portrait uses the full phone height; the viewport becomes a deliberate close-up of the active interface.
  const base = vertical ? height / DH : width / DW;
  const z = interpolate(frame, [0, dur], [zoomFrom, zoomTo], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ background: bgGradient, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: DW, height: DH, transform: `scale(${base})`, position: "relative" }}>
        <div
          style={{
            width: DW,
            height: DH,
            transform: `scale(${z})`,
            transformOrigin: `${focus[0]}px ${focus[1]}px`,
            position: "relative",
          }}
        >
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};

type Pt = { f: number; x: number; y: number; click?: boolean };

/** A gentle simulated mouse pointer travelling through keyframes (design coords). */
export const Cursor: React.FC<{ path: Pt[] }> = ({ path }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frames = path.map((p) => p.f);
  const ease = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const, easing: (t: number) => t * t * (3 - 2 * t) };
  const x = interpolate(frame, frames, path.map((p) => p.x), ease);
  const y = interpolate(frame, frames, path.map((p) => p.y), ease);
  const appear = spring({ frame: frame - Math.max(0, frames[0] - 8), fps, config: { damping: 200 } });

  return (
    <>
      {path
        .filter((p) => p.click)
        .map((p, i) => {
          const t = frame - p.f;
          if (t < 0 || t > 26) return null;
          const r = interpolate(t, [0, 26], [10, 58]);
          const o = interpolate(t, [0, 26], [0.4, 0]);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: p.x - r,
                top: p.y - r,
                width: r * 2,
                height: r * 2,
                borderRadius: 999,
                border: `3px solid ${GOLD}`,
                opacity: o,
              }}
            />
          );
        })}
      <div style={{ position: "absolute", left: x, top: y, opacity: appear, filter: "drop-shadow(0 6px 10px rgba(34,48,63,0.35))" }}>
        <svg width="34" height="46" viewBox="0 0 24 32">
          <path d="M2 1 L2 25 L8 19.5 L12 29 L16 27 L12.4 17.8 L20 17.5 Z" fill="#fff" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
    </>
  );
};

const NAV = [
  { t: "לוח בקרה", i: "▤" },
  { t: "תנועות", i: "⇅" },
  { t: "ייבוא נתונים", i: "⭳" },
  { t: "צ'קים עתידיים", i: "🗓" },
  { t: "דוחות", i: "▦" },
  { t: "הגדרות", i: "⚙" },
];

/** Full-bleed app chrome: gold-accented header + right sidebar (RTL). */
export const AppShell: React.FC<{ active: string; title: string; children: React.ReactNode }> = ({
  active,
  title,
  children,
}) => {
  return (
    <div
      style={{
        width: DW,
        height: DH,
        display: "flex",
        flexDirection: "row-reverse",
        direction: "rtl",
        fontFamily: FONT,
        color: INK,
        background: PAPER,
      }}
    >
      <div
        style={{
          width: 250,
          background: PANEL,
          borderInlineStart: `1px solid ${LINE}`,
          padding: "22px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 8px 20px" }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: `linear-gradient(140deg, ${GOLD}, ${GOLD_SOFT})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 900,
              fontSize: 22,
            }}
          >
            ₪
          </div>
          <div style={{ fontWeight: 900, fontSize: 20, lineHeight: 1.1 }}>
            ממשק ניהול
            <div style={{ fontSize: 15, fontWeight: 400, color: MUTED }}>פיננסי</div>
          </div>
        </div>
        {NAV.map((n) => {
          const on = n.t === active;
          return (
            <div
              key={n.t}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 12,
                fontSize: 20,
                fontWeight: on ? 900 : 400,
                color: on ? BLUE : MUTED,
                background: on ? "rgba(201,168,76,0.16)" : "transparent",
                borderInlineEnd: on ? `4px solid ${GOLD}` : "4px solid transparent",
              }}
            >
              <span style={{ fontSize: 18 }}>{n.i}</span>
              {n.t}
            </div>
          );
        })}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div
          style={{
            height: 78,
            background: PANEL,
            borderBottom: `1px solid ${LINE}`,
            display: "flex",
            alignItems: "center",
            padding: "0 30px",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 900 }}>{title}</div>
          <div style={{ width: 60, height: 5, borderRadius: 5, background: GOLD }} />
          <div
            style={{
              marginInlineStart: "auto",
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: MUTED,
              fontSize: 18,
            }}
          >
            <div style={{ padding: "8px 16px", borderRadius: 999, border: `1px solid ${LINE}` }}>מרץ 2026</div>
            <div style={{ width: 38, height: 38, borderRadius: 999, background: "rgba(43,74,111,0.12)" }} />
          </div>
        </div>
        <div style={{ flex: 1, padding: 26, overflow: "hidden" }}>{children}</div>
      </div>
    </div>
  );
};

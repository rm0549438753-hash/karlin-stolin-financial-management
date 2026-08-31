import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { FONT, GOLD, INK, NAVY } from "../theme";

export const useVertical = () => {
  const { width, height } = useVideoConfig();
  return height > width;
};

/** Standard entrance: rise + fade, spring-driven. */
export function useRise(delay: number, distance = 60) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return {
    opacity: interpolate(s, [0, 1], [0, 1]),
    transform: `translateY(${interpolate(s, [0, 1], [distance, 0])}px)`,
  };
}

export function useOut(startFrame: number, len = 12) {
  const frame = useCurrentFrame();
  return interpolate(frame, [startFrame, startFrame + len], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export const GoldRule: React.FC<{ width?: number; delay?: number; height?: number }> = ({
  width = 220,
  delay = 0,
  height = 8,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return (
    <div
      style={{
        width: width * s,
        height,
        borderRadius: height,
        background: `linear-gradient(90deg, ${GOLD}, #F2DE9B)`,
      }}
    />
  );
};

export const Title: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  delay?: number;
  style?: React.CSSProperties;
}> = ({ children, size = 96, color = "#fff", delay = 0, style }) => {
  const rise = useRise(delay, 40);
  return (
    <div
      style={{
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1.1,
        color,
        letterSpacing: "-0.02em",
        direction: "rtl",
        ...rise,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Sub: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  delay?: number;
  style?: React.CSSProperties;
}> = ({ children, size = 40, color = "rgba(255,255,255,0.72)", delay = 0, style }) => {
  const rise = useRise(delay, 26);
  return (
    <div
      style={{
        fontFamily: FONT,
        fontWeight: 400,
        fontSize: size,
        lineHeight: 1.35,
        color,
        direction: "rtl",
        ...rise,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** A window chrome wrapper that makes mockups read as an app screen. */
export const AppFrame: React.FC<{
  children: React.ReactNode;
  title: string;
  style?: React.CSSProperties;
}> = ({ children, title, style }) => {
  return (
    <div
      style={{
        borderRadius: 26,
        overflow: "hidden",
        background: "#fff",
        boxShadow: "0 50px 120px rgba(0,0,0,0.45)",
        border: `2px solid rgba(212,175,55,0.55)`,
        direction: "rtl",
        fontFamily: FONT,
        color: INK,
        ...style,
      }}
    >
      <div
        style={{
          background: NAVY,
          padding: "18px 26px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          borderBottom: `4px solid ${GOLD}`,
        }}
      >
        <div style={{ width: 34, height: 34, borderRadius: 999, background: "#fff", border: `2px solid ${GOLD}` }} />
        <div style={{ color: GOLD, fontWeight: 900, fontSize: 26 }}>{title}</div>
        <div style={{ marginInlineStart: "auto", display: "flex", gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: 999, background: "rgba(255,255,255,0.35)" }} />
          ))}
        </div>
      </div>
      {children}
    </div>
  );
};

export const nis = (n: number) => `${n.toLocaleString("he-IL")} ₪`;

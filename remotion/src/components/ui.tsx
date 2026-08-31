import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { FONT, GOLD, INK, MUTED } from "../theme";

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
        background: `linear-gradient(90deg, ${GOLD}, #F0DFAE)`,
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
}> = ({ children, size = 96, color = INK, delay = 0, style }) => {
  const rise = useRise(delay, 34);
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
}> = ({ children, size = 40, color = MUTED, delay = 0, style }) => {
  const rise = useRise(delay, 22);
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

export const nis = (n: number) => `${n.toLocaleString("he-IL")} ₪`;

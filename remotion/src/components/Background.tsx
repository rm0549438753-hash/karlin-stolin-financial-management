import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { GOLD, bgGradient } from "../theme";

/** Persistent layer: slow drifting gold motes + subtle vignette over the navy field. */
export const Background: React.FC<{ light?: boolean }> = ({ light }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const motes = new Array(18).fill(0).map((_, i) => {
    const seed = (i * 9301 + 49297) % 233280;
    const rx = seed / 233280;
    const ry = ((i * 7919) % 1000) / 1000;
    const drift = Math.sin((frame / (60 + i * 4)) * Math.PI * 2 + i) * 40;
    const rise = interpolate(frame, [0, durationInFrames], [0, -120 - i * 6]);
    return {
      key: i,
      left: rx * width,
      top: ry * height + rise,
      size: 4 + (i % 5) * 3,
      x: drift,
      opacity: 0.08 + ((i % 4) * 0.05),
    };
  });

  return (
    <AbsoluteFill style={{ background: light ? "transparent" : bgGradient }}>
      {motes.map((m) => (
        <div
          key={m.key}
          style={{
            position: "absolute",
            left: m.left,
            top: m.top,
            width: m.size,
            height: m.size,
            borderRadius: 999,
            background: GOLD,
            opacity: light ? m.opacity * 0.5 : m.opacity,
            transform: `translateX(${m.x}px)`,
            filter: "blur(0.5px)",
          }}
        />
      ))}
      <AbsoluteFill
        style={{
          background: "radial-gradient(75% 65% at 50% 45%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.35) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

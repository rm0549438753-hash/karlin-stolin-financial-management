import React from "react";
import { AbsoluteFill } from "remotion";
import { GoldRule, Sub, Title, useVertical } from "../components/ui";
import { BLUE, GOLD, bgGradient } from "../theme";

export const TextCard: React.FC<{ kicker?: string; title: string; sub?: string }> = ({ kicker, title, sub }) => {
  const vertical = useVertical();
  return (
    <AbsoluteFill
      style={{
        background: bgGradient,
        alignItems: "center",
        justifyContent: "center",
        padding: vertical ? 90 : 140,
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        {kicker ? <Sub size={vertical ? 34 : 32} color={GOLD} delay={0} style={{ fontWeight: 900, letterSpacing: "0.14em" }}>{kicker}</Sub> : null}
        <Title size={vertical ? 78 : 92} delay={4} color={BLUE} style={{ textAlign: "center" }}>
          {title}
        </Title>
        <GoldRule width={vertical ? 200 : 260} delay={10} />
        {sub ? (
          <Sub size={vertical ? 38 : 40} delay={14} style={{ maxWidth: vertical ? 880 : 1200, textAlign: "center" }}>
            {sub}
          </Sub>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

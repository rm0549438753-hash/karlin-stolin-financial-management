import React from "react";
import { AbsoluteFill } from "remotion";
import { AppShell, Cursor, Stage } from "../components/Screen";
import { ChecksBody } from "../components/Mockups";

export const ChecksScene: React.FC = () => (
  <AbsoluteFill>
    <Stage zoomFrom={1.01} zoomTo={1.08} focus={[870, 430]}>
      <AppShell active="צ'קים עתידיים" title="צ'קים עתידיים">
        <ChecksBody />
      </AppShell>
      <Cursor path={[{ f: 18, x: 1120, y: 180 }, { f: 65, x: 960, y: 330 }, { f: 112, x: 1060, y: 430, click: true }, { f: 174, x: 700, y: 610 }]} />
    </Stage>
  </AbsoluteFill>
);

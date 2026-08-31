import React from "react";
import { AbsoluteFill } from "remotion";
import { AppShell, Cursor, Stage } from "../components/Screen";
import { ReportsBody } from "../components/Mockups";

export const ReportsScene: React.FC = () => (
  <AbsoluteFill>
    <Stage zoomFrom={1.02} zoomTo={1.1} focus={[920, 420]}>
      <AppShell active="דוחות" title="דוחות">
        <ReportsBody />
      </AppShell>
      <Cursor path={[{ f: 18, x: 1110, y: 180 }, { f: 70, x: 1215, y: 240 }, { f: 116, x: 1290, y: 240, click: true }, { f: 178, x: 1170, y: 335 }]} />
    </Stage>
  </AbsoluteFill>
);

import React from "react";
import { AbsoluteFill } from "remotion";
import { AppShell, Cursor, Stage } from "../components/Screen";
import { SettingsBody } from "../components/Mockups";

export const SettingsScene: React.FC = () => (
  <AbsoluteFill>
    <Stage zoomFrom={1.01} zoomTo={1.08} focus={[900, 430]}>
      <AppShell active="הגדרות" title="הגדרות מערכת">
        <SettingsBody />
      </AppShell>
      <Cursor path={[{ f: 18, x: 1110, y: 180 }, { f: 62, x: 1370, y: 610 }, { f: 112, x: 1160, y: 520, click: true }, { f: 185, x: 700, y: 510 }]} />
    </Stage>
  </AbsoluteFill>
);

import React from "react";
import { AbsoluteFill } from "remotion";
import { AppShell, Cursor, Stage } from "../components/Screen";
import { ImportBody } from "../components/Mockups";

export const ImportScene: React.FC = () => (
  <AbsoluteFill>
    <Stage zoomFrom={1.01} zoomTo={1.08} focus={[850, 445]}>
      <AppShell active="ייבוא נתונים" title="ייבוא נתונים">
        <ImportBody />
      </AppShell>
      <Cursor path={[{ f: 22, x: 1170, y: 180 }, { f: 62, x: 970, y: 350 }, { f: 105, x: 730, y: 380, click: true }, { f: 175, x: 980, y: 590 }]} />
    </Stage>
  </AbsoluteFill>
);

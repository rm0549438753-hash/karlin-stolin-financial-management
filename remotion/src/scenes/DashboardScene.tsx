import React from "react";
import { AbsoluteFill } from "remotion";
import { AppShell, Cursor, Stage } from "../components/Screen";
import { DashboardBody } from "../components/Mockups";

export const DashboardScene: React.FC = () => (
  <AbsoluteFill>
    <Stage zoomFrom={1.01} zoomTo={1.07} focus={[1010, 410]}>
      <AppShell active="לוח בקרה" title="לוח בקרה">
        <DashboardBody />
      </AppShell>
      <Cursor path={[{ f: 25, x: 1020, y: 180 }, { f: 75, x: 920, y: 315 }, { f: 140, x: 1210, y: 430, click: true }, { f: 205, x: 1320, y: 650 }]} />
    </Stage>
  </AbsoluteFill>
);

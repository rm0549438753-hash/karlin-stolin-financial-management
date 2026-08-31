import React from "react";
import { AbsoluteFill } from "remotion";
import { AppShell, Cursor, Stage } from "../components/Screen";
import { TransactionsBody } from "../components/Mockups";

export const TransactionsScene: React.FC = () => (
  <AbsoluteFill>
    <Stage zoomFrom={1.02} zoomTo={1.1} focus={[920, 470]}>
      <AppShell active="תנועות" title="תנועות · חשבון בנק 4821">
        <TransactionsBody />
      </AppShell>
      <Cursor path={[{ f: 22, x: 1150, y: 180 }, { f: 70, x: 1100, y: 260 }, { f: 128, x: 900, y: 478, click: true }, { f: 190, x: 650, y: 610 }]} />
    </Stage>
  </AbsoluteFill>
);

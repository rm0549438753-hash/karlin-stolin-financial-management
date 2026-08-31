import React from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { fade } from "@remotion/transitions/fade";
import { IntroScene } from "./scenes/IntroScene";
import { ChaosScene } from "./scenes/ChaosScene";
import { SolutionScene } from "./scenes/SolutionScene";
import { FeaturesScene } from "./scenes/FeaturesScene";
import { TrustScene } from "./scenes/TrustScene";
import { OutroScene } from "./scenes/OutroScene";
import { NAVY_DEEP } from "./theme";

const T = 20;
const timing = springTiming({ config: { damping: 200 }, durationInFrames: T });

/** Scene lengths in frames @30fps: 6s, 10s, 10s, 26s, 10s, 8s. */
export const SCENE_FRAMES = [180, 300, 300, 780, 300, 240];
export const TOTAL_FRAMES = SCENE_FRAMES.reduce((a, b) => a + b, 0) - T * 5;

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: NAVY_DEEP }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES[0]}>
          <IntroScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-left" })} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES[1]}>
          <ChaosScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-left" })} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES[2]}>
          <SolutionScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-left" })} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES[3]}>
          <FeaturesScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES[4]}>
          <TrustScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-left" })} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES[5]}>
          <OutroScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

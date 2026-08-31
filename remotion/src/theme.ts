import { loadFont } from "@remotion/google-fonts/Heebo";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700", "900"],
  subsets: ["hebrew", "latin"],
});

export const FONT = fontFamily;

/** Light palette: white + soft gold. */
export const PAPER = "#FDFBF6";
export const PAPER_2 = "#F5EFE2";
export const PANEL = "#FFFFFF";
export const GOLD = "#C9A84C";
export const GOLD_SOFT = "#E7D3A0";
export const GOLD_DEEP = "#A9862F";
export const BLUE = "#2B4A6F";
export const BLUE_SOFT = "#5C7FA6";
export const INK = "#22303F";
export const MUTED = "rgba(34,48,63,0.55)";
export const LINE = "rgba(34,48,63,0.10)";
export const GREEN = "#2E9E6B";
export const RED = "#C4553F";

export const bgGradient = `radial-gradient(120% 100% at 75% 0%, #FFFFFF 0%, ${PAPER} 45%, ${PAPER_2} 100%)`;
export const creamGradient = bgGradient;

/** Design canvas for every app screen; scaled to the video frame. */
export const DW = 1600;
export const DH = 900;

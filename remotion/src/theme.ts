import { loadFont } from "@remotion/google-fonts/Heebo";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700", "900"],
  subsets: ["hebrew", "latin"],
});

export const FONT = fontFamily;

export const NAVY = "#0d3b66";
export const NAVY_DEEP = "#082a4c";
export const NAVY_SOFT = "#144a7a";
export const GOLD = "#D4AF37";
export const GOLD_SOFT = "#E9CC72";
export const CREAM = "#F6F1E4";
export const INK = "#122032";
export const GREEN = "#2E9E6B";
export const RED = "#C6503C";

export const bgGradient = `radial-gradient(120% 90% at 80% 0%, ${NAVY_SOFT} 0%, ${NAVY} 45%, ${NAVY_DEEP} 100%)`;
export const creamGradient = `radial-gradient(110% 90% at 20% 0%, #FFFDF7 0%, ${CREAM} 60%, #EBE2CD 100%)`;

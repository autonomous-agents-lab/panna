import { Noto_Serif, Noto_Serif_Devanagari } from "next/font/google";

// next/font downloads these at build time and serves them from our own origin, so the browser
// never requests a font host. The CSS variables feed the font tokens in src/theme/tokens.ts.
// Kept out of src/theme so unit tests never import next/font.
const latin = Noto_Serif({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-face-latin",
});

const devanagari = Noto_Serif_Devanagari({
  subsets: ["devanagari"],
  display: "swap",
  variable: "--font-face-devanagari",
});

/** Class names that define `--font-face-latin` and `--font-face-devanagari`; set on `<html>`. */
export const fontVariables = `${latin.variable} ${devanagari.variable}`;

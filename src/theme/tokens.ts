/**
 * The design tokens: the only file in `src/` where colour literals may be written.
 * Everything else reads these values, either as `theme` in TypeScript or as the CSS custom
 * properties the root layout renders on `:root` (see `css-variables.ts`).
 *
 * Text/background pairs are held to WCAG AA by `contrast.test.ts`. The palette is a clean
 * default; the UI polish epic may replace it.
 */
export const theme = {
  color: {
    paper: "#F5EBDC",
    paperAged: "#EBDCC2",
    paperShade: "#E0CFAF",
    ink: "#2B2118",
    inkMuted: "#5C4B3A",
    accent: "#8C3B1F",
    onAccent: "#FBF5EC",
    focus: "#1F5FA8",
    error: "#A3261B",
  },
  space: {
    0: "0",
    1: "0.25rem",
    2: "0.5rem",
    3: "0.75rem",
    4: "1rem",
    6: "1.5rem",
    8: "2rem",
    12: "3rem",
    16: "4rem",
  },
  radius: {
    sm: "0.25rem",
    md: "0.5rem",
    lg: "1rem",
    full: "9999px",
  },
  // Stacks only; web fonts are loaded by the reader epic. Every stack carries a
  // Devanagari-capable fallback so Hindi text renders in a Devanagari face today.
  font: {
    serif:
      '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Noto Serif Devanagari", "Kohinoor Devanagari", Mangal, serif',
    sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Devanagari", "Kohinoor Devanagari", "Nirmala UI", sans-serif',
    devanagari: '"Noto Serif Devanagari", "Kohinoor Devanagari", Mangal, "Nirmala UI", serif',
    mono: 'ui-monospace, "SF Mono", Menlo, Consolas, "Noto Sans Devanagari", monospace',
  },
  focus: {
    ringWidth: "3px",
    ringOffset: "2px",
  },
} as const;

export type Theme = typeof theme;

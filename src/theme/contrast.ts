export type Rgb = { r: number; g: number; b: number };

// Opaque colours only: a contrast ratio is not defined for a translucent colour on its own.
const OPAQUE_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function hexToRgb(hex: string): Rgb {
  if (!OPAQUE_HEX.test(hex)) {
    throw new Error(`Expected a 3- or 6-digit hex colour, got "${hex}"`);
  }
  const digits =
    hex.length === 4 ? [...hex.slice(1)].map((digit) => digit + digit).join("") : hex.slice(1);
  const value = Number.parseInt(digits, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function linearChannel(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance, from 0 (black) to 1 (white). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b);
}

/** WCAG 2.x contrast ratio between two hex colours, from 1 to 21. Order does not matter. */
export function contrastRatio(a: string, b: string): number {
  const [darker, lighter] = [relativeLuminance(hexToRgb(a)), relativeLuminance(hexToRgb(b))].sort(
    (x, y) => x - y,
  ) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

/** The form browsers report computed colours in, so e2e tests can compare against tokens. */
export function toCssRgb(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

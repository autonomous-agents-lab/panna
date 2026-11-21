import { describe, expect, it } from "vitest";

import { contrastRatio, theme } from "@/theme";

const { color } = theme;
const papers = { paper: color.paper, paperAged: color.paperAged, paperShade: color.paperShade };

describe("default token pairs meet WCAG AA", () => {
  it.each([
    ["ink", "paper", color.ink, color.paper],
    ["ink", "paperAged", color.ink, color.paperAged],
    ["ink", "paperShade", color.ink, color.paperShade],
    ["inkMuted", "paper", color.inkMuted, color.paper],
    ["inkMuted", "paperAged", color.inkMuted, color.paperAged],
    ["inkMuted", "paperShade", color.inkMuted, color.paperShade],
    ["onAccent", "accent", color.onAccent, color.accent],
    ["error", "paper", color.error, color.paper],
  ])("%s text on %s is at least 4.5:1", (_, __, text, background) => {
    expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(4.5);
  });

  // WCAG 1.4.11: non-text UI such as the focus ring needs 3:1 against what it sits on.
  it.each(Object.entries(papers))("focus ring on %s is at least 3:1", (_, background) => {
    expect(contrastRatio(color.focus, background)).toBeGreaterThanOrEqual(3);
  });
});

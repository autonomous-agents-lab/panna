import { expect, test, type Page } from "@playwright/test";

import { theme, toCssRgb } from "../src/theme";

const WHITE = "rgb(255, 255, 255)";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("the page uses the paper and ink tokens, set on :root, without hydration errors", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("/");

  const styles = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const root = getComputedStyle(document.documentElement);
    return {
      background: body.backgroundColor,
      color: body.color,
      paperVariable: root.getPropertyValue("--color-paper").trim(),
      serifVariable: root.getPropertyValue("--font-serif").trim(),
    };
  });

  expect(styles.background).toBe(toCssRgb(theme.color.paper));
  expect(styles.background).not.toBe(WHITE);
  expect(styles.color).toBe(toCssRgb(theme.color.ink));
  expect(styles.paperVariable.toLowerCase()).toBe(theme.color.paper.toLowerCase());
  expect(styles.serifVariable).toBe(theme.font.serif);
  expect(errors).toEqual([]);
});

test("keyboard focus is drawn with the focus token", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const button = document.createElement("button");
    button.id = "focus-probe";
    button.textContent = "Focus probe";
    document.body.prepend(button);
  });

  await page.keyboard.press("Tab");
  const probe = page.locator("#focus-probe");
  await expect(probe).toBeFocused();

  const outline = await probe.evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.outlineColor, style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(outline).toEqual({
    color: toCssRgb(theme.color.focus),
    style: "solid",
    width: theme.focus.ringWidth,
  });
});

async function probeMotion(page: Page) {
  await page.goto("/");
  return page.evaluate(() => {
    const style = document.createElement("style");
    style.textContent = "@keyframes probe-fade { from { opacity: 0 } to { opacity: 1 } }";
    document.head.append(style);
    const element = document.createElement("div");
    element.style.transition = "opacity 1s";
    element.style.animation = "probe-fade 2s infinite";
    document.body.append(element);
    const computed = getComputedStyle(element);
    return {
      transition: computed.transitionDuration,
      animation: computed.animationDuration,
      iterations: computed.animationIterationCount,
    };
  });
}

test("reduced motion disables transitions and animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const motion = await probeMotion(page);

  expect(Number.parseFloat(motion.transition)).toBeLessThan(0.001);
  expect(Number.parseFloat(motion.animation)).toBeLessThan(0.001);
  expect(motion.iterations).toBe("1");
});

test("without a reduced-motion preference, motion is left alone", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const motion = await probeMotion(page);

  expect(motion).toEqual({ transition: "1s", animation: "2s", iterations: "infinite" });
});

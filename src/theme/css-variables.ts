import type { Theme } from "./tokens";

export type TokenTree = { readonly [key: string]: string | TokenTree };
export type CssVariableName = `--${string}`;

type Paths<T> = {
  [K in keyof T & (string | number)]: T[K] extends string ? `${K}` : `${K}.${Paths<T[K]>}`;
}[keyof T & (string | number)];

/** Every leaf token as a dotted path, e.g. `"color.paperAged"` or `"space.4"`. */
export type TokenPath = Paths<Theme>;

function toKebabCase(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** `"color.paperAged"` → `"--color-paper-aged"`. */
export function toCssVariableName(path: string): CssVariableName {
  return `--${path.split(".").map(toKebabCase).join("-")}`;
}

/** Flattens a token tree into one custom property per leaf. */
export function toCssVariables(tree: TokenTree): Record<CssVariableName, string> {
  const variables: Record<CssVariableName, string> = {};
  const walk = (node: TokenTree, path: string[]) => {
    for (const [key, value] of Object.entries(node)) {
      const next = [...path, key];
      if (typeof value === "string") variables[toCssVariableName(next.join("."))] = value;
      else walk(value, next);
    }
  };
  walk(tree, []);
  return variables;
}

/**
 * The `:root` rule the root layout inlines in `<head>`. It is injected as raw HTML, so a value
 * containing `<` (which could close the `<style>` element) is rejected.
 */
export function renderRootCss(tree: TokenTree): string {
  const declarations = Object.entries(toCssVariables(tree))
    .map(([name, value]) => `${name}:${value};`)
    .join("");
  const css = `:root{${declarations}}`;
  if (css.includes("<")) throw new Error("Theme token values must not contain '<'");
  return css;
}

/** A typed reference to a token for inline styles, e.g. `cssVar("color.ink")` → `var(--color-ink)`. */
export function cssVar(path: TokenPath): `var(${CssVariableName})` {
  return `var(${toCssVariableName(path)})`;
}

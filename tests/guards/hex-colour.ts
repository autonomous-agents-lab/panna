import { collectSourceFiles, findPattern, type LiteralHit } from "./find-literal";

/**
 * A 3, 4, 6 or 8 digit hex colour. The lookbehind skips JS private fields (`this.#fade`),
 * HTML entities (`&#123;`) and identifiers; the lookahead rejects longer words and lengths
 * that are not colours (5 or 7 digits).
 */
export const HEX_COLOUR = /(?<![\w.&$-])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/iu;

export function findRawHexColours(root: string, excludeGlobs: string[]): LiteralHit[] {
  return findPattern(collectSourceFiles(root, excludeGlobs), HEX_COLOUR);
}

import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

export type SourceFile = { path: string; content: string };
export type LiteralHit = { path: string; line: number };

export const SCANNED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".json", ".md"];

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Finds `name` as a whole word, ignoring case. A letter, digit or underscore on either side
 * means it is part of another word, so a name glued to other text (e.g. "PannaBook") is
 * deliberately not reported.
 */
export function findLiteral(files: SourceFile[], name: string): LiteralHit[] {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(name)}(?![\\p{L}\\p{N}_])`, "iu");
  return files.flatMap((file) =>
    file.content
      .split(/\r?\n/)
      .flatMap((text, index) => (pattern.test(text) ? [{ path: file.path, line: index + 1 }] : [])),
  );
}

export function formatHits(hits: LiteralHit[]): string {
  return hits.map((hit) => `${hit.path}:${hit.line}`).join("\n");
}

/** Supports `*` (within one path segment) and `**` (any depth), which is all the guard needs. */
export function globToRegExp(glob: string): RegExp {
  let source = "";
  for (let i = 0; i < glob.length; i++) {
    if (glob.startsWith("**/", i)) {
      source += "(?:.*/)?";
      i += 2;
    } else if (glob.startsWith("**", i)) {
      source += ".*";
      i += 1;
    } else if (glob[i] === "*") {
      source += "[^/]*";
    } else {
      source += escapeRegExp(glob.charAt(i));
    }
  }
  return new RegExp(`^${source}$`);
}

/** Reads every scanned file under `root`, skipping paths (relative to `root`) that match `excludeGlobs`. */
export function collectSourceFiles(root: string, excludeGlobs: string[]): SourceFile[] {
  const excludes = excludeGlobs.map(globToRegExp);
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && SCANNED_EXTENSIONS.includes(extname(entry.name)))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => {
      const relativePath = relative(root, path).split(sep).join("/");
      return !excludes.some((exclude) => exclude.test(relativePath));
    })
    .sort()
    .map((path) => ({ path, content: readFileSync(path, "utf8") }));
}

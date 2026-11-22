import type { LiteralHit, SourceFile } from "./find-literal";

const URL_LITERAL = /https?:\/\/[^\s"'`)<>\]]*/g;

/** Reports each `http(s)://` URL that isn't exactly one of the `allowed` strings. */
export function findUrlLiterals(files: SourceFile[], allowed: readonly string[]): LiteralHit[] {
  return files.flatMap((file) =>
    file.content
      .split(/\r?\n/)
      .flatMap((text, index) =>
        [...text.matchAll(URL_LITERAL)].some(([url]) => !allowed.includes(url))
          ? [{ path: file.path, line: index + 1 }]
          : [],
      ),
  );
}

import type { SourceFile } from "./find-literal";

/** The only Supabase variables that may reach code shipped to the browser. */
export const PUBLIC_SUPABASE_ENV = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];

export type EnvNameHit = { path: string; name: string };

const SUPABASE_ENV_NAME = /(?<![A-Za-z0-9_])[A-Z0-9_]*SUPABASE[A-Z0-9_]*(?![A-Za-z0-9_])/g;
const SERVICE_ROLE = /SERVICE_ROLE/;
// `import "server-only"` as the first statement, after any leading comments.
const SERVER_ONLY_IMPORT = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*import\s+["']server-only["']/;

export function isServerOnly(file: SourceFile): boolean {
  return SERVER_ONLY_IMPORT.test(file.content);
}

/** Every upper-case `*SUPABASE*` name that is not one of the two public variables. */
export function findNonPublicSupabaseEnv(files: SourceFile[]): EnvNameHit[] {
  return files.flatMap((file) =>
    [...new Set(file.content.match(SUPABASE_ENV_NAME) ?? [])]
      .filter((name) => !PUBLIC_SUPABASE_ENV.includes(name))
      .map((name) => ({ path: file.path, name })),
  );
}

/** Paths of files that mention the service-role key name without being guarded by `server-only`. */
export function findServiceRoleOutsideServerOnly(files: SourceFile[]): string[] {
  return files.filter((file) => SERVICE_ROLE.test(file.content) && !isServerOnly(file)).map((file) => file.path);
}

// Reads facts out of the SQL migrations so Vitest can check them against src/config without a
// database. Every lookup takes the latest definition across all migrations (in filename order)
// and throws a message naming what it couldn't find, so a test never passes on a missed parse.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Migration {
  name: string;
  /** The SQL with comments removed. */
  sql: string;
}

export const MIGRATIONS_DIR = join(import.meta.dirname, "..", "..", "supabase", "migrations");

/** Removes `-- line` and `/* block *\/` comments. Our migrations don't put `--` inside strings. */
export function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

export function readMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: stripSqlComments(readFileSync(join(dir, name), "utf8")) }));
}

/** The text between the parenthesis at `openIndex` and its matching close. */
export function balancedParens(text: string, openIndex: number): string {
  if (text[openIndex] !== "(") throw new Error(`Expected "(" at index ${openIndex}`);
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return text.slice(openIndex + 1, i);
  }
  throw new Error(`Unbalanced parentheses from index ${openIndex}`);
}

/** Splits on commas that aren't inside parentheses or string literals. */
export function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "'") inString = !inString;
    else if (inString) continue;
    else if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === "," && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts.filter((part) => part !== "");
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function last<T>(matches: T[], what: string): T {
  const found = matches.at(-1);
  if (found === undefined) throw new Error(`No migration defines ${what}`);
  return found;
}

/** The expression of the latest `constraint <name> check (...)` across all migrations. */
export function latestCheckConstraint(migrations: Migration[], name: string): string {
  const pattern = new RegExp(`\\bconstraint\\s+${escapeRegExp(name)}\\s+check\\s*\\(`, "gi");
  const matches = migrations.flatMap(({ sql }) =>
    [...sql.matchAll(pattern)].map((match) => balancedParens(sql, match.index + match[0].length - 1).trim()),
  );
  return last(matches, `check constraint ${name}`);
}

/** The values of `<column> in ('a', 'b', ...)`. */
export function inListValues(expression: string, column: string): string[] {
  const match = new RegExp(`^${escapeRegExp(column)}\\s+in\\s*\\(([^)]*)\\)$`, "i").exec(expression);
  if (!match) throw new Error(`Expected "${column} in (...)", got: ${expression}`);
  return stringLiterals(match[1]!);
}

/** The bounds of `char_length(<column>) between <min> and <max>`. */
export function charLengthRange(expression: string, column: string): { min: number; max: number } {
  const match = new RegExp(
    `^char_length\\(${escapeRegExp(column)}\\)\\s+between\\s+(\\d+)\\s+and\\s+(\\d+)$`,
    "i",
  ).exec(expression);
  if (!match) throw new Error(`Expected "char_length(${column}) between <min> and <max>", got: ${expression}`);
  return { min: Number(match[1]), max: Number(match[2]) };
}

/** The total length bounds of `<column> ~ '^[a-z][a-z0-9_]{a,b}$'` (one leading letter plus a to b more). */
export function usernameFormatLengthRange(expression: string, column: string): { min: number; max: number } {
  const match = new RegExp(
    `^${escapeRegExp(column)}\\s+~\\s+'\\^\\[a-z\\]\\[a-z0-9_\\]\\{(\\d+),(\\d+)\\}\\$'$`,
    "i",
  ).exec(expression);
  if (!match) throw new Error(`Expected "${column} ~ '^[a-z][a-z0-9_]{a,b}$'", got: ${expression}`);
  return { min: Number(match[1]) + 1, max: Number(match[2]) + 1 };
}

/** Every 'single-quoted' literal in `text`, in order. */
export function stringLiterals(text: string): string[] {
  return [...text.matchAll(/'((?:[^']|'')*)'/g)].map((match) => match[1]!.replaceAll("''", "'"));
}

/** The bodies of every `create table public.<table> (...)`, in migration order. */
function createTableBodies(migrations: Migration[], table: string): string[] {
  const pattern = new RegExp(`\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${escapeRegExp(table)}\\s*\\(`, "gi");
  return migrations.flatMap(({ sql }) =>
    [...sql.matchAll(pattern)].map((match) => balancedParens(sql, match.index + match[0].length - 1)),
  );
}

const TABLE_CONSTRAINT_START = /^(constraint|primary|unique|check|foreign|exclude)\b/i;

/** Column names of `public.<table>`: its create table plus any later `add column`. */
export function tableColumns(migrations: Migration[], table: string): string[] {
  const body = last(createTableBodies(migrations, table), `table public.${table}`);
  const columns = splitTopLevel(body)
    .filter((item) => !TABLE_CONSTRAINT_START.test(item))
    .map((item) => item.split(/\s+/)[0]!.replaceAll('"', ""));
  const addColumn = new RegExp(
    `\\balter\\s+table\\s+(?:only\\s+)?public\\.${escapeRegExp(table)}\\s+add\\s+column\\s+(?:if\\s+not\\s+exists\\s+)?(\\w+)`,
    "gi",
  );
  for (const { sql } of migrations) {
    for (const match of sql.matchAll(addColumn)) columns.push(match[1]!);
  }
  return columns;
}

/** The latest string-literal default of `public.<table>.<column>`, from create table or `set default`. */
export function latestColumnDefault(migrations: Migration[], table: string, column: string): string {
  const defaults: string[] = [];
  const setDefault = new RegExp(
    `\\balter\\s+table\\s+(?:only\\s+)?public\\.${escapeRegExp(table)}\\s+alter\\s+column\\s+${escapeRegExp(column)}\\s+set\\s+default\\s+'([^']*)'`,
    "gi",
  );
  const createTable = new RegExp(`\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${escapeRegExp(table)}\\s*\\(`, "gi");
  for (const { sql } of migrations) {
    const found: { index: number; value: string }[] = [];
    for (const match of sql.matchAll(createTable)) {
      const body = balancedParens(sql, match.index + match[0].length - 1);
      const item = splitTopLevel(body).find((part) => part.split(/\s+/)[0] === column);
      const value = item === undefined ? undefined : /\bdefault\s+'([^']*)'/i.exec(item)?.[1];
      if (value !== undefined) found.push({ index: match.index, value });
    }
    for (const match of sql.matchAll(setDefault)) found.push({ index: match.index, value: match[1]! });
    defaults.push(...found.sort((a, b) => a.index - b.index).map(({ value }) => value));
  }
  return last(defaults, `a string default for public.${table}.${column}`);
}

/** The body of the latest `create [or replace] function public.<name>(...) ... as $$ ... $$`. */
export function latestFunctionBody(migrations: Migration[], name: string): string {
  const pattern = new RegExp(
    `\\bcreate\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${escapeRegExp(name)}\\s*\\([\\s\\S]*?\\bas\\s+\\$\\$([\\s\\S]*?)\\$\\$`,
    "gi",
  );
  const bodies = migrations.flatMap(({ sql }) => [...sql.matchAll(pattern)].map((match) => match[1]!));
  return last(bodies, `function public.${name}`);
}

/** The string literals of the only `array[...]` in `text`. */
export function arrayLiteralValues(text: string): string[] {
  const arrays = [...text.matchAll(/\barray\s*\[([^\]]*)\]/gi)];
  if (arrays.length !== 1) throw new Error(`Expected exactly one array[...] literal, found ${arrays.length}`);
  return stringLiterals(arrays[0]![1]!);
}

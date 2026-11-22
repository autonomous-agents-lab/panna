import { describe, expect, it } from "vitest";

import { readMigrations } from "../support/migration-sql";

// Migrations only add or change; they never drop user data. Comments are stripped first, and
// statements like `revoke ... delete, truncate on ...` are privileges, not data loss.
const DATA_LOSS = [
  { what: "drop table", pattern: /\bdrop\s+table\b/i },
  { what: "drop schema", pattern: /\bdrop\s+schema\b/i },
  { what: "drop column", pattern: /\bdrop\s+column\b/i },
  { what: "truncate", pattern: /(^|;)\s*truncate\b/i },
  { what: "delete from", pattern: /\bdelete\s+from\b/i },
];

describe("supabase migrations", () => {
  const migrations = readMigrations();

  it("are found", () => {
    expect(migrations.map(({ name }) => name)).toContain("20261123000000_create_profiles_books_username_history.sql");
  });

  it.each(migrations)("$name drops, truncates and deletes nothing", ({ sql }) => {
    const found = DATA_LOSS.filter(({ pattern }) => pattern.test(sql)).map(({ what }) => what);
    expect(found).toEqual([]);
  });

  it("the profiles, books and username history migration drops nothing at all", () => {
    const migration = migrations.find(({ name }) => name.endsWith("_create_profiles_books_username_history.sql"));
    expect(migration?.sql).not.toMatch(/\bdrop\b/i);
  });

  it("the data-loss patterns catch what they are meant to", () => {
    const caught = (sql: string) => DATA_LOSS.filter(({ pattern }) => pattern.test(sql)).map(({ what }) => what);
    expect(caught("drop table public.x;")).toEqual(["drop table"]);
    expect(caught("alter table public.x drop column y;")).toEqual(["drop column"]);
    expect(caught("select 1;\ntruncate public.x;")).toEqual(["truncate"]);
    expect(caught("delete from public.x;")).toEqual(["delete from"]);
    expect(caught("drop schema s;")).toEqual(["drop schema"]);
    expect(caught("revoke insert, update, delete, truncate on public.x from anon;")).toEqual([]);
  });
});

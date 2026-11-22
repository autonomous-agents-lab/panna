import { describe, expect, it } from "vitest";

import {
  arrayLiteralValues,
  balancedParens,
  charLengthRange,
  inListValues,
  latestCheckConstraint,
  latestColumnDefault,
  latestFunctionBody,
  splitTopLevel,
  stripSqlComments,
  tableColumns,
  usernameFormatLengthRange,
  type Migration,
} from "./migration-sql";

const migration = (name: string, sql: string): Migration => ({ name, sql: stripSqlComments(sql) });

const first = migration(
  "1_create.sql",
  `-- a comment with constraint t_kind_check check (kind in ('ignored'))
  /* block
     comment */
  create table public.t (
    id uuid primary key,
    kind text not null default 'a' constraint t_kind_check check (kind in ('a', 'b')),
    name text constraint t_name_length_check check (char_length(name) between 1 and 9),
    handle text constraint t_handle_check check (handle ~ '^[a-z][a-z0-9_]{2,29}$'),
    constraint t_pair_check check (id is not null)
  );
  create function public.f(p text) returns boolean language sql as $$ select p = any (array['x', 'y''s']) $$;`,
);

const second = migration(
  "2_change.sql",
  `alter table public.t add constraint t_kind_check check (kind in ('a', 'b', 'c'));
  alter table public.t add column extra text;
  alter table public.t alter column kind set default 'b';
  create or replace function public.f(p text) returns boolean language sql as $$ select p = any (array['z']) $$;`,
);

describe("stripSqlComments", () => {
  it("removes line and block comments", () => {
    expect(stripSqlComments("a -- b\n/* c\nd */e")).toBe("a \ne");
  });
});

describe("balancedParens", () => {
  it("returns the text inside matching parentheses", () => {
    expect(balancedParens("x (a (b) c) d", 2)).toBe("a (b) c");
  });

  it("throws when not at an opening parenthesis or when unbalanced", () => {
    expect(() => balancedParens("abc", 0)).toThrow('Expected "("');
    expect(() => balancedParens("(a (b)", 0)).toThrow("Unbalanced");
  });
});

describe("splitTopLevel", () => {
  it("ignores commas inside parentheses and strings", () => {
    expect(splitTopLevel("a in ('x', 'y'), f(1, 2), 'p,q' ,")).toEqual(["a in ('x', 'y')", "f(1, 2)", "'p,q'"]);
  });
});

describe("latestCheckConstraint", () => {
  it("takes the latest definition across migrations and ignores comments", () => {
    expect(latestCheckConstraint([first], "t_kind_check")).toBe("kind in ('a', 'b')");
    expect(latestCheckConstraint([first, second], "t_kind_check")).toBe("kind in ('a', 'b', 'c')");
  });

  it("throws when no migration defines it", () => {
    expect(() => latestCheckConstraint([first, second], "t_missing_check")).toThrow(
      "No migration defines check constraint t_missing_check",
    );
  });
});

describe("expression parsers", () => {
  it("read an in-list, a char_length range and the username format", () => {
    expect(inListValues("kind in ('a', 'b')", "kind")).toEqual(["a", "b"]);
    expect(charLengthRange("char_length(name) between 1 and 9", "name")).toEqual({ min: 1, max: 9 });
    expect(usernameFormatLengthRange("handle ~ '^[a-z][a-z0-9_]{2,29}$'", "handle")).toEqual({ min: 3, max: 30 });
  });

  it("throw on any other shape", () => {
    expect(() => inListValues("kind = 'a'", "kind")).toThrow('Expected "kind in (...)"');
    expect(() => charLengthRange("char_length(name) <= 9", "name")).toThrow("char_length(name) between");
    expect(() => usernameFormatLengthRange("handle ~ '^[a-z]+$'", "handle")).toThrow("handle ~");
  });
});

describe("tableColumns", () => {
  it("lists created and added columns, not table constraints", () => {
    expect(tableColumns([first, second], "t")).toEqual(["id", "kind", "name", "handle", "extra"]);
  });

  it("throws for a table no migration creates", () => {
    expect(() => tableColumns([first], "nope")).toThrow("No migration defines table public.nope");
  });
});

describe("latestColumnDefault", () => {
  it("takes the latest of the create table default and set default", () => {
    expect(latestColumnDefault([first], "t", "kind")).toBe("a");
    expect(latestColumnDefault([first, second], "t", "kind")).toBe("b");
  });

  it("throws when the column has no string default", () => {
    expect(() => latestColumnDefault([first, second], "t", "name")).toThrow("public.t.name");
    expect(() => latestColumnDefault([first], "t", "nope")).toThrow("public.t.nope");
  });
});

describe("latestFunctionBody and arrayLiteralValues", () => {
  it("read the latest function's array literal, unescaping quotes", () => {
    expect(arrayLiteralValues(latestFunctionBody([first], "f"))).toEqual(["x", "y's"]);
    expect(arrayLiteralValues(latestFunctionBody([first, second], "f"))).toEqual(["z"]);
  });

  it("throw when the function or a single array is missing", () => {
    expect(() => latestFunctionBody([first], "g")).toThrow("No migration defines function public.g");
    expect(() => arrayLiteralValues("select 1")).toThrow("found 0");
    expect(() => arrayLiteralValues("array['a'] || array['b']")).toThrow("found 2");
  });
});

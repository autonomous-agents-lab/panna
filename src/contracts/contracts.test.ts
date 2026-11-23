import { describe, expect, expectTypeOf, it } from "vitest";
import type { z } from "zod";

import { CONTENT_STATUSES, PAGE_BODY_DB_MAX_BYTES, PAGE_BODY_MAX_BYTES } from "@/config/content";
import {
  COVER_STYLES,
  CONTENT_LANGUAGES,
  DEFAULT_CONTENT_LANGUAGE,
  DEFAULT_COVER_STYLE,
  DEFAULT_FONT,
  FONT_IDS,
  TEXT_LIMITS,
} from "@/config/books";
import { RESERVED_USERNAMES, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/config/usernames";
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";
import { validateUsername } from "@/lib/username";

import {
  USERNAME_PATTERN,
  bookSchema,
  chapterSchema,
  contentStatusSchema,
  createChapterInputSchema,
  createPageInputSchema,
  pageBodyInputSchema,
  pageBodySchema,
  pageSchema,
  sanitisePageBody,
  updateChapterInputSchema,
  updatePageInputSchema,
  type Chapter,
  type ContentStatus,
  type Page,
  coverStyleSchema,
  createProfileWithBookInputSchema,
  createProfileWithBookResultSchema,
  fontIdSchema,
  languageSchema,
  profileSchema,
  usernameHeldUntilResultSchema,
  usernameSchema,
  type Book,
  type CoverStyle,
  type CreateProfileWithBookInput,
  type FontId,
  type Language,
  type Profile,
} from "./index";
import { WHITESPACE_CHARACTERS } from "./fields";
import {
  arrayLiteralValues,
  charLengthRange,
  inListValues,
  latestCheckConstraint,
  latestColumnDefault,
  latestFunctionBody,
  readMigrations,
  tableColumns,
  usernameFormatLengthRange,
} from "../../tests/support/migration-sql";

const migrations = readMigrations();
const check = (name: string) => latestCheckConstraint(migrations, name);
const sorted = (values: readonly string[]) => [...values].sort();

function groups(pattern: RegExp, text: string): string[] {
  const match = pattern.exec(text);
  if (!match) throw new Error(`Expected ${pattern}, got: ${text}`);
  return match.slice(1);
}

/** A Postgres bracket-expression body as a one-character JS regex; its `\xhhh` escapes become `\u{hhh}`. */
const postgresCharacterClass = (body: string) =>
  new RegExp(`^[${body.replace(/\\x([0-9a-f]+)/gi, "\\u{$1}")}]$`, "u");

/** Code points (hex) where `whitespace` disagrees with what `String.prototype.trim` strips. */
function disagreementsWithTrim(whitespace: RegExp): string[] {
  const disagreements: string[] = [];
  for (let codePoint = 0; codePoint <= 0x10ffff; codePoint++) {
    const char = String.fromCodePoint(codePoint);
    if ((char.trim() === "") !== whitespace.test(char)) disagreements.push(codePoint.toString(16));
  }
  return disagreements;
}

const profileRow: Profile = {
  id: "5b3c1c1e-8a9f-4f43-9d55-0b6a3c2f4e10",
  username: "asha_k",
  display_name: "आशा",
  avatar_path: null,
  bio: "हिन्दी में लिखती हूँ",
  preferred_language: "hi",
  username_changed_at: null,
  created_at: "2026-11-23T10:00:00.123456+00:00",
  updated_at: "2026-11-23T10:00:00.123456+00:00",
  deactivated_at: null,
};

const bookRow: Book = {
  id: "0f6b2f0e-1d2a-4c51-8a3b-7e9f2d1c4b20",
  owner_id: profileRow.id,
  title: "आशा",
  subtitle: null,
  cover_style: "classic",
  font: "kalam",
  default_language: "hi",
  created_at: "2026-11-23T10:00:00.123456+00:00",
  updated_at: "2026-11-23T10:00:00.123456+00:00",
};

const chapterRow: Chapter = {
  id: "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e40",
  book_id: bookRow.id,
  position: 0,
  title: "पहला अध्याय",
  status: "published",
  published_at: "2026-11-23T10:00:00.123456+00:00",
  archived_at: null,
  language: "hi",
  created_at: "2026-11-23T10:00:00.123456+00:00",
  updated_at: "2026-11-23T10:00:00.123456+00:00",
};

const pageRow: Page = {
  id: "8d2e3f4a-5b6c-4d7e-8f90-a1b2c3d4e5f6",
  book_id: bookRow.id,
  chapter_id: chapterRow.id,
  position: 0,
  status: "draft",
  published_at: null,
  archived_at: null,
  language: "hi",
  body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "आज बारिश हुई।" }] }] },
  created_at: "2026-11-23T10:00:00.123456+00:00",
  updated_at: "2026-11-23T10:00:00.123456+00:00",
};

const bodyOptions = { storageUrl: "https://abcdefghijkl.supabase.co" };
const migrationSql = migrations.map(({ sql }) => sql).join("\n");

describe("config lists agree with the database check constraints (AC-8)", () => {
  it("cover styles", () => {
    expect(inListValues(check("books_cover_style_check"), "cover_style")).toEqual([...COVER_STYLES]);
  });

  it("fonts", () => {
    expect(inListValues(check("books_font_check"), "font")).toEqual([...FONT_IDS]);
  });

  it("content languages, on profiles and books", () => {
    expect(inListValues(check("profiles_preferred_language_check"), "preferred_language")).toEqual([
      ...CONTENT_LANGUAGES,
    ]);
    expect(inListValues(check("books_default_language_check"), "default_language")).toEqual([...CONTENT_LANGUAGES]);
  });

  it("column defaults", () => {
    expect(latestColumnDefault(migrations, "books", "cover_style")).toBe(DEFAULT_COVER_STYLE);
    expect(latestColumnDefault(migrations, "books", "font")).toBe(DEFAULT_FONT);
    expect(latestColumnDefault(migrations, "books", "default_language")).toBe(DEFAULT_CONTENT_LANGUAGE);
    expect(latestColumnDefault(migrations, "profiles", "preferred_language")).toBe(DEFAULT_CONTENT_LANGUAGE);
  });

  it("username length, in the format checks on profiles and username_history", () => {
    const limits = { min: USERNAME_MIN_LENGTH, max: USERNAME_MAX_LENGTH };
    expect(usernameFormatLengthRange(check("profiles_username_format_check"), "username")).toEqual(limits);
    expect(usernameFormatLengthRange(check("username_history_username_format_check"), "username")).toEqual(limits);
  });

  it("the reserved usernames in public.is_reserved_username", () => {
    expect(arrayLiteralValues(latestFunctionBody(migrations, "is_reserved_username"))).toEqual([
      ...RESERVED_USERNAMES,
    ]);
  });

  it("whitespace, in the not-blank checks and public.trim_whitespace, is what trim strips", () => {
    const classes = new Set([
      ...groups(/^display_name ~ '\[\^([^\]]*)\]'$/, check("profiles_display_name_not_blank_check")),
      ...groups(/^title ~ '\[\^([^\]]*)\]'$/, check("books_title_not_blank_check")),
      ...groups(/^title ~ '\[\^([^\]]*)\]'$/, check("chapters_title_not_blank_check")),
      ...groups(/'\^\[([^\]]*)\]\+\|\[([^\]]*)\]\+\$'/, latestFunctionBody(migrations, "trim_whitespace")),
    ]);
    for (const body of classes) expect(disagreementsWithTrim(postgresCharacterClass(body))).toEqual([]);
  });

  it.each([
    ["profiles_display_name_length_check", "display_name", TEXT_LIMITS.displayName],
    ["profiles_bio_length_check", "bio", TEXT_LIMITS.bio],
    ["profiles_avatar_path_length_check", "avatar_path", TEXT_LIMITS.avatarPath],
    ["books_title_length_check", "title", TEXT_LIMITS.bookTitle],
    ["books_subtitle_length_check", "subtitle", TEXT_LIMITS.bookSubtitle],
    ["chapters_title_length_check", "title", TEXT_LIMITS.chapterTitle],
  ])("text limit %s", (constraint, column, limit) => {
    expect(charLengthRange(check(constraint), column)).toEqual(limit);
  });
});

describe("chapters and pages agree with their migration", () => {
  it.each(["chapters", "pages"])("%s statuses, languages, positions and status default", (table) => {
    expect(inListValues(check(`${table}_status_check`), "status")).toEqual([...CONTENT_STATUSES]);
    expect(inListValues(check(`${table}_language_check`), "language")).toEqual([...CONTENT_LANGUAGES]);
    expect(check(`${table}_position_check`)).toBe("position >= 0");
    expect(latestColumnDefault(migrations, table, "status")).toBe("draft");
    expect(contentStatusSchema.parse("draft")).toBe("draft");
  });

  it("the database body size backstop is PAGE_BODY_DB_MAX_BYTES, with room over the sanitiser's limit", () => {
    const [limit] = groups(/octet_length\(body::text\)\s*<=\s*(\d+)/, check("pages_body_shape_check"));
    expect(Number(limit)).toBe(PAGE_BODY_DB_MAX_BYTES);
    // body::text adds a space after every ':' and ',', 10-15% more than JSON.stringify.
    expect(PAGE_BODY_DB_MAX_BYTES).toBeGreaterThanOrEqual(PAGE_BODY_MAX_BYTES * 1.25);
  });

  it("the default body is a valid body the sanitiser leaves unchanged", () => {
    const body: unknown = JSON.parse(latestColumnDefault(migrations, "pages", "body"));
    expect(pageBodySchema.parse(body)).toEqual(body);
    expect(sanitisePageBody(body, bodyOptions)).toEqual({ ok: true, body });
  });

  it.each([
    ["chapters", "insert", Object.keys(createChapterInputSchema.shape)],
    ["chapters", "update", Object.keys(updateChapterInputSchema.shape)],
    ["pages", "insert", Object.keys(createPageInputSchema(bodyOptions).shape)],
    ["pages", "update", Object.keys(updatePageInputSchema(bodyOptions).shape)],
  ])("the %s %s input schema has exactly the granted columns", (table, privilege, keys) => {
    const [columns] = groups(new RegExp(`grant ${privilege} \\(([^)]*)\\) on public\\.${table} to authenticated`), migrationSql);
    expect(sorted(keys)).toEqual(sorted(columns!.split(",").map((column) => column.trim())));
  });
});

describe("schemas match the table columns (AC-8)", () => {
  it("profileSchema has exactly the profiles columns", () => {
    expect(sorted(Object.keys(profileSchema.shape))).toEqual(sorted(tableColumns(migrations, "profiles")));
  });

  it("bookSchema has exactly the books columns", () => {
    expect(sorted(Object.keys(bookSchema.shape))).toEqual(sorted(tableColumns(migrations, "books")));
  });

  it("chapterSchema and pageSchema have exactly the chapters and pages columns", () => {
    expect(sorted(Object.keys(chapterSchema.shape))).toEqual(sorted(tableColumns(migrations, "chapters")));
    expect(sorted(Object.keys(pageSchema.shape))).toEqual(sorted(tableColumns(migrations, "pages")));
    expectTypeOf<keyof Chapter>().toEqualTypeOf<keyof Tables<"chapters">>();
    expectTypeOf<keyof Page>().toEqualTypeOf<keyof Tables<"pages">>();
    expectTypeOf<Chapter>().toExtend<Tables<"chapters">>();
    expectTypeOf<Page>().toExtend<Tables<"pages">>();
    expectTypeOf<z.output<typeof createChapterInputSchema>>().toExtend<TablesInsert<"chapters">>();
    expectTypeOf<z.output<typeof updateChapterInputSchema>>().toExtend<TablesUpdate<"chapters">>();
    expectTypeOf<z.output<ReturnType<typeof createPageInputSchema>>>().toExtend<TablesInsert<"pages">>();
    expectTypeOf<z.output<ReturnType<typeof updatePageInputSchema>>>().toExtend<TablesUpdate<"pages">>();
    expectTypeOf<ContentStatus>().toEqualTypeOf<"draft" | "published">();
  });

  it("types match the generated database types", () => {
    expectTypeOf<keyof Profile>().toEqualTypeOf<keyof Tables<"profiles">>();
    expectTypeOf<keyof Book>().toEqualTypeOf<keyof Tables<"books">>();
    expectTypeOf<Profile>().toExtend<Tables<"profiles">>();
    expectTypeOf<Book>().toExtend<Tables<"books">>();
    type CreateArgs = Database["public"]["Functions"]["create_profile_with_book"]["Args"];
    expectTypeOf<keyof CreateProfileWithBookInput>().toEqualTypeOf<keyof CreateArgs>();
    expectTypeOf<CreateProfileWithBookInput>().toExtend<CreateArgs>();
    expectTypeOf<Language>().toEqualTypeOf<"hi" | "en">();
    expectTypeOf<CoverStyle>().toEqualTypeOf<(typeof COVER_STYLES)[number]>();
    expectTypeOf<FontId>().toEqualTypeOf<(typeof FONT_IDS)[number]>();
  });
});

describe("schemas", () => {
  it("parse valid rows", () => {
    expect(profileSchema.parse(profileRow)).toEqual(profileRow);
    expect(bookSchema.parse(bookRow)).toEqual(bookRow);
    expect(createProfileWithBookResultSchema.parse({ profile: profileRow, book: bookRow })).toEqual({
      profile: profileRow,
      book: bookRow,
    });
  });

  it("reject out-of-list values and unknown keys", () => {
    expect(coverStyleSchema.safeParse("glitter").success).toBe(false);
    expect(fontIdSchema.safeParse("comic_sans").success).toBe(false);
    expect(languageSchema.safeParse("fr").success).toBe(false);
    expect(bookSchema.safeParse({ ...bookRow, font: "comic_sans" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...profileRow, preferred_language: "fr" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...profileRow, email: "a@example.org" }).success).toBe(false);
  });

  it("enforce text limits in code points, like char_length", () => {
    const max = TEXT_LIMITS.displayName.max;
    expect(profileSchema.safeParse({ ...profileRow, display_name: "😀".repeat(max) }).success).toBe(true);
    expect(profileSchema.safeParse({ ...profileRow, display_name: "😀".repeat(max + 1) }).success).toBe(false);
    expect(profileSchema.safeParse({ ...profileRow, display_name: "" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...profileRow, display_name: "   " }).success).toBe(false);
    expect(bookSchema.safeParse({ ...bookRow, subtitle: "" }).success).toBe(true);
  });

  it("WHITESPACE_CHARACTERS is exactly the set String.prototype.trim strips", () => {
    expect(disagreementsWithTrim(new RegExp(`^[${WHITESPACE_CHARACTERS}]$`, "u"))).toEqual([]);
  });

  it.each([
    ["tab", "\t"],
    ["newline", "\n"],
    ["no-break space", "\xa0"],
    ["ideographic space", "\u{3000}"],
    ["byte order mark", "\u{feff}"],
  ])("reject a %s-only display name and title, as the database's not-blank checks do", (_name, blank) => {
    expect(profileSchema.safeParse({ ...profileRow, display_name: blank }).success).toBe(false);
    expect(bookSchema.safeParse({ ...bookRow, title: blank }).success).toBe(false);
  });

  it("accept text surrounded by whitespace, as the database does", () => {
    expect(profileSchema.safeParse({ ...profileRow, display_name: "\xa0Asha\t" }).success).toBe(true);
    expect(bookSchema.safeParse({ ...bookRow, title: "\u{3000}आशा\n" }).success).toBe(true);
  });

  it("match the username format check", () => {
    expect(USERNAME_PATTERN.source).toBe(
      check("profiles_username_format_check").replace(/^username\s+~\s+'(.*)'$/, "$1"),
    );
    expect(usernameSchema.safeParse("asha").success).toBe(true);
    expect(usernameSchema.safeParse("Asha").success).toBe(false);
  });

  it("normalize the create_profile_with_book input as the function does", () => {
    expect(
      createProfileWithBookInputSchema.parse({ p_username: "  Asha ", p_display_name: " Asha ", p_preferred_language: "en" }),
    ).toEqual({ p_username: "asha", p_display_name: "Asha", p_preferred_language: "en" });
    expect(
      createProfileWithBookInputSchema.parse({
        p_username: "\u{3000}Asha\t",
        p_display_name: "\xa0Asha\u{feff}",
        p_preferred_language: "en",
      }),
    ).toEqual({ p_username: "asha", p_display_name: "Asha", p_preferred_language: "en" });
    expect(
      createProfileWithBookInputSchema.safeParse({ p_username: "asha", p_display_name: "\xa0\t", p_preferred_language: "en" })
        .success,
    ).toBe(false);
    expect(
      createProfileWithBookInputSchema.safeParse({ p_username: "1asha", p_display_name: "A", p_preferred_language: "en" })
        .success,
    ).toBe(false);
  });

  it("rejects a username with a letter that only lowercases to ASCII, as validateUsername does", () => {
    const kelvin = "\u{212a}sha";
    expect(validateUsername(kelvin)).toEqual({ ok: false, code: "invalid_characters" });
    expect(
      createProfileWithBookInputSchema.safeParse({ p_username: kelvin, p_display_name: "A", p_preferred_language: "en" })
        .success,
    ).toBe(false);
  });

  it("parse valid chapter and page rows, and reject unknown statuses and unsanitised bodies", () => {
    expect(chapterSchema.parse(chapterRow)).toEqual(chapterRow);
    expect(pageSchema.parse(pageRow)).toEqual(pageRow);
    expect(chapterSchema.safeParse({ ...chapterRow, status: "scheduled" }).success).toBe(false);
    expect(chapterSchema.safeParse({ ...chapterRow, position: -1 }).success).toBe(false);
    expect(chapterSchema.safeParse({ ...chapterRow, title: "\u{3000}" }).success).toBe(false);
    expect(pageSchema.safeParse({ ...pageRow, body: { type: "doc", content: [{ type: "script" }] } }).success).toBe(false);
  });

  it("trim chapter titles on input and keep them within the limit", () => {
    const input = { book_id: bookRow.id, position: 0, title: "  पहला अध्याय ", language: "hi" };
    expect(createChapterInputSchema.parse(input)).toEqual({ ...input, title: "पहला अध्याय" });
    expect(createChapterInputSchema.safeParse({ ...input, title: " \t " }).success).toBe(false);
    expect(createChapterInputSchema.safeParse({ ...input, title: "x".repeat(TEXT_LIMITS.chapterTitle.max + 1) }).success).toBe(false);
    expect(createChapterInputSchema.safeParse({ ...input, published_at: "2026-11-23T10:00:00+00:00" }).success).toBe(false);
    expect(updateChapterInputSchema.parse({ archived_at: null })).toEqual({ archived_at: null });
    expect(updateChapterInputSchema.safeParse({ book_id: bookRow.id }).success).toBe(false);
  });

  it("sanitise page bodies on input (AC-5)", () => {
    const create = createPageInputSchema(bodyOptions);
    const input = { book_id: bookRow.id, chapter_id: chapterRow.id, position: 0, language: "en" };
    expect(create.parse(input)).toEqual(input);
    expect(
      create.parse({ ...input, body: { type: "doc", content: [{ type: "script" }, { type: "paragraph", attrs: { onclick: "x" } }] } }),
    ).toEqual({ ...input, body: { type: "doc", content: [{ type: "paragraph" }] } });
    expect(updatePageInputSchema(bodyOptions).parse({ status: "published" })).toEqual({ status: "published" });
    expect(updatePageInputSchema(bodyOptions).safeParse({ published_at: "2026-11-23T10:00:00+00:00" }).success).toBe(false);
  });

  it("report a rejected page body as an issue with the error code and its path (AC-5)", () => {
    const result = updatePageInputSchema(bodyOptions).safeParse({
      body: { type: "doc", content: [{ type: "image", attrs: { src: "javascript:alert(1)", alt: "x" } }] },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        code: "custom",
        message: "page_body_image_src_not_allowed",
        path: ["body", "content", 0, "attrs", "src"],
      }),
    ]);
    expect(pageBodyInputSchema(bodyOptions).safeParse("<p>hi</p>").error?.issues[0]?.message).toBe(
      "page_body_not_a_document",
    );
  });

  it("type username_held_until's result as a timestamp or null", () => {
    expect(usernameHeldUntilResultSchema.parse(null)).toBeNull();
    expect(usernameHeldUntilResultSchema.parse("2026-12-01T00:00:00+00:00")).toBe("2026-12-01T00:00:00+00:00");
    expect(usernameHeldUntilResultSchema.safeParse("soon").success).toBe(false);
  });
});

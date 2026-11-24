import { describe, expect, it } from "vitest";

import { catalogues } from "@/i18n/catalogue";
import type { DashboardChapter } from "@/lib/writing/dashboard/view";

import { NO_ACTIONS, elements, render, summary, tFor, textOf, type TestLocale } from "./__fixtures__/render";
import { ChapterList } from "./ChapterList";
import { StatusBadge } from "./StatusBadge";

const CHAPTERS: DashboardChapter[] = [
  {
    id: "c1",
    title: "पहला अध्याय",
    language: "en",
    pages: [summary("p1", "Morning", "published"), summary("p2", null, "draft"), summary("p3", "शाम", "draft")],
  },
  { id: "c2", title: "Second", language: "en", pages: [] },
];

const renderList = (locale: TestLocale, chapters = CHAPTERS) =>
  render(locale, <ChapterList chapters={chapters} t={tFor(locale)} actions={NO_ACTIONS} />);

describe("ChapterList", () => {
  it.each(["en", "hi"] as const)(
    "in %s, lists chapters in order, each with its pages in order and an Untitled page placeholder (AC-2)",
    (locale) => {
      const t = catalogues[locale];
      const html = renderList(locale);
      expect(elements(html, "h2").map((heading) => heading.text)).toEqual(["पहला अध्याय", "Second"]);
      const text = textOf(html);
      const order = ["Morning", t["write.untitledPage"], "शाम", "Second", t["write.chapter.noPages"]].map((part) =>
        text.indexOf(part),
      );
      expect(order.every((index) => index >= 0)).toBe(true);
      expect(order).toEqual([...order].sort((a, b) => a - b));
      expect(elements(html, "ol")[0]).toMatchObject({ "aria-label": t["write.chapters.label"] });
      expect(elements(html, "ol")[1]).toMatchObject({ "aria-label": `${t["write.chapter.pagesLabel"].replace("{title}", "पहला अध्याय")}` });
    },
  );

  it.each(["en", "hi"] as const)("in %s, gives every page a status badge with a text label (AC-2)", (locale) => {
    const t = catalogues[locale];
    const html = renderList(locale);
    const badges = elements(html, "span").filter((span) => span.class?.includes("badge"));
    expect(badges.map((badge) => badge.text)).toEqual([
      t["write.status.published"],
      t["write.status.draft"],
      t["write.status.draft"],
    ]);
  });

  it.each(["en", "hi"] as const)(
    "in %s, names every control after its item: open, rename, move and add page (AC-5)",
    (locale) => {
      const t = tFor(locale);
      const html = renderList(locale);
      const named = (key: Parameters<typeof t>[0], title: string) => t(key, { title });

      const links = elements(html, "a");
      expect(links.map((link) => [link.href, link["aria-label"], link.text])).toEqual([
        ["/write/pages/p1", named("write.action.openNamed", "Morning"), t("write.action.open")],
        ["/write/pages/p2", named("write.action.openNamed", t("write.untitledPage")), t("write.action.open")],
        ["/write/pages/p3", named("write.action.openNamed", "शाम"), t("write.action.open")],
      ]);

      const buttons = elements(html, "button");
      for (const button of buttons) {
        expect(button["aria-label"], button.text).toContain(button.text);
      }
      const names = buttons.map((button) => button["aria-label"]);
      for (const title of ["पहला अध्याय", "Second", "Morning", t("write.untitledPage"), "शाम"]) {
        expect(names).toContain(named("write.action.renameNamed", title));
        expect(names).toContain(named("write.action.moveUpNamed", title));
        expect(names).toContain(named("write.action.moveDownNamed", title));
      }
      expect(names).toContain(named("write.action.addPageNamed", "Second"));
    },
  );

  it("disables moving the first item up and the last item down, and nothing else (AC-5)", () => {
    const t = tFor("en");
    const buttons = elements(renderList("en"), "button");
    const disabled = buttons.filter((button) => "disabled" in button).map((button) => button["aria-label"]);
    expect(disabled).toEqual([
      t("write.action.moveUpNamed", { title: "पहला अध्याय" }),
      t("write.action.moveUpNamed", { title: "Morning" }),
      t("write.action.moveDownNamed", { title: "शाम" }),
      t("write.action.moveDownNamed", { title: "Second" }),
    ]);
  });

  it("posts each move with the item's id and its direction (AC-3)", () => {
    const html = renderList("en");
    const hidden = elements(html, "input").filter((input) => input.type === "hidden");
    expect(hidden.map((input) => [input.name, input.value])).toContainEqual(["chapterId", "c2"]);
    expect(hidden.map((input) => [input.name, input.value])).toContainEqual(["pageId", "p3"]);
    const moves = elements(html, "button").filter((button) => button.name === "direction");
    expect(new Set(moves.map((button) => button.value))).toEqual(new Set(["up", "down"]));
    expect(moves.every((button) => button.type === "submit")).toBe(true);
  });

  it("marks Devanagari titles as Hindi so they get the Devanagari UI font, even in an English chapter (AC-6)", () => {
    const html = renderList("en");
    expect(elements(html, "h2").map((heading) => [heading.text, heading.lang])).toEqual([
      ["पहला अध्याय", "hi"],
      ["Second", "en"],
    ]);
    const titles = elements(html, "span").filter((span) => span.class?.includes("pageTitle"));
    expect(titles.map((title) => [title.text, title.lang])).toEqual([
      ["Morning", "en"],
      [catalogues.en["write.untitledPage"], undefined],
      ["शाम", "hi"],
    ]);
  });

  it("has no untranslated chrome in Hindi: every button label and name is from the Hindi catalogue (AC-6)", () => {
    const hi = Object.values(catalogues.hi).map((message) => message.split("{")[0]!.trim());
    for (const button of elements(renderList("hi"), "button")) {
      expect(hi.some((message) => message !== "" && button.text.startsWith(message)), button.text).toBe(true);
    }
  });
});

describe("StatusBadge (AC-2)", () => {
  it.each([
    ["en", "draft", "Draft"],
    ["en", "published", "Published"],
    ["en", "archived", "Archived"],
    ["hi", "draft", "ड्राफ़्ट"],
    ["hi", "published", "प्रकाशित"],
    ["hi", "archived", "संग्रहीत"],
  ] as const)("in %s, labels %s as %j", (locale, status, label) => {
    const [badge] = elements(render(locale, <StatusBadge status={status} t={tFor(locale)} />), "span");
    expect(badge?.text).toBe(label);
    expect(badge?.class).toMatch(new RegExp(status));
  });
});

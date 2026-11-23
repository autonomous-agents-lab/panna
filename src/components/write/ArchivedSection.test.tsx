import { describe, expect, it } from "vitest";

import { catalogues } from "@/i18n/catalogue";
import type { ArchivedPage } from "@/lib/writing/dashboard/view";

import { elements, render, summary, tFor } from "./__fixtures__/render";
import { ArchivedSection } from "./ArchivedSection";

const ARCHIVED: ArchivedPage[] = [
  { ...summary("x1", "Old draft", "archived"), chapterTitle: "पहला अध्याय", chapterLanguage: "en" },
  { ...summary("x2", null, "archived"), chapterTitle: "Second", chapterLanguage: "en" },
];

describe("ArchivedSection", () => {
  it.each(["en", "hi"] as const)(
    "in %s, keeps archived pages in a collapsed section with their badge, chapter and an open link",
    (locale) => {
      const t = tFor(locale);
      const html = render(locale, <ArchivedSection pages={ARCHIVED} t={t} />);

      const [details] = elements(html, "details");
      expect(details).not.toHaveProperty("open");
      expect(elements(html, "summary")[0]?.text).toBe(t("write.archived.summary", { count: 2 }));
      const badges = elements(html, "span").filter((span) => span.class?.includes("badge"));
      expect(badges.map((badge) => badge.text)).toEqual([catalogues[locale]["write.status.archived"], catalogues[locale]["write.status.archived"]]);
      expect(elements(html, "span").filter((span) => span.lang === "hi").map((span) => span.text)).toEqual(["पहला अध्याय"]);
      expect(elements(html, "a").map((link) => [link.href, link["aria-label"]])).toEqual([
        ["/write/pages/x1", t("write.action.openNamed", { title: "Old draft" })],
        ["/write/pages/x2", t("write.action.openNamed", { title: t("write.untitledPage") })],
      ]);
    },
  );

  it("offers no rename or move controls, since archived pages can't be edited", () => {
    const html = render("en", <ArchivedSection pages={ARCHIVED} t={tFor("en")} />);
    expect(elements(html, "button")).toEqual([]);
    expect(elements(html, "form")).toEqual([]);
  });

  it("renders nothing without archived pages", () => {
    expect(render("en", <ArchivedSection pages={[]} t={tFor("en")} />)).not.toContain("<details");
  });
});

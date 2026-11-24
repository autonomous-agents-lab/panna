import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { catalogues } from "@/i18n/catalogue";
import { I18nProvider } from "@/i18n/client";

import { elements, noop, render, tFor } from "./__fixtures__/render";
import { DashboardNotice, DashboardStatusProvider } from "./DashboardStatus";
import { NewChapterForm } from "./NewChapterForm";
import { RenameForm } from "./RenameForm";
import { TitleField } from "./TitleField";

/** Without the status provider, whose own regions would get in the way. */
const plain = (locale: "en" | "hi", node: ReactNode) =>
  renderToStaticMarkup(
    <I18nProvider locale={locale} messages={catalogues[locale]}>
      {node}
    </I18nProvider>,
  );

describe("TitleField (AC-4)", () => {
  it.each(["en", "hi"] as const)("in %s, shows an error tied to the labelled input", (locale) => {
    const t = tFor(locale);
    const error = t("write.error.titleTooLong", { max: 100 });
    const html = plain(locale, <TitleField id="f1" label={t("write.field.pageTitle")} defaultValue="Too long" error={error} />);

    expect(elements(html, "label")[0]).toMatchObject({ for: "f1", text: t("write.field.pageTitle") });
    expect(elements(html, "input")[0]).toMatchObject({
      id: "f1",
      name: "title",
      value: "Too long",
      "aria-invalid": "true",
      "aria-describedby": "f1-error",
    });
    expect(elements(html, "span").find((span) => span.id === "f1-error")).toMatchObject({ role: "alert", text: error });
  });

  it("without an error, is a plain labelled input that the browser won't block", () => {
    const html = plain("en", <TitleField id="f2" label="Chapter title" defaultValue="" />);
    const [input] = elements(html, "input");
    expect(input).not.toHaveProperty("aria-invalid");
    expect(input).not.toHaveProperty("aria-describedby");
    expect(input).not.toHaveProperty("required");
    expect(input).not.toHaveProperty("maxlength");
    expect(html).not.toContain('role="alert"');
  });
});

describe("NewChapterForm (AC-3)", () => {
  it.each(["en", "hi"] as const)("in %s, is a labelled title input with an Add chapter button", (locale) => {
    const t = catalogues[locale];
    const html = render(locale, <NewChapterForm action={noop} />);
    const [label] = elements(html, "label");
    const [input] = elements(html, "input");
    expect(label).toMatchObject({ text: t["write.newChapter.label"], for: input?.id });
    expect(input).toMatchObject({ name: "title", value: "" });
    expect(elements(html, "button")[0]).toMatchObject({ type: "submit", text: t["write.newChapter.submit"] });
  });
});

describe("RenameForm (AC-3, AC-5)", () => {
  it.each(["en", "hi"] as const)("in %s, starts as a Rename button named after the item", (locale) => {
    const t = tFor(locale);
    const html = render(
      locale,
      <RenameForm action={noop} idField="pageId" id="p1" title={null} displayTitle={t("write.untitledPage")} label="x" />,
    );
    expect(elements(html, "button")).toEqual([
      expect.objectContaining({
        type: "button",
        text: t("write.action.rename"),
        "aria-label": t("write.action.renameNamed", { title: t("write.untitledPage") }),
      }),
    ]);
  });
});

describe("DashboardNotice (AC-8)", () => {
  it.each(["en", "hi"] as const)("in %s, shows the failure inline with Retry and Dismiss, not as a dialog", (locale) => {
    const t = catalogues[locale];
    const html = plain(
      locale,
      <DashboardNotice message={t["write.error.saveFailed"]} onRetry={() => {}} onDismiss={() => {}} />,
    );
    expect(elements(html, "p").find((p) => p.role === "alert")?.text).toBe(t["write.error.saveFailed"]);
    expect(elements(html, "button").map((button) => [button.type, button.text])).toEqual([
      ["button", t["write.error.retry"]],
      ["button", t["write.error.dismiss"]],
    ]);
    expect(html).not.toMatch(/<dialog|role="dialog"|aria-modal/);
  });

  it("keeps an empty alert region without a failure, so a later one is announced", () => {
    const html = plain("en", <DashboardNotice onRetry={() => {}} onDismiss={() => {}} />);
    expect(html).toContain('<p role="alert"');
    expect(elements(html, "button")).toEqual([]);
  });
});

describe("DashboardStatusProvider (AC-5)", () => {
  it("renders its children between the failure notice and a polite status region", () => {
    const html = renderToStaticMarkup(
      <I18nProvider locale="en" messages={catalogues.en}>
        <DashboardStatusProvider>
          <p id="child">child</p>
        </DashboardStatusProvider>
      </I18nProvider>,
    );
    expect(html).toMatch(/role="alert".*id="child".*<p role="status" class="[^"]*">/);
  });
});

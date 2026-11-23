import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { PageSummary } from "@/contracts";
import { catalogues } from "@/i18n/catalogue";
import { I18nProvider } from "@/i18n/client";
import { createTranslator } from "@/i18n/translate";
import { IDLE, type DashboardAction } from "@/lib/writing/dashboard/action-state";

import type { ChapterListActions } from "../ChapterList";
import { DashboardStatusProvider } from "../DashboardStatus";

export type TestLocale = "en" | "hi";

export const tFor = (locale: TestLocale) => createTranslator(catalogues[locale]);

/** Static markup of `node` inside the providers the dashboard's client components need. */
export function render(locale: TestLocale, node: ReactNode): string {
  return renderToStaticMarkup(
    <I18nProvider locale={locale} messages={catalogues[locale]}>
      <DashboardStatusProvider>{node}</DashboardStatusProvider>
    </I18nProvider>,
  );
}

export const noop: DashboardAction = async () => IDLE;

export const NO_ACTIONS: ChapterListActions = {
  createPage: noop,
  renameChapter: noop,
  renamePage: noop,
  moveChapter: noop,
  movePage: noop,
};

export function summary(id: string, title: string | null, status: PageSummary["status"] = "draft"): PageSummary {
  return { id, chapter_id: "c", position: 0, title, status, language: "en", updated_at: "2026-11-23T10:00:00.000Z" };
}

export type Element = Record<string, string> & { text: string };

/** The attributes and leading text of each `<tag>` in static markup (there is no DOM here). */
export function elements(html: string, tag: string): Element[] {
  return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>([^<]*)`, "g"))].map(([, attributes = "", text = ""]) => ({
    ...Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value])),
    text,
  }));
}

/** Text with markup and the few entities React escapes removed. */
export function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

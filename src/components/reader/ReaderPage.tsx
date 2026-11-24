import type { ReaderPage as ReaderPageData } from "@/contracts";
import type { Locale, Translate } from "@/i18n";

import { RichText } from "./RichText";
import styles from "./ReaderPage.module.css";

interface ReaderPageProps {
  page: ReaderPageData;
  locale: Locale;
  t: Translate;
}

/** The calendar date in UTC, so every server shows the same day whatever its own time zone. */
function formatDate(timestamp: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(timestamp));
}

/** One published page. The article carries the page's own language; its footer is in the UI's. */
export function ReaderPage({ page, locale, t }: ReaderPageProps) {
  return (
    <article lang={page.language} className={styles.page}>
      <RichText body={page.body} />
      <footer lang={locale} className={styles.meta}>
        <time dateTime={page.published_at}>
          {t("reader.publishedOn", { date: formatDate(page.published_at, locale) })}
        </time>
      </footer>
    </article>
  );
}

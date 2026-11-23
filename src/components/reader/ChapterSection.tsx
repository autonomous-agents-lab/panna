import type { ReaderChapterSummary, ReaderPage as ReaderPageData } from "@/contracts";
import type { Locale, Translate } from "@/i18n";

import styles from "./ChapterSection.module.css";
import { ReaderPage } from "./ReaderPage";

interface ChapterSectionProps {
  chapter: ReaderChapterSummary;
  pages: readonly ReaderPageData[];
  locale: Locale;
  t: Translate;
}

/** A chapter heading and its pages, in the order given. */
export function ChapterSection({ chapter, pages, locale, t }: ChapterSectionProps) {
  const headingId = `chapter-${chapter.id}`;
  return (
    <section className={styles.chapter} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.title}>
        {chapter.title}
      </h2>
      {pages.map((page) => (
        <ReaderPage key={page.id} page={page} locale={locale} t={t} />
      ))}
    </section>
  );
}

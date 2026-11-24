import type { PublicBook } from "@/contracts/public-book";
import type { Locale, Translate } from "@/i18n";
import { initials } from "@/lib/profile/initials";

import styles from "./BookPlaceholder.module.css";

/**
 * A writer's book until the reader epic replaces it: the cover title, who wrote it and their bio.
 * The article is marked with the book's language; the app's own words keep the UI locale.
 */
export function BookPlaceholder({ book, locale, t }: { book: PublicBook; locale: Locale; t: Translate }) {
  return (
    <article lang={book.book.default_language} className={styles.book}>
      <header className={styles.cover}>
        <h1 className={styles.title}>{book.book.title}</h1>
        {book.book.subtitle && <p className={styles.subtitle}>{book.book.subtitle}</p>}
      </header>
      <div className={styles.writer}>
        {/* Decorative: the writer's name is right beside it. Photos arrive with avatar upload. */}
        <span aria-hidden="true" className={styles.initials}>
          {initials(book.display_name)}
        </span>
        <p lang={locale} className={styles.byline}>
          {t("book.byline", { name: book.display_name })}
        </p>
      </div>
      {book.bio && <p className={styles.bio}>{book.bio}</p>}
      <p lang={locale} className={styles.note}>
        {t("book.placeholder")}
      </p>
    </article>
  );
}

import Image from "next/image";
import Link from "next/link";

import type { ReaderBookInfo, ReaderWriter } from "@/contracts";
import type { Translate } from "@/i18n";

import styles from "./BookCover.module.css";

interface BookCoverProps {
  writer: ReaderWriter;
  book: ReaderBookInfo;
  t: Translate;
  /** When set, the title links back to the whole book (used on a single page's route). */
  bookHref?: string;
}

const PHOTO_SIZE = 64;

/**
 * The book's cover details as plain markup. The style and font are exposed as data attributes
 * for the reader stories that draw the cover and load the book's font.
 */
export function BookCover({ writer, book, t, bookHref }: BookCoverProps) {
  const writerName = writer.display_name;
  return (
    <header className={styles.cover} data-cover-style={book.cover_style} data-font={book.font}>
      <h1 className={styles.title}>{bookHref ? <Link href={bookHref}>{book.title}</Link> : book.title}</h1>
      {book.subtitle && <p className={styles.subtitle}>{book.subtitle}</p>}
      <div className={styles.writer}>
        {writer.photo_url && (
          <Image
            className={styles.photo}
            src={writer.photo_url}
            alt={t("reader.writerPhoto", { writerName })}
            width={PHOTO_SIZE}
            height={PHOTO_SIZE}
          />
        )}
        <div>
          <p className={styles.byline}>{t("reader.byline", { writerName })}</p>
          {writer.bio && <p className={styles.bio}>{writer.bio}</p>}
        </div>
      </div>
    </header>
  );
}

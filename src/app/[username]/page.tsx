import { notFound } from "next/navigation";

import { BookCover } from "@/components/reader/BookCover";
import { ChapterSection } from "@/components/reader/ChapterSection";
import { usernameSchema, type ReaderBook } from "@/contracts";
import { getTranslator } from "@/i18n/server";
import { notFoundMetadata, pageMetadata } from "@/lib/page-metadata";
import { loadPublishedBook } from "@/lib/reader/load";

import styles from "./page.module.css";

interface BookRouteProps {
  params: Promise<{ username: string }>;
}

/** The writer's published book, or null. A malformed username never reaches the source. */
async function findBook(params: BookRouteProps["params"]): Promise<ReaderBook | null> {
  const username = usernameSchema.safeParse((await params).username);
  return username.success ? loadPublishedBook(username.data) : null;
}

// Only the page calls notFound(). Thrown from here, Next sends a 404 whose HTML is an empty
// error shell, so the not-found text would need JavaScript to appear.
export async function generateMetadata({ params }: BookRouteProps) {
  const found = await findBook(params);
  if (!found) return notFoundMetadata();
  const { writer, book } = found;
  return pageMetadata({
    path: `/${writer.username}`,
    titleKey: "reader.documentTitle",
    titleValues: { bookTitle: book.title, writerName: writer.display_name },
  });
}

/** A writer's whole book as plain, server-rendered text. The interactive reader builds on this markup. */
export default async function BookRoute({ params }: BookRouteProps) {
  const [found, { locale, t }] = await Promise.all([findBook(params), getTranslator()]);
  if (!found) notFound();
  const { writer, book, chapters } = found;
  return (
    <div className={styles.book}>
      <BookCover writer={writer} book={book} t={t} />
      {chapters.length === 0 ? (
        <p className={styles.empty}>{t("reader.empty")}</p>
      ) : (
        chapters.map(({ pages, ...chapter }) => (
          <ChapterSection key={chapter.id} chapter={chapter} pages={pages} locale={locale} t={t} />
        ))
      )}
    </div>
  );
}

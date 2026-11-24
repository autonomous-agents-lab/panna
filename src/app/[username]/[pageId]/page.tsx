import { notFound } from "next/navigation";
import { z } from "zod";

import { BookCover } from "@/components/reader/BookCover";
import { ChapterSection } from "@/components/reader/ChapterSection";
import { usernameSchema, type ReaderPageView } from "@/contracts";
import { getTranslator } from "@/i18n/server";
import { notFoundMetadata, pageMetadata } from "@/lib/page-metadata";
import { loadPublishedPage } from "@/lib/reader/load";

import styles from "../page.module.css";

interface PageRouteProps {
  params: Promise<{ username: string; pageId: string }>;
}

const pageIdSchema = z.uuid();

/** One published page of the writer's book, or null. Malformed params never reach the source. */
async function findPage(params: PageRouteProps["params"]): Promise<ReaderPageView | null> {
  const { username, pageId } = await params;
  const parsedUsername = usernameSchema.safeParse(username);
  const parsedPageId = pageIdSchema.safeParse(pageId);
  return parsedUsername.success && parsedPageId.success
    ? loadPublishedPage(parsedUsername.data, parsedPageId.data)
    : null;
}

// Only the page calls notFound(); see the book route for why metadata doesn't.
export async function generateMetadata({ params }: PageRouteProps) {
  const found = await findPage(params);
  if (!found) return notFoundMetadata();
  const { writer, book, chapter, page } = found;
  return pageMetadata({
    path: `/${writer.username}/${page.id}`,
    titleKey: "reader.pageDocumentTitle",
    titleValues: { chapterTitle: chapter.title, bookTitle: book.title, writerName: writer.display_name },
  });
}

/** A single published page at its own stable URL, as plain, server-rendered text. */
export default async function PageRoute({ params }: PageRouteProps) {
  const [found, { locale, t }] = await Promise.all([findPage(params), getTranslator()]);
  if (!found) notFound();
  const { writer, book, chapter, page } = found;
  return (
    <div className={styles.book}>
      <BookCover writer={writer} book={book} t={t} bookHref={`/${writer.username}`} />
      <ChapterSection chapter={chapter} pages={[page]} locale={locale} t={t} />
    </div>
  );
}

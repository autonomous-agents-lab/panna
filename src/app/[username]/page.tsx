import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import { BookPlaceholder } from "@/components/book/BookPlaceholder";
import { config } from "@/config";
import type { PublicBook } from "@/contracts/public-book";
import { USERNAME_INPUT_CHARACTERS, USERNAME_PATTERN } from "@/contracts/username";
import { getTranslator } from "@/i18n/server";
import { getPublicBook } from "@/lib/books/public-book";
import { bookJsonLd } from "@/lib/books/structured-data";
import { buildMetadata } from "@/lib/metadata";

type BookPageProps = { params: Promise<{ username: string }> };

// Metadata and the page both ask; one query per request.
const findBook = cache(getPublicBook);

/**
 * The book for a /<username> param. Anything that can't be a username is a 404 without a query; a
 * mixed-case one is redirected (308) to its lowercase canonical URL before the lookup.
 * There is no loading.tsx here, so notFound() runs before streaming and the status is a real 404.
 */
async function bookFor(params: BookPageProps["params"]): Promise<PublicBook> {
  const { username } = await params;
  const lower = username.toLowerCase();
  if (!USERNAME_INPUT_CHARACTERS.test(username) || !USERNAME_PATTERN.test(lower)) notFound();
  if (username !== lower) permanentRedirect(`/${lower}`);
  const book = await findBook(lower);
  if (!book) notFound();
  return book;
}

export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
  const [book, { t }] = await Promise.all([bookFor(params), getTranslator()]);
  const name = book.display_name;
  return buildMetadata({
    appName: config.appName,
    siteUrl: config.siteUrl,
    title: t("book.metaTitle", { title: book.book.title, name }),
    description: book.bio || t("book.metaDescription", { name, appName: config.appName }),
    locale: book.book.default_language,
    path: `/${book.username}`,
  });
}

/** A writer's book. A placeholder until the reader epic replaces it. */
export default async function BookPage({ params }: BookPageProps) {
  const [book, { locale, t }] = await Promise.all([bookFor(params), getTranslator()]);
  const url = new URL(`/${book.username}`, config.siteUrl).href;
  return (
    <>
      <BookPlaceholder book={book} locale={locale} t={t} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: bookJsonLd(book, url) }} />
    </>
  );
}

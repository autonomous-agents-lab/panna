import "server-only";

import { cache } from "react";

import { getBookSource } from "./source";

// Cached per request, so a route's metadata and its page share one lookup.

export const loadPublishedBook = cache((username: string) => getBookSource().getPublishedBook(username));

export const loadPublishedPage = cache((username: string, pageId: string) =>
  getBookSource().getPublishedPage(username, pageId),
);

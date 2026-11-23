/** Why the sanitiser rejected a page body. Listed in docs/content-format.md. */
export const PAGE_BODY_ERROR_CODES = [
  "page_body_not_a_document",
  "page_body_too_deep",
  "page_body_too_large",
  "page_body_image_src_not_allowed",
  "page_body_image_alt_missing",
  "page_body_image_alt_too_long",
] as const;

export type PageBodyErrorCode = (typeof PAGE_BODY_ERROR_CODES)[number];

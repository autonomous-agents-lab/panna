import { IMAGE_SRC_MAX_LENGTH, PAGE_IMAGES_BUCKET } from "@/config/content";

export interface PageBodyOptions {
  /** The Supabase project URL (NEXT_PUBLIC_SUPABASE_URL). Images must be served from its origin. */
  storageUrl: string;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Public object path in the page-images bucket. Segments can't start with a dot, so no `.` or `..`. */
const IMAGE_PATH = new RegExp(
  `^/storage/v1/object/public/${escapeRegExp(PAGE_IMAGES_BUCKET)}(?:/[A-Za-z0-9_-][A-Za-z0-9._-]*)+$`,
);

/**
 * Whether `src` is a public URL of an object in our page-images bucket. It must already be in the
 * form the URL parser would produce (so nothing is hidden by normalisation), use http or https,
 * have the storage URL's origin, and carry no credentials, query or fragment.
 */
export function isAllowedImageSrc(src: string, { storageUrl }: PageBodyOptions): boolean {
  if (src.length > IMAGE_SRC_MAX_LENGTH) return false;
  const url = URL.parse(src);
  if (url === null || (url.protocol !== "https:" && url.protocol !== "http:")) return false;
  return (
    url.origin === new URL(storageUrl).origin && src === url.origin + url.pathname && IMAGE_PATH.test(url.pathname)
  );
}

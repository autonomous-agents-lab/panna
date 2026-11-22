import type { Locale } from "./locales";
import { en } from "./messages/en";
import { hi } from "./messages/hi";
import { createTranslator, type Translate } from "./translate";

export type MessageKey = keyof typeof en;
export type Catalogue = Record<MessageKey, string>;

export const catalogues: Record<Locale, Catalogue> = { en, hi };

/** `t` for a fixed locale, for output that isn't tied to a request (e.g. the web manifest). */
export function translatorFor(locale: Locale): Translate {
  return createTranslator(catalogues[locale]);
}

/** A language's own name, written in that language (e.g. "हिन्दी"), for the locale switch. */
export function endonymOf(locale: Locale): string {
  return catalogues[locale]["localeSwitch.endonym"];
}

export interface CatalogueDifferences {
  /** Keys in the reference catalogue that the other one lacks. */
  missing: string[];
  /** Keys in the other catalogue that the reference one lacks. */
  extra: string[];
  /** Keys whose value is empty or whitespace, in either catalogue. */
  empty: string[];
}

export function compareCatalogues(
  reference: Record<string, string>,
  other: Record<string, string>,
): CatalogueDifferences {
  const referenceKeys = Object.keys(reference);
  const otherKeys = Object.keys(other);
  const isBlank = (value: string | undefined) => value === undefined || value.trim() === "";
  return {
    missing: referenceKeys.filter((key) => !Object.hasOwn(other, key)),
    extra: otherKeys.filter((key) => !Object.hasOwn(reference, key)),
    empty: [...new Set([...referenceKeys, ...otherKeys])].filter(
      (key) =>
        (Object.hasOwn(reference, key) && isBlank(reference[key])) ||
        (Object.hasOwn(other, key) && isBlank(other[key])),
    ),
  };
}

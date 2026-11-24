const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** The first user-perceived character of a non-empty word. */
function firstGrapheme(word: string): string {
  return graphemes.segment(word).containing(0)!.segment;
}

/**
 * Up to two initials for an avatar placeholder: the first and last words' first characters.
 * Characters are graphemes, so a Devanagari letter keeps its vowel sign or conjunct ("श्री" → "श्री").
 */
export function initials(displayName: string): string {
  const words = displayName.trim().split(/\s+/u).filter(Boolean);
  const picked = words.length > 1 ? [words[0]!, words.at(-1)!] : words;
  return picked.map(firstGrapheme).join("").toLocaleUpperCase();
}

// Sample books for the in-memory stand-in. The reader serves these until it switches to
// Supabase (story 8), which removes them from the live path and keeps them for tests only.
// The usernames are reserved (src/config/usernames.ts), so no real writer can claim them, and
// every word here is obviously sample text about no real person.

import type { Book, Chapter, Page, Profile, RichTextBlock, RichTextDoc } from "@/contracts";

import { bookStoreSchema, type BookStore } from "./project";

export const SAMPLE_USERNAMES = {
  bilingual: "sample_writer_bilingual",
  empty: "sample_writer_empty",
  drafts: "sample_writer_drafts",
} as const;

/** Ids of the sample rows, as uuids, so tests and e2e can request them. */
export const SAMPLE_IDS = {
  bilingual: {
    profile: "5a000000-0000-4000-8000-000000000001",
    book: "5b000000-0000-4000-8000-000000000001",
    chapters: {
      morning: "5c000000-0000-4000-8000-000000000101",
      rain: "5c000000-0000-4000-8000-000000000102",
      evening: "5c000000-0000-4000-8000-000000000103",
    },
    pages: {
      morningHindi: "5d000000-0000-4000-8000-000000000101",
      morningEnglish: "5d000000-0000-4000-8000-000000000102",
      rainEnglish: "5d000000-0000-4000-8000-000000000103",
      eveningHindi: "5d000000-0000-4000-8000-000000000104",
      eveningEnglish: "5d000000-0000-4000-8000-000000000105",
    },
  },
  empty: {
    profile: "5a000000-0000-4000-8000-000000000002",
    book: "5b000000-0000-4000-8000-000000000002",
    chapter: "5c000000-0000-4000-8000-000000000201",
  },
  drafts: {
    profile: "5a000000-0000-4000-8000-000000000003",
    book: "5b000000-0000-4000-8000-000000000003",
    chapters: {
      live: "5c000000-0000-4000-8000-000000000301",
      archived: "5c000000-0000-4000-8000-000000000302",
    },
    pages: {
      published: "5d000000-0000-4000-8000-000000000301",
      draft: "5d000000-0000-4000-8000-000000000302",
      unpublished: "5d000000-0000-4000-8000-000000000303",
      archived: "5d000000-0000-4000-8000-000000000304",
      inArchivedChapter: "5d000000-0000-4000-8000-000000000305",
    },
  },
} as const;

/** Text that must never reach a reader, one phrase per way a page can be hidden. */
export const HIDDEN_MARKERS = {
  draft: "Sample draft text that is not published yet.",
  unpublished: "Sample text the writer unpublished after publishing.",
  archived: "Sample text from a page the writer archived.",
  inArchivedChapter: "Sample text from a chapter the writer archived.",
} as const;

const at = (day: number) => `2026-11-${String(day).padStart(2, "0")}T09:00:00+00:00`;

const paragraph = (text: string): RichTextBlock => ({ type: "paragraph", content: [{ type: "text", text }] });

const doc = (...blocks: (string | RichTextBlock)[]): RichTextDoc => ({
  type: "doc",
  content: blocks.map((block) => (typeof block === "string" ? paragraph(block) : block)),
});

function profile(id: string, username: string, display_name: string, bio: string | null): Profile {
  return {
    id,
    username,
    display_name,
    avatar_path: null,
    bio,
    preferred_language: "en",
    username_changed_at: null,
    created_at: at(1),
    updated_at: at(1),
    deactivated_at: null,
  };
}

function book(fields: Pick<Book, "id" | "owner_id" | "title" | "subtitle" | "default_language">): Book {
  return { cover_style: "classic", font: "kalam", created_at: at(1), updated_at: at(1), ...fields };
}

function chapter(fields: Pick<Chapter, "id" | "book_id" | "title" | "position"> & Partial<Chapter>): Chapter {
  return { created_at: at(2), updated_at: at(2), archived_at: null, ...fields };
}

function page(
  fields: Pick<Page, "id" | "chapter_id" | "language" | "content" | "position"> & Partial<Page>,
): Page {
  return {
    title: null,
    status: "published",
    published_at: at(10),
    created_at: at(3),
    updated_at: at(10),
    archived_at: null,
    ...fields,
  };
}

const bilingual = SAMPLE_IDS.bilingual;
const empty = SAMPLE_IDS.empty;
const drafts = SAMPLE_IDS.drafts;

// Rows are listed out of reading order on purpose: the reader must sort by position.
const store = {
  profiles: [
    profile(
      bilingual.profile,
      SAMPLE_USERNAMES.bilingual,
      "Sample Writer",
      "A sample writer who keeps a notebook in Hindi and English. Not a real person.",
    ),
    profile(empty.profile, SAMPLE_USERNAMES.empty, "Sample Beginner", "A sample writer who hasn’t published yet."),
    profile(drafts.profile, SAMPLE_USERNAMES.drafts, "Sample Drafter", null),
  ],
  books: [
    book({
      id: bilingual.book,
      owner_id: bilingual.profile,
      title: "नमूने की डायरी",
      subtitle: "A sample notebook in two languages",
      default_language: "hi",
    }),
    book({ id: empty.book, owner_id: empty.profile, title: "An Empty Sample Book", subtitle: null, default_language: "en" }),
    book({ id: drafts.book, owner_id: drafts.profile, title: "A Sample Book of Drafts", subtitle: null, default_language: "en" }),
  ],
  chapters: [
    chapter({ id: bilingual.chapters.evening, book_id: bilingual.book, title: "शाम / Evening", position: 2 }),
    chapter({ id: bilingual.chapters.morning, book_id: bilingual.book, title: "सुबह / Morning", position: 0 }),
    chapter({ id: bilingual.chapters.rain, book_id: bilingual.book, title: "बारिश / Rain", position: 1 }),
    chapter({ id: empty.chapter, book_id: empty.book, title: "A chapter with nothing in it yet", position: 0 }),
    chapter({ id: drafts.chapters.live, book_id: drafts.book, title: "Sample chapter", position: 0 }),
    chapter({
      id: drafts.chapters.archived,
      book_id: drafts.book,
      title: "Sample archived chapter",
      position: 1,
      archived_at: at(12),
    }),
  ],
  pages: [
    page({
      id: bilingual.pages.morningEnglish,
      chapter_id: bilingual.chapters.morning,
      language: "en",
      position: 1,
      title: "A sample morning",
      content: doc(
        "This is sample text, written to show how a page reads. The kettle starts to hum before the sun is fully up, and the street below is still quiet enough to hear a bicycle bell two lanes away.",
        "Mornings in this sample notebook are slow on purpose. A cup of tea, a window, and a page that does not need to be finished today. Nothing here is about anyone real; it is only here so the reader has something to show.",
        "By the time the milk van passes, the page is half full. The rest can wait for the evening chapter.",
      ),
    }),
    page({
      id: bilingual.pages.morningHindi,
      chapter_id: bilingual.chapters.morning,
      language: "hi",
      position: 0,
      title: "नमूने की सुबह",
      content: doc(
        "यह नमूने का पाठ है, जो यह दिखाने के लिए लिखा गया है कि एक पन्ना कैसे पढ़ा जाता है। सूरज पूरी तरह निकलने से पहले ही केतली गुनगुनाने लगती है, और नीचे की गली इतनी शांत होती है कि दो गली दूर की साइकिल की घंटी भी सुनाई देती है।",
        "इस नमूने की डायरी में सुबहें जान-बूझकर धीमी हैं। एक कप चाय, एक खिड़की, और एक पन्ना जिसे आज ही पूरा करना ज़रूरी नहीं। इसमें किसी असली व्यक्ति की बात नहीं है।",
        "जब तक दूध वाली गाड़ी गुज़रती है, पन्ना आधा भर चुका होता है। बाक़ी शाम के अध्याय के लिए रहने दीजिए।",
      ),
    }),
    page({
      id: bilingual.pages.eveningEnglish,
      chapter_id: bilingual.chapters.evening,
      language: "en",
      position: 1,
      content: doc(
        "Sample evening text in English. The lamps come on one by one, and the notebook is open again on the same table.",
        "Some days the page fills itself. Other days a single line is enough, and that is a page too.",
      ),
    }),
    page({
      id: bilingual.pages.eveningHindi,
      chapter_id: bilingual.chapters.evening,
      language: "hi",
      position: 0,
      content: doc(
        "हिन्दी में नमूने की शाम। एक-एक करके बत्तियाँ जलती हैं, और डायरी फिर उसी मेज़ पर खुली है।",
        "कुछ दिन पन्ना अपने आप भर जाता है। कुछ दिन एक पंक्ति ही काफ़ी होती है, और वह भी एक पन्ना है।",
      ),
    }),
    page({
      id: bilingual.pages.rainEnglish,
      chapter_id: bilingual.chapters.rain,
      language: "en",
      position: 0,
      title: "Sample notes on rain",
      content: doc(
        {
          type: "paragraph",
          content: [
            { type: "text", text: "The first rain of the season is " },
            { type: "text", text: "always", marks: [{ type: "italic" }] },
            { type: "text", text: " louder than expected." },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "What the sample rain sounds like" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "On a tin roof: " },
            { type: "text", text: "drums", marks: [{ type: "bold" }] },
            { type: "text", text: "." },
            { type: "hard_break" },
            { type: "text", text: "On leaves: a long, soft hush." },
          ],
        },
        { type: "blockquote", content: [paragraph("A sample line worth quoting: the rain does not hurry, so neither should the page.")] },
        "This page exists to show headings, emphasis, line breaks and quotes in the sample book.",
      ),
    }),
    page({
      id: drafts.pages.archived,
      chapter_id: drafts.chapters.live,
      language: "en",
      position: 2,
      archived_at: at(11),
      content: doc(HIDDEN_MARKERS.archived),
    }),
    page({
      id: drafts.pages.draft,
      chapter_id: drafts.chapters.live,
      language: "en",
      position: 1,
      status: "draft",
      published_at: null,
      content: doc(HIDDEN_MARKERS.draft),
    }),
    page({
      id: drafts.pages.published,
      chapter_id: drafts.chapters.live,
      language: "en",
      position: 0,
      content: doc("Sample published text from a book that also has drafts."),
    }),
    page({
      id: drafts.pages.unpublished,
      chapter_id: drafts.chapters.live,
      language: "en",
      position: 3,
      status: "draft",
      content: doc(HIDDEN_MARKERS.unpublished),
    }),
    page({
      id: drafts.pages.inArchivedChapter,
      chapter_id: drafts.chapters.archived,
      language: "en",
      position: 0,
      content: doc(HIDDEN_MARKERS.inArchivedChapter),
    }),
  ],
} satisfies BookStore;

/** The sample rows, checked against the row contracts. */
export const sampleBookStore: BookStore = bookStoreSchema.parse(store);

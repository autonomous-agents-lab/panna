# Panna: product brief

Working name **Panna** (पन्ना, "page"). The name is not final: it must come from configuration (`NEXT_PUBLIC_APP_NAME`, default "Panna") everywhere it appears, including metadata, emails, share images and the manifest. Nothing hard-codes it.

## Vision

A digital book for everyone. Every person who signs up gets their own book and writes their thoughts in it, page by page, in Hindi, English or both. Readers open someone's book and turn its pages like a real notebook: paper that folds under your finger, a soft page-turn sound, warm aged paper with handwriting-style lettering. People follow writers, react to pages, leave a thought on any page and review whole books.

The reading experience is the product. It should feel like holding a real copy, and nothing like a blog feed.

## Who it's for

- **Writers**: anyone with thoughts, poems, diaries or stories, often bilingual, who wants them to feel like a book and not like posts.
- **Readers**: people who follow writers they like and read slowly, a page at a time.
- Every user is both. There is no special admin who writes; all accounts are equal.

## Core experience

### The book page (public, the heart of the product)
- A writer's book is at `/<username>`. It opens on a **closed book in the centre of the screen**. Its cover shows the book title, the writer's name, photo and short bio, and a cover style the writer chose.
- Tapping or swiping opens the cover with a 3D animation.
- **Turning pages is swipe/drag only, a real 3D paper fold**: the page curls and bends with the finger, follows the drag, and settles or springs back depending on how far it went. Keyboard arrows and on-screen arrows are the accessible equivalent. No instant slide or fade transitions.
- **A page-turn sound** plays on each turn (subtle, can be muted, remembered per reader, off when the OS asks for reduced motion).
- **Paper looks real**: warm off-white or aged tone, subtle texture and grain, soft edge shading and a centre-gutter shadow on spreads, ink-like text. Not flat white.
- **Desktop shows two-page spreads; phones show one page.** Long writing is paginated into pages that fit the page size; pages re-flow on resize without losing the reader's place.
- **Typography**: Hindi (Devanagari) and English, each with several fonts, including handwriting-style ones (for example Kalam, Amita, Sahitya, Laila for Devanagari; Caveat, Homemade Apple, Kalam for Latin). The writer picks the book's font; readers can switch to a plain readable font. Fonts are free for commercial use (OFL) and loaded efficiently.
- A **contents page** lists chapters and jumps to them. The reader's last page is remembered.
- **Hanging comments**: every page has a small tab hanging from its edge showing the comment count. Expanding it opens that page's thread beside or under the page, without leaving the book. Signed-in readers can add a thought and reply.
- **Reactions** on each page (a like at minimum), visible as counts.

### Writing
- Each user has exactly one book (title, subtitle, cover style, font, language default).
- Writers create chapters and pages, with drafts and publishing. Only published pages are visible to others.
- A focused editor for Hindi and English: basic formatting (bold, italic, headings, quotes, line breaks), with a live preview of how the page will look in the book.
- Images on pages (uploaded to storage, resized, with alt text).
- Writers can edit, unpublish or archive their own pages (soft delete; nothing is hard-deleted from the product's data).

### Community
- Follow and unfollow writers; a **following feed** of newly published pages.
- **Book reviews**: a rating and a short review on a whole book, one per reader per book.
- In-app notifications: new follower, new comment or reply on your page, new review, new page from someone you follow. **Optional email notifications** per type, off by default.
- Safety basics: report a page, comment or user; block a user; writers can hide comments on their own pages.

### Sharing
- Any single page can be shared as an **image**: an Instagram story (9:16) or a post (1:1), rendered in the book's style with the writer's name and a link back.
- On phones, use the native share sheet so the image goes straight to Instagram, WhatsApp and others. On desktop, download the image, and share links for X and Facebook. Every page has its own shareable URL with a rich preview card.

### Accounts and profiles
- Sign up and sign in with email (magic link) and Google, via Supabase Auth.
- Profile: unique username (the book's URL), display name, photo, short bio, preferred language.

### Discovery and SEO
- Book and page URLs are server-rendered so search engines read the text. Each has a proper title, description, canonical URL, Open Graph and Twitter cards, and `lang` (`hi`/`en`) set right.
- Sitemap and robots.txt; structured data (Book/CreativeWork, Person).
- A simple home page: what Panna is, featured and recent books, sign-up.
- Fast: good Core Web Vitals on a mid-range phone over 4G. Privacy-friendly analytics.

## Technical direction
- **Next.js (App Router) + TypeScript (strict)**, deployed on **Vercel**. Preview deploys for every PR; production deploys from `main`.
- **Supabase**: Postgres, Auth, Storage. Schema changes are versioned SQL migrations in the repo. Row Level Security on every table. Developers and tests run against **local Supabase (Docker)**; the hosted project is only reached through Vercel's environment variables.
- Page-turn animation with CSS 3D transforms or WebGL (three.js) if needed for the paper curl; it must hold 60fps on mid-range phones and degrade gracefully.
- Tests: unit (Vitest) for logic, component tests where useful, and end-to-end (Playwright) for the reading, writing and sharing flows, including swipe gestures and screenshots.
- CI on GitHub Actions: typecheck, lint, unit tests, e2e on the preview.
- Accessibility: keyboard navigation, focus states, screen-reader labels, reduced-motion support, colour contrast on the paper tones.
- Bilingual UI (Hindi and English) for all app chrome, selectable by the user.

## Non-negotiables
- No secrets in the repo. Only the Supabase **anon** key is ever in client code; the service-role key is never given to anyone or anything except Vercel's server environment.
- Nothing in the product hard-deletes user content; deletion means archive/soft delete.
- Every story ships with tests for its acceptance criteria.

## Later (out of scope now, don't build)
- **UI enhancement epic**: a visual polish pass based on inspiration links the owner will share. For now, build clean, solid, good-looking defaults.
- Custom domain purchase and setup (the app must be ready for it).
- Native mobile apps, payments, monetisation, AI writing features.

## Suggested epics, in order
1. Foundation and delivery pipeline (project setup, configurable branding, CI, Vercel, local Supabase, CLAUDE.md conventions).
2. Accounts, profiles and the book model.
3. The book reader (closed cover, opening, 3D page turns with sound, paper, fonts, pagination, contents, resume).
4. Writing (editor, chapters, drafts and publishing, images).
5. Community (follow, feed, hanging page comments, reactions, reviews, notifications, safety basics).
6. Sharing (page images for stories and posts, share sheet, links, preview cards).
7. Discovery, SEO, performance and launch readiness.

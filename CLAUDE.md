# CLAUDE.md: how we build Panna

Read `docs/product-brief.md` first. It's the source of truth for what we're building and why.

## Stack
- Next.js (App Router) + TypeScript `strict`. Node 22.
- Supabase (Postgres, Auth, Storage) via `@supabase/ssr`. Local Supabase in Docker (`npx supabase start`) for development and tests.
- Vitest for unit/component tests, Playwright for end-to-end. GitHub Actions CI. Netlify hosting (keep app code host-agnostic).

## Commands (keep these working; agents and CI rely on them)
- `npm run dev`: local app
- `npm test`: typecheck + lint + unit tests (must pass before every commit)
- `npm run test:e2e`: Playwright, starts the app itself
- `npm run build`: production build

## Principles
- **SOLID, small units.** Components render; hooks and `lib/` hold logic. One responsibility per module. Pure functions for anything non-trivial, so it can be unit-tested.
- **Server first.** Fetch on the server (Server Components, Route Handlers, Server Actions). Client components only where interaction needs them (the book reader, the editor).
- **Configuration, not constants.** App name, URLs, feature flags and limits come from `src/config` (reading env). Never hard-code "Panna".
- **Design tokens.** Colours, paper tones, spacing, radii and fonts live in one theme file. No raw hex in components.
- **Accessibility is part of done:** keyboard, focus, labels, reduced motion, contrast.
- **SEO is part of done** for public pages: metadata, canonical, OG/Twitter, `lang`, structured data.
- **Performance:** no heavy libraries without need; lazy-load the reader's 3D/sound assets; images through `next/image`.
- **Bilingual:** all UI strings go through the i18n layer (Hindi and English). Devanagari text uses Devanagari fonts.

## Data and security
- Every table has Row Level Security. Policies are written and tested with the migration that adds the table.
- Schema changes only as new SQL migrations in `supabase/migrations`. Never edit an applied migration. Migrations only add or change; they never drop user data.
- User content is never hard-deleted: use `archived_at`/`deleted_at`.
- Only the anon key in client code. Never commit secrets; `.env.local` is git-ignored and `.env.example` documents every variable.
- Validate all input at the boundary (zod) and never trust the client.

## Tests
- Every acceptance criterion has a test that would fail without the change.
- Unit-test logic at full branch coverage. E2E for user flows (reading, writing, sharing), including swipe gestures.
- Don't weaken, skip or delete a test to make it pass.

## Git
- One story per branch, named `KEY-123-short-slug`. Commit messages start with the key and say why.
- Never push to `main` directly; everything goes through a reviewed PR.

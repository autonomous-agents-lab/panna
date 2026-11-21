# Panna (working name)

A digital book for everyone: write your thoughts in Hindi or English, page by page, and let readers turn your pages like a real notebook.

See `docs/product-brief.md` for the product and `CLAUDE.md` for how it's built. The app name is configurable (`NEXT_PUBLIC_APP_NAME`).

## Quick start

You need Node 22. The repo pins it in `.nvmrc` and `package.json` `engines`; on another version, run `nvm use` first.

```sh
nvm use                         # switch to Node 22 (or install it: nvm install)
npm ci                          # install the locked dependencies
cp .env.example .env.local      # local settings; edit .env.local if you need to
npm run dev                     # open http://localhost:3000
```

Every variable in `.env.example` has a working default, so the app also runs without `.env.local`. An invalid value stops the app with an error naming the variable.

Before running the end-to-end tests for the first time, install the browser Playwright uses:

```sh
npx playwright install chromium
```

## Commands

| Command            | What it does                                                         |
| ------------------ | -------------------------------------------------------------------- |
| `npm run dev`      | Start the app locally at http://localhost:3000                       |
| `npm test`         | Typecheck (`tsc --noEmit`), lint (ESLint), then unit tests (Vitest)  |
| `npm run test:e2e` | Playwright end-to-end tests; starts the app itself on port 3100 (`E2E_PORT` to change) |
| `npm run build`    | Production build                                                     |
| `npm run start`    | Serve the production build                                           |

## Configuration

App-wide values (app name, site URL, feature flags, limits) come only from `src/config`, which reads and validates the environment. The app name comes from `NEXT_PUBLIC_APP_NAME`; `npm test` fails if the name is written anywhere else under `src/`.

## Languages (Hindi and English)

All UI text comes from the catalogues in `src/i18n/messages/` (`en.ts` and `hi.ts`). To add a string, add the same key to both catalogues, then use it through `getTranslator()` from `@/i18n/server` in Server Components or `useTranslator()` from `@/i18n/client` in Client Components. Use `{name}` placeholders for values, e.g. `t("shell.homeLink", { appName: config.appName })`.

`npm test` fails if a key is in one catalogue but not the other, if a value is empty, or if a component in `src/app` or `src/components` writes UI text (or an `aria-label`, `alt`, `title` or `placeholder`) directly instead of through `t()`.

The language comes from the `locale` cookie set by the switch in the header; without it, from the browser's `Accept-Language`; otherwise English. URLs never carry a locale.

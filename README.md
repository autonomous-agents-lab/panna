# Panna (working name)

A digital book for everyone: write your thoughts in Hindi or English, page by page, and let readers turn your pages like a real notebook.

See `docs/product-brief.md` for the product, `docs/content-format.md` for the page body format, and `CLAUDE.md` for how it's built. The app name is configurable (`NEXT_PUBLIC_APP_NAME`).

## Quick start

You need Node 22. The repo pins it in `.nvmrc` and `package.json` `engines`; on another version, run `nvm use` first.

```sh
nvm use                         # switch to Node 22 (or install it: nvm install)
npm ci                          # install the locked dependencies
cp .env.example .env.local      # local settings; edit .env.local if you need to
npm run dev                     # open http://localhost:3000
```

The `optionalDependencies` in `package.json` pin the native bindings of `rolldown` and `lightningcss` (used by Vite/Vitest) for Linux x64 (glibc) and macOS. Without them, a lockfile written on one platform can leave out every binding, and `npm ci` breaks elsewhere ([npm/cli#4828](https://github.com/npm/cli/issues/4828)). When you bump Vitest or Vite, set these pins to the new `rolldown` and `lightningcss` versions. `tests/repo/lockfile.test.ts` fails until you do.

The app settings in `.env.example` have working defaults, so the shell also runs without `.env.local`. An invalid value stops the app with an error naming the variable. The Supabase variables have no defaults; set them as described in [Local Supabase](#local-supabase).

Before running the end-to-end tests for the first time, install the browser Playwright uses:

```sh
npx playwright install chromium
```

## Commands

| Command            | What it does                                                         |
| ------------------ | -------------------------------------------------------------------- |
| `npm run dev`      | Start the app locally at http://localhost:3000                       |
| `npm test`         | Typecheck (`tsc --noEmit`), lint (ESLint), then unit tests (Vitest)  |
| `npm run test:coverage` | Unit tests with coverage; fails below the thresholds in `vitest.config.ts` (100% for the page body sanitiser and renderer) |
| `npm run test:e2e` | Playwright end-to-end tests, including axe accessibility checks; builds and starts the production app itself on port 3100 (`E2E_PORT` to change; `E2E_STAND_IN_WRITING=false` serves /write as a deploy does, a 404) |
| `npm run build`    | Production build                                                     |
| `npm run start`    | Serve the production build                                           |
| `npm run test:db`  | pgTAP policy tests in `supabase/tests` against the local Supabase stack |
| `npm run test:build` | Production build, then checks the client bundles reference only the public Supabase variables |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` from the local database |
| `npm run auth:emails` | Regenerate the Supabase Auth email templates and subjects from `NEXT_PUBLIC_APP_NAME` (see [Auth locally](#auth-locally)) |

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request to `main` and every push to `main`. Each check is its own job, so it shows as its own status check, and they run in parallel:

| Check       | What it runs |
| ----------- | ------------ |
| `typecheck` | `npx next typegen`, then `npm run typecheck` |
| `lint`      | `npm run lint` |
| `unit`      | `npm run test:coverage`: the unit tests with coverage, failing below the thresholds in `vitest.config.ts` |
| `build`     | `npm run test:build` (production build plus the client-bundle check) |
| `e2e`       | Starts a local Supabase (Postgres, Auth, API and Mailpit), points the app at it, then `npm run test:e2e`, with the Playwright browser cached per Playwright version |
| `db`        | Starts a fresh local Supabase, `supabase db reset --local` (every migration, then the seed), then `npm run test:db` |
| `secrets`   | gitleaks over the PR's commits (or the pushed commits on `main`), using `.gitleaks.toml` |
| `preview`   | Pull requests only: waits for the PR's Netlify Deploy Preview to serve the PR's head commit (see [Deployment](#deployment)) |
| `e2e-preview` | Pull requests only, after `preview`: `npm run test:e2e` against the Deploy Preview |
| `production` | Pushes to `main` only: waits for production to serve the merged commit, then checks `/` and `/api/health` answer 200 |

Together `typecheck`, `lint` and `unit` are what `npm test` runs locally. The jobs use no repository secrets and the token is read-only, so pull requests from forks run the same way.

**If `secrets` fails**, its log names the rule, the file, the line and the commit; the value itself is redacted. Treat the secret as leaked: rotate it first, then remove it from the branch history (rewrite the commits that added it) before the PR can merge. Deleting it in a new commit is not enough, because the scan covers every commit in the PR.

## Deployment

The app is hosted on Netlify (site `panna-book`, production at https://panna-book.netlify.app). `netlify.toml` builds it on Node 22 with the Next.js runtime (`@netlify/plugin-nextjs`, pinned in `devDependencies`). App code stays host-agnostic: `netlify.toml` maps Netlify's own variables onto ours (its commit SHA onto `APP_VERSION`, its production URL onto `NEXT_PUBLIC_SITE_URL` unless that is set in Netlify), and `npm test` fails if anything under `src/` imports a host package or reads a host variable.

The flow for every change:

1. **Open a pull request.** Netlify builds a Deploy Preview at `https://deploy-preview-<PR number>--panna-book.netlify.app` and posts its URL on the PR.
2. **CI tests the preview.** The `preview` job polls the preview's `/api/health` until it reports the PR's head commit, then `e2e-preview` runs the whole Playwright suite, axe checks included, against it with `PLAYWRIGHT_BASE_URL` set to the preview URL. Tests that need the `/test-only/*` routes are tagged `@test-routes` and only run in the local `e2e` job, because those routes are never turned on in a deploy. Tests that need Supabase (the sign-in form, Google's authorize step, the link callback and the mail inbox) are tagged `@local-supabase` and only run there too, because deploys have no Supabase on purpose. The protected-page redirects need none, so they run against the preview as well. Netlify injects its review toolbar into previews (never production); on remote runs the specs' shared fixture (`e2e/fixtures.ts`) answers the toolbar's requests with an empty script, so it can't take focus or show up as an external request.
3. **Merge to `main`.** Netlify deploys to production, and the `production` job waits for https://panna-book.netlify.app to serve the merged commit and checks `/` and `/api/health` answer 200.

Deployed env values (such as the app name) are set only in Netlify; `.env.example` notes which. For now the database is local only, by the owner's decision on BOOK-17 (see [Auth locally](#auth-locally) for how it differs from the product brief), so Netlify sets no Supabase values on purpose: deploys render public pages signed out, protected pages redirect to `/login`, and `/login` says sign-in is unavailable. The Supabase service-role key may only ever go in Netlify's server-side environment. CI needs no Netlify token, because preview URLs are predictable and `/api/health` reports the deployed commit. The URLs and the wait (`WAIT_TIMEOUT_MINUTES`, 8 minutes) are set once in the workflow's `env`.

To run the end-to-end tests against any deploy yourself: `PLAYWRIGHT_BASE_URL=https://deploy-preview-12--panna-book.netlify.app NEXT_PUBLIC_SITE_URL=https://panna-book.netlify.app npm run test:e2e`.

**If `preview` or `production` times out**, the job fails with a `::error::` annotation naming the URL, the commit it waited for and the last thing it saw:

- `HTTP 404`: the deploy doesn't exist yet. Check the Netlify deploy log; the build may have failed, or (on the free plan, which builds one site at a time) be queued behind another build. Re-run the job once it is published. Netlify may not build previews for PRs from forks.
- `version <other sha>`: an older (or newer) commit is live. The build for this commit failed or is still running. On `main`, a newer merge published first also causes this; that run's own `production` job is the one to check.
- `network error`: the site didn't answer at all; check Netlify's status and the site settings.

## Configuration

App-wide values (app name, site URL, feature flags, limits) come only from `src/config`, which reads and validates the environment. The app name comes from `NEXT_PUBLIC_APP_NAME`; `npm test` fails if the name is written anywhere else under `src/`. Canonical, Open Graph and manifest URLs are built from `NEXT_PUBLIC_SITE_URL`, so a custom domain is only an env change; `npm test` fails if an absolute `http(s)://` URL is written under `src/` outside `src/config`.

The Supabase URL and anon key are validated only when a Supabase client is created (`getSupabaseConfig()`), so pages that don't use Supabase render without them. A missing value throws an error naming the variable.

Server-only values live in `src/config/server.ts`, which client code can't import:

- `APP_VERSION`: the commit SHA `/api/health` reports. Don't set it in Netlify: `netlify.toml` maps Netlify's commit onto it at build time, and `next.config.ts` bakes it into the server build. Anything that isn't a 7 to 40 character hex SHA is ignored in favour of the `package.json` version, which is also what local and CI builds report.
- `ENABLE_TEST_ROUTES`: `true` turns on `/test-only/*` routes (a page that throws, for the error-page tests). Playwright sets it for the server it starts. It must never be set in Netlify, in production or in deploy previews.
- `WRITING_DATA_SOURCE`: where the writing epic keeps chapters and pages. The only value for now is `stand-in` (the default): an in-memory store and a fixed stand-in writer, so the writing UI runs without auth or tables, and no Supabase call is made. Data is lost on restart. Any other value stops the server with an error naming the variable. The story that adds the Supabase data source makes that the production default.

`GET /api/health` returns `{ status: "ok", version, time }` with `Cache-Control: no-store`. It doesn't check Supabase.

## Local Supabase

Every developer runs the same local database (Postgres, Auth, Storage) in Docker. The Supabase CLI is a pinned dev dependency, so `npx supabase` is the same version for everyone.

You need Docker running. Then:

```sh
npx supabase start              # first run downloads the images; prints the local URLs and keys
npx supabase status             # prints them again at any time
```

**Copy the local values into `.env.local`.** From the `npx supabase status` output, copy the API URL into `NEXT_PUBLIC_SUPABASE_URL` and the anon key (shown as the publishable key in newer CLI versions) into `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The anon key in `.env.example` is only a placeholder and will not work. Never put the service-role (secret) key in `.env.local` or in client code.

```sh
npx supabase db reset           # rebuild the database: apply every migration, then supabase/seed.sql
npm run test:db                 # run the pgTAP policy tests in supabase/tests
npx supabase stop               # stop the stack when you are done
```

`npm run test:db` also fails if any table in the `public` schema has row level security disabled.

### Adding a migration

1. `npx supabase migration new <short_name>` creates `supabase/migrations/<timestamp>_<short_name>.sql`. Write the SQL there.
2. Every new table enables row level security, has a policy for each allowed action, and revokes privileges a client role must not have, in the same migration. Follow `supabase/migrations/*_create_app_meta.sql`.
3. Add pgTAP tests in `supabase/tests/<name>.test.sql` for every allowed and denied case.
4. `npx supabase db reset`, then `npm run test:db`.
5. `npm run db:types` and commit the regenerated `src/lib/supabase/database.types.ts` in the same PR.

Rules:

- An applied migration is never edited. To change something, add a new migration.
- Migrations only add or change; a migration never drops user data. User content is soft-deleted with `archived_at`/`deleted_at`. `npm test` fails if a migration drops a table, schema or column, truncates, or deletes rows.

### Profiles, books and usernames

- `profiles`: one per auth user (`id` is the auth user id). Public profile data only, no email or auth data.
- `books`: exactly one per profile (`owner_id` is unique).
- `username_history`: usernames a profile gave up, held until `reusable_after`. Clients can't read it. They call `username_held_until(name)`, which returns only when the name becomes free.

Clients create their profile and book together by calling the `create_profile_with_book(p_username, p_display_name, p_preferred_language)` RPC. It trims and lowercases the username and rejects reserved names (`username_reserved`) and held names (`username_held`). A name already in use, whatever its case, fails on `profiles_username_lower_key`. `usernameErrorFromDb` in `src/lib/username` maps these errors to the codes that `validateUsername` uses, so the UI shows one set of Hindi and English messages.

Anyone can read profiles and books, except those whose owner is deactivated (`deactivated_at`); owners still see their own. Signed-in users can update only their own editable columns. Changing an id, `owner_id`, the username or `deactivated_at`, inserting, or deleting raises `42501`.

Cover styles, fonts, content languages, username limits, the reserved usernames and text length limits are defined in `src/config` (`books.ts`, `usernames.ts`). They are mirrored in the database as check constraints, column defaults and `is_reserved_username`. To change one, add a migration and change the config in the same PR. `src/contracts/contracts.test.ts` fails if the two disagree. The types and zod schemas in `src/contracts` (`Profile`, `Book`, `CoverStyle`, `FontId`, `Language`) are built from the same config.

**Deleting a user fails while they have a profile.** `profiles.id` references `auth.users` without `on delete cascade`, because user content is never hard-deleted. Removing a user from the Supabase dashboard therefore fails on the foreign key. In the product, removing an account means deactivating it.

## Auth locally

Sign-in uses Supabase Auth through `@supabase/ssr`: an emailed magic link or Google, both returning to `/auth/callback` on `NEXT_PUBLIC_SITE_URL`. `src/proxy.ts` refreshes the session on every page request and sends signed-out visitors of `/settings` and `/onboarding` (and anything under them) to `/login?next=<path>`. Every `next` value goes through `safeNextPath` (`src/lib/auth/redirect.ts`), so sign-in never redirects off the site. Without the Supabase variables, public pages still render (signed out), protected pages redirect to `/login`, and `/login` says sign-in is unavailable.

**Magic links.** With the local stack running (see [Local Supabase](#local-supabase)), sign in at http://localhost:3000/login and open the email in Mailpit at http://127.0.0.1:54324. Open the link in the same browser that asked for it: it uses PKCE, so another browser (e.g. a phone's mail app) lands on `/login` with an error and a form to request a new link. The local Auth config allows redirects to `http://localhost:3000/auth/callback` and the e2e server's `http://localhost:3100/auth/callback`; use `localhost`, not `127.0.0.1`, so the cookies match.

**Google.** `supabase/config.toml` turns Google on with `client_id` and `secret` read through `env(...)` from `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`. A plain `npx supabase start` works without them: the CLI keeps the `env(...)` text as a placeholder, and only real Google sign-in fails. To try Google locally, create an OAuth client in the Google Cloud console with the redirect URI `http://127.0.0.1:54321/auth/v1/callback`, export both variables in your shell, then `npx supabase stop && npx supabase start`. Never commit real credentials.

**Email templates.** Supabase Auth can't read the app's env, so the magic-link and confirmation emails (one bilingual email, Hindi and English) are generated from `NEXT_PUBLIC_APP_NAME` into `supabase/templates/*.html` and the `subject` lines in `supabase/config.toml`. After changing the name or the copy in `src/lib/auth/email-templates.ts`, run `npm run auth:emails`, commit the result and restart Supabase. `npm test` fails if the committed files drift from the configured name.

**No hosted project, for now.** The owner decided on BOOK-17 (2026-11-23) to keep the database local only, so deploys have no Supabase values and can't sign anyone in; the `@local-supabase` e2e tests cover the whole flow against the local stack. This departs from `docs/product-brief.md` (hosted project `panna`, Supabase values in Netlify), which needs its own change to match. If a hosted project is wired up, take `@local-supabase` off every sign-in e2e test except the "with local Supabase" ones (only those need the Mailpit inbox), so the form, axe, noindex, keyboard and Google tests run against Deploy Previews again, and assert that in `tests/repo/e2e-target.test.ts`. The owner also sets it in Netlify (both Supabase variables, every deploy context) and in its Supabase dashboard:

1. Authentication → URL Configuration: set the Site URL to `https://panna-book.netlify.app` and add `https://panna-book.netlify.app/auth/callback**` to the redirect URLs.
2. Authentication → Emails: for "Magic link" and "Confirm signup", paste the subject from `supabase/config.toml` and the body from `supabase/templates/magic_link.html` and `confirmation.html`. Run `NEXT_PUBLIC_APP_NAME=<deployed name> npm run auth:emails` first if Netlify sets a different name (and don't commit that output unless the default changes too).
3. Authentication → Providers → Google: enable it with a real OAuth client whose authorized redirect URI is `<supabase project URL>/auth/v1/callback`.

Even then, Deploy Previews couldn't complete sign-in: callbacks are built only from `NEXT_PUBLIC_SITE_URL`, which `netlify.toml` maps to the production URL on previews, so a magic link or Google sign-in started on a preview would return to production.

## Languages (Hindi and English)

All UI text comes from the catalogues in `src/i18n/messages/` (`en.ts` and `hi.ts`). To add a string, add the same key to both catalogues, then use it through `getTranslator()` from `@/i18n/server` in Server Components or `useTranslator()` from `@/i18n/client` in Client Components. Use `{name}` placeholders for values, e.g. `t("shell.homeLink", { appName: config.appName })`.

`npm test` fails if a key is in one catalogue but not the other, if a value is empty, or if a component in `src/app` or `src/components` writes UI text (or an `aria-label`, `alt`, `title` or `placeholder`) directly instead of through `t()`.

The language comes from the `locale` cookie set by the switch in the header; without it, from the browser's `Accept-Language`; otherwise English. URLs never carry a locale.

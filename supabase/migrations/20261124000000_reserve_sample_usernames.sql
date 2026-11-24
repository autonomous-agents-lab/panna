-- Reserves the usernames of the reader's sample books (src/lib/reader/fixtures.ts), which are
-- served publicly until the reader reads from Supabase, so no real writer can claim them.
-- The list must match RESERVED_USERNAMES in src/config/usernames.ts (contracts.test.ts checks).
-- `create or replace` keeps the function's owner and privileges.
create or replace function public.is_reserved_username(p_username text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(public.trim_whitespace(p_username)) = any (array[
    'api', 'login', 'logout', 'signup', 'signin', 'auth', 'callback', 'settings', 'onboarding',
    'feed', 'about', 'admin', 'help', 'terms', 'privacy', 'sitemap.xml', 'robots.txt',
    'manifest.webmanifest', 'favicon.ico', '_next', 'static', 'public', 'assets', 'new', 'edit',
    'search', 'explore', 'notifications', 'profile', 'account', 'book', 'books', 'page', 'pages',
    'share', 'u', 'me', 'home', 'support', 'contact', 'test-only',
    'sample_writer_bilingual', 'sample_writer_empty', 'sample_writer_drafts'
  ]::text[]);
$$;

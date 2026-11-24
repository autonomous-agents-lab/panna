-- Books live at /<username>, so no one may claim a name that is also a top-level app route.
-- Adds 'write' (the writing epic's route) to the reserved list. The list mirrors
-- RESERVED_USERNAMES in src/config/usernames.ts; src/contracts/contracts.test.ts compares the
-- latest definition here with it, and tests/repo/reserved-routes.test.ts checks every top-level
-- route under src/app is reserved. Existing profiles are left as they are.
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
    'share', 'u', 'me', 'home', 'support', 'contact', 'test-only', 'write'
  ]::text[]);
$$;

revoke execute on function public.is_reserved_username(text) from public, anon, authenticated;

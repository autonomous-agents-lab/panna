-- Profiles, books and username history: the foundation every other epic reads and writes.
--
-- The fixed lists and limits below mirror src/config (books.ts, usernames.ts). Change both
-- together, through a new migration; src/contracts/contracts.test.ts fails if they disagree.
--
-- Clients may read profiles and books and update a few of their own columns. Every other write
-- goes through a SECURITY DEFINER function, so a denied write raises 42501 instead of silently
-- affecting zero rows. User content is never hard-deleted: nothing here cascades on delete.

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- profiles ------------------------------------------------------------------------------------

-- No ON DELETE CASCADE: deleting an auth user that still has a profile fails on purpose.
-- Account removal in the product means deactivation (deactivated_at).
create table public.profiles (
  id uuid primary key references auth.users (id),
  username text not null
    constraint profiles_username_format_check check (username ~ '^[a-z][a-z0-9_]{2,29}$'),
  display_name text not null
    constraint profiles_display_name_length_check check (char_length(display_name) between 1 and 50)
    constraint profiles_display_name_not_blank_check check (btrim(display_name) <> ''),
  avatar_path text
    constraint profiles_avatar_path_length_check check (char_length(avatar_path) between 1 and 512),
  bio text
    constraint profiles_bio_length_check check (char_length(bio) between 0 and 160),
  preferred_language text not null default 'en'
    constraint profiles_preferred_language_check check (preferred_language in ('hi', 'en')),
  username_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz
);

comment on table public.profiles is
  'One per auth user. Public profile data only: no email or other auth data. Never hard-deleted; deactivated_at hides it from everyone but its owner.';

-- Usernames are stored lowercase already; this index is the database-level guarantee that
-- uniqueness is case-insensitive whatever writes the row.
create unique index profiles_username_lower_key on public.profiles (lower(username));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- books ---------------------------------------------------------------------------------------

create table public.books (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null
    constraint books_owner_id_key unique
    references public.profiles (id),
  title text not null
    constraint books_title_length_check check (char_length(title) between 1 and 100)
    constraint books_title_not_blank_check check (btrim(title) <> ''),
  subtitle text
    constraint books_subtitle_length_check check (char_length(subtitle) between 0 and 150),
  cover_style text not null default 'classic'
    constraint books_cover_style_check check (cover_style in ('classic', 'linen', 'kraft', 'marbled', 'minimal')),
  font text not null default 'kalam'
    constraint books_font_check check (font in ('kalam', 'amita', 'sahitya', 'laila', 'caveat', 'homemade_apple')),
  default_language text not null default 'en'
    constraint books_default_language_check check (default_language in ('hi', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.books is
  'Exactly one per profile (books_owner_id_key), created with the profile by create_profile_with_book.';

create trigger books_set_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

-- username_history ----------------------------------------------------------------------------

create table public.username_history (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id),
  username text not null
    constraint username_history_username_format_check check (username ~ '^[a-z][a-z0-9_]{2,29}$'),
  released_at timestamptz not null default now(),
  reusable_after timestamptz not null,
  constraint username_history_reusable_after_check check (reusable_after >= released_at)
);

comment on table public.username_history is
  'Usernames a profile gave up, held until reusable_after. Private: it links old names to profiles. Clients learn only when a name is free, through username_held_until.';

create index username_history_username_lower_idx on public.username_history (lower(username));
create index username_history_profile_id_idx on public.username_history (profile_id);

-- Row level security --------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.username_history enable row level security;

create policy profiles_select_active_or_own
  on public.profiles
  for select
  to anon, authenticated
  using (deactivated_at is null or id = (select auth.uid()));

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy books_select_active_or_own
  on public.books
  for select
  to anon, authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = books.owner_id and p.deactivated_at is null
    )
  );

create policy books_update_own
  on public.books
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- username_history has no client policy, so anon and authenticated read zero rows.

-- Privileges ----------------------------------------------------------------------------------

revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
revoke insert, update, delete, truncate on public.books from anon, authenticated;
revoke insert, update, delete, truncate on public.username_history from anon, authenticated;

-- Only these columns are client-writable. id, owner_id, username, deactivated_at and the
-- timestamps are not, so changing them raises 42501. A later `grant update on table` would
-- silently re-open them; supabase/tests/profiles_books_rls.test.sql pins this behaviour.
grant update (display_name, avatar_path, bio, preferred_language) on public.profiles to authenticated;
grant update (title, subtitle, cover_style, font, default_language) on public.books to authenticated;

-- Functions -----------------------------------------------------------------------------------

-- Mirrors RESERVED_USERNAMES in src/config/usernames.ts. The app validator checks the same list
-- for fast feedback; this copy stops a client that calls the RPC directly.
create function public.is_reserved_username(p_username text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(btrim(p_username)) = any (array[
    'api', 'login', 'logout', 'signup', 'signin', 'auth', 'callback', 'settings', 'onboarding',
    'feed', 'about', 'admin', 'help', 'terms', 'privacy', 'sitemap.xml', 'robots.txt',
    'manifest.webmanifest', 'favicon.ico', '_next', 'static', 'public', 'assets', 'new', 'edit',
    'search', 'explore', 'notifications', 'profile', 'account', 'book', 'books', 'page', 'pages',
    'share', 'u', 'me', 'home', 'support', 'contact', 'test-only'
  ]::text[]);
$$;

revoke execute on function public.is_reserved_username(text) from public, anon, authenticated;

-- When a released username becomes free again, or null if nobody holds it. Returns no profile id,
-- so it can't link an old name to its former owner.
create function public.username_held_until(p_username text)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(h.reusable_after)
  from public.username_history h
  where lower(h.username) = lower(btrim(p_username))
    and h.reusable_after > now();
$$;

revoke execute on function public.username_held_until(text) from public;
grant execute on function public.username_held_until(text) to anon, authenticated;

-- Creates the caller's profile and their one book in a single transaction. The id always comes
-- from auth.uid(), never from the arguments.
create function public.create_profile_with_book(
  p_username text,
  p_display_name text,
  p_preferred_language text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_username text := lower(btrim(p_username));
  v_display_name text := btrim(p_display_name);
  v_profile public.profiles;
  v_book public.books;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if public.is_reserved_username(v_username) then
    raise exception 'username_reserved' using errcode = 'P0001';
  end if;

  if public.username_held_until(v_username) is not null then
    raise exception 'username_held' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, username, display_name, preferred_language)
  values (v_user_id, v_username, v_display_name, p_preferred_language)
  returning * into v_profile;

  -- cover_style and font take their column defaults.
  insert into public.books (owner_id, title, default_language)
  values (v_user_id, v_display_name, p_preferred_language)
  returning * into v_book;

  return jsonb_build_object('profile', to_jsonb(v_profile), 'book', to_jsonb(v_book));
end;
$$;

revoke execute on function public.create_profile_with_book(text, text, text) from public, anon;
grant execute on function public.create_profile_with_book(text, text, text) to authenticated;

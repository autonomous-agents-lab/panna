-- Chapters and pages: what a writer writes inside their one book.
--
-- Visibility: the owner of a book sees all its chapters and pages, drafts and archived ones too.
-- Everyone else sees a chapter when it is published, not archived and its book is visible under
-- the books policy (so a deactivated writer's content stays hidden), and a page only when the page
-- and its chapter both pass that rule.
--
-- Clients write to these tables directly, through RLS and column grants: inserts and updates are
-- for the book's owner only, and only the granted columns are writable (others raise 42501). An
-- update to a row the caller doesn't own matches no rows. Nothing is hard-deleted: there is no
-- DELETE grant or policy, no cascade, and archiving sets archived_at (null restores the row).
-- published_at and archived_at are stamped by public.apply_publication_state, never by clients.
--
-- The lists and limits below mirror src/config (books.ts, content.ts); change both together,
-- through a new migration. src/contracts/contracts.test.ts fails if they disagree. The body check
-- is only a backstop: the page body format is enforced by the sanitiser in
-- src/contracts/page-body (docs/content-format.md). Its size limit is looser than the
-- sanitiser's, because body::text puts a space after every ':' and ',' and so measures a body
-- 10-15% larger than JSON.stringify does.

-- chapters ------------------------------------------------------------------------------------

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id),
  position integer not null
    constraint chapters_position_check check (position >= 0),
  title text not null
    constraint chapters_title_length_check check (char_length(title) between 1 and 100)
    constraint chapters_title_not_blank_check
      check (title ~ '[^\x9-\xD\x20\xA0\x1680\x2000-\x200A\x2028\x2029\x202F\x205F\x3000\xFEFF]'),
  status text not null default 'draft'
    constraint chapters_status_check check (status in ('draft', 'published')),
  published_at timestamptz,
  archived_at timestamptz,
  language text not null
    constraint chapters_language_check check (language in ('hi', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Deferrable so a reorder can swap two positions inside one transaction.
  constraint chapters_book_id_position_key unique (book_id, position) deferrable initially deferred,
  -- The target of pages_chapter_id_book_id_fkey.
  constraint chapters_id_book_id_key unique (id, book_id)
);

comment on table public.chapters is
  'Chapters of a book, ordered by position. Never hard-deleted; archived_at hides a chapter from everyone but its owner.';

-- pages ---------------------------------------------------------------------------------------

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id),
  chapter_id uuid not null,
  position integer not null
    constraint pages_position_check check (position >= 0),
  status text not null default 'draft'
    constraint pages_status_check check (status in ('draft', 'published')),
  published_at timestamptz,
  archived_at timestamptz,
  language text not null
    constraint pages_language_check check (language in ('hi', 'en')),
  body jsonb not null default '{"type": "doc", "content": [{"type": "paragraph"}]}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pages_body_shape_check check (
    jsonb_typeof(body) = 'object' and body ->> 'type' = 'doc' and octet_length(body::text) <= 300000
  ),
  -- A page and its chapter always belong to the same book.
  constraint pages_chapter_id_book_id_fkey foreign key (chapter_id, book_id) references public.chapters (id, book_id),
  constraint pages_chapter_id_position_key unique (chapter_id, position) deferrable initially deferred
);

comment on table public.pages is
  'Pages of a chapter, ordered by position. body is the sanitised rich-text document described in docs/content-format.md. Never hard-deleted; archived_at hides a page from everyone but its owner.';

-- chapters_book_id_position_key and pages_chapter_id_position_key already index book_id and chapter_id.
create index pages_book_id_idx on public.pages (book_id);

-- Triggers ------------------------------------------------------------------------------------

-- Owns published_at and archived_at, so a value sent by any writer is never trusted:
-- published_at is now() when a row becomes published, null while it is a draft, and otherwise
-- unchanged; archived_at is now() when a row is archived, unchanged while it stays archived, and
-- null when it is restored.
create function public.apply_publication_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.published_at := case when new.status = 'published' then now() end;
    new.archived_at := case when new.archived_at is not null then now() end;
    return new;
  end if;

  if new.status = 'draft' then
    new.published_at := null;
  elsif old.status = 'draft' then
    new.published_at := now();
  else
    new.published_at := old.published_at;
  end if;

  if new.archived_at is not null then
    new.archived_at := coalesce(old.archived_at, now());
  end if;

  return new;
end;
$$;

revoke execute on function public.apply_publication_state() from public, anon, authenticated;

create trigger chapters_apply_publication_state
  before insert or update on public.chapters
  for each row execute function public.apply_publication_state();

create trigger chapters_set_updated_at
  before update on public.chapters
  for each row execute function public.set_updated_at();

create trigger pages_apply_publication_state
  before insert or update on public.pages
  for each row execute function public.apply_publication_state();

create trigger pages_set_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

-- Row level security --------------------------------------------------------------------------

alter table public.chapters enable row level security;
alter table public.pages enable row level security;

-- The books subqueries run under the books policy, so "its book is visible" needs no extra test.
create policy chapters_select_published_or_own
  on public.chapters
  for select
  to anon, authenticated
  using (
    exists (select 1 from public.books b where b.id = chapters.book_id and b.owner_id = (select auth.uid()))
    or (
      status = 'published'
      and archived_at is null
      and exists (select 1 from public.books b where b.id = chapters.book_id)
    )
  );

create policy chapters_insert_own
  on public.chapters
  for insert
  to authenticated
  with check (
    exists (select 1 from public.books b where b.id = chapters.book_id and b.owner_id = (select auth.uid()))
  );

create policy chapters_update_own
  on public.chapters
  for update
  to authenticated
  using (
    exists (select 1 from public.books b where b.id = chapters.book_id and b.owner_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.books b where b.id = chapters.book_id and b.owner_id = (select auth.uid()))
  );

-- The chapters subquery runs under the chapters policy, which already requires a visible book.
create policy pages_select_published_or_own
  on public.pages
  for select
  to anon, authenticated
  using (
    exists (select 1 from public.books b where b.id = pages.book_id and b.owner_id = (select auth.uid()))
    or (
      status = 'published'
      and archived_at is null
      and exists (
        select 1 from public.chapters c
        where c.id = pages.chapter_id and c.status = 'published' and c.archived_at is null
      )
    )
  );

-- The chapter check repeats pages_chapter_id_book_id_fkey so that putting a page in another
-- writer's chapter fails here, with 42501, before the foreign key is checked.
create policy pages_insert_own
  on public.pages
  for insert
  to authenticated
  with check (
    exists (select 1 from public.books b where b.id = pages.book_id and b.owner_id = (select auth.uid()))
    and exists (select 1 from public.chapters c where c.id = pages.chapter_id and c.book_id = pages.book_id)
  );

create policy pages_update_own
  on public.pages
  for update
  to authenticated
  using (
    exists (select 1 from public.books b where b.id = pages.book_id and b.owner_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.books b where b.id = pages.book_id and b.owner_id = (select auth.uid()))
    and exists (select 1 from public.chapters c where c.id = pages.chapter_id and c.book_id = pages.book_id)
  );

-- No DELETE policy on either table, for any role.

-- Privileges ----------------------------------------------------------------------------------

revoke insert, update, delete, truncate on public.chapters from anon, authenticated;
revoke insert, update, delete, truncate on public.pages from anon, authenticated;

-- Only these columns are client-writable. id, book_id (after insert), published_at and the
-- timestamps are not, so writing them raises 42501. A later `grant ... on table` would silently
-- re-open them; supabase/tests/chapters_pages_schema.test.sql pins this behaviour.
grant insert (book_id, position, title, status, language) on public.chapters to authenticated;
grant update (position, title, status, language, archived_at) on public.chapters to authenticated;
grant insert (book_id, chapter_id, position, status, language, body) on public.pages to authenticated;
grant update (chapter_id, position, status, language, archived_at, body) on public.pages to authenticated;

-- Behaviour of chapters and pages with real auth.users rows: who sees what (AC-2, AC-3), who may
-- write what (AC-4), the publication timestamps (AC-7) and the live constraints (AC-1).
-- Everything, helper schema included, is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

select plan(88);

-- Helpers ------------------------------------------------------------------------------------

create schema test_helpers;
grant usage on schema test_helpers to anon, authenticated;

create function test_helpers.as_user(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function test_helpers.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;

-- Runs a statement as the current role and returns how many rows it affected.
create function test_helpers.affected(p_sql text) returns bigint language plpgsql as $$
declare
  n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- The book of a user, whoever asks (a deactivated writer's book is hidden from others).
create function test_helpers.book_of(p_owner uuid) returns uuid language sql stable security definer as $$
  select id from public.books where owner_id = p_owner;
$$;

-- A is the writer, B the other user the card asks for, C a writer who deactivates.
insert into auth.users (id, aud, role, email) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'c@example.test');

select test_helpers.as_user('11111111-1111-4111-8111-111111111111');
select public.create_profile_with_book('asha', 'Asha', 'hi');
select test_helpers.as_user('22222222-2222-4222-8222-222222222222');
select public.create_profile_with_book('bina', 'Bina', 'en');
select test_helpers.as_user('33333333-3333-4333-8333-333333333333');
select public.create_profile_with_book('chandni', 'Chandni', 'en');
reset role;

-- A's matrix of chapters (c...) and pages (p...), written as the table owner so the ids are fixed.
insert into public.chapters (id, book_id, position, title, status, archived_at, language) values
  ('a0000000-0000-4000-8000-0000000000c1', test_helpers.book_of('11111111-1111-4111-8111-111111111111'), 0, 'Published', 'published', null, 'hi'),
  ('a0000000-0000-4000-8000-0000000000c2', test_helpers.book_of('11111111-1111-4111-8111-111111111111'), 1, 'Draft', 'draft', null, 'hi'),
  ('a0000000-0000-4000-8000-0000000000c3', test_helpers.book_of('11111111-1111-4111-8111-111111111111'), 2, 'Archived', 'published', now(), 'en'),
  ('b0000000-0000-4000-8000-0000000000c1', test_helpers.book_of('22222222-2222-4222-8222-222222222222'), 0, 'B chapter', 'published', null, 'en'),
  ('c0000000-0000-4000-8000-0000000000c1', test_helpers.book_of('33333333-3333-4333-8333-333333333333'), 0, 'C chapter', 'published', null, 'en');

insert into public.pages (id, book_id, chapter_id, position, status, archived_at, language, body) values
  ('a0000000-0000-4000-8000-0000000000a1', test_helpers.book_of('11111111-1111-4111-8111-111111111111'),
   'a0000000-0000-4000-8000-0000000000c1', 0, 'published', null, 'hi',
   '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "पहला पन्ना"}]}]}'),
  ('a0000000-0000-4000-8000-0000000000a2', test_helpers.book_of('11111111-1111-4111-8111-111111111111'),
   'a0000000-0000-4000-8000-0000000000c1', 1, 'draft', null, 'hi', default),
  ('a0000000-0000-4000-8000-0000000000a3', test_helpers.book_of('11111111-1111-4111-8111-111111111111'),
   'a0000000-0000-4000-8000-0000000000c1', 2, 'published', now(), 'hi', default),
  ('a0000000-0000-4000-8000-0000000000a4', test_helpers.book_of('11111111-1111-4111-8111-111111111111'),
   'a0000000-0000-4000-8000-0000000000c2', 0, 'published', null, 'hi', default),
  ('a0000000-0000-4000-8000-0000000000a5', test_helpers.book_of('11111111-1111-4111-8111-111111111111'),
   'a0000000-0000-4000-8000-0000000000c3', 0, 'published', null, 'en', default),
  ('b0000000-0000-4000-8000-0000000000a1', test_helpers.book_of('22222222-2222-4222-8222-222222222222'),
   'b0000000-0000-4000-8000-0000000000c1', 0, 'published', null, 'en', default),
  ('c0000000-0000-4000-8000-0000000000a1', test_helpers.book_of('33333333-3333-4333-8333-333333333333'),
   'c0000000-0000-4000-8000-0000000000c1', 0, 'published', null, 'en', default);

-- AC-2: others see only published, non-archived pages in published, non-archived chapters -----

select test_helpers.as_user('22222222-2222-4222-8222-222222222222');
select results_eq(
  $$select id from public.chapters where book_id = test_helpers.book_of('11111111-1111-4111-8111-111111111111')$$,
  $$values ('a0000000-0000-4000-8000-0000000000c1'::uuid)$$,
  'B sees only A''s published, non-archived chapter'
);
select results_eq(
  $$select id from public.pages where book_id = test_helpers.book_of('11111111-1111-4111-8111-111111111111')$$,
  $$values ('a0000000-0000-4000-8000-0000000000a1'::uuid)$$,
  'B sees only A''s published, non-archived page in a published, non-archived chapter'
);
select is_empty(
  $$select id from public.pages where id in ('a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000a3',
    'a0000000-0000-4000-8000-0000000000a4', 'a0000000-0000-4000-8000-0000000000a5')$$,
  'B cannot fetch A''s draft page, archived page, or published pages in draft or archived chapters, even by id'
);
reset role;

select test_helpers.as_anon();
select results_eq(
  $$select id from public.chapters where book_id = test_helpers.book_of('11111111-1111-4111-8111-111111111111')$$,
  $$values ('a0000000-0000-4000-8000-0000000000c1'::uuid)$$,
  'anon sees only A''s published, non-archived chapter'
);
select results_eq(
  $$select id from public.pages where book_id = test_helpers.book_of('11111111-1111-4111-8111-111111111111')$$,
  $$values ('a0000000-0000-4000-8000-0000000000a1'::uuid)$$,
  'anon sees only A''s published, non-archived page in a published, non-archived chapter'
);
select results_eq(
  $$select body->'content'->0->'content'->0->>'text' from public.pages where id = 'a0000000-0000-4000-8000-0000000000a1'$$,
  $$values ('पहला पन्ना')$$,
  'anon reads the published page''s body'
);
reset role;

-- AC-3: the owner sees everything ---------------------------------------------------------------

select test_helpers.as_user('11111111-1111-4111-8111-111111111111');
select results_eq(
  $$select id from public.chapters where book_id = test_helpers.book_of('11111111-1111-4111-8111-111111111111') order by position$$,
  $$values ('a0000000-0000-4000-8000-0000000000c1'::uuid), ('a0000000-0000-4000-8000-0000000000c2'::uuid),
           ('a0000000-0000-4000-8000-0000000000c3'::uuid)$$,
  'A sees all their chapters, draft and archived included'
);
select results_eq(
  $$select id from public.pages where book_id = test_helpers.book_of('11111111-1111-4111-8111-111111111111') order by id$$,
  $$values ('a0000000-0000-4000-8000-0000000000a1'::uuid), ('a0000000-0000-4000-8000-0000000000a2'::uuid),
           ('a0000000-0000-4000-8000-0000000000a3'::uuid), ('a0000000-0000-4000-8000-0000000000a4'::uuid),
           ('a0000000-0000-4000-8000-0000000000a5'::uuid)$$,
  'A sees all their pages, draft and archived included'
);
select results_eq(
  $$select id from public.pages where book_id = test_helpers.book_of('22222222-2222-4222-8222-222222222222')$$,
  $$values ('b0000000-0000-4000-8000-0000000000a1'::uuid)$$,
  'A sees B''s published page like any reader'
);

-- AC-4: A writes their own chapters and pages ------------------------------------------------------

select lives_ok(
  $$insert into public.chapters (book_id, position, title, language)
    values (test_helpers.book_of('11111111-1111-4111-8111-111111111111'), 3, 'New chapter', 'en')$$,
  'A inserts a chapter in their book'
);
select lives_ok(
  $$insert into public.pages (book_id, chapter_id, position, language)
    values (test_helpers.book_of('11111111-1111-4111-8111-111111111111'), 'a0000000-0000-4000-8000-0000000000c2', 1, 'en')$$,
  'A inserts a page in their chapter'
);
select results_eq(
  $$select c.status, c.published_at, p.status, p.body
    from public.chapters c join public.pages p on p.chapter_id = c.id
    where c.id = 'a0000000-0000-4000-8000-0000000000c2' and p.position = 1$$,
  $$values ('draft'::text, null::timestamptz, 'draft'::text,
            '{"type": "doc", "content": [{"type": "paragraph"}]}'::jsonb)$$,
  'new chapters and pages are drafts, and a page starts with one empty paragraph'
);
select is(
  test_helpers.affected($$update public.chapters set title = 'Renamed', language = 'en', position = 4
    where title = 'New chapter'$$),
  1::bigint, 'A retitles and moves their chapter'
);
select is(
  test_helpers.affected($$update public.pages
    set body = '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "edited"}]}]}',
        language = 'en'
    where id = 'a0000000-0000-4000-8000-0000000000a2'$$),
  1::bigint, 'A edits their page''s body'
);
select is(
  test_helpers.affected($$update public.pages set chapter_id = 'a0000000-0000-4000-8000-0000000000c2', position = 5
    where id = 'a0000000-0000-4000-8000-0000000000a2'$$),
  1::bigint, 'A moves a page into another of their chapters'
);
select is(
  test_helpers.affected($$update public.chapters set archived_at = '2000-01-01' where id = 'a0000000-0000-4000-8000-0000000000c2'$$),
  1::bigint, 'A archives their chapter'
);
select is(
  (select archived_at from public.chapters where id = 'a0000000-0000-4000-8000-0000000000c2'),
  now(), 'archiving stamps archived_at with the time of the update, not the client''s value'
);
select is(
  test_helpers.affected($$update public.chapters set archived_at = null where id = 'a0000000-0000-4000-8000-0000000000c2'$$),
  1::bigint, 'A restores their chapter'
);
select is(
  test_helpers.affected($$update public.pages set archived_at = now() where id = 'a0000000-0000-4000-8000-0000000000a1'$$),
  1::bigint, 'A archives their page'
);
select is(
  test_helpers.affected($$update public.pages set archived_at = null where id = 'a0000000-0000-4000-8000-0000000000a1'$$),
  1::bigint, 'A restores their page'
);
select results_eq(
  $$select archived_at from public.chapters where id = 'a0000000-0000-4000-8000-0000000000c2'
    union all select archived_at from public.pages where id = 'a0000000-0000-4000-8000-0000000000a1'$$,
  $$values (null::timestamptz), (null::timestamptz)$$,
  'restoring clears archived_at'
);

-- A still can't break the rules in their own book.
select throws_ok(
  $$update public.pages set chapter_id = 'b0000000-0000-4000-8000-0000000000c1' where id = 'a0000000-0000-4000-8000-0000000000a2'$$,
  '42501', 'new row violates row-level security policy for table "pages"',
  'A cannot move their page into B''s chapter'
);
select throws_ok(
  $$insert into public.pages (book_id, chapter_id, position, language)
    values (test_helpers.book_of('11111111-1111-4111-8111-111111111111'), 'b0000000-0000-4000-8000-0000000000c1', 9, 'en')$$,
  '42501', 'new row violates row-level security policy for table "pages"',
  'A cannot add a page of their book to B''s chapter'
);
select throws_ok(
  $$update public.chapters set book_id = test_helpers.book_of('22222222-2222-4222-8222-222222222222')
    where id = 'a0000000-0000-4000-8000-0000000000c1'$$,
  '42501', 'permission denied for table chapters', 'A cannot change a chapter''s book_id'
);
select throws_ok(
  $$update public.pages set book_id = test_helpers.book_of('22222222-2222-4222-8222-222222222222')
    where id = 'a0000000-0000-4000-8000-0000000000a1'$$,
  '42501', 'permission denied for table pages', 'A cannot change a page''s book_id'
);
select throws_ok(
  $$update public.pages set published_at = '2000-01-01' where id = 'a0000000-0000-4000-8000-0000000000a1'$$,
  '42501', 'permission denied for table pages', 'A cannot write published_at'
);
select throws_ok(
  $$insert into public.chapters (book_id, position, title, language, published_at)
    values (test_helpers.book_of('11111111-1111-4111-8111-111111111111'), 7, 'Forged', 'en', '2000-01-01')$$,
  '42501', 'permission denied for table chapters', 'A cannot insert a published_at'
);
select throws_ok(
  $$update public.chapters set created_at = '2000-01-01' where id = 'a0000000-0000-4000-8000-0000000000c1'$$,
  '42501', 'permission denied for table chapters', 'A cannot write created_at'
);
select throws_ok(
  $$update public.pages set updated_at = '2000-01-01' where id = 'a0000000-0000-4000-8000-0000000000a1'$$,
  '42501', 'permission denied for table pages', 'A cannot write updated_at'
);
select throws_ok(
  $$delete from public.pages where id = 'a0000000-0000-4000-8000-0000000000a2'$$,
  '42501', 'permission denied for table pages', 'A cannot delete even their own page'
);
select throws_ok(
  $$delete from public.chapters where id = 'a0000000-0000-4000-8000-0000000000c2'$$,
  '42501', 'permission denied for table chapters', 'A cannot delete even their own chapter'
);
reset role;

-- AC-4: B can't write A's chapters and pages ---------------------------------------------------

select test_helpers.as_user('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$insert into public.chapters (book_id, position, title, language)
    values (test_helpers.book_of('11111111-1111-4111-8111-111111111111'), 9, 'Intruder', 'en')$$,
  '42501', 'new row violates row-level security policy for table "chapters"',
  'B cannot insert a chapter in A''s book'
);
select throws_ok(
  $$insert into public.pages (book_id, chapter_id, position, language)
    values (test_helpers.book_of('11111111-1111-4111-8111-111111111111'), 'a0000000-0000-4000-8000-0000000000c1', 9, 'en')$$,
  '42501', 'new row violates row-level security policy for table "pages"',
  'B cannot insert a page in A''s book'
);
select throws_ok(
  $$insert into public.pages (book_id, chapter_id, position, language)
    values (test_helpers.book_of('22222222-2222-4222-8222-222222222222'), 'a0000000-0000-4000-8000-0000000000c1', 9, 'en')$$,
  '42501', 'new row violates row-level security policy for table "pages"',
  'B cannot add a page of their own book to A''s chapter'
);
select throws_ok(
  $$update public.pages set chapter_id = 'a0000000-0000-4000-8000-0000000000c1' where id = 'b0000000-0000-4000-8000-0000000000a1'$$,
  '42501', 'new row violates row-level security policy for table "pages"',
  'B cannot move their page into A''s chapter'
);
select is(
  test_helpers.affected($$update public.chapters set title = 'Hacked' where id = 'a0000000-0000-4000-8000-0000000000c1'$$),
  0::bigint, 'B retitling A''s chapter matches no rows'
);
select is(
  test_helpers.affected($$update public.chapters set archived_at = now(), status = 'draft' where book_id = test_helpers.book_of('11111111-1111-4111-8111-111111111111')$$),
  0::bigint, 'B archiving or unpublishing A''s chapters matches no rows'
);
select is(
  test_helpers.affected($$update public.pages set body = '{"type": "doc", "content": []}' where id = 'a0000000-0000-4000-8000-0000000000a1'$$),
  0::bigint, 'B editing A''s published page matches no rows'
);
select is(
  test_helpers.affected($$update public.pages set archived_at = now() where book_id = test_helpers.book_of('11111111-1111-4111-8111-111111111111')$$),
  0::bigint, 'B archiving A''s pages matches no rows'
);
select is(
  test_helpers.affected($$update public.pages set status = 'published' where id = 'a0000000-0000-4000-8000-0000000000a2'$$),
  0::bigint, 'B publishing A''s draft matches no rows'
);
select throws_ok(
  $$delete from public.pages where id = 'a0000000-0000-4000-8000-0000000000a1'$$,
  '42501', 'permission denied for table pages', 'B cannot delete A''s page'
);
select throws_ok(
  $$delete from public.chapters where id = 'a0000000-0000-4000-8000-0000000000c1'$$,
  '42501', 'permission denied for table chapters', 'B cannot delete A''s chapter'
);
reset role;

select results_eq(
  $$select c.title, c.status, c.archived_at, p.status, p.archived_at, p.body->'content'->0->'content'->0->>'text'
    from public.chapters c join public.pages p on p.chapter_id = c.id
    where p.id = 'a0000000-0000-4000-8000-0000000000a1'$$,
  $$values ('Published'::text, 'published'::text, null::timestamptz, 'published'::text, null::timestamptz, 'पहला पन्ना'::text)$$,
  'A''s published chapter and page are unchanged after B''s attempts'
);
select results_eq(
  $$select chapter_id, status from public.pages where id in ('a0000000-0000-4000-8000-0000000000a2', 'b0000000-0000-4000-8000-0000000000a1') order by id$$,
  $$values ('a0000000-0000-4000-8000-0000000000c2'::uuid, 'draft'::text), ('b0000000-0000-4000-8000-0000000000c1'::uuid, 'published'::text)$$,
  'A''s draft is still a draft and B''s page is still in B''s chapter'
);

select test_helpers.as_anon();
select throws_ok(
  $$insert into public.chapters (book_id, position, title, language)
    values (test_helpers.book_of('11111111-1111-4111-8111-111111111111'), 9, 'Anon', 'en')$$,
  '42501', 'permission denied for table chapters', 'anon cannot insert a chapter'
);
select throws_ok(
  $$update public.pages set status = 'draft' where id = 'a0000000-0000-4000-8000-0000000000a1'$$,
  '42501', 'permission denied for table pages', 'anon cannot update a page'
);
select throws_ok(
  $$delete from public.pages where id = 'a0000000-0000-4000-8000-0000000000a1'$$,
  '42501', 'permission denied for table pages', 'anon cannot delete a page'
);
select throws_ok(
  $$delete from public.chapters where id = 'a0000000-0000-4000-8000-0000000000c1'$$,
  '42501', 'permission denied for table chapters', 'anon cannot delete a chapter'
);
reset role;

-- AC-7: the database owns published_at ----------------------------------------------------------

select test_helpers.as_user('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$insert into public.chapters (book_id, position, title, status, language)
    values (test_helpers.book_of('11111111-1111-4111-8111-111111111111'), 5, 'Straight out', 'published', 'hi')$$,
  'A inserts a published chapter'
);
select is(
  (select published_at from public.chapters where title = 'Straight out'), now(),
  'inserting as published sets published_at to now()'
);
select is(
  test_helpers.affected($$update public.pages set status = 'published' where id = 'a0000000-0000-4000-8000-0000000000a2'$$),
  1::bigint, 'A publishes their draft page'
);
select is(
  (select published_at from public.pages where id = 'a0000000-0000-4000-8000-0000000000a2'), now(),
  'publishing sets published_at to now()'
);
reset role;

-- Give the published page and chapter an old timestamp, bypassing the trigger, so that "kept"
-- and "set again" can be told apart inside this one transaction.
set local session_replication_role = replica;
update public.pages set published_at = '2001-01-01', archived_at = null where id = 'a0000000-0000-4000-8000-0000000000a1';
update public.chapters set published_at = '2001-01-01' where id = 'a0000000-0000-4000-8000-0000000000c1';
set local session_replication_role = origin;

select test_helpers.as_user('11111111-1111-4111-8111-111111111111');
select is(
  test_helpers.affected($$update public.pages set position = 3, status = 'published' where id = 'a0000000-0000-4000-8000-0000000000a1'$$),
  1::bigint, 'A edits a published page and saves it as published again'
);
select is(
  (select published_at from public.pages where id = 'a0000000-0000-4000-8000-0000000000a1'), '2001-01-01'::timestamptz,
  'an edit that keeps it published keeps published_at'
);
select is(
  test_helpers.affected($$update public.pages set status = 'draft' where id = 'a0000000-0000-4000-8000-0000000000a1'$$),
  1::bigint, 'A unpublishes the page'
);
select results_eq(
  $$select status, published_at, body->'content'->0->'content'->0->>'text' from public.pages where id = 'a0000000-0000-4000-8000-0000000000a1'$$,
  $$values ('draft'::text, null::timestamptz, 'पहला पन्ना'::text)$$,
  'unpublishing returns the page to draft, clears published_at and keeps the content'
);
select is(
  test_helpers.affected($$update public.chapters set status = 'draft' where id = 'a0000000-0000-4000-8000-0000000000c1'$$),
  1::bigint, 'A unpublishes the chapter'
);
select results_eq(
  $$select status, published_at, title from public.chapters where id = 'a0000000-0000-4000-8000-0000000000c1'$$,
  $$values ('draft'::text, null::timestamptz, 'Published'::text)$$,
  'unpublishing returns the chapter to draft, clears published_at and keeps the title'
);
select is(
  test_helpers.affected($$update public.chapters set status = 'published' where id = 'a0000000-0000-4000-8000-0000000000c1'$$),
  1::bigint, 'A republishes the chapter'
);
select is(
  (select published_at from public.chapters where id = 'a0000000-0000-4000-8000-0000000000c1'), now(),
  'republishing sets a new published_at'
);
reset role;

-- Even the table owner can't forge published_at or archived_at.
select lives_ok(
  $$insert into public.pages (id, book_id, chapter_id, position, status, published_at, language)
    values ('a0000000-0000-4000-8000-0000000000a6', test_helpers.book_of('11111111-1111-4111-8111-111111111111'),
            'a0000000-0000-4000-8000-0000000000c1', 6, 'published', '1999-01-01', 'hi'),
           ('a0000000-0000-4000-8000-0000000000a7', test_helpers.book_of('11111111-1111-4111-8111-111111111111'),
            'a0000000-0000-4000-8000-0000000000c1', 7, 'draft', '1999-01-01', 'hi')$$,
  'the table owner inserts pages with a forged published_at'
);
select results_eq(
  $$select published_at from public.pages where id in ('a0000000-0000-4000-8000-0000000000a6', 'a0000000-0000-4000-8000-0000000000a7') order by id$$,
  $$values (now()), (null::timestamptz)$$,
  'the trigger overwrites it: now() when published, null when draft'
);
update public.pages set published_at = '1999-01-01', updated_at = '1999-01-01' where id = 'a0000000-0000-4000-8000-0000000000a6';
select results_eq(
  $$select published_at, updated_at from public.pages where id = 'a0000000-0000-4000-8000-0000000000a6'$$,
  $$values (now(), now())$$,
  'an update can''t forge published_at or updated_at either'
);

set local session_replication_role = replica;
update public.pages set archived_at = '2002-02-02' where id = 'a0000000-0000-4000-8000-0000000000a3';
set local session_replication_role = origin;
update public.pages set archived_at = '1999-01-01', position = 8 where id = 'a0000000-0000-4000-8000-0000000000a3';
select is(
  (select archived_at from public.pages where id = 'a0000000-0000-4000-8000-0000000000a3'), '2002-02-02'::timestamptz,
  'an archived row keeps its original archived_at'
);
select is(
  (select status from public.pages where id = 'a0000000-0000-4000-8000-0000000000a3'), 'published',
  'archiving doesn''t change status'
);

-- Deactivated writers --------------------------------------------------------------------------

update public.profiles set deactivated_at = now() where id = '33333333-3333-4333-8333-333333333333';

select test_helpers.as_anon();
select is_empty(
  $$select id from public.chapters where id = 'c0000000-0000-4000-8000-0000000000c1'
    union all select id from public.pages where id = 'c0000000-0000-4000-8000-0000000000a1'$$,
  'anon no longer sees a deactivated writer''s published chapter and page'
);
reset role;
select test_helpers.as_user('22222222-2222-4222-8222-222222222222');
select is_empty(
  $$select id from public.chapters where id = 'c0000000-0000-4000-8000-0000000000c1'
    union all select id from public.pages where id = 'c0000000-0000-4000-8000-0000000000a1'$$,
  'B no longer sees them either'
);
reset role;
select test_helpers.as_user('33333333-3333-4333-8333-333333333333');
select results_eq(
  $$select id from public.pages where id = 'c0000000-0000-4000-8000-0000000000a1'$$,
  $$values ('c0000000-0000-4000-8000-0000000000a1'::uuid)$$,
  'the deactivated writer still sees their own page'
);
reset role;

-- AC-1: the constraints are live ----------------------------------------------------------------

select throws_ok(
  $$update public.chapters set status = 'scheduled' where id = 'a0000000-0000-4000-8000-0000000000c1'$$,
  '23514', null, 'an unknown chapter status is rejected'
);
select throws_ok(
  $$update public.pages set status = 'scheduled' where id = 'a0000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'an unknown page status is rejected'
);
select throws_ok(
  $$update public.chapters set language = 'fr' where id = 'a0000000-0000-4000-8000-0000000000c1'$$,
  '23514', null, 'an unknown chapter language is rejected'
);
select throws_ok(
  $$update public.pages set language = 'fr' where id = 'a0000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'an unknown page language is rejected'
);
select throws_ok(
  $$update public.chapters set position = -1 where id = 'a0000000-0000-4000-8000-0000000000c1'$$,
  '23514', null, 'a negative chapter position is rejected'
);
select throws_ok(
  $$update public.pages set position = -1 where id = 'a0000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'a negative page position is rejected'
);
select throws_ok(
  $$update public.chapters set title = U&'\00A0\0009\3000' where id = 'a0000000-0000-4000-8000-0000000000c1'$$,
  '23514', null, 'a blank chapter title is rejected'
);
select throws_ok(
  $$update public.chapters set title = repeat('x', 101) where id = 'a0000000-0000-4000-8000-0000000000c1'$$,
  '23514', null, 'a chapter title over 100 characters is rejected'
);
select throws_ok(
  $$update public.chapters set title = '' where id = 'a0000000-0000-4000-8000-0000000000c1'$$,
  '23514', null, 'an empty chapter title is rejected'
);
select throws_ok(
  $$update public.pages set body = '[]' where id = 'a0000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'a body that is not an object is rejected'
);
select throws_ok(
  $$update public.pages set body = '{"type": "html", "content": "<script>alert(1)</script>"}' where id = 'a0000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'a body whose type is not doc is rejected'
);
select throws_ok(
  $$update public.pages set body = jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
      jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', repeat('x', 300000))))))
    where id = 'a0000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'a body over the database backstop is rejected'
);
select throws_ok(
  $$insert into public.pages (book_id, chapter_id, position, language)
    values (test_helpers.book_of('22222222-2222-4222-8222-222222222222'), 'a0000000-0000-4000-8000-0000000000c1', 9, 'en')$$,
  '23503', null, 'even the table owner can''t put a page in a chapter of another book'
);
select throws_ok(
  $$insert into public.pages (book_id, chapter_id, position) values (test_helpers.book_of('11111111-1111-4111-8111-111111111111'), 'a0000000-0000-4000-8000-0000000000c1', 9)$$,
  '23502', null, 'a page needs a language'
);

-- A body of many small nodes just under the sanitiser's 200000 bytes (JSON.stringify) measures
-- more than 200000 as body::text, and must still fit the database's looser backstop.
create temporary table near_limit as
  select jsonb_build_object('type', 'doc', 'content', jsonb_agg(
    '{"type": "paragraph", "content": [{"type": "text", "text": "a", "marks": [{"type": "bold"}]}]}'::jsonb)) as body
  from generate_series(1, 2325);
select ok(
  (select octet_length(replace(replace(body::text, ': ', ':'), ', ', ',')) between 199000 and 200000
          and octet_length(body::text) > 200000 from near_limit),
  'the near-limit body is just under 200000 bytes compact, and over 200000 as body::text'
);
select lives_ok(
  $$update public.pages set body = (select body from near_limit) where id = 'a0000000-0000-4000-8000-0000000000a1'$$,
  'a body the sanitiser accepts near its limit is stored'
);

-- Positions are unique per parent, checked at commit, so two can be swapped in one transaction.
update public.chapters set position = 1 where id = 'a0000000-0000-4000-8000-0000000000c1';
update public.chapters set position = 0 where id = 'a0000000-0000-4000-8000-0000000000c2';
select lives_ok($$set constraints all immediate$$, 'two chapters swap positions within a transaction');
select throws_ok(
  $$update public.chapters set position = 0 where id = 'a0000000-0000-4000-8000-0000000000c3'$$,
  '23505', null, 'two chapters of a book cannot share a position'
);
select throws_ok(
  $$update public.pages set position = 3 where id = 'a0000000-0000-4000-8000-0000000000a6'$$,
  '23505', null, 'two pages of a chapter cannot share a position'
);
select lives_ok(
  $$update public.pages set position = 0 where id = 'b0000000-0000-4000-8000-0000000000a1'$$,
  'pages in different chapters may share a position'
);

select * from finish();
rollback;

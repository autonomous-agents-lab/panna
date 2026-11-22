-- Behaviour of profiles, books, username_history and create_profile_with_book with real
-- auth.users rows. Everything, helper schema included, is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;

select plan(62);

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

create table test_helpers.created (who text primary key, result jsonb not null);
grant insert, select on test_helpers.created to authenticated;

-- A and B are the two users the card asks for; C and D cover the failure and username cases.
insert into auth.users (id, aud, role, email) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'c@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'd@example.test');

-- AC-5: create_profile_with_book ----------------------------------------------------------------

select test_helpers.as_anon();
select throws_ok(
  $$select public.create_profile_with_book('anon_user', 'Anon', 'en')$$,
  '42501', null, 'anon cannot call create_profile_with_book'
);
reset role;

select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.create_profile_with_book('nobody', 'Nobody', 'en')$$,
  '42501', 'not_authenticated', 'a caller without a user id is rejected'
);
reset role;

select test_helpers.as_user('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$insert into test_helpers.created select 'A', public.create_profile_with_book('  Asha ', ' Asha Rao ', 'hi')$$,
  'A creates their profile and book'
);
reset role;

select results_eq(
  $$select result->'profile'->>'id', result->'profile'->>'username', result->'profile'->>'display_name',
           result->'profile'->>'preferred_language', result->'book'->>'owner_id', result->'book'->>'title',
           result->'book'->>'cover_style', result->'book'->>'font', result->'book'->>'default_language'
    from test_helpers.created where who = 'A'$$,
  $$values ('11111111-1111-4111-8111-111111111111', 'asha', 'Asha Rao', 'hi',
            '11111111-1111-4111-8111-111111111111', 'Asha Rao', 'classic', 'kalam', 'hi')$$,
  'the result has the normalized profile and a book with the default title, cover, font and language'
);
select is(
  (select array(select jsonb_object_keys(result->'profile') order by 1) from test_helpers.created where who = 'A'),
  array['avatar_path', 'bio', 'created_at', 'deactivated_at', 'display_name', 'id', 'preferred_language',
        'updated_at', 'username', 'username_changed_at'],
  'the returned profile carries only profile columns, no email or auth data'
);
select is((select count(*) from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 1::bigint,
  'exactly one profile for A');
select is((select count(*) from public.books where owner_id = '11111111-1111-4111-8111-111111111111'), 1::bigint,
  'exactly one book for A');

select test_helpers.as_user('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$select public.create_profile_with_book('asha_two', 'Asha', 'en')$$,
  '23505', 'duplicate key value violates unique constraint "profiles_pkey"',
  'a second call by A is rejected'
);
reset role;
select is((select count(*) from public.books where owner_id = '11111111-1111-4111-8111-111111111111'), 1::bigint,
  'A still has exactly one book');

-- Atomicity: make the book insert fail for C only; the profile insert must not survive.
create function test_helpers.fail_book_for_c() returns trigger language plpgsql as $$
begin
  if new.owner_id = '33333333-3333-4333-8333-333333333333' then
    raise exception 'book_insert_failed';
  end if;
  return new;
end;
$$;
create trigger fail_book_for_c before insert on public.books
  for each row execute function test_helpers.fail_book_for_c();

select test_helpers.as_user('33333333-3333-4333-8333-333333333333');
select throws_ok(
  $$select public.create_profile_with_book('chandni', 'Chandni', 'en')$$,
  'P0001', 'book_insert_failed', 'when the book insert fails, the call fails'
);
reset role;
select is((select count(*) from public.profiles where id = '33333333-3333-4333-8333-333333333333'), 0::bigint,
  'and no profile is left behind for C');

-- AC-6: case-insensitive uniqueness ----------------------------------------------------------

select test_helpers.as_user('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$select public.create_profile_with_book('asha', 'Asha B', 'en')$$,
  '23505', 'duplicate key value violates unique constraint "profiles_username_lower_key"',
  'B cannot take asha after A chose Asha'
);
select lives_ok(
  $$select public.create_profile_with_book('Bina', 'Bina', 'en')$$,
  'B creates their profile and book as bina'
);
reset role;
select throws_ok(
  $$insert into public.profiles (id, username, display_name)
    values ('44444444-4444-4444-8444-444444444444', 'asha', 'Direct')$$,
  '23505', 'duplicate key value violates unique constraint "profiles_username_lower_key"',
  'the database rejects the duplicate even for a direct superuser insert'
);

-- Reserved and held usernames ----------------------------------------------------------------

insert into public.username_history (profile_id, username, released_at, reusable_after) values
  ('11111111-1111-4111-8111-111111111111', 'heldname', '2000-01-01', '2998-01-01'),
  ('11111111-1111-4111-8111-111111111111', 'heldname', '2000-01-01', '2999-01-01'),
  ('11111111-1111-4111-8111-111111111111', 'freename', '2000-01-01', '2001-01-01');

select test_helpers.as_user('44444444-4444-4444-8444-444444444444');
select throws_ok(
  $$select public.create_profile_with_book('admin', 'Admin', 'en')$$,
  'P0001', 'username_reserved', 'a reserved name is rejected by the function'
);
select throws_ok(
  $$select public.create_profile_with_book(' Admin ', 'Admin', 'en')$$,
  'P0001', 'username_reserved', 'the reserved check is case-insensitive'
);
select throws_ok(
  $$select public.create_profile_with_book('HeldName', 'Held', 'en')$$,
  'P0001', 'username_held', 'a name held until the future is rejected'
);
select is(public.username_held_until(' HeldName '), '2999-01-01'::timestamptz,
  'username_held_until returns the latest future hold');
select is(public.username_held_until('freename'), null, 'a hold in the past returns null');
select is(public.username_held_until('nobody_has_it'), null, 'a name with no history returns null');
select is_empty($$select * from public.username_history$$, 'authenticated reads no username history rows');
select throws_ok(
  $$insert into public.username_history (profile_id, username, reusable_after)
    values ('44444444-4444-4444-8444-444444444444', 'grab', '2999-01-01')$$,
  '42501', null, 'authenticated cannot write username history'
);
select lives_ok(
  $$select public.create_profile_with_book('freename', 'Dev', 'en')$$,
  'a name whose hold has passed can be taken'
);
reset role;

select test_helpers.as_anon();
select is(public.username_held_until('heldname'), '2999-01-01'::timestamptz, 'anon can ask when a name is free');
select is_empty($$select * from public.username_history$$, 'anon reads no username history rows');
reset role;

-- AC-2: reading ---------------------------------------------------------------------------------

select test_helpers.as_anon();
select results_eq(
  $$select username from public.profiles where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222') order by username$$,
  $$values ('asha'), ('bina')$$,
  'anon reads both profiles'
);
select results_eq(
  $$select title from public.books where owner_id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222') order by title$$,
  $$values ('Asha Rao'), ('Bina')$$,
  'anon reads both books'
);
reset role;

select test_helpers.as_user('11111111-1111-4111-8111-111111111111');
select results_eq(
  $$select username from public.profiles where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222') order by username$$,
  $$values ('asha'), ('bina')$$,
  'A reads both profiles'
);
select results_eq(
  $$select title from public.books where owner_id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222') order by title$$,
  $$values ('Asha Rao'), ('Bina')$$,
  'A reads both books'
);

-- AC-3: writing own rows and other people's -----------------------------------------------------

select is(
  test_helpers.affected($$update public.profiles
    set display_name = 'Asha R', bio = 'Pages', avatar_path = 'avatars/a.webp', preferred_language = 'en'
    where id = '11111111-1111-4111-8111-111111111111'$$),
  1::bigint, 'A updates their own profile'
);
select is(
  test_helpers.affected($$update public.books
    set title = 'Notebook', subtitle = 'Pages', cover_style = 'linen', font = 'amita', default_language = 'en'
    where owner_id = '11111111-1111-4111-8111-111111111111'$$),
  1::bigint, 'A updates their own book'
);
select is(
  test_helpers.affected($$update public.profiles set display_name = 'Hacked' where id = '22222222-2222-4222-8222-222222222222'$$),
  0::bigint, 'A updating B''s profile matches no rows'
);
select is(
  test_helpers.affected($$update public.books set title = 'Hacked' where owner_id = '22222222-2222-4222-8222-222222222222'$$),
  0::bigint, 'A updating B''s book matches no rows'
);
select throws_ok(
  $$insert into public.profiles (id, username, display_name) values ('22222222-2222-4222-8222-222222222222', 'other', 'Other')$$,
  '42501', 'permission denied for table profiles', 'A cannot insert a profile for B'
);
select throws_ok(
  $$insert into public.books (owner_id, title) values ('22222222-2222-4222-8222-222222222222', 'Other')$$,
  '42501', 'permission denied for table books', 'A cannot insert a book for B'
);
select throws_ok(
  $$delete from public.profiles where id = '22222222-2222-4222-8222-222222222222'$$,
  '42501', 'permission denied for table profiles', 'A cannot delete B''s profile'
);
select throws_ok(
  $$delete from public.books where owner_id = '11111111-1111-4111-8111-111111111111'$$,
  '42501', 'permission denied for table books', 'A cannot delete even their own book'
);
select throws_ok(
  $$update public.books set cover_style = 'glitter' where owner_id = '11111111-1111-4111-8111-111111111111'$$,
  '23514', null, 'A cannot set a cover style outside the list'
);

-- AC-4: protected columns and a second book -------------------------------------------------------

select throws_ok(
  $$update public.profiles set id = '44444444-4444-4444-8444-444444444444' where id = '11111111-1111-4111-8111-111111111111'$$,
  '42501', null, 'A cannot change profiles.id'
);
select throws_ok(
  $$update public.books set owner_id = '22222222-2222-4222-8222-222222222222' where owner_id = '11111111-1111-4111-8111-111111111111'$$,
  '42501', null, 'A cannot change books.owner_id'
);
select throws_ok(
  $$update public.profiles set username = 'asha_new' where id = '11111111-1111-4111-8111-111111111111'$$,
  '42501', null, 'A cannot change their username directly'
);
select throws_ok(
  $$update public.profiles set deactivated_at = null where id = '11111111-1111-4111-8111-111111111111'$$,
  '42501', null, 'A cannot change deactivated_at'
);
select throws_ok(
  $$insert into public.books (owner_id, title) values ('11111111-1111-4111-8111-111111111111', 'Second')$$,
  '42501', 'permission denied for table books', 'A cannot insert a second book'
);
reset role;

select throws_ok(
  $$insert into public.books (owner_id, title) values ('11111111-1111-4111-8111-111111111111', 'Second')$$,
  '23505', 'duplicate key value violates unique constraint "books_owner_id_key"',
  'even a superuser cannot give A a second book'
);
select results_eq(
  $$select display_name, bio, avatar_path, preferred_language from public.profiles where id = '11111111-1111-4111-8111-111111111111'$$,
  $$values ('Asha R'::text, 'Pages'::text, 'avatars/a.webp'::text, 'en'::text)$$,
  'A''s profile update was saved'
);
select results_eq(
  $$select title, subtitle, cover_style, font, default_language from public.books where owner_id = '11111111-1111-4111-8111-111111111111'$$,
  $$values ('Notebook'::text, 'Pages'::text, 'linen'::text, 'amita'::text, 'en'::text)$$,
  'A''s book update was saved'
);
update public.profiles set updated_at = '2000-01-01' where id = '11111111-1111-4111-8111-111111111111';
update public.books set updated_at = '2000-01-01' where owner_id = '11111111-1111-4111-8111-111111111111';
select is(
  (select array[p.updated_at, b.updated_at] from public.profiles p join public.books b on b.owner_id = p.id
   where p.id = '11111111-1111-4111-8111-111111111111'),
  array[now(), now()],
  'the triggers set updated_at to the time of the update, whatever the statement says'
);
select results_eq(
  $$select p.display_name, b.title from public.profiles p join public.books b on b.owner_id = p.id
    where p.id = '22222222-2222-4222-8222-222222222222'$$,
  $$values ('Bina'::text, 'Bina'::text)$$,
  'B''s profile and book are unchanged'
);

-- Check constraints are live (AC-8) --------------------------------------------------------------

select throws_ok($$update public.books set font = 'comic_sans' where owner_id = '22222222-2222-4222-8222-222222222222'$$,
  '23514', null, 'an unknown font is rejected');
select throws_ok($$update public.books set default_language = 'fr' where owner_id = '22222222-2222-4222-8222-222222222222'$$,
  '23514', null, 'an unknown book language is rejected');
select throws_ok($$update public.profiles set preferred_language = 'fr' where id = '22222222-2222-4222-8222-222222222222'$$,
  '23514', null, 'an unknown preferred language is rejected');
select throws_ok($$update public.profiles set username = 'Bina' where id = '22222222-2222-4222-8222-222222222222'$$,
  '23514', null, 'an uppercase username is rejected by the format check');
select throws_ok($$update public.profiles set username = '1bina' where id = '22222222-2222-4222-8222-222222222222'$$,
  '23514', null, 'a username starting with a digit is rejected');
select throws_ok($$update public.profiles set display_name = repeat('x', 51) where id = '22222222-2222-4222-8222-222222222222'$$,
  '23514', null, 'a display name over 50 characters is rejected');
select throws_ok($$update public.profiles set display_name = '   ' where id = '22222222-2222-4222-8222-222222222222'$$,
  '23514', null, 'a blank display name is rejected');
select throws_ok($$update public.profiles set bio = repeat('x', 161) where id = '22222222-2222-4222-8222-222222222222'$$,
  '23514', null, 'a bio over 160 characters is rejected');
select throws_ok($$update public.books set title = repeat('x', 101) where owner_id = '22222222-2222-4222-8222-222222222222'$$,
  '23514', null, 'a title over 100 characters is rejected');

-- AC-2: deactivated profiles are hidden from everyone but their owner ----------------------------

update public.profiles set deactivated_at = now() where id = '22222222-2222-4222-8222-222222222222';

select test_helpers.as_anon();
select results_eq(
  $$select username from public.profiles where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')$$,
  $$values ('asha')$$,
  'anon no longer sees B''s deactivated profile'
);
select is_empty(
  $$select * from public.books where owner_id = '22222222-2222-4222-8222-222222222222'$$,
  'anon no longer sees B''s book'
);
reset role;

select test_helpers.as_user('11111111-1111-4111-8111-111111111111');
select is_empty(
  $$select * from public.profiles where id = '22222222-2222-4222-8222-222222222222'$$,
  'A no longer sees B''s deactivated profile'
);
select is_empty(
  $$select * from public.books where owner_id = '22222222-2222-4222-8222-222222222222'$$,
  'A no longer sees B''s book'
);
reset role;

select test_helpers.as_user('22222222-2222-4222-8222-222222222222');
select results_eq(
  $$select p.username, b.title from public.profiles p join public.books b on b.owner_id = p.id
    where p.id = '22222222-2222-4222-8222-222222222222'$$,
  $$values ('bina'::text, 'Bina'::text)$$,
  'B still sees their own profile and book'
);
reset role;

select * from finish();
rollback;

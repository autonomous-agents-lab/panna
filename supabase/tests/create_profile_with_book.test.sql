-- Onboarding (BOOK-20): what create_profile_with_book refuses when a request bypasses the form,
-- and the route names reserved because books live at /<username>. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

create schema test_onboarding;
grant usage on schema test_onboarding to authenticated;

create function test_onboarding.as_user(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

insert into auth.users (id, aud, role, email) values
  ('a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'onboard-a@example.test'),
  ('a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'onboard-b@example.test');

-- AC-5: invalid fields raise and leave nothing behind -----------------------------------------

select test_onboarding.as_user('a0000000-0000-4000-8000-000000000001');
select throws_ok(
  $$select public.create_profile_with_book('onboard_a', repeat('x', 51), 'en')$$,
  '23514', null, 'a 51-character display name is rejected'
);
select throws_ok(
  $$select public.create_profile_with_book('onboard_a', '   ', 'en')$$,
  '23514', null, 'a blank display name is rejected'
);
select throws_ok(
  $$select public.create_profile_with_book('onboard_a', 'Onboard A', 'fr')$$,
  '23514', null, 'an unsupported language is rejected'
);
select throws_ok(
  $$select public.create_profile_with_book('on-board', 'Onboard A', 'en')$$,
  '23514', null, 'a username with a hyphen is rejected'
);
reset role;
select is((select count(*) from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'), 0::bigint,
  'no profile was written by the rejected calls');
select is((select count(*) from public.books where owner_id = 'a0000000-0000-4000-8000-000000000001'), 0::bigint,
  'no book was written by the rejected calls');

-- 'write' and every other route name is reserved, in any case ------------------------------

select ok(public.is_reserved_username('write'), 'write is reserved');
select ok(public.is_reserved_username(' WRITE '), 'the reservation ignores case and surrounding whitespace');
select ok(public.is_reserved_username('onboarding'), 'existing reservations are kept');

select test_onboarding.as_user('a0000000-0000-4000-8000-000000000001');
select throws_ok(
  $$select public.create_profile_with_book('write', 'Writer', 'en')$$,
  'P0001', 'username_reserved', 'create_profile_with_book rejects write'
);
select throws_ok(
  $$select public.create_profile_with_book('Write', 'Writer', 'en')$$,
  'P0001', 'username_reserved', 'create_profile_with_book rejects Write'
);
select throws_ok(
  $$select public.create_profile_with_book('WRITE', 'Writer', 'en')$$,
  'P0001', 'username_reserved', 'create_profile_with_book rejects WRITE'
);

-- AC-4: a name claimed meanwhile, in another case, is refused -----------------------------

select lives_ok(
  $$select public.create_profile_with_book('Onboard_Name', 'Onboard A', 'hi')$$,
  'A claims onboard_name'
);
reset role;

select test_onboarding.as_user('a0000000-0000-4000-8000-000000000002');
select throws_ok(
  $$select public.create_profile_with_book('ONBOARD_NAME', 'Onboard B', 'en')$$,
  '23505', 'duplicate key value violates unique constraint "profiles_username_lower_key"',
  'B cannot claim the same name in another case'
);
reset role;
select is((select count(*) from public.profiles where id = 'a0000000-0000-4000-8000-000000000002'), 0::bigint,
  'B has no profile after losing the race');

-- Ownership always comes from the session ----------------------------------------------------

select results_eq(
  $$select id, username, preferred_language from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'$$,
  $$values ('a0000000-0000-4000-8000-000000000001'::uuid, 'onboard_name'::text, 'hi'::text)$$,
  'the profile belongs to the caller, with the name lowercased and the chosen language'
);

select * from finish();
rollback;

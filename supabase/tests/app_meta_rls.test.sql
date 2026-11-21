begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

select has_table('public', 'app_meta', 'app_meta exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.app_meta'::regclass),
  'app_meta has row level security enabled'
);
select policies_are('public', 'app_meta', array['app_meta_select_all'], 'app_meta has only the select policy');
select results_eq(
  $$select key, value from public.app_meta$$,
  $$values ('seed_version', '1')$$,
  'the seed row exists after db reset'
);

-- anon
set local role anon;

select results_eq(
  $$select key, value from public.app_meta$$,
  $$values ('seed_version', '1')$$,
  'anon can select'
);
select throws_ok(
  $$insert into public.app_meta (key, value) values ('anon_key', 'x')$$,
  '42501', 'permission denied for table app_meta', 'anon cannot insert'
);
select throws_ok(
  $$update public.app_meta set value = 'x' where key = 'seed_version'$$,
  '42501', 'permission denied for table app_meta', 'anon cannot update'
);
select throws_ok(
  $$delete from public.app_meta where key = 'seed_version'$$,
  '42501', 'permission denied for table app_meta', 'anon cannot delete'
);
select throws_ok(
  $$truncate public.app_meta$$,
  '42501', 'permission denied for table app_meta', 'anon cannot truncate'
);

reset role;

-- authenticated
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$select key, value from public.app_meta$$,
  $$values ('seed_version', '1')$$,
  'authenticated can select'
);
select throws_ok(
  $$insert into public.app_meta (key, value) values ('user_key', 'x')$$,
  '42501', 'permission denied for table app_meta', 'authenticated cannot insert'
);
select throws_ok(
  $$update public.app_meta set value = 'x' where key = 'seed_version'$$,
  '42501', 'permission denied for table app_meta', 'authenticated cannot update'
);
select throws_ok(
  $$delete from public.app_meta where key = 'seed_version'$$,
  '42501', 'permission denied for table app_meta', 'authenticated cannot delete'
);
select throws_ok(
  $$truncate public.app_meta$$,
  '42501', 'permission denied for table app_meta', 'authenticated cannot truncate'
);

reset role;

select results_eq(
  $$select key, value from public.app_meta$$,
  $$values ('seed_version', '1')$$,
  'the seed row is unchanged after the denied writes'
);

select * from finish();
rollback;

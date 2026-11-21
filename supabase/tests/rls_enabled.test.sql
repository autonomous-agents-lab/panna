begin;
create extension if not exists pgtap with schema extensions;

select plan(2);

select is_empty(
  $$select tablename from pg_tables where schemaname = 'public' and not rowsecurity$$,
  'every table in the public schema has row level security enabled'
);

-- Self-check: a public table without RLS must trip the query above. It has to live in
-- `public` (a temp table lands in pg_temp and would never match); the rollback removes it.
create table public.rls_guard_probe (id int);

select results_eq(
  $$select tablename from pg_tables where schemaname = 'public' and not rowsecurity$$,
  $$values ('rls_guard_probe'::name)$$,
  'the guard reports a public table that has row level security disabled'
);

select * from finish();
rollback;

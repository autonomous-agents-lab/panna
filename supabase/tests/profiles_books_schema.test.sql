begin;
create extension if not exists pgtap with schema extensions;

select plan(44);

-- Tables, RLS and columns (AC-1). The exact column lists prove there is no email or other auth
-- data in these tables (AC-2).
select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'books', 'books exists');
select has_table('public', 'username_history', 'username_history exists');

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.books'::regclass), 'books has RLS enabled');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.username_history'::regclass),
  'username_history has RLS enabled'
);

select columns_are('public', 'profiles', array[
  'id', 'username', 'display_name', 'avatar_path', 'bio', 'preferred_language',
  'username_changed_at', 'created_at', 'updated_at', 'deactivated_at'
], 'profiles has exactly the contract columns');
select columns_are('public', 'books', array[
  'id', 'owner_id', 'title', 'subtitle', 'cover_style', 'font', 'default_language', 'created_at', 'updated_at'
], 'books has exactly the contract columns');
select columns_are('public', 'username_history', array[
  'id', 'profile_id', 'username', 'released_at', 'reusable_after'
], 'username_history has exactly its columns');

-- Indexes and keys (AC-4, AC-6).
select has_index('public', 'profiles', 'profiles_username_lower_key', 'the case-insensitive username index exists');
select ok(
  (select indisunique from pg_index where indexrelid = 'public.profiles_username_lower_key'::regclass),
  'the username index is unique'
);
select matches(
  pg_get_indexdef('public.profiles_username_lower_key'::regclass),
  'USING btree \(lower\(username\)\)',
  'the username index is on lower(username)'
);
select is(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'books_owner_id_key' and conrelid = 'public.books'::regclass),
  'UNIQUE (owner_id)',
  'books.owner_id is unique, so there is one book per owner'
);
select fk_ok('public', 'profiles', 'id', 'auth', 'users', 'id', 'profiles.id references auth.users');
select fk_ok('public', 'books', 'owner_id', 'public', 'profiles', 'id', 'books.owner_id references profiles');
select is_empty(
  $$select conname from pg_constraint
    where contype = 'f' and confdeltype = 'c'
      and conrelid in ('public.profiles'::regclass, 'public.books'::regclass, 'public.username_history'::regclass)$$,
  'no foreign key cascades on delete, so user content is never hard-deleted'
);

-- Check constraints are live (AC-8; their values are compared with src/config in Vitest).
select col_has_check('public', 'profiles', 'username', 'profiles.username has a format check');
select col_has_check('public', 'profiles', 'preferred_language', 'profiles.preferred_language has a check');
select col_has_check('public', 'books', 'cover_style', 'books.cover_style has a check');
select col_has_check('public', 'books', 'font', 'books.font has a check');
select col_has_check('public', 'books', 'default_language', 'books.default_language has a check');

-- Policies.
select policies_are('public', 'profiles', array['profiles_select_active_or_own', 'profiles_update_own'],
  'profiles has only the select and own-update policies');
select policies_are('public', 'books', array['books_select_active_or_own', 'books_update_own'],
  'books has only the select and own-update policies');
select is_empty(
  $$select policyname from pg_policies where schemaname = 'public' and tablename = 'username_history'$$,
  'username_history has no client policy'
);

-- Column privileges: only the editable columns are client-writable (AC-4).
select is(
  array(select column_name::text from information_schema.column_privileges
        where table_schema = 'public' and table_name = 'profiles' and grantee = 'authenticated'
          and privilege_type = 'UPDATE' order by column_name),
  array['avatar_path', 'bio', 'display_name', 'preferred_language'],
  'authenticated may update only display_name, avatar_path, bio and preferred_language on profiles'
);
select is(
  array(select column_name::text from information_schema.column_privileges
        where table_schema = 'public' and table_name = 'books' and grantee = 'authenticated'
          and privilege_type = 'UPDATE' order by column_name),
  array['cover_style', 'default_language', 'font', 'subtitle', 'title'],
  'authenticated may update only title, subtitle, cover_style, font and default_language on books'
);
select ok(
  not has_table_privilege('anon', 'public.profiles', 'INSERT, UPDATE, DELETE, TRUNCATE')
  and not has_table_privilege('anon', 'public.books', 'INSERT, UPDATE, DELETE, TRUNCATE')
  and not has_table_privilege('anon', 'public.username_history', 'INSERT, UPDATE, DELETE, TRUNCATE'),
  'anon cannot write any of the tables'
);
select ok(
  not has_table_privilege('authenticated', 'public.profiles', 'INSERT, DELETE, TRUNCATE')
  and not has_table_privilege('authenticated', 'public.books', 'INSERT, DELETE, TRUNCATE')
  and not has_table_privilege('authenticated', 'public.username_history', 'INSERT, UPDATE, DELETE, TRUNCATE'),
  'authenticated cannot insert, delete or truncate, nor write username_history'
);

-- Functions.
select is_definer('public', 'create_profile_with_book', array['text', 'text', 'text'],
  'create_profile_with_book is SECURITY DEFINER');
select is_definer('public', 'username_held_until', array['text'], 'username_held_until is SECURITY DEFINER');
select is(
  (select proconfig from pg_proc where oid = 'public.create_profile_with_book(text, text, text)'::regprocedure),
  array['search_path=""'],
  'create_profile_with_book pins an empty search_path'
);
select is(
  (select proconfig from pg_proc where oid = 'public.username_held_until(text)'::regprocedure),
  array['search_path=""'],
  'username_held_until pins an empty search_path'
);
select ok(
  has_function_privilege('authenticated', 'public.create_profile_with_book(text, text, text)', 'execute'),
  'authenticated can call create_profile_with_book'
);
select ok(
  not has_function_privilege('anon', 'public.create_profile_with_book(text, text, text)', 'execute'),
  'anon cannot call create_profile_with_book'
);
select ok(
  has_function_privilege('anon', 'public.username_held_until(text)', 'execute')
  and has_function_privilege('authenticated', 'public.username_held_until(text)', 'execute'),
  'anon and authenticated can call username_held_until'
);
select ok(
  not has_function_privilege('anon', 'public.is_reserved_username(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.is_reserved_username(text)', 'execute'),
  'clients cannot call is_reserved_username directly'
);
select ok(public.is_reserved_username(' Admin '), 'is_reserved_username trims and case-folds');
select ok(not public.is_reserved_username('asha'), 'is_reserved_username allows an ordinary name');
select ok(public.is_reserved_username(U&'\0009Admin\00A0'), 'is_reserved_username trims tabs and no-break spaces too');
select is(
  public.trim_whitespace(U&'\0009\000A\00A0\2028 Asha  Rao\3000\FEFF\000D'),
  'Asha  Rao',
  'trim_whitespace strips what JavaScript trim strips, from both ends only'
);
select is(public.trim_whitespace(U&'\0085Asha\200B'), U&'\0085Asha\200B',
  'trim_whitespace keeps characters JavaScript trim keeps (NEL, zero-width space)');
select ok(
  not has_function_privilege('anon', 'public.trim_whitespace(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.trim_whitespace(text)', 'execute'),
  'clients cannot call trim_whitespace directly'
);
select has_trigger('public', 'profiles', 'profiles_set_updated_at', 'profiles keeps updated_at current');
select has_trigger('public', 'books', 'books_set_updated_at', 'books keeps updated_at current');

select * from finish();
rollback;

-- Structure of chapters and pages (AC-1). Behaviour with real users is in chapters_pages_rls.test.sql.
begin;
create extension if not exists pgtap with schema extensions;

select plan(42);

-- Tables, RLS and columns.
select has_table('public', 'chapters', 'chapters exists');
select has_table('public', 'pages', 'pages exists');
select ok((select relrowsecurity from pg_class where oid = 'public.chapters'::regclass), 'chapters has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.pages'::regclass), 'pages has RLS enabled');

select columns_are('public', 'chapters', array[
  'id', 'book_id', 'position', 'title', 'status', 'published_at', 'archived_at', 'language', 'created_at', 'updated_at'
], 'chapters has exactly the contract columns');
select columns_are('public', 'pages', array[
  'id', 'book_id', 'chapter_id', 'position', 'status', 'published_at', 'archived_at', 'language', 'body',
  'created_at', 'updated_at'
], 'pages has exactly the contract columns');
select col_type_is('public', 'pages', 'body', 'jsonb', 'pages.body is jsonb');
select col_not_null('public', 'chapters', 'language', 'chapters.language is required');
select col_not_null('public', 'pages', 'language', 'pages.language is required');
select col_hasnt_default('public', 'chapters', 'language', 'chapters.language has no default');
select col_hasnt_default('public', 'pages', 'language', 'pages.language has no default');

-- Foreign keys.
select fk_ok('public', 'chapters', 'book_id', 'public', 'books', 'id', 'chapters.book_id references books');
select fk_ok('public', 'pages', 'book_id', 'public', 'books', 'id', 'pages.book_id references books');
select fk_ok('public', 'pages', array['chapter_id', 'book_id'], 'public', 'chapters', array['id', 'book_id'],
  'pages (chapter_id, book_id) references chapters, so a page and its chapter share a book');
select is_empty(
  $$select conname from pg_constraint
    where contype = 'f' and confdeltype = 'c'
      and conrelid in ('public.chapters'::regclass, 'public.pages'::regclass)$$,
  'no foreign key cascades on delete'
);

-- Ordering: unique positions per parent, deferrable so a reorder can swap them.
select is(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'chapters_book_id_position_key'),
  'UNIQUE (book_id, "position") DEFERRABLE INITIALLY DEFERRED',
  'chapter positions are unique per book, checked at commit'
);
select is(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'pages_chapter_id_position_key'),
  'UNIQUE (chapter_id, "position") DEFERRABLE INITIALLY DEFERRED',
  'page positions are unique per chapter, checked at commit'
);
select has_index('public', 'pages', 'pages_book_id_idx', 'pages are indexed by book');

-- Check constraints.
select col_has_check('public', 'chapters', 'status', 'chapters.status has a check');
select col_has_check('public', 'pages', 'status', 'pages.status has a check');
select col_has_check('public', 'chapters', 'language', 'chapters.language has a check');
select col_has_check('public', 'pages', 'language', 'pages.language has a check');
select col_has_check('public', 'chapters', 'position', 'chapters.position has a check');
select col_has_check('public', 'pages', 'position', 'pages.position has a check');
select col_has_check('public', 'chapters', 'title', 'chapters.title has checks');
select col_has_check('public', 'pages', 'body', 'pages.body has a shape check');

-- Policies: no DELETE (or ALL) policy for any role.
select policies_are('public', 'chapters',
  array['chapters_select_published_or_own', 'chapters_insert_own', 'chapters_update_own'],
  'chapters has only the select, insert and update policies');
select policies_are('public', 'pages',
  array['pages_select_published_or_own', 'pages_insert_own', 'pages_update_own'],
  'pages has only the select, insert and update policies');
select is_empty(
  $$select policyname from pg_policies
    where schemaname = 'public' and tablename in ('chapters', 'pages') and cmd in ('DELETE', 'ALL')$$,
  'no DELETE or ALL policy on chapters or pages'
);
select policy_roles_are('public', 'chapters', 'chapters_insert_own', array['authenticated'], 'only signed-in users may insert chapters');
select policy_roles_are('public', 'pages', 'pages_update_own', array['authenticated'], 'only signed-in users may update pages');

-- Privileges: only the editable columns are client-writable; nobody may delete.
select is(
  array(select column_name::text from information_schema.column_privileges
        where table_schema = 'public' and table_name = 'chapters' and grantee = 'authenticated'
          and privilege_type = 'INSERT' order by column_name),
  array['book_id', 'language', 'position', 'status', 'title'],
  'authenticated may insert only book_id, position, title, status and language on chapters'
);
select is(
  array(select column_name::text from information_schema.column_privileges
        where table_schema = 'public' and table_name = 'chapters' and grantee = 'authenticated'
          and privilege_type = 'UPDATE' order by column_name),
  array['archived_at', 'language', 'position', 'status', 'title'],
  'authenticated may update only position, title, status, language and archived_at on chapters'
);
select is(
  array(select column_name::text from information_schema.column_privileges
        where table_schema = 'public' and table_name = 'pages' and grantee = 'authenticated'
          and privilege_type = 'INSERT' order by column_name),
  array['body', 'book_id', 'chapter_id', 'language', 'position', 'status'],
  'authenticated may insert only book_id, chapter_id, position, status, language and body on pages'
);
select is(
  array(select column_name::text from information_schema.column_privileges
        where table_schema = 'public' and table_name = 'pages' and grantee = 'authenticated'
          and privilege_type = 'UPDATE' order by column_name),
  array['archived_at', 'body', 'chapter_id', 'language', 'position', 'status'],
  'authenticated may update only chapter_id, position, status, language, archived_at and body on pages'
);
select ok(
  not has_table_privilege('anon', 'public.chapters', 'INSERT, UPDATE, DELETE, TRUNCATE')
  and not has_table_privilege('anon', 'public.pages', 'INSERT, UPDATE, DELETE, TRUNCATE')
  and not has_any_column_privilege('anon', 'public.chapters', 'INSERT, UPDATE')
  and not has_any_column_privilege('anon', 'public.pages', 'INSERT, UPDATE'),
  'anon cannot write chapters or pages'
);
select ok(
  not has_table_privilege('authenticated', 'public.chapters', 'DELETE, TRUNCATE')
  and not has_table_privilege('authenticated', 'public.pages', 'DELETE, TRUNCATE'),
  'authenticated cannot delete or truncate chapters or pages'
);

-- Triggers and the function behind them.
select has_trigger('public', 'chapters', 'chapters_apply_publication_state', 'chapters stamps published_at and archived_at');
select has_trigger('public', 'pages', 'pages_apply_publication_state', 'pages stamps published_at and archived_at');
select has_trigger('public', 'chapters', 'chapters_set_updated_at', 'chapters keeps updated_at current');
select has_trigger('public', 'pages', 'pages_set_updated_at', 'pages keeps updated_at current');
select ok(
  not has_function_privilege('anon', 'public.apply_publication_state()', 'execute')
  and not has_function_privilege('authenticated', 'public.apply_publication_state()', 'execute')
  and (select proconfig from pg_proc where oid = 'public.apply_publication_state()'::regprocedure) = array['search_path=""'],
  'clients cannot call apply_publication_state, and it pins an empty search_path'
);

select * from finish();
rollback;

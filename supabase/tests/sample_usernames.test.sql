begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

-- The reader's sample books are served at these names, so nobody can claim them.
select ok(public.is_reserved_username('sample_writer_bilingual'), 'sample_writer_bilingual is reserved');
select ok(public.is_reserved_username('sample_writer_empty'), 'sample_writer_empty is reserved');
select ok(public.is_reserved_username(' Sample_Writer_Drafts '), 'sample_writer_drafts is reserved, trimmed and case-folded');
select ok(public.is_reserved_username('admin'), 'the earlier reserved names are still reserved');
select ok(
  not has_function_privilege('anon', 'public.is_reserved_username(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.is_reserved_username(text)', 'execute'),
  'replacing is_reserved_username keeps clients from calling it'
);

select * from finish();
rollback;

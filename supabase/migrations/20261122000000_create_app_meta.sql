-- Pattern table: every new table follows this shape. RLS on, an explicit policy per allowed
-- action, and client write privileges revoked so a denied write raises 42501 instead of
-- silently affecting zero rows.
create table public.app_meta (
  key text primary key check (length(trim(key)) > 0),
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.app_meta is
  'Pattern table for migrations: app-wide key/value metadata. Readable by anyone, writable by no client role. Not used by app features yet.';

alter table public.app_meta enable row level security;

create policy app_meta_select_all
  on public.app_meta
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.app_meta from anon, authenticated;

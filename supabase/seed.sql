-- Runs after migrations on `npx supabase db reset`. Local development data only.
insert into public.app_meta (key, value)
values ('seed_version', '1')
on conflict (key) do nothing;

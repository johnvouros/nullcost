create table if not exists public.account_profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text not null,
    display_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

drop trigger if exists account_profiles_set_updated_at on public.account_profiles;
create trigger account_profiles_set_updated_at
before update on public.account_profiles
for each row
execute function public.set_updated_at();

create or replace function public.sync_account_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.account_profiles (
        id,
        email,
        display_name
    )
    values (
        new.id,
        coalesce(new.email, ''),
        coalesce(
            nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
            nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
            'operator'
        )
    )
    on conflict (id) do update
    set
        email = excluded.email,
        display_name = coalesce(
            nullif(trim(public.account_profiles.display_name), ''),
            excluded.display_name
        );

    return new;
end;
$$;

drop trigger if exists on_auth_user_saved on auth.users;
create trigger on_auth_user_saved
after insert or update on auth.users
for each row
execute function public.sync_account_profile_from_auth_user();

insert into public.account_profiles (id, email, display_name)
select
    u.id,
    coalesce(u.email, ''),
    coalesce(
        nullif(trim(coalesce(u.raw_user_meta_data ->> 'display_name', '')), ''),
        nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
        'operator'
    )
from auth.users u
on conflict (id) do update
set
    email = excluded.email,
    display_name = coalesce(
        nullif(trim(public.account_profiles.display_name), ''),
        excluded.display_name
    );

alter table public.account_profiles enable row level security;

drop policy if exists "users can read own account profile" on public.account_profiles;
create policy "users can read own account profile"
on public.account_profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "users can update own account profile" on public.account_profiles;
create policy "users can update own account profile"
on public.account_profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

grant select, update on public.account_profiles to authenticated;

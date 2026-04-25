create table if not exists public.referral_profile_private (
    profile_id uuid primary key references public.referral_profiles (id) on delete cascade,
    contact_email text,
    default_disclosure text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

drop trigger if exists referral_profile_private_set_updated_at on public.referral_profile_private;
create trigger referral_profile_private_set_updated_at
before update on public.referral_profile_private
for each row
execute function public.set_updated_at();

insert into public.referral_profile_private (profile_id, contact_email)
select rp.id, rp.contact_email
from public.referral_profiles rp
where rp.contact_email is not null
on conflict (profile_id) do update
set contact_email = excluded.contact_email;

update public.referral_profiles
set contact_email = null
where contact_email is not null;

create table if not exists public.profile_memberships (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.referral_profiles (id) on delete cascade,
    account_id uuid not null references public.account_profiles (id) on delete cascade,
    role text not null default 'owner' check (role in ('owner', 'editor')),
    status text not null default 'pending' check (status in ('pending', 'active', 'rejected')),
    claim_note text,
    rejection_reason text,
    responded_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint profile_memberships_profile_account_unique unique (profile_id, account_id)
);

create index if not exists profile_memberships_account_status_idx
on public.profile_memberships (account_id, status, created_at desc);

create index if not exists profile_memberships_profile_status_idx
on public.profile_memberships (profile_id, status, created_at desc);

create unique index if not exists profile_memberships_one_active_owner_idx
on public.profile_memberships (profile_id)
where role = 'owner' and status = 'active';

drop trigger if exists profile_memberships_set_updated_at on public.profile_memberships;
create trigger profile_memberships_set_updated_at
before update on public.profile_memberships
for each row
execute function public.set_updated_at();

alter table public.referral_entries
    alter column status set default 'draft';

alter table public.referral_entries
    drop constraint if exists referral_entries_status_check;

alter table public.referral_entries
    add constraint referral_entries_status_check
    check (status in ('draft', 'pending', 'active', 'paused', 'rejected', 'archived'));

alter table public.referral_entries
    add column if not exists review_note text,
    add column if not exists reviewed_at timestamptz,
    add column if not exists reviewed_by uuid references public.account_profiles (id) on delete set null,
    add column if not exists submitted_at timestamptz;

alter table public.referral_profile_private enable row level security;
alter table public.profile_memberships enable row level security;

grant select, insert, update, delete on public.referral_profile_private to authenticated;
grant select, insert, update, delete on public.profile_memberships to authenticated;

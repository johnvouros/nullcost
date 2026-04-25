create table if not exists public.referral_profiles (
    id uuid primary key default gen_random_uuid(),
    slug text not null,
    display_name text not null,
    bio text,
    website text,
    contact_email text,
    status text not null default 'active' check (status in ('active', 'paused')),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists referral_profiles_slug_lower_idx
on public.referral_profiles (lower(slug));

create table if not exists public.referral_entries (
    id uuid primary key default gen_random_uuid(),
    provider_id uuid not null references public.providers (id) on delete cascade,
    profile_id uuid not null references public.referral_profiles (id) on delete cascade,
    status text not null default 'pending' check (status in ('pending', 'active', 'paused', 'rejected', 'archived')),
    kind text not null default 'referral_link' check (kind in ('affiliate_link', 'referral_link', 'coupon_code')),
    title text,
    referral_url text,
    destination_url text,
    referral_code text,
    notes text,
    disclosure text,
    weight integer not null default 1 check (weight > 0),
    selection_count bigint not null default 0,
    click_count bigint not null default 0,
    last_selected_at timestamptz,
    last_clicked_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint referral_entries_payload_check check (
        referral_url is not null or referral_code is not null
    ),
    constraint referral_entries_referral_url_http_check check (
        referral_url is null or referral_url ~* '^https?://'
    ),
    constraint referral_entries_destination_url_http_check check (
        destination_url is null or destination_url ~* '^https?://'
    )
);

create unique index if not exists referral_entries_unique_submission_idx
on public.referral_entries (
    provider_id,
    profile_id,
    coalesce(lower(referral_url), ''),
    coalesce(lower(referral_code), '')
);

create index if not exists referral_entries_provider_status_idx
on public.referral_entries (provider_id, status, created_at desc);

create index if not exists referral_entries_profile_idx
on public.referral_entries (profile_id, created_at desc);

create table if not exists public.referral_rotations (
    id uuid primary key default gen_random_uuid(),
    provider_id uuid not null references public.providers (id) on delete cascade,
    entry_id uuid not null references public.referral_entries (id) on delete cascade,
    profile_id uuid not null references public.referral_profiles (id) on delete cascade,
    kind text not null,
    resolved_url text,
    resolved_code text,
    source text not null default 'site',
    session_id text,
    metadata jsonb not null default '{}'::jsonb,
    selected_at timestamptz not null default now(),
    clicked_at timestamptz,
    click_metadata jsonb not null default '{}'::jsonb
);

create index if not exists referral_rotations_provider_idx
on public.referral_rotations (provider_id, selected_at desc);

create index if not exists referral_rotations_entry_idx
on public.referral_rotations (entry_id, selected_at desc);

drop trigger if exists referral_profiles_set_updated_at on public.referral_profiles;
create trigger referral_profiles_set_updated_at
before update on public.referral_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists referral_entries_set_updated_at on public.referral_entries;
create trigger referral_entries_set_updated_at
before update on public.referral_entries
for each row
execute function public.set_updated_at();

create or replace function public.resolve_referral_entry(
    provider_slug_input text,
    requested_kind_input text default null,
    request_source_input text default 'site',
    request_session_id_input text default null,
    request_metadata_input jsonb default '{}'::jsonb
)
returns table (
    rotation_id uuid,
    provider_id uuid,
    provider_slug text,
    provider_name text,
    entry_id uuid,
    profile_id uuid,
    profile_slug text,
    profile_display_name text,
    kind text,
    title text,
    resolved_url text,
    destination_url text,
    referral_code text,
    disclosure text,
    notes text,
    selection_count bigint,
    click_count bigint,
    selected_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
    return query
    with provider_match as (
        select p.id, p.slug, p.name
        from public.providers p
        where lower(p.slug) = lower(trim(provider_slug_input))
        limit 1
    ),
    candidate as (
        select e.*
        from public.referral_entries e
        join provider_match p on p.id = e.provider_id
        where e.status = 'active'
          and (
              nullif(trim(coalesce(requested_kind_input, '')), '') is null
              or e.kind = nullif(trim(requested_kind_input), '')
          )
        order by
            (e.selection_count::numeric / greatest(e.weight, 1)) asc,
            coalesce(e.last_selected_at, to_timestamp(0)) asc,
            random()
        limit 1
    ),
    updated_entry as (
        update public.referral_entries e
        set selection_count = e.selection_count + 1,
            last_selected_at = now()
        from candidate c
        where e.id = c.id
        returning e.*
    ),
    inserted_rotation as (
        insert into public.referral_rotations (
            provider_id,
            entry_id,
            profile_id,
            kind,
            resolved_url,
            resolved_code,
            source,
            session_id,
            metadata
        )
        select
            e.provider_id,
            e.id,
            e.profile_id,
            e.kind,
            coalesce(e.referral_url, e.destination_url),
            e.referral_code,
            coalesce(nullif(trim(request_source_input), ''), 'site'),
            nullif(trim(coalesce(request_session_id_input, '')), ''),
            coalesce(request_metadata_input, '{}'::jsonb)
        from updated_entry e
        returning *
    )
    select
        r.id as rotation_id,
        p.id as provider_id,
        p.slug as provider_slug,
        p.name as provider_name,
        e.id as entry_id,
        rp.id as profile_id,
        rp.slug as profile_slug,
        rp.display_name as profile_display_name,
        e.kind,
        e.title,
        r.resolved_url,
        e.destination_url,
        e.referral_code,
        e.disclosure,
        e.notes,
        e.selection_count,
        e.click_count,
        r.selected_at
    from inserted_rotation r
    join updated_entry e on e.id = r.entry_id
    join provider_match p on p.id = e.provider_id
    join public.referral_profiles rp on rp.id = e.profile_id;
end;
$$;

create or replace function public.record_referral_click(
    rotation_id_input uuid,
    click_metadata_input jsonb default '{}'::jsonb
)
returns table (
    rotation_id uuid,
    entry_id uuid,
    recorded boolean,
    click_count bigint,
    clicked_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
    return query
    with target as (
        select r.id, r.entry_id, r.clicked_at
        from public.referral_rotations r
        where r.id = rotation_id_input
        limit 1
    ),
    updated_rotation as (
        update public.referral_rotations r
        set clicked_at = now(),
            click_metadata = coalesce(r.click_metadata, '{}'::jsonb) || coalesce(click_metadata_input, '{}'::jsonb)
        from target t
        where r.id = t.id
          and t.clicked_at is null
        returning r.id, r.entry_id, r.clicked_at
    ),
    updated_entry as (
        update public.referral_entries e
        set click_count = e.click_count + 1,
            last_clicked_at = now()
        from updated_rotation r
        where e.id = r.entry_id
        returning e.id, e.click_count
    ),
    current_state as (
        select
            t.id as rotation_id,
            t.entry_id,
            exists(select 1 from updated_rotation) as recorded,
            coalesce(
                (select ue.click_count from updated_entry ue where ue.id = t.entry_id),
                e.click_count
            ) as click_count,
            coalesce(
                (select ur.clicked_at from updated_rotation ur where ur.id = t.id),
                t.clicked_at
            ) as clicked_at
        from target t
        join public.referral_entries e on e.id = t.entry_id
    )
    select
        c.rotation_id,
        c.entry_id,
        c.recorded,
        c.click_count,
        c.clicked_at
    from current_state c;
end;
$$;

alter table public.referral_profiles enable row level security;
alter table public.referral_entries enable row level security;
alter table public.referral_rotations enable row level security;

drop policy if exists "referral profiles are publicly readable" on public.referral_profiles;
create policy "referral profiles are publicly readable"
on public.referral_profiles
for select
to anon, authenticated
using (status = 'active');

drop policy if exists "active referral entries are publicly readable" on public.referral_entries;
create policy "active referral entries are publicly readable"
on public.referral_entries
for select
to anon, authenticated
using (status = 'active');

grant execute on function public.resolve_referral_entry(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.record_referral_click(uuid, jsonb) to anon, authenticated;

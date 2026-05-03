create table if not exists public.referral_router_controls (
    provider_id uuid primary key references public.providers (id) on delete cascade,
    mode text not null default 'weighted' check (mode in ('weighted', 'equal', 'paused', 'fallback_only')),
    fallback_preference text not null default 'official' check (fallback_preference in ('official', 'docs', 'pricing', 'signup', 'provider_page')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.referral_router_controls enable row level security;

drop trigger if exists referral_router_controls_set_updated_at on public.referral_router_controls;
create trigger referral_router_controls_set_updated_at
before update on public.referral_router_controls
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
        select
            p.id,
            p.slug,
            p.name,
            coalesce(rc.mode, 'weighted') as router_mode
        from public.providers p
        left join public.referral_router_controls rc on rc.provider_id = p.id
        where lower(p.slug) = lower(trim(provider_slug_input))
        limit 1
    ),
    candidate as (
        select e.*
        from public.referral_entries e
        join provider_match p on p.id = e.provider_id
        where e.status = 'active'
          and p.router_mode not in ('paused', 'fallback_only')
          and (
              nullif(trim(coalesce(requested_kind_input, '')), '') is null
              or e.kind = nullif(trim(requested_kind_input), '')
          )
        order by
            case
                when p.router_mode = 'equal' then e.selection_count::numeric
                else (e.selection_count::numeric / greatest(e.weight, 1))
            end asc,
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

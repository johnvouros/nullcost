create table if not exists public.request_rate_limits (
    scope text not null,
    bucket_key text not null,
    window_start timestamptz not null,
    hit_count integer not null default 1 check (hit_count > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (scope, bucket_key, window_start)
);

alter table public.request_rate_limits enable row level security;

drop trigger if exists request_rate_limits_set_updated_at on public.request_rate_limits;
create trigger request_rate_limits_set_updated_at
before update on public.request_rate_limits
for each row
execute function public.set_updated_at();

create or replace function public.apply_rate_limit(
    scope_input text,
    bucket_key_input text,
    window_seconds_input integer,
    max_hits_input integer
)
returns table (
    allowed boolean,
    hit_count integer,
    retry_after_seconds integer,
    window_started_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
    safe_window_seconds integer;
    bucket_start timestamptz;
    current_hits integer;
    seconds_elapsed integer;
begin
    if nullif(trim(coalesce(scope_input, '')), '') is null then
        raise exception 'scope_input is required';
    end if;

    if nullif(trim(coalesce(bucket_key_input, '')), '') is null then
        raise exception 'bucket_key_input is required';
    end if;

    safe_window_seconds := greatest(coalesce(window_seconds_input, 0), 1);

    if coalesce(max_hits_input, 0) <= 0 then
        raise exception 'max_hits_input must be positive';
    end if;

    bucket_start := to_timestamp(floor(extract(epoch from now()) / safe_window_seconds) * safe_window_seconds);

    insert into public.request_rate_limits (
        scope,
        bucket_key,
        window_start,
        hit_count
    )
    values (
        trim(scope_input),
        trim(bucket_key_input),
        bucket_start,
        1
    )
    on conflict (scope, bucket_key, window_start)
    do update
    set
        hit_count = public.request_rate_limits.hit_count + 1,
        updated_at = now()
    returning public.request_rate_limits.hit_count
    into current_hits;

    seconds_elapsed := floor(extract(epoch from now() - bucket_start));

    return query
    select
        current_hits <= max_hits_input,
        current_hits,
        greatest(safe_window_seconds - seconds_elapsed, 0),
        bucket_start;
end;
$$;

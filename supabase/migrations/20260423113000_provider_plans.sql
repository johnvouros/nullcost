create table if not exists public.provider_plans (
    id uuid primary key default gen_random_uuid(),
    provider_id uuid not null references public.providers (id) on delete cascade,
    slug text not null,
    name text not null,
    summary text,
    price_label text not null,
    price_amount numeric,
    currency text default 'USD',
    billing_period text default 'month' check (billing_period in ('month', 'year', 'usage', 'custom')),
    plan_type text not null check (plan_type in ('free', 'paid', 'enterprise')),
    best_for_tags jsonb not null default '[]'::jsonb,
    official_url text,
    source_url text,
    sort_order integer not null default 100,
    trial_available boolean not null default false,
    contact_sales_only boolean not null default false,
    last_checked date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (provider_id, slug)
);

create index if not exists provider_plans_provider_id_idx on public.provider_plans (provider_id);
create index if not exists provider_plans_provider_sort_idx on public.provider_plans (provider_id, sort_order asc);

drop trigger if exists provider_plans_set_updated_at on public.provider_plans;
create trigger provider_plans_set_updated_at
before update on public.provider_plans
for each row
execute function public.set_updated_at();

alter table public.provider_plans enable row level security;

drop policy if exists "provider plans are publicly readable" on public.provider_plans;
create policy "provider plans are publicly readable"
on public.provider_plans
for select
to anon, authenticated
using (true);

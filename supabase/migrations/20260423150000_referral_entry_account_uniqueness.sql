create or replace function public.enforce_single_provider_code_per_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.status = 'archived' then
        return new;
    end if;

    if exists (
        select 1
        from public.profile_memberships current_membership
        join public.profile_memberships other_membership
          on other_membership.account_id = current_membership.account_id
         and other_membership.status = 'active'
        join public.referral_entries other_entry
          on other_entry.profile_id = other_membership.profile_id
        where current_membership.profile_id = new.profile_id
          and current_membership.status = 'active'
          and other_entry.provider_id = new.provider_id
          and other_entry.status <> 'archived'
          and other_entry.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) then
        raise exception 'You already have a code for this provider. Edit the existing code instead.';
    end if;

    return new;
end;
$$;

drop trigger if exists referral_entries_one_provider_code_per_account on public.referral_entries;
create trigger referral_entries_one_provider_code_per_account
before insert or update of provider_id, profile_id, status
on public.referral_entries
for each row
execute function public.enforce_single_provider_code_per_account();

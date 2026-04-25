drop policy if exists "referral profiles are publicly readable" on public.referral_profiles;
drop policy if exists "active referral entries are publicly readable" on public.referral_entries;

revoke execute on function public.resolve_referral_entry(text, text, text, text, jsonb) from anon, authenticated;
revoke execute on function public.record_referral_click(uuid, jsonb) from anon, authenticated;

grant execute on function public.resolve_referral_entry(text, text, text, text, jsonb) to service_role;
grant execute on function public.record_referral_click(uuid, jsonb) to service_role;

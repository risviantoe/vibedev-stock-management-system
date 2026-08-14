-- Deterministic demo bootstrap for a fresh environment.
-- Prerequisite: create the Admin auth user first so the profile trigger has
-- produced one public.profiles row.
--
-- Run with:
-- supabase db query --linked --file supabase/demo_seed.sql

do $$
declare
  v_actor_id uuid;
begin
  select profile.id
  into v_actor_id
  from public.profiles as profile
  where profile.role = 'ADMIN'
  order by profile.created_at, profile.id
  limit 1;

  if v_actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'DEMO_ADMIN_PROFILE_REQUIRED';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_actor_id,
      'role', 'authenticated'
    )::text,
    true
  );

  perform public.reset_demo_dataset('RESET DEMO');
end;
$$;

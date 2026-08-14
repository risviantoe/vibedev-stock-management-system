-- Post-seed smoke check for a disposable fresh database.
-- Run after all migrations, creation of one Admin auth user, and demo_seed.sql.

do $$
declare
  v_actor_id uuid;
  v_status jsonb;
  v_integrity jsonb;
begin
  select profile.id
  into v_actor_id
  from public.profiles as profile
  where profile.role = 'ADMIN'
  order by profile.created_at, profile.id
  limit 1;

  if v_actor_id is null then
    raise exception 'Fresh-install smoke requires one Admin profile';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_actor_id,
      'role', 'authenticated'
    )::text,
    true
  );

  select public.get_demo_dataset_status() into v_status;
  select public.get_integrity_report() into v_integrity;

  if not (v_status ->> 'ready')::boolean
    or (v_status #>> '{counts,products}')::integer <> 6
    or (v_status #>> '{counts,movements}')::integer <> 14 then
    raise exception 'Fresh demo dataset is not ready: %', v_status;
  end if;

  if v_integrity ->> 'overall_status' <> 'PASS'
    or (v_integrity ->> 'passed_count')::integer <> 8 then
    raise exception 'Fresh demo integrity is not 8/8: %', v_integrity;
  end if;

  raise notice
    'Fresh install ready: % products, % movements, integrity %/%',
    v_status #>> '{counts,products}',
    v_status #>> '{counts,movements}',
    v_integrity ->> 'passed_count',
    jsonb_array_length(v_integrity -> 'checks');
end;
$$;

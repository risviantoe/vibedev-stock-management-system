-- Smoke checks for the page-level operational retrieval functions.

do $$
declare
  v_actor_id uuid;
  v_row_count integer;
  v_total_count bigint;
begin
  select profile.id
  into v_actor_id
  from public.profiles as profile
  where profile.role = 'ADMIN'
  order by profile.created_at, profile.id
  limit 1;

  if v_actor_id is null then
    raise exception 'Operational retrieval test requires one Admin profile';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_actor_id,
      'role', 'authenticated'
    )::text,
    true
  );

  select count(*), max(result.total_count)
  into v_row_count, v_total_count
  from public.search_inventory_products(
    p_status => 'ALL',
    p_page => 1,
    p_page_size => 2
  ) as result;

  if v_row_count > 2 or coalesce(v_total_count, 0) < v_row_count then
    raise exception 'Product retrieval returned an invalid page: %/%',
      v_row_count,
      v_total_count;
  end if;

  select count(*), max(result.total_count)
  into v_row_count, v_total_count
  from public.search_stock_movements(
    p_page => 1,
    p_page_size => 2
  ) as result;

  if v_row_count > 2 or coalesce(v_total_count, 0) < v_row_count then
    raise exception 'Ledger retrieval returned an invalid page: %/%',
      v_row_count,
      v_total_count;
  end if;

  select count(*), max(result.total_count)
  into v_row_count, v_total_count
  from public.search_marketplace_orders(
    p_page => 1,
    p_page_size => 2
  ) as result;

  if v_row_count > 2 or coalesce(v_total_count, 0) < v_row_count then
    raise exception 'Marketplace order retrieval returned an invalid page: %/%',
      v_row_count,
      v_total_count;
  end if;

  select count(*), max(result.total_count)
  into v_row_count, v_total_count
  from public.search_marketplace_event_attempts(
    p_page => 1,
    p_page_size => 2
  ) as result;

  if v_row_count > 2 or coalesce(v_total_count, 0) < v_row_count then
    raise exception 'Marketplace event retrieval returned an invalid page: %/%',
      v_row_count,
      v_total_count;
  end if;

  if exists (
    select 1
    from public.search_inventory_products(
      p_search => '___retrieval_no_match___',
      p_status => 'ALL'
    )
  ) then
    raise exception 'Product retrieval ignored the search term';
  end if;

  raise notice 'Operational retrieval functions passed pagination and filtering checks';
end;
$$;

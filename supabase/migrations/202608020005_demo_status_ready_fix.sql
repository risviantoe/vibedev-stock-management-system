begin;

create or replace function public.get_demo_dataset_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_settings public.system_settings%rowtype;
begin
  perform public.assert_admin();

  select *
  into strict v_settings
  from public.system_settings
  where id;

  return jsonb_build_object(
    'demo_mode', v_settings.demo_mode,
    'dataset_key', 'stokledger-demo-v1',
    'generation', v_settings.demo_generation,
    'last_reset_at', v_settings.demo_reset_at,
    'ready',
      v_settings.demo_generation > 0
      and exists (
        select 1
        from public.products
        where id = '61000000-0000-4000-8000-000000000001'
          and sku = 'CLN-GENTLE-100'
      )
      and (select count(*) > 0 from public.stock_ledger)
      and (select count(*) > 0 from public.orders),
    'counts', jsonb_build_object(
      'products', (select count(*) from public.products),
      'batches', (select count(*) from public.batches),
      'orders', (select count(*) from public.orders),
      'movements', (select count(*) from public.stock_ledger),
      'returns', (select count(*) from public.returns),
      'open_anomalies',
        (select count(*) from public.anomalies where status = 'OPEN')
    )
  );
end;
$$;

revoke execute on function public.get_demo_dataset_status() from public;
grant execute on function public.get_demo_dataset_status() to authenticated;

commit;

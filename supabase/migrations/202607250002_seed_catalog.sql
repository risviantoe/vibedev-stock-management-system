begin;

insert into public.products (id, sku, name, is_active)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'CLN-GENTLE-100',
    'Gentle Barrier Cleanser 100 ml',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'SER-NIAC-020',
    'Niacinamide Serum 20 ml',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'SUN-DAILY-030',
    'Daily Shield Sunscreen 30 ml',
    true
  )
on conflict (id) do update
set
  sku = excluded.sku,
  name = excluded.name,
  is_active = excluded.is_active;

insert into public.batches (
  id,
  product_id,
  batch_code,
  expiry_date,
  source_type
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'CLN-2026-01',
    '2027-01-31',
    'PRODUCTION'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'SER-2026-03',
    '2027-03-31',
    'PRODUCTION'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    'SUN-2026-04',
    '2027-04-30',
    'PRODUCTION'
  )
on conflict (id) do update
set
  product_id = excluded.product_id,
  batch_code = excluded.batch_code,
  expiry_date = excluded.expiry_date,
  source_type = excluded.source_type;

commit;

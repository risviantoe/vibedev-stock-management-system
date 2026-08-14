begin;

insert into public.products (id, sku, name, is_active)
values
  (
    '10000000-0000-4000-8000-000000000004',
    'TON-HYDR-100',
    'Hydrating Essence Toner 100 ml',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    'MSK-CALM-001',
    'Calming Sheet Mask',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000006',
    'LIP-BALM-010',
    'Ceramide Lip Balm 10 g',
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
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000004',
    'TON-2026-04',
    '2027-04-30',
    'PRODUCTION'
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000005',
    'MSK-2026-06',
    '2027-06-30',
    'PRODUCTION'
  ),
  (
    '20000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000006',
    'LIP-2026-07',
    '2027-07-31',
    'PRODUCTION'
  )
on conflict (id) do update
set
  product_id = excluded.product_id,
  batch_code = excluded.batch_code,
  expiry_date = excluded.expiry_date,
  source_type = excluded.source_type;

insert into public.bundles (id, sku, name, is_active)
values (
  '30000000-0000-4000-8000-000000000001',
  'GLOW-KIT',
  'Glow Routine Kit',
  true
)
on conflict (id) do update
set
  sku = excluded.sku,
  name = excluded.name,
  is_active = excluded.is_active;

insert into public.bundle_recipe_versions (
  id,
  bundle_id,
  version,
  effective_from
)
values (
  '31000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  1,
  '2025-01-01T00:00:00Z'
)
on conflict (id) do update
set
  bundle_id = excluded.bundle_id,
  version = excluded.version,
  effective_from = excluded.effective_from;

insert into public.bundle_recipe_components (
  id,
  recipe_version_id,
  product_id,
  qty
)
values
  (
    '32000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    1
  ),
  (
    '32000000-0000-4000-8000-000000000002',
    '31000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000004',
    1
  )
on conflict (id) do update
set
  recipe_version_id = excluded.recipe_version_id,
  product_id = excluded.product_id,
  qty = excluded.qty;

insert into public.promo_rules (
  id,
  name,
  start_at,
  end_at,
  channel,
  is_active
)
values (
  '33000000-0000-4000-8000-000000000001',
  'Serum Bonus Mask',
  '2025-01-01T00:00:00Z',
  '2030-01-01T00:00:00Z',
  'SHOPEE',
  true
)
on conflict (id) do update
set
  name = excluded.name,
  start_at = excluded.start_at,
  end_at = excluded.end_at,
  channel = excluded.channel,
  is_active = excluded.is_active;

insert into public.promo_rule_items (
  id,
  promo_rule_id,
  trigger_product_id,
  trigger_qty,
  free_product_id,
  free_qty
)
values (
  '34000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  2,
  '10000000-0000-4000-8000-000000000005',
  1
)
on conflict (id) do update
set
  promo_rule_id = excluded.promo_rule_id,
  trigger_product_id = excluded.trigger_product_id,
  trigger_qty = excluded.trigger_qty,
  free_product_id = excluded.free_product_id,
  free_qty = excluded.free_qty;

insert into public.marketplace_listings (
  id,
  channel,
  listing_sku,
  listing_type,
  product_id,
  bundle_id,
  is_active
)
values
  (
    '35000000-0000-4000-8000-000000000001',
    'SHOPEE',
    'CLN-GENTLE-100',
    'PHYSICAL',
    '10000000-0000-4000-8000-000000000001',
    null,
    true
  ),
  (
    '35000000-0000-4000-8000-000000000002',
    'SHOPEE',
    'SER-NIAC-020',
    'PHYSICAL',
    '10000000-0000-4000-8000-000000000002',
    null,
    true
  ),
  (
    '35000000-0000-4000-8000-000000000003',
    'SHOPEE',
    'SUN-DAILY-030',
    'PHYSICAL',
    '10000000-0000-4000-8000-000000000003',
    null,
    true
  ),
  (
    '35000000-0000-4000-8000-000000000004',
    'SHOPEE',
    'TON-HYDR-100',
    'PHYSICAL',
    '10000000-0000-4000-8000-000000000004',
    null,
    true
  ),
  (
    '35000000-0000-4000-8000-000000000005',
    'SHOPEE',
    'MSK-CALM-001',
    'PHYSICAL',
    '10000000-0000-4000-8000-000000000005',
    null,
    true
  ),
  (
    '35000000-0000-4000-8000-000000000006',
    'SHOPEE',
    'LIP-BALM-010',
    'PHYSICAL',
    '10000000-0000-4000-8000-000000000006',
    null,
    true
  ),
  (
    '35000000-0000-4000-8000-000000000007',
    'SHOPEE',
    'GLOW-KIT',
    'BUNDLE',
    null,
    '30000000-0000-4000-8000-000000000001',
    true
  ),
  (
    '35000000-0000-4000-8000-000000000101',
    'TIKTOK',
    'CLN-GENTLE-100',
    'PHYSICAL',
    '10000000-0000-4000-8000-000000000001',
    null,
    true
  ),
  (
    '35000000-0000-4000-8000-000000000102',
    'TIKTOK',
    'SER-NIAC-020',
    'PHYSICAL',
    '10000000-0000-4000-8000-000000000002',
    null,
    true
  ),
  (
    '35000000-0000-4000-8000-000000000103',
    'TIKTOK',
    'SUN-DAILY-030',
    'PHYSICAL',
    '10000000-0000-4000-8000-000000000003',
    null,
    true
  ),
  (
    '35000000-0000-4000-8000-000000000104',
    'TIKTOK',
    'TON-HYDR-100',
    'PHYSICAL',
    '10000000-0000-4000-8000-000000000004',
    null,
    true
  ),
  (
    '35000000-0000-4000-8000-000000000105',
    'TIKTOK',
    'MSK-CALM-001',
    'PHYSICAL',
    '10000000-0000-4000-8000-000000000005',
    null,
    true
  ),
  (
    '35000000-0000-4000-8000-000000000106',
    'TIKTOK',
    'LIP-BALM-010',
    'PHYSICAL',
    '10000000-0000-4000-8000-000000000006',
    null,
    true
  ),
  (
    '35000000-0000-4000-8000-000000000107',
    'TIKTOK',
    'GLOW-KIT',
    'BUNDLE',
    null,
    '30000000-0000-4000-8000-000000000001',
    true
  )
on conflict (id) do update
set
  channel = excluded.channel,
  listing_sku = excluded.listing_sku,
  listing_type = excluded.listing_type,
  product_id = excluded.product_id,
  bundle_id = excluded.bundle_id,
  is_active = excluded.is_active;

insert into public.product_reservations (product_id, reserved_qty)
select product.id, 0
from public.products as product
on conflict (product_id) do nothing;

commit;

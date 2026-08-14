begin;

create or replace function public.save_product_marketplace_listing(
  p_id uuid,
  p_product_id uuid,
  p_channel public.stock_channel,
  p_listing_sku text,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_listing public.marketplace_listings;
  v_product_is_active boolean;
begin
  perform public.assert_admin();

  if p_product_id is null then
    raise exception using
      errcode = '22023',
      message = 'PRODUCT_REQUIRED';
  end if;

  if p_channel not in ('SHOPEE', 'TIKTOK') then
    raise exception using
      errcode = '22023',
      message = 'INVALID_MARKETPLACE_CHANNEL';
  end if;

  if p_listing_sku is null
     or length(trim(p_listing_sku)) not between 1 and 100 then
    raise exception using
      errcode = '22023',
      message = 'INVALID_MARKETPLACE_LISTING_SKU';
  end if;

  select product.is_active
  into v_product_is_active
  from public.products as product
  where product.id = p_product_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'PRODUCT_NOT_FOUND';
  end if;

  if coalesce(p_is_active, true) and not v_product_is_active then
    raise exception using
      errcode = '22023',
      message = 'INACTIVE_PRODUCT_CANNOT_HAVE_ACTIVE_LISTING';
  end if;

  if p_id is null then
    insert into public.marketplace_listings (
      channel,
      listing_sku,
      listing_type,
      product_id,
      bundle_id,
      is_active
    )
    values (
      p_channel,
      trim(p_listing_sku),
      'PHYSICAL',
      p_product_id,
      null,
      coalesce(p_is_active, true)
    )
    returning * into v_listing;
  else
    update public.marketplace_listings as listing
    set
      channel = p_channel,
      listing_sku = trim(p_listing_sku),
      is_active = coalesce(p_is_active, true)
    where listing.id = p_id
      and listing.product_id = p_product_id
      and listing.listing_type = 'PHYSICAL'
    returning listing.* into v_listing;

    if not found then
      raise exception using
        errcode = 'P0002',
        message = 'PRODUCT_MARKETPLACE_LISTING_NOT_FOUND';
    end if;
  end if;

  return to_jsonb(v_listing);
exception
  when unique_violation then
    raise exception using
      errcode = '23505',
      message = 'MARKETPLACE_LISTING_SKU_ALREADY_EXISTS';
end;
$$;

create or replace function public.deactivate_product_marketplace_listings()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.is_active and not new.is_active then
    update public.marketplace_listings
    set is_active = false
    where product_id = new.id
      and listing_type = 'PHYSICAL'
      and is_active;
  end if;

  return new;
end;
$$;

create trigger products_deactivate_marketplace_listings
after update of is_active on public.products
for each row
when (old.is_active is distinct from new.is_active)
execute function public.deactivate_product_marketplace_listings();

revoke execute on function public.save_product_marketplace_listing(
  uuid,
  uuid,
  public.stock_channel,
  text,
  boolean
) from public;
revoke execute on function public.deactivate_product_marketplace_listings()
  from public;

grant execute on function public.save_product_marketplace_listing(
  uuid,
  uuid,
  public.stock_channel,
  text,
  boolean
) to authenticated;

update public.system_settings
set schema_version = 4;

commit;

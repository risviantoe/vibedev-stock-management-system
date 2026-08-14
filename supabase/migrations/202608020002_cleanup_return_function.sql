begin;

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.create_return(text,public.stock_channel,text,text,jsonb,timestamptz)'::regprocedure
  )
  into v_definition;

  if position('v_listing_type' in v_definition) > 0 then
    v_definition := regexp_replace(
      v_definition,
      E'[[:space:]]*v_listing_type public[.]marketplace_listing_type;',
      '',
      'g'
    );
    v_definition := regexp_replace(
      v_definition,
      E'select[[:space:]]+order_item[.]listing_type[[:space:]]+into[[:space:]]+v_listing_type[[:space:]]+from',
      E'perform 1\n      from',
      'g'
    );

    if position('v_listing_type' in v_definition) > 0 then
      raise exception 'CREATE_RETURN_CLEANUP_FAILED';
    end if;

    execute v_definition;
  end if;
end;
$$;

commit;

import "server-only";

import type {
  BundleConfiguration,
  BundleRecipeComponentRow,
  BundleRecipeVersionRow,
  BundleRow,
  EventInboxEntry,
  MarketplaceEventAttemptRow,
  MarketplaceEventReceipt,
  MarketplaceEventRow,
  MarketplaceListing,
  MarketplaceOrder,
  OrderComponentRow,
  OrderItemRow,
  OrderRow,
  PromoConfiguration,
  PromoRuleItemRow,
  PromoRuleRow,
} from "@/lib/domain/marketplace";
import type { ProductRow } from "@/lib/domain/inventory";
import {
  toPaginatedResult,
  type PaginatedResult,
} from "@/lib/pagination";
import type {
  MarketplaceEventRetrieval,
  MarketplaceOrderRetrieval,
} from "@/lib/retrieval";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function assertQuery<T>(
  result: { data: T | null; error: { message: string } | null },
  label: string,
): T {
  if (result.error || result.data === null) {
    throw new Error(`${label}: ${result.error?.message ?? "data tidak tersedia"}`);
  }
  return result.data;
}

export type MarketplaceWorkspace = {
  listings: MarketplaceListing[];
  inbox: EventInboxEntry[];
  orders: MarketplaceOrder[];
  bundles: BundleConfiguration[];
  promos: PromoConfiguration[];
  products: ProductRow[];
};

export async function getActiveMarketplaceListings(): Promise<
  MarketplaceListing[]
> {
  const supabase = await createServerSupabaseClient();
  const [productResult, listingResult, bundleResult] = await Promise.all([
    supabase
      .from("products")
      .select("id,sku,name,is_active,created_at,updated_at")
      .order("sku"),
    supabase
      .from("marketplace_listings")
      .select("id,channel,listing_sku,listing_type,product_id,bundle_id,is_active")
      .eq("is_active", true)
      .order("channel")
      .order("listing_sku"),
    supabase
      .from("bundles")
      .select("id,sku,name,is_active,created_at,updated_at")
      .order("sku"),
  ]);
  const products = assertQuery(
    productResult as { data: ProductRow[] | null; error: { message: string } | null },
    "Gagal memuat produk listing aktif",
  );
  const listings = assertQuery(
    listingResult as {
      data: Array<Omit<MarketplaceListing, "product" | "bundle">> | null;
      error: { message: string } | null;
    },
    "Gagal memuat listing marketplace aktif",
  );
  const bundles = assertQuery(
    bundleResult as { data: BundleRow[] | null; error: { message: string } | null },
    "Gagal memuat bundle listing aktif",
  );
  const productById = new Map(products.map((product) => [product.id, product]));
  const bundleById = new Map(bundles.map((bundle) => [bundle.id, bundle]));

  return listings.map((listing) => ({
    ...listing,
    product: listing.product_id
      ? productById.get(listing.product_id) ?? null
      : null,
    bundle: listing.bundle_id
      ? bundleById.get(listing.bundle_id) ?? null
      : null,
  }));
}

export async function getMarketplaceWorkspace(): Promise<MarketplaceWorkspace> {
  const supabase = await createServerSupabaseClient();
  const [
    productResult,
    listingResult,
    eventResult,
    attemptResult,
    orderResult,
    itemResult,
    componentResult,
    bundleResult,
    recipeResult,
    recipeComponentResult,
    promoResult,
    promoItemResult,
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id,sku,name,is_active,created_at,updated_at")
      .order("sku"),
    supabase
      .from("marketplace_listings")
      .select(
        "id,channel,listing_sku,listing_type,product_id,bundle_id,is_active",
      )
      .eq("is_active", true)
      .order("channel")
      .order("listing_sku"),
    supabase
      .from("marketplace_events")
      .select(
        "id,source,external_event_id,channel,event_type,external_order_id,processing_status,business_command_id,error_code,error_message,occurred_at,received_at,processed_at",
      )
      .order("received_at", { ascending: false })
      .limit(100),
    supabase
      .from("marketplace_event_attempts")
      .select(
        "id,marketplace_event_id,attempt_no,processing_status,error_code,error_message,received_at,processed_at",
      )
      .order("received_at", { ascending: false })
      .limit(100),
    supabase
      .from("orders")
      .select(
        "id,external_order_id,channel,status,created_event_id,last_event_id,ordered_at,shipped_at,cancelled_at,created_at,updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("order_items")
      .select(
        "id,order_id,external_line_id,listing_sku,listing_type,ordered_qty,reserved_qty,shipped_qty,cancelled_qty,returned_qty,created_at,updated_at",
      )
      .order("created_at"),
    supabase
      .from("order_item_components")
      .select(
        "id,order_item_id,product_id,component_type,qty_per_item,ordered_component_qty,reserved_qty,shipped_qty,cancelled_qty,recipe_version_id,promo_rule_id,snapshot,created_at,updated_at",
      )
      .order("created_at"),
    supabase
      .from("bundles")
      .select("id,sku,name,is_active,created_at,updated_at")
      .order("sku"),
    supabase
      .from("bundle_recipe_versions")
      .select("id,bundle_id,version,effective_from,created_at")
      .order("effective_from", { ascending: false }),
    supabase
      .from("bundle_recipe_components")
      .select("id,recipe_version_id,product_id,qty,created_at"),
    supabase
      .from("promo_rules")
      .select(
        "id,name,start_at,end_at,channel,is_active,created_at,updated_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("promo_rule_items")
      .select(
        "id,promo_rule_id,trigger_product_id,trigger_qty,free_product_id,free_qty,created_at",
      ),
  ]);

  const products = assertQuery(
    productResult as {
      data: ProductRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat produk marketplace",
  );
  const listingRows = assertQuery(
    listingResult as {
      data: Array<Omit<MarketplaceListing, "product" | "bundle">> | null;
      error: { message: string } | null;
    },
    "Gagal memuat listing marketplace",
  );
  const events = assertQuery(
    eventResult as {
      data: MarketplaceEventRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat riwayat event marketplace",
  );
  const attempts = assertQuery(
    attemptResult as {
      data: MarketplaceEventAttemptRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat attempt event",
  );
  const orderRows = assertQuery(
    orderResult as {
      data: OrderRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat order",
  );
  const itemRows = assertQuery(
    itemResult as {
      data: OrderItemRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat item order",
  );
  const componentRows = assertQuery(
    componentResult as {
      data: OrderComponentRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat snapshot komponen order",
  );
  const bundleRows = assertQuery(
    bundleResult as {
      data: BundleRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat bundle",
  );
  const recipeRows = assertQuery(
    recipeResult as {
      data: BundleRecipeVersionRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat versi recipe",
  );
  const recipeComponentRows = assertQuery(
    recipeComponentResult as {
      data: BundleRecipeComponentRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat komponen recipe",
  );
  const promoRows = assertQuery(
    promoResult as {
      data: PromoRuleRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat promo",
  );
  const promoItemRows = assertQuery(
    promoItemResult as {
      data: PromoRuleItemRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat item promo",
  );

  const productById = new Map(products.map((product) => [product.id, product]));
  const bundleById = new Map(bundleRows.map((bundle) => [bundle.id, bundle]));
  const eventById = new Map(events.map((event) => [event.id, event]));

  const normalizedComponents = componentRows.map((component) => ({
    ...component,
    qty_per_item: Number(component.qty_per_item),
    ordered_component_qty: Number(component.ordered_component_qty),
    reserved_qty: Number(component.reserved_qty),
    shipped_qty: Number(component.shipped_qty),
    cancelled_qty: Number(component.cancelled_qty),
    product: productById.get(component.product_id) ?? null,
  }));
  const componentsByItem = new Map<
    string,
    typeof normalizedComponents
  >();
  for (const component of normalizedComponents) {
    const existing = componentsByItem.get(component.order_item_id) ?? [];
    existing.push(component);
    componentsByItem.set(component.order_item_id, existing);
  }

  const normalizedItems = itemRows.map((item) => ({
    ...item,
    ordered_qty: Number(item.ordered_qty),
    reserved_qty: Number(item.reserved_qty),
    shipped_qty: Number(item.shipped_qty),
    cancelled_qty: Number(item.cancelled_qty),
    returned_qty: Number(item.returned_qty),
    components: componentsByItem.get(item.id) ?? [],
  }));
  const itemsByOrder = new Map<string, typeof normalizedItems>();
  for (const item of normalizedItems) {
    const existing = itemsByOrder.get(item.order_id) ?? [];
    existing.push(item);
    itemsByOrder.set(item.order_id, existing);
  }

  const recipesByBundle = new Map<string, BundleRecipeVersionRow[]>();
  for (const recipe of recipeRows) {
    const existing = recipesByBundle.get(recipe.bundle_id) ?? [];
    existing.push({ ...recipe, version: Number(recipe.version) });
    recipesByBundle.set(recipe.bundle_id, existing);
  }

  const recipeComponentsByVersion = new Map<
    string,
    BundleRecipeComponentRow[]
  >();
  for (const component of recipeComponentRows) {
    const existing =
      recipeComponentsByVersion.get(component.recipe_version_id) ?? [];
    existing.push({ ...component, qty: Number(component.qty) });
    recipeComponentsByVersion.set(component.recipe_version_id, existing);
  }

  const promoItemsByRule = new Map<string, PromoRuleItemRow[]>();
  for (const item of promoItemRows) {
    const existing = promoItemsByRule.get(item.promo_rule_id) ?? [];
    existing.push({
      ...item,
      trigger_qty: Number(item.trigger_qty),
      free_qty: Number(item.free_qty),
    });
    promoItemsByRule.set(item.promo_rule_id, existing);
  }

  return {
    products,
    listings: listingRows.map((listing) => ({
      ...listing,
      product: listing.product_id
        ? productById.get(listing.product_id) ?? null
        : null,
      bundle: listing.bundle_id
        ? bundleById.get(listing.bundle_id) ?? null
        : null,
    })),
    inbox: attempts.map((attempt) => ({
      ...attempt,
      attempt_no: Number(attempt.attempt_no),
      event: eventById.get(attempt.marketplace_event_id) ?? null,
    })),
    orders: orderRows.map((order) => ({
      ...order,
      items: itemsByOrder.get(order.id) ?? [],
    })),
    bundles: bundleRows.map((bundle) => {
      const activeRecipe = recipesByBundle.get(bundle.id)?.[0] ?? null;
      return {
        ...bundle,
        activeRecipe: activeRecipe
          ? {
              ...activeRecipe,
              components: (
                recipeComponentsByVersion.get(activeRecipe.id) ?? []
              ).map((component) => ({
                ...component,
                product: productById.get(component.product_id) ?? null,
              })),
            }
          : null,
      };
    }),
    promos: promoRows.map((promo) => ({
      ...promo,
      items: (promoItemsByRule.get(promo.id) ?? []).map((item) => ({
        ...item,
        triggerProduct: productById.get(item.trigger_product_id) ?? null,
        freeProduct: productById.get(item.free_product_id) ?? null,
      })),
    })),
  };
}

export async function getMarketplaceOrdersPage(
  page: number,
  pageSize: number,
  retrieval: MarketplaceOrderRetrieval,
): Promise<PaginatedResult<MarketplaceOrder>> {
  const supabase = await createServerSupabaseClient();
  const searchResult = await supabase.rpc("search_marketplace_orders", {
    p_search: retrieval.search || null,
    p_channel: retrieval.channel,
    p_status: retrieval.status,
    p_sort: retrieval.sort,
    p_page: page,
    p_page_size: pageSize,
  });
  const searchRows = assertQuery(
    searchResult as {
      data: Array<{ order_id: string; total_count: number }> | null;
      error: { message: string } | null;
    },
    "Gagal mencari order marketplace",
  );
  const total = Number(searchRows[0]?.total_count ?? 0);

  if (!searchRows.length) {
    return toPaginatedResult([], total, page, pageSize);
  }

  const orderIds = searchRows.map((row) => row.order_id);
  const orderResult = await supabase
    .from("orders")
    .select(
      "id,external_order_id,channel,status,created_event_id,last_event_id,ordered_at,shipped_at,cancelled_at,created_at,updated_at",
    )
    .in("id", orderIds);
  const unorderedOrderRows = assertQuery(
    orderResult as { data: OrderRow[] | null; error: { message: string } | null },
    "Gagal memuat halaman order marketplace",
  );
  const orderById = new Map(unorderedOrderRows.map((order) => [order.id, order]));
  const orderRows = orderIds
    .map((orderId) => orderById.get(orderId))
    .filter((order): order is OrderRow => Boolean(order));

  const itemResult = await supabase
    .from("order_items")
    .select(
      "id,order_id,external_line_id,listing_sku,listing_type,ordered_qty,reserved_qty,shipped_qty,cancelled_qty,returned_qty,created_at,updated_at",
    )
    .in("order_id", orderRows.map((order) => order.id))
    .order("created_at");
  const itemRows = assertQuery(
    itemResult as { data: OrderItemRow[] | null; error: { message: string } | null },
    "Gagal memuat item halaman order marketplace",
  );
  const itemsByOrder = new Map<string, MarketplaceOrder["items"]>();

  for (const item of itemRows) {
    const existing = itemsByOrder.get(item.order_id) ?? [];
    existing.push({
      ...item,
      ordered_qty: Number(item.ordered_qty),
      reserved_qty: Number(item.reserved_qty),
      shipped_qty: Number(item.shipped_qty),
      cancelled_qty: Number(item.cancelled_qty),
      returned_qty: Number(item.returned_qty),
      components: [],
    });
    itemsByOrder.set(item.order_id, existing);
  }

  return toPaginatedResult(
    orderRows.map((order) => ({
      ...order,
      items: itemsByOrder.get(order.id) ?? [],
    })),
    total,
    page,
    pageSize,
  );
}

export async function getMarketplaceInboxPage(
  page: number,
  pageSize: number,
  retrieval: MarketplaceEventRetrieval,
): Promise<PaginatedResult<EventInboxEntry>> {
  const supabase = await createServerSupabaseClient();
  const searchResult = await supabase.rpc("search_marketplace_event_attempts", {
    p_search: retrieval.search || null,
    p_channel: retrieval.channel,
    p_status: retrieval.status,
    p_sort: retrieval.sort,
    p_page: page,
    p_page_size: pageSize,
  });
  const searchRows = assertQuery(
    searchResult as {
      data: Array<{ attempt_id: string; total_count: number }> | null;
      error: { message: string } | null;
    },
    "Gagal mencari aktivitas marketplace",
  );
  const total = Number(searchRows[0]?.total_count ?? 0);

  if (!searchRows.length) {
    return toPaginatedResult([], total, page, pageSize);
  }

  const attemptIds = searchRows.map((row) => row.attempt_id);
  const attemptResult = await supabase
    .from("marketplace_event_attempts")
    .select(
      "id,marketplace_event_id,attempt_no,processing_status,error_code,error_message,received_at,processed_at",
    )
    .in("id", attemptIds);
  const unorderedAttempts = assertQuery(
    attemptResult as {
      data: MarketplaceEventAttemptRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat halaman aktivitas marketplace",
  );
  const attemptById = new Map(
    unorderedAttempts.map((attempt) => [attempt.id, attempt]),
  );
  const attempts = attemptIds
    .map((attemptId) => attemptById.get(attemptId))
    .filter((attempt): attempt is MarketplaceEventAttemptRow => Boolean(attempt));

  const eventResult = await supabase
    .from("marketplace_events")
    .select(
      "id,source,external_event_id,channel,event_type,external_order_id,processing_status,business_command_id,error_code,error_message,occurred_at,received_at,processed_at",
    )
    .in(
      "id",
      [...new Set(attempts.map((attempt) => attempt.marketplace_event_id))],
    );
  const events = assertQuery(
    eventResult as {
      data: MarketplaceEventRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat event untuk halaman aktivitas marketplace",
  );
  const eventById = new Map(events.map((event) => [event.id, event]));

  return toPaginatedResult(
    attempts.map((attempt) => ({
      ...attempt,
      attempt_no: Number(attempt.attempt_no),
      event: eventById.get(attempt.marketplace_event_id) ?? null,
    })),
    total,
    page,
    pageSize,
  );
}

export async function getMarketplaceOrder(
  orderId: string,
): Promise<MarketplaceOrder | null> {
  const workspace = await getMarketplaceWorkspace();
  return workspace.orders.find((order) => order.id === orderId) ?? null;
}

export async function getMarketplaceEventReceipt(
  eventId: string,
): Promise<MarketplaceEventReceipt | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_marketplace_event_receipt", {
    p_event_id: eventId,
  });

  if (error) {
    throw new Error(`Gagal memuat bukti event: ${error.message}`);
  }

  return (data as MarketplaceEventReceipt | null) ?? null;
}

export async function getMarketplaceDashboardSummary(): Promise<{
  reservedOrders: number;
  rejectedEvents: number;
  duplicateAttempts: number;
}> {
  const supabase = await createServerSupabaseClient();
  const [orderResult, rejectedResult, duplicateResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["RESERVED", "PARTIALLY_CANCELLED"]),
    supabase
      .from("marketplace_events")
      .select("id", { count: "exact", head: true })
      .eq("processing_status", "REJECTED"),
    supabase
      .from("marketplace_event_attempts")
      .select("id", { count: "exact", head: true })
      .eq("processing_status", "DUPLICATE"),
  ]);

  if (orderResult.error || rejectedResult.error || duplicateResult.error) {
    throw new Error("Gagal memuat ringkasan marketplace.");
  }

  return {
    reservedOrders: orderResult.count ?? 0,
    rejectedEvents: rejectedResult.count ?? 0,
    duplicateAttempts: duplicateResult.count ?? 0,
  };
}

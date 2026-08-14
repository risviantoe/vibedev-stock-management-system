import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BalanceRow,
  BatchInventory,
  BatchRow,
  BusinessCommandRow,
  CommandReceipt,
  LedgerEntry,
  LedgerRow,
  MovementGroupRow,
  OpeningBalanceRow,
  ProductInventory,
  ProductMarketplaceListing,
  ProductRow,
} from "@/lib/domain/inventory";
import {
  toPaginatedResult,
  type PaginatedResult,
} from "@/lib/pagination";
import type { LedgerRetrieval, ProductRetrieval } from "@/lib/retrieval";
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

function buildInventorySnapshot(
  products: ProductRow[],
  batches: BatchRow[],
  balances: BalanceRow[],
  openings: OpeningBalanceRow[],
  reservations: Array<{ product_id: string; reserved_qty: number }>,
  listings: Array<ProductMarketplaceListing & { product_id: string }>,
): ProductInventory[] {
  const balanceByBatch = new Map(
    balances.map((balance) => [balance.batch_id, Number(balance.on_hand_qty)]),
  );
  const openingByBatch = new Map(
    openings.map((opening) => [opening.batch_id, opening]),
  );
  const batchesByProduct = new Map<string, BatchInventory[]>();
  const reservationByProduct = new Map(
    reservations.map((reservation) => [
      reservation.product_id,
      Number(reservation.reserved_qty),
    ]),
  );
  const listingsByProduct = new Map<string, ProductMarketplaceListing[]>();

  for (const { product_id: productId, ...listing } of listings) {
    const existing = listingsByProduct.get(productId) ?? [];
    existing.push(listing);
    listingsByProduct.set(productId, existing);
  }

  for (const batch of batches) {
    const existing = batchesByProduct.get(batch.product_id) ?? [];
    existing.push({
      ...batch,
      onHandQty: balanceByBatch.get(batch.id) ?? 0,
      openingBalance: openingByBatch.get(batch.id) ?? null,
    });
    batchesByProduct.set(batch.product_id, existing);
  }

  return products.map((product) => {
    const productBatches = batchesByProduct.get(product.id) ?? [];
    const onHandQty = productBatches.reduce(
      (total, batch) => total + batch.onHandQty,
      0,
    );
    const reservedQty = reservationByProduct.get(product.id) ?? 0;
    return {
      ...product,
      batches: productBatches,
      onHandQty,
      reservedQty,
      availableQty: onHandQty - reservedQty,
      marketplaceListings: listingsByProduct.get(product.id) ?? [],
    };
  });
}

function buildLedgerEntries(
  ledger: LedgerRow[],
  products: ProductRow[],
  batches: BatchRow[],
  groups: MovementGroupRow[],
  commands: BusinessCommandRow[],
  balances: BalanceRow[],
  reversedMovementIds: string[],
): LedgerEntry[] {
  const productById = new Map(products.map((product) => [product.id, product]));
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const commandById = new Map(commands.map((command) => [command.id, command]));
  const balanceByBatch = new Map(
    balances.map((balance) => [balance.batch_id, Number(balance.on_hand_qty)]),
  );
  const reversedIds = new Set(reversedMovementIds);

  return ledger.map((movement) => {
    const group = groupById.get(movement.movement_group_id);
    return {
      ...movement,
      qty_delta: Number(movement.qty_delta),
      sequence_no: Number(movement.sequence_no),
      product: productById.get(movement.product_id) ?? null,
      batch: batchById.get(movement.batch_id) ?? null,
      command: group ? commandById.get(group.business_command_id) ?? null : null,
      isReversed: reversedIds.has(movement.id),
      currentBatchBalance: balanceByBatch.get(movement.batch_id) ?? 0,
    };
  });
}

export async function getInventorySnapshot(): Promise<ProductInventory[]> {
  const supabase = await createServerSupabaseClient();
  const [
    productResult,
    batchResult,
    balanceResult,
    openingResult,
    reservationResult,
    listingResult,
  ] =
    await Promise.all([
      supabase
        .from("products")
        .select("id,sku,name,is_active,created_at,updated_at")
        .order("name"),
      supabase
        .from("batches")
        .select(
          "id,product_id,batch_code,expiry_date,source_type,created_at",
        )
        .order("expiry_date"),
      supabase
        .from("stock_balances")
        .select("product_id,batch_id,on_hand_qty,updated_at"),
      supabase
        .from("opening_balances")
        .select(
          "id,product_id,batch_id,qty,verification_status,created_at,verified_at",
        ),
      supabase
        .from("product_reservations")
        .select("product_id,reserved_qty"),
      supabase
        .from("marketplace_listings")
        .select(
          "id,channel,listing_sku,product_id,is_active,created_at,updated_at",
        )
        .eq("listing_type", "PHYSICAL")
        .order("channel")
        .order("listing_sku"),
    ]);

  const products = assertQuery(
    productResult as { data: ProductRow[] | null; error: { message: string } | null },
    "Gagal memuat produk",
  );
  const batches = assertQuery(
    batchResult as { data: BatchRow[] | null; error: { message: string } | null },
    "Gagal memuat batch",
  );
  const balances = assertQuery(
    balanceResult as {
      data: BalanceRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat saldo",
  );
  const openings = assertQuery(
    openingResult as {
      data: OpeningBalanceRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat opening balance",
  );
  const reservations = assertQuery(
    reservationResult as {
      data: Array<{ product_id: string; reserved_qty: number }> | null;
      error: { message: string } | null;
    },
    "Gagal memuat reservasi",
  );
  const listings = assertQuery(
    listingResult as {
      data:
        | Array<ProductMarketplaceListing & { product_id: string }>
        | null;
      error: { message: string } | null;
    },
    "Gagal memuat marketplace listing",
  );

  return buildInventorySnapshot(
    products,
    batches,
    balances,
    openings,
    reservations,
    listings,
  );
}

export async function getInventorySnapshotPage(
  page: number,
  pageSize: number,
  retrieval: ProductRetrieval,
): Promise<PaginatedResult<ProductInventory>> {
  const supabase = await createServerSupabaseClient();
  const searchResult = await supabase.rpc("search_inventory_products", {
    p_search: retrieval.search || null,
    p_status: retrieval.status,
    p_expiry: retrieval.expiry,
    p_sort: retrieval.sort,
    p_page: page,
    p_page_size: pageSize,
  });
  const searchRows = assertQuery(
    searchResult as {
      data: Array<{ product_id: string; total_count: number }> | null;
      error: { message: string } | null;
    },
    "Gagal mencari produk",
  );
  const total = Number(searchRows[0]?.total_count ?? 0);

  if (!searchRows.length) {
    return toPaginatedResult([], total, page, pageSize);
  }

  const productIds = searchRows.map((row) => row.product_id);
  const productResult = await supabase
    .from("products")
    .select("id,sku,name,is_active,created_at,updated_at")
    .in("id", productIds);
  const unorderedProducts = assertQuery(
    productResult as {
      data: ProductRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat halaman produk",
  );
  const productById = new Map(
    unorderedProducts.map((product) => [product.id, product]),
  );
  const products = productIds
    .map((productId) => productById.get(productId))
    .filter((product): product is ProductRow => Boolean(product));
  const [batchResult, balanceResult, openingResult, reservationResult, listingResult] =
    await Promise.all([
      supabase
        .from("batches")
        .select("id,product_id,batch_code,expiry_date,source_type,created_at")
        .in("product_id", productIds)
        .order("expiry_date"),
      supabase
        .from("stock_balances")
        .select("product_id,batch_id,on_hand_qty,updated_at")
        .in("product_id", productIds),
      supabase
        .from("opening_balances")
        .select("id,product_id,batch_id,qty,verification_status,created_at,verified_at")
        .in("product_id", productIds),
      supabase
        .from("product_reservations")
        .select("product_id,reserved_qty")
        .in("product_id", productIds),
      supabase
        .from("marketplace_listings")
        .select("id,channel,listing_sku,product_id,is_active,created_at,updated_at")
        .eq("listing_type", "PHYSICAL")
        .in("product_id", productIds)
        .order("channel")
        .order("listing_sku"),
    ]);

  const batches = assertQuery(
    batchResult as { data: BatchRow[] | null; error: { message: string } | null },
    "Gagal memuat batch halaman produk",
  );
  const balances = assertQuery(
    balanceResult as { data: BalanceRow[] | null; error: { message: string } | null },
    "Gagal memuat saldo halaman produk",
  );
  const openings = assertQuery(
    openingResult as { data: OpeningBalanceRow[] | null; error: { message: string } | null },
    "Gagal memuat saldo awal halaman produk",
  );
  const reservations = assertQuery(
    reservationResult as {
      data: Array<{ product_id: string; reserved_qty: number }> | null;
      error: { message: string } | null;
    },
    "Gagal memuat reservasi halaman produk",
  );
  const listings = assertQuery(
    listingResult as {
      data: Array<ProductMarketplaceListing & { product_id: string }> | null;
      error: { message: string } | null;
    },
    "Gagal memuat listing halaman produk",
  );

  return toPaginatedResult(
    buildInventorySnapshot(
      products,
      batches,
      balances,
      openings,
      reservations,
      listings,
    ),
    total,
    page,
    pageSize,
  );
}

export async function getProductInventory(
  productId: string,
): Promise<ProductInventory | null> {
  const products = await getInventorySnapshot();
  return products.find((product) => product.id === productId) ?? null;
}

export async function getLedgerEntries(limit = 100): Promise<LedgerEntry[]> {
  const supabase = await createServerSupabaseClient();
  const [ledgerResult, productResult, batchResult, groupResult, commandResult, balanceResult] =
    await Promise.all([
      supabase
        .from("stock_ledger")
        .select(
          "id,sequence_no,movement_group_id,product_id,batch_id,qty_delta,reason,channel,source_type,source_id,reference,reverses_movement_id,actor_id,movement_key,occurred_at,created_at",
        )
        .order("sequence_no", { ascending: false })
        .limit(limit),
      supabase
        .from("products")
        .select("id,sku,name,is_active,created_at,updated_at"),
      supabase
        .from("batches")
        .select(
          "id,product_id,batch_code,expiry_date,source_type,created_at",
        ),
      supabase
        .from("movement_groups")
        .select(
          "id,business_command_id,group_type,source_type,source_id,reversal_group_id,created_at",
        ),
      supabase
        .from("business_commands")
        .select(
          "id,command_type,idempotency_key,status,source_type,source_id,error_code,error_message,created_at,completed_at",
        )
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("stock_balances")
        .select("product_id,batch_id,on_hand_qty,updated_at"),
    ]);

  const ledger = assertQuery(
    ledgerResult as { data: LedgerRow[] | null; error: { message: string } | null },
    "Gagal memuat ledger",
  );
  const products = assertQuery(
    productResult as { data: ProductRow[] | null; error: { message: string } | null },
    "Gagal memuat produk ledger",
  );
  const batches = assertQuery(
    batchResult as { data: BatchRow[] | null; error: { message: string } | null },
    "Gagal memuat batch ledger",
  );
  const groups = assertQuery(
    groupResult as {
      data: MovementGroupRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat movement group",
  );
  const commands = assertQuery(
    commandResult as {
      data: BusinessCommandRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat command",
  );
  const balances = assertQuery(
    balanceResult as {
      data: BalanceRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat saldo ledger",
  );

  const reversedMovementIds =
    ledger
      .map((movement) => movement.reverses_movement_id)
      .filter((id): id is string => Boolean(id));

  return buildLedgerEntries(
    ledger,
    products,
    batches,
    groups,
    commands,
    balances,
    reversedMovementIds,
  );
}

export async function getLedgerEntriesPage(
  page: number,
  pageSize: number,
  retrieval: LedgerRetrieval,
): Promise<PaginatedResult<LedgerEntry>> {
  const supabase = await createServerSupabaseClient();
  const searchResult = await supabase.rpc("search_stock_movements", {
    p_search: retrieval.search || null,
    p_from: retrieval.from || null,
    p_to: retrieval.to || null,
    p_reason: retrieval.reason,
    p_channel: retrieval.channel,
    p_status: retrieval.status,
    p_sort: retrieval.sort,
    p_page: page,
    p_page_size: pageSize,
  });
  const searchRows = assertQuery(
    searchResult as {
      data: Array<{ movement_id: string; total_count: number }> | null;
      error: { message: string } | null;
    },
    "Gagal mencari riwayat stok",
  );
  const total = Number(searchRows[0]?.total_count ?? 0);

  if (!searchRows.length) {
    return toPaginatedResult([], total, page, pageSize);
  }

  const movementIds = searchRows.map((row) => row.movement_id);
  const ledgerResult = await supabase
    .from("stock_ledger")
    .select(
      "id,sequence_no,movement_group_id,product_id,batch_id,qty_delta,reason,channel,source_type,source_id,reference,reverses_movement_id,actor_id,movement_key,occurred_at,created_at",
    )
    .in("id", movementIds);
  const unorderedLedger = assertQuery(
    ledgerResult as { data: LedgerRow[] | null; error: { message: string } | null },
    "Gagal memuat halaman riwayat stok",
  );
  const movementById = new Map(
    unorderedLedger.map((movement) => [movement.id, movement]),
  );
  const ledger = movementIds
    .map((movementId) => movementById.get(movementId))
    .filter((movement): movement is LedgerRow => Boolean(movement));

  const productIds = [...new Set(ledger.map((movement) => movement.product_id))];
  const batchIds = [...new Set(ledger.map((movement) => movement.batch_id))];
  const groupIds = [...new Set(ledger.map((movement) => movement.movement_group_id))];
  const [productResult, batchResult, groupResult, balanceResult, reversalResult] =
    await Promise.all([
      supabase
        .from("products")
        .select("id,sku,name,is_active,created_at,updated_at")
        .in("id", productIds),
      supabase
        .from("batches")
        .select("id,product_id,batch_code,expiry_date,source_type,created_at")
        .in("id", batchIds),
      supabase
        .from("movement_groups")
        .select("id,business_command_id,group_type,source_type,source_id,reversal_group_id,created_at")
        .in("id", groupIds),
      supabase
        .from("stock_balances")
        .select("product_id,batch_id,on_hand_qty,updated_at")
        .in("batch_id", batchIds),
      supabase
        .from("stock_ledger")
        .select("reverses_movement_id")
        .in("reverses_movement_id", movementIds),
    ]);

  const products = assertQuery(
    productResult as { data: ProductRow[] | null; error: { message: string } | null },
    "Gagal memuat produk riwayat stok",
  );
  const batches = assertQuery(
    batchResult as { data: BatchRow[] | null; error: { message: string } | null },
    "Gagal memuat batch riwayat stok",
  );
  const groups = assertQuery(
    groupResult as { data: MovementGroupRow[] | null; error: { message: string } | null },
    "Gagal memuat transaksi riwayat stok",
  );
  const balances = assertQuery(
    balanceResult as { data: BalanceRow[] | null; error: { message: string } | null },
    "Gagal memuat saldo riwayat stok",
  );
  const reversedMovementIds = assertQuery(
    reversalResult as {
      data: Array<{ reverses_movement_id: string | null }> | null;
      error: { message: string } | null;
    },
    "Gagal memuat status koreksi riwayat stok",
  )
    .map((movement) => movement.reverses_movement_id)
    .filter((id): id is string => Boolean(id));
  const commandIds = [
    ...new Set(groups.map((group) => group.business_command_id)),
  ];
  const commandResult = await supabase
    .from("business_commands")
    .select("id,command_type,idempotency_key,status,source_type,source_id,error_code,error_message,created_at,completed_at")
    .in("id", commandIds);
  const commands = assertQuery(
    commandResult as { data: BusinessCommandRow[] | null; error: { message: string } | null },
    "Gagal memuat command riwayat stok",
  );

  return toPaginatedResult(
    buildLedgerEntries(
      ledger,
      products,
      batches,
      groups,
      commands,
      balances,
      reversedMovementIds,
    ),
    total,
    page,
    pageSize,
  );
}

export async function getCommandReceipt(
  commandId: string,
): Promise<CommandReceipt | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_movement_receipt", {
    p_command_id: commandId,
  });

  if (error) {
    throw new Error(`Gagal memuat receipt: ${error.message}`);
  }

  return (data as CommandReceipt | null) ?? null;
}

export async function requireAuthenticatedUser(
  supabase?: SupabaseClient,
): Promise<{ id: string; email: string }> {
  const client = supabase ?? (await createServerSupabaseClient());
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    throw new Error("UNAUTHENTICATED");
  }

  return {
    id: user.id,
    email: user.email ?? "Admin",
  };
}

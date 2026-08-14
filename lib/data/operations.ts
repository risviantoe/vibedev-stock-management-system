import "server-only";

import type {
  BatchRow,
  ProductRow,
} from "@/lib/domain/inventory";
import type { OrderItem } from "@/lib/domain/marketplace";
import {
  type AnomalyRow,
  type NotificationRow,
  type OpnameCountRow,
  type OpnameSession,
  type OpnameSessionRow,
  type OperationsWorkspace,
  type ReturnCandidate,
  type ReturnItemRow,
  type ReturnRecord,
  type ReturnRow,
} from "@/lib/domain/operations";
import { getMarketplaceWorkspace } from "@/lib/data/marketplace";
import {
  getPageRange,
  toPaginatedResult,
  type PaginatedResult,
} from "@/lib/pagination";
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

export async function getOperationsWorkspace(): Promise<OperationsWorkspace> {
  const supabase = await createServerSupabaseClient();
  const [
    marketplace,
    returnResult,
    returnItemResult,
    sessionResult,
    countResult,
    batchResult,
    anomalyResult,
    notificationResult,
  ] = await Promise.all([
    getMarketplaceWorkspace(),
    supabase
      .from("returns")
      .select(
        "id,external_return_id,order_id,channel,claim_deadline,claim_status,created_command_id,created_by,created_at,recorded_at,updated_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("return_items")
      .select(
        "id,return_id,order_item_id,product_id,qty,inspection_status,condition,return_batch_id,inspected_command_id,inspected_by,inspected_at,created_at,updated_at",
      )
      .order("created_at"),
    supabase
      .from("opname_sessions")
      .select(
        "id,idempotency_key,status,actor_id,started_at,finalized_at,finalized_command_id,created_at,updated_at",
      )
      .order("started_at", { ascending: false }),
    supabase
      .from("opname_counts")
      .select(
        "session_id,product_id,batch_id,system_qty,physical_qty,variance_qty,saved_at",
      )
      .order("product_id")
      .order("batch_id"),
    supabase
      .from("batches")
      .select("id,product_id,batch_code,expiry_date,source_type,created_at")
      .order("expiry_date"),
    supabase
      .from("anomalies")
      .select(
        "id,fingerprint,type,severity,status,product_id,batch_id,order_id,return_id,movement_id,explanation,evidence,detected_at,last_detected_at,resolved_at,updated_at",
      )
      .order("status")
      .order("last_detected_at", { ascending: false }),
    supabase
      .from("notification_feed")
      .select(
        "id,type,severity,title,message,due_at,product_id,batch_id,return_id,created_at",
      )
      .order("severity")
      .order("due_at"),
  ]);

  const returnRows = assertQuery(
    returnResult as {
      data: ReturnRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat return",
  );
  const returnItemRows = assertQuery(
    returnItemResult as {
      data: ReturnItemRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat item return",
  );
  const sessionRows = assertQuery(
    sessionResult as {
      data: OpnameSessionRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat sesi opname",
  );
  const countRows = assertQuery(
    countResult as {
      data: OpnameCountRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat hitung opname",
  );
  const batches = assertQuery(
    batchResult as {
      data: BatchRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat batch operasional",
  );
  const anomalies = assertQuery(
    anomalyResult as {
      data: AnomalyRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat anomaly",
  );
  const notifications = assertQuery(
    notificationResult as {
      data: NotificationRow[] | null;
      error: { message: string } | null;
    },
    "Gagal memuat notifikasi",
  );

  const productById = new Map(
    marketplace.products.map((product) => [product.id, product]),
  );
  const orderById = new Map(
    marketplace.orders.map((order) => [order.id, order]),
  );
  const orderItemById = new Map<string, OrderItem>();
  for (const order of marketplace.orders) {
    for (const item of order.items) {
      orderItemById.set(item.id, item);
    }
  }
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));

  const returnItemsByReturn = new Map<
    string,
    ReturnRecord["items"]
  >();
  const returnedByItemProduct = new Map<string, number>();
  for (const item of returnItemRows) {
    const normalized = {
      ...item,
      qty: Number(item.qty),
      product: productById.get(item.product_id) ?? null,
      orderItem: orderItemById.get(item.order_item_id) ?? null,
      returnBatch: item.return_batch_id
        ? batchById.get(item.return_batch_id) ?? null
        : null,
    };
    const existing = returnItemsByReturn.get(item.return_id) ?? [];
    existing.push(normalized);
    returnItemsByReturn.set(item.return_id, existing);

    const key = `${item.order_item_id}:${item.product_id}`;
    returnedByItemProduct.set(
      key,
      (returnedByItemProduct.get(key) ?? 0) + Number(item.qty),
    );
  }

  const now = Date.now();
  const returns: ReturnRecord[] = returnRows.map((returnRow) => ({
    ...returnRow,
    order: orderById.get(returnRow.order_id) ?? null,
    items: returnItemsByReturn.get(returnRow.id) ?? [],
    remainingClaimDays: returnRow.claim_deadline
      ? Math.max(
          0,
          Math.ceil(
            (new Date(returnRow.claim_deadline).getTime() - now) / 86_400_000,
          ),
        )
      : null,
  }));

  const returnCandidates: ReturnCandidate[] = [];
  for (const order of marketplace.orders) {
    for (const item of order.items) {
      const physicalByProduct = new Map<string, number>();
      for (const component of item.components) {
        const netShipped = Math.max(
          component.shipped_qty - component.cancelled_qty,
          0,
        );
        physicalByProduct.set(
          component.product_id,
          (physicalByProduct.get(component.product_id) ?? 0) + netShipped,
        );
      }

      for (const [productId, shippedQty] of physicalByProduct) {
        if (shippedQty <= 0) {
          continue;
        }
        const key = `${item.id}:${productId}`;
        const returnedQty = returnedByItemProduct.get(key) ?? 0;
        const returnableQty = shippedQty - returnedQty;
        if (returnableQty <= 0) {
          continue;
        }
        returnCandidates.push({
          key,
          orderId: order.id,
          externalOrderId: order.external_order_id,
          channel: order.channel,
          orderItemId: item.id,
          externalLineId: item.external_line_id,
          listingSku: item.listing_sku,
          productId,
          product: productById.get(productId) ?? null,
          shippedQty,
          returnedQty,
          returnableQty,
        });
      }
    }
  }

  const countsBySession = new Map<string, OpnameSession["counts"]>();
  for (const count of countRows) {
    const existing = countsBySession.get(count.session_id) ?? [];
    existing.push({
      ...count,
      system_qty: Number(count.system_qty),
      physical_qty:
        count.physical_qty === null ? null : Number(count.physical_qty),
      variance_qty:
        count.variance_qty === null ? null : Number(count.variance_qty),
      product: productById.get(count.product_id) ?? null,
      batch: batchById.get(count.batch_id) ?? null,
    });
    countsBySession.set(count.session_id, existing);
  }

  const opnameSessions = sessionRows.map((session) => ({
    ...session,
    counts: (countsBySession.get(session.id) ?? []).sort((left, right) => {
      const productOrder = (left.product?.sku ?? "").localeCompare(
        right.product?.sku ?? "",
      );
      if (productOrder !== 0) {
        return productOrder;
      }
      return (left.batch?.expiry_date ?? "").localeCompare(
        right.batch?.expiry_date ?? "",
      );
    }),
  }));

  return {
    products: marketplace.products as ProductRow[],
    orders: marketplace.orders,
    returns,
    returnCandidates,
    opnameSessions,
    activeOpname:
      opnameSessions.find((session) => session.status === "DRAFT") ?? null,
    anomalies,
    notifications,
  };
}

export async function getOperationsDashboardSummary(): Promise<{
  pendingReturnItems: number;
  openAnomalies: number;
  notifications: NotificationRow[];
  activeOpname: boolean;
}> {
  const supabase = await createServerSupabaseClient();
  const [returnResult, anomalyResult, notificationResult, opnameResult] =
    await Promise.all([
      supabase
        .from("return_items")
        .select("id", { count: "exact", head: true })
        .eq("inspection_status", "PENDING"),
      supabase
        .from("anomalies")
        .select("id", { count: "exact", head: true })
        .eq("status", "OPEN"),
      supabase
        .from("notification_feed")
        .select(
          "id,type,severity,title,message,due_at,product_id,batch_id,return_id,created_at",
        )
        .order("severity")
        .order("due_at"),
      supabase
        .from("opname_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "DRAFT"),
    ]);

  if (
    returnResult.error ||
    anomalyResult.error ||
    notificationResult.error ||
    opnameResult.error
  ) {
    throw new Error("Gagal memuat ringkasan operasional Milestone 4.");
  }

  return {
    pendingReturnItems: returnResult.count ?? 0,
    openAnomalies: anomalyResult.count ?? 0,
    notifications: (notificationResult.data ?? []) as NotificationRow[],
    activeOpname: Boolean(opnameResult.count),
  };
}

export async function getActiveOpnameSession(): Promise<OpnameSession | null> {
  const supabase = await createServerSupabaseClient();
  const sessionResult = await supabase
    .from("opname_sessions")
    .select(
      "id,idempotency_key,status,actor_id,started_at,finalized_at,finalized_command_id,created_at,updated_at",
    )
    .eq("status", "DRAFT")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionResult.error) {
    throw new Error(`Gagal memuat sesi opname aktif: ${sessionResult.error.message}`);
  }
  if (!sessionResult.data) {
    return null;
  }

  const session = sessionResult.data as OpnameSessionRow;
  const countResult = await supabase
    .from("opname_counts")
    .select("session_id,product_id,batch_id,system_qty,physical_qty,variance_qty,saved_at")
    .eq("session_id", session.id)
    .order("product_id")
    .order("batch_id");
  const countRows = assertQuery(
    countResult as { data: OpnameCountRow[] | null; error: { message: string } | null },
    "Gagal memuat hitung sesi opname aktif",
  );

  if (!countRows.length) {
    return { ...session, counts: [] };
  }

  const [productResult, batchResult] = await Promise.all([
    supabase
      .from("products")
      .select("id,sku,name,is_active,created_at,updated_at")
      .in("id", [...new Set(countRows.map((count) => count.product_id))]),
    supabase
      .from("batches")
      .select("id,product_id,batch_code,expiry_date,source_type,created_at")
      .in("id", [...new Set(countRows.map((count) => count.batch_id))]),
  ]);
  const products = assertQuery(
    productResult as { data: ProductRow[] | null; error: { message: string } | null },
    "Gagal memuat produk sesi opname aktif",
  );
  const batches = assertQuery(
    batchResult as { data: BatchRow[] | null; error: { message: string } | null },
    "Gagal memuat batch sesi opname aktif",
  );
  const productById = new Map(products.map((product) => [product.id, product]));
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));

  const counts = countRows
    .map((count) => ({
      ...count,
      system_qty: Number(count.system_qty),
      physical_qty: count.physical_qty === null ? null : Number(count.physical_qty),
      variance_qty: count.variance_qty === null ? null : Number(count.variance_qty),
      product: productById.get(count.product_id) ?? null,
      batch: batchById.get(count.batch_id) ?? null,
    }))
    .sort((left, right) => {
      const productOrder = (left.product?.sku ?? "").localeCompare(
        right.product?.sku ?? "",
      );
      if (productOrder !== 0) {
        return productOrder;
      }
      return (left.batch?.expiry_date ?? "").localeCompare(
        right.batch?.expiry_date ?? "",
      );
    });

  return {
    ...session,
    counts,
  };
}

export async function getOpnameHistoryPage(
  page: number,
  pageSize: number,
): Promise<PaginatedResult<OpnameSession>> {
  const supabase = await createServerSupabaseClient();
  const { from, to } = getPageRange(page, pageSize);
  const sessionResult = await supabase
    .from("opname_sessions")
    .select(
      "id,idempotency_key,status,actor_id,started_at,finalized_at,finalized_command_id,created_at,updated_at",
      { count: "exact" },
    )
    .eq("status", "FINALIZED")
    .order("started_at", { ascending: false })
    .range(from, to);
  const sessions = assertQuery(
    sessionResult as { data: OpnameSessionRow[] | null; error: { message: string } | null },
    "Gagal memuat halaman riwayat opname",
  );
  const total = sessionResult.count ?? 0;

  if (!sessions.length) {
    return toPaginatedResult([], total, page, pageSize);
  }

  const countResult = await supabase
    .from("opname_counts")
    .select("session_id,product_id,batch_id,system_qty,physical_qty,variance_qty,saved_at")
    .in("session_id", sessions.map((session) => session.id));
  const countRows = assertQuery(
    countResult as { data: OpnameCountRow[] | null; error: { message: string } | null },
    "Gagal memuat hitung halaman riwayat opname",
  );
  const countsBySession = new Map<string, OpnameSession["counts"]>();

  for (const count of countRows) {
    const existing = countsBySession.get(count.session_id) ?? [];
    existing.push({
      ...count,
      system_qty: Number(count.system_qty),
      physical_qty: count.physical_qty === null ? null : Number(count.physical_qty),
      variance_qty: count.variance_qty === null ? null : Number(count.variance_qty),
      product: null,
      batch: null,
    });
    countsBySession.set(count.session_id, existing);
  }

  return toPaginatedResult(
    sessions.map((session) => ({
      ...session,
      counts: countsBySession.get(session.id) ?? [],
    })),
    total,
    page,
    pageSize,
  );
}

export async function getAnomaliesPage(
  page: number,
  pageSize: number,
): Promise<PaginatedResult<AnomalyRow>> {
  const supabase = await createServerSupabaseClient();
  const { from, to } = getPageRange(page, pageSize);
  const anomalyResult = await supabase
    .from("anomalies")
    .select(
      "id,fingerprint,type,severity,status,product_id,batch_id,order_id,return_id,movement_id,explanation,evidence,detected_at,last_detected_at,resolved_at,updated_at",
      { count: "exact" },
    )
    .order("status")
    .order("last_detected_at", { ascending: false })
    .range(from, to);
  const anomalies = assertQuery(
    anomalyResult as { data: AnomalyRow[] | null; error: { message: string } | null },
    "Gagal memuat halaman hasil rekonsiliasi",
  );

  return toPaginatedResult(
    anomalies,
    anomalyResult.count ?? 0,
    page,
    pageSize,
  );
}

export async function getReconciliationSummary(): Promise<{
  open: number;
  critical: number;
  resolved: number;
  notifications: number;
}> {
  const supabase = await createServerSupabaseClient();
  const [openResult, criticalResult, resolvedResult, notificationResult] =
    await Promise.all([
      supabase
        .from("anomalies")
        .select("id", { count: "exact", head: true })
        .eq("status", "OPEN"),
      supabase
        .from("anomalies")
        .select("id", { count: "exact", head: true })
        .eq("status", "OPEN")
        .eq("severity", "CRITICAL"),
      supabase
        .from("anomalies")
        .select("id", { count: "exact", head: true })
        .eq("status", "RESOLVED"),
      supabase
        .from("notification_feed")
        .select("id", { count: "exact", head: true }),
    ]);

  if (
    openResult.error ||
    criticalResult.error ||
    resolvedResult.error ||
    notificationResult.error
  ) {
    throw new Error("Gagal memuat ringkasan rekonsiliasi.");
  }

  return {
    open: openResult.count ?? 0,
    critical: criticalResult.count ?? 0,
    resolved: resolvedResult.count ?? 0,
    notifications: notificationResult.count ?? 0,
  };
}

import type {
  CommandReceipt,
  ProductRow,
  ReceiptMovement,
} from "@/lib/domain/inventory";
import type { StockChannel } from "@/lib/domain/stock";

export const MARKETPLACE_SOURCES = [
  "SIMULATOR",
  "CSV_IMPORT",
  "SHOPEE",
  "TIKTOK",
] as const;

export const MARKETPLACE_EVENT_TYPES = [
  "ORDER_CREATED",
  "ORDER_SHIPPED",
  "ORDER_CANCELLED",
] as const;

export const MARKETPLACE_PROCESSING_STATUSES = [
  "RECEIVED",
  "APPLIED",
  "DUPLICATE",
  "REJECTED",
] as const;

export const MARKETPLACE_ORDER_STATUSES = [
  "RESERVED",
  "SHIPPED",
  "IN_TRANSIT",
  "PARTIALLY_CANCELLED",
  "CANCELLED",
] as const;

export type MarketplaceSource = (typeof MARKETPLACE_SOURCES)[number];
export type MarketplaceEventType = (typeof MARKETPLACE_EVENT_TYPES)[number];
export type MarketplaceProcessingStatus =
  (typeof MARKETPLACE_PROCESSING_STATUSES)[number];
export type MarketplaceOrderStatus =
  (typeof MARKETPLACE_ORDER_STATUSES)[number];
export type MarketplaceChannel = Extract<StockChannel, "SHOPEE" | "TIKTOK">;

export type CanonicalMarketplaceItem = {
  external_line_id: string;
  listing_sku?: string;
  quantity: number;
};

export type CanonicalMarketplaceEvent = {
  source: MarketplaceSource;
  external_event_id: string;
  channel: MarketplaceChannel;
  event_type: MarketplaceEventType;
  external_order_id: string;
  occurred_at: string;
  items: CanonicalMarketplaceItem[];
  raw_payload?: unknown;
};

export type MarketplaceListing = {
  id: string;
  channel: MarketplaceChannel;
  listing_sku: string;
  listing_type: "PHYSICAL" | "BUNDLE";
  product_id: string | null;
  bundle_id: string | null;
  is_active: boolean;
  product: ProductRow | null;
  bundle: BundleRow | null;
};

export type MarketplaceEventRow = {
  id: string;
  source: MarketplaceSource;
  external_event_id: string;
  channel: MarketplaceChannel;
  event_type: MarketplaceEventType;
  external_order_id: string;
  processing_status: MarketplaceProcessingStatus;
  business_command_id: string | null;
  error_code: string | null;
  error_message: string | null;
  occurred_at: string;
  received_at: string;
  processed_at: string | null;
};

export type MarketplaceEventAttemptRow = {
  id: string;
  marketplace_event_id: string;
  attempt_no: number;
  processing_status: MarketplaceProcessingStatus;
  error_code: string | null;
  error_message: string | null;
  received_at: string;
  processed_at: string | null;
};

export type EventInboxEntry = MarketplaceEventAttemptRow & {
  event: MarketplaceEventRow | null;
};

export type OrderRow = {
  id: string;
  external_order_id: string;
  channel: MarketplaceChannel;
  status: MarketplaceOrderStatus;
  created_event_id: string;
  last_event_id: string;
  ordered_at: string;
  shipped_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  external_line_id: string;
  listing_sku: string;
  listing_type: "PHYSICAL" | "BUNDLE";
  ordered_qty: number;
  reserved_qty: number;
  shipped_qty: number;
  cancelled_qty: number;
  returned_qty: number;
  created_at: string;
  updated_at: string;
};

export type OrderComponentRow = {
  id: string;
  order_item_id: string;
  product_id: string;
  component_type: "PRIMARY" | "BUNDLE_COMPONENT" | "PROMO";
  qty_per_item: number;
  ordered_component_qty: number;
  reserved_qty: number;
  shipped_qty: number;
  cancelled_qty: number;
  recipe_version_id: string | null;
  promo_rule_id: string | null;
  snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type OrderComponent = OrderComponentRow & {
  product: ProductRow | null;
};

export type OrderItem = OrderItemRow & {
  components: OrderComponent[];
};

export type MarketplaceOrder = OrderRow & {
  items: OrderItem[];
};

export type BundleRow = {
  id: string;
  sku: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BundleRecipeVersionRow = {
  id: string;
  bundle_id: string;
  version: number;
  effective_from: string;
  created_at: string;
};

export type BundleRecipeComponentRow = {
  id: string;
  recipe_version_id: string;
  product_id: string;
  qty: number;
  created_at: string;
};

export type BundleConfiguration = BundleRow & {
  activeRecipe: (BundleRecipeVersionRow & {
    components: Array<BundleRecipeComponentRow & { product: ProductRow | null }>;
  }) | null;
};

export type PromoRuleRow = {
  id: string;
  name: string;
  start_at: string;
  end_at: string;
  channel: MarketplaceChannel;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PromoRuleItemRow = {
  id: string;
  promo_rule_id: string;
  trigger_product_id: string;
  trigger_qty: number;
  free_product_id: string;
  free_qty: number;
  created_at: string;
};

export type PromoConfiguration = PromoRuleRow & {
  items: Array<
    PromoRuleItemRow & {
      triggerProduct: ProductRow | null;
      freeProduct: ProductRow | null;
    }
  >;
};

export type MarketplaceReceiptOrderItem = {
  id: string;
  external_line_id: string;
  listing_sku: string;
  listing_type: "PHYSICAL" | "BUNDLE";
  ordered_qty: number;
  reserved_qty: number;
  shipped_qty: number;
  cancelled_qty: number;
  components: Array<{
    id: string;
    product_id: string;
    product_sku: string;
    product_name: string;
    component_type: "PRIMARY" | "BUNDLE_COMPONENT" | "PROMO";
    ordered_qty: number;
    reserved_qty: number;
    shipped_qty: number;
    cancelled_qty: number;
    snapshot: Record<string, unknown>;
  }>;
};

export type MarketplaceEventReceipt = CommandReceipt & {
  movements: ReceiptMovement[];
  event: {
    id: string;
    source: MarketplaceSource;
    external_event_id: string;
    channel: MarketplaceChannel;
    event_type: MarketplaceEventType;
    external_order_id: string;
    processing_status: MarketplaceProcessingStatus;
    occurred_at: string;
    received_at: string;
    processed_at: string | null;
  };
  order: null | {
    id: string;
    external_order_id: string;
    channel: MarketplaceChannel;
    status: MarketplaceOrderStatus;
    ordered_at: string;
    shipped_at: string | null;
    cancelled_at: string | null;
    items: MarketplaceReceiptOrderItem[];
  };
};

export type CsvPreviewRow = {
  row: number;
  valid: boolean;
  message: string | null;
  external_event_id: string;
  external_order_id: string;
};

export type CsvMarketplacePreview = {
  events: CanonicalMarketplaceEvent[];
  rows: CsvPreviewRow[];
  valid: boolean;
  summary: {
    rowCount: number;
    eventCount: number;
    validRowCount: number;
    invalidRowCount: number;
  };
};

const csvColumns = [
  "external_event_id",
  "channel",
  "event_type",
  "external_order_id",
  "occurred_at",
  "external_line_id",
  "listing_sku",
  "quantity",
] as const;

function parseCsvRecords(input: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      record.push(value.trim());
      value = "";
    } else if (character === "\n") {
      record.push(value.trim());
      if (record.some((entry) => entry.length > 0)) {
        records.push(record);
      }
      record = [];
      value = "";
    } else if (character !== "\r") {
      value += character;
    }
  }

  if (quoted) {
    throw new Error("CSV memiliki tanda kutip yang belum ditutup.");
  }

  record.push(value.trim());
  if (record.some((entry) => entry.length > 0)) {
    records.push(record);
  }

  return records;
}

export function previewMarketplaceCsv(input: string): CsvMarketplacePreview {
  if (!input.trim()) {
    throw new Error("Isi CSV wajib diisi.");
  }

  const records = parseCsvRecords(input);
  if (records.length < 2) {
    throw new Error("CSV harus mempunyai header dan minimal satu baris data.");
  }

  const headers = records[0].map((header) => header.trim().toLowerCase());
  const missing = csvColumns.filter((column) => !headers.includes(column));
  if (missing.length) {
    throw new Error(`Kolom CSV belum lengkap: ${missing.join(", ")}.`);
  }

  const grouped = new Map<string, CanonicalMarketplaceEvent>();
  const rows: CsvPreviewRow[] = [];

  records.slice(1).forEach((values, rowIndex) => {
    const object = Object.fromEntries(
      headers.map((header, index) => [header, values[index]?.trim() ?? ""]),
    );
    const rowNumber = rowIndex + 2;
    let message: string | null = null;

    const channel = object.channel?.toUpperCase();
    const eventType = object.event_type?.toUpperCase();
    const quantity = Number(object.quantity);
    const occurredAt = new Date(object.occurred_at);

    if (!object.external_event_id) {
      message = "external_event_id wajib diisi.";
    } else if (channel !== "SHOPEE" && channel !== "TIKTOK") {
      message = "channel harus SHOPEE atau TIKTOK.";
    } else if (
      !MARKETPLACE_EVENT_TYPES.includes(eventType as MarketplaceEventType)
    ) {
      message = "event_type tidak didukung.";
    } else if (!object.external_order_id) {
      message = "external_order_id wajib diisi.";
    } else if (Number.isNaN(occurredAt.getTime())) {
      message = "occurred_at tidak valid.";
    } else if (
      eventType !== "ORDER_SHIPPED" &&
      (!object.external_line_id ||
        !Number.isSafeInteger(quantity) ||
        quantity <= 0)
    ) {
      message = "Line ID dan quantity positif wajib diisi.";
    } else if (eventType === "ORDER_CREATED" && !object.listing_sku) {
      message = "listing_sku wajib untuk ORDER_CREATED.";
    }

    rows.push({
      row: rowNumber,
      valid: !message,
      message,
      external_event_id: object.external_event_id ?? "",
      external_order_id: object.external_order_id ?? "",
    });

    if (message) {
      return;
    }

    const key = object.external_event_id;
    const existing = grouped.get(key);
    const item: CanonicalMarketplaceItem | null =
      eventType === "ORDER_SHIPPED"
        ? null
        : {
            external_line_id: object.external_line_id,
            ...(eventType === "ORDER_CREATED"
              ? { listing_sku: object.listing_sku.toUpperCase() }
              : {}),
            quantity,
          };

    if (existing) {
      if (
        existing.channel !== channel ||
        existing.event_type !== eventType ||
        existing.external_order_id !== object.external_order_id ||
        existing.occurred_at !== occurredAt.toISOString()
      ) {
        const conflict = rows[rows.length - 1];
        conflict.valid = false;
        conflict.message =
          "Baris dengan event ID yang sama memiliki metadata berbeda.";
        return;
      }
      if (item) {
        existing.items.push(item);
      }
      return;
    }

    grouped.set(key, {
      source: "CSV_IMPORT",
      external_event_id: object.external_event_id,
      channel: channel as MarketplaceChannel,
      event_type: eventType as MarketplaceEventType,
      external_order_id: object.external_order_id,
      occurred_at: occurredAt.toISOString(),
      items: item ? [item] : [],
      raw_payload: object,
    });
  });

  const valid = rows.every((row) => row.valid);
  return {
    events: valid ? Array.from(grouped.values()) : [],
    rows,
    valid,
    summary: {
      rowCount: rows.length,
      eventCount: valid ? grouped.size : 0,
      validRowCount: rows.filter((row) => row.valid).length,
      invalidRowCount: rows.filter((row) => !row.valid).length,
    },
  };
}

export function marketplaceEventLabel(type: MarketplaceEventType): string {
  const labels: Record<MarketplaceEventType, string> = {
    ORDER_CREATED: "Order dibuat",
    ORDER_SHIPPED: "Capai titik pengiriman",
    ORDER_CANCELLED: "Order dibatalkan",
  };
  return labels[type];
}

export function marketplaceOrderStatusLabel(
  status: MarketplaceOrderStatus,
): string {
  const labels: Record<MarketplaceOrderStatus, string> = {
    RESERVED: "Direservasi",
    SHIPPED: "Dikirim",
    IN_TRANSIT: "Dalam perjalanan",
    PARTIALLY_CANCELLED: "Batal sebagian",
    CANCELLED: "Dibatalkan",
  };
  return labels[status];
}

export function marketplaceProcessingStatusLabel(
  status: MarketplaceProcessingStatus,
): string {
  const labels: Record<MarketplaceProcessingStatus, string> = {
    RECEIVED: "Diterima",
    APPLIED: "Diproses",
    DUPLICATE: "Duplikat diabaikan",
    REJECTED: "Ditolak",
  };
  return labels[status];
}

export function listingTypeLabel(
  type: OrderItemRow["listing_type"],
): string {
  return type === "BUNDLE" ? "Bundle" : "Produk";
}

export function componentTypeLabel(
  type: OrderComponentRow["component_type"],
): string {
  const labels: Record<OrderComponentRow["component_type"], string> = {
    PRIMARY: "Produk utama",
    BUNDLE_COMPONENT: "Komponen bundle",
    PROMO: "Bonus promo",
  };
  return labels[type];
}
